// Gateway Forward handler: capture what the subject sent and received.
//
// Rules (from the design review):
//  1. The page always wins. Nothing here may break or delay the user's response.
//     Any capture error falls back to the original request/response.
//  2. Bodies go straight to R2; only a small summary goes through the Queue.
//  3. Bodies are capped (MAX_CAPTURE_BYTES). Anything cut off or lost is written
//     to the ledger as a gap, never silently dropped.

import { activeCaseFor, maxBytes, ledger } from "./config.js";
import {
  captureHeaders,
  classifySend,
  extractTitle,
  isNavigation,
  maybeDecompress,
  redactBody,
  sha256Hex,
} from "./util.js";

const NO_BODY_STATUS = new Set([101, 204, 205, 304]);
const MAX_MESSAGE_CHARS = 120_000; // Queue messages are limited to ~128 KB.

export async function handleGateway(request, context, next, env, ctx) {
  let plan = null;
  try {
    plan = await planCapture(request, context, env);
  } catch (err) {
    console.error("capture plan failed", String(err));
  }
  if (!plan) return next(request);

  const startedAt = Date.now();

  // Tee the request body so the upstream upload streams normally while we read a
  // capped copy in parallel.
  let upstream = request;
  let sentPromise = null;
  if (plan.captureSent && request.body) {
    try {
      const [toOrigin, toCapture] = request.body.tee();
      upstream = new Request(request, { body: toOrigin });
      sentPromise = readCapped(toCapture, plan.cap);
      ctx.waitUntil(sentPromise.catch(() => {}));
    } catch (err) {
      plan.gaps.push(`request body not captured: ${String(err)}`);
    }
  }

  let response;
  try {
    response = await next(upstream);
  } catch (err) {
    // Upstream failure: behave exactly as Gateway would, but record the gap.
    ctx.waitUntil(recordGap(env, plan, request, startedAt, `upstream request failed: ${String(err)}`).catch(() => {}));
    throw err;
  }

  try {
    let out = response;
    let bodyPromise = null;
    if (response.body && request.method !== "HEAD" && !NO_BODY_STATUS.has(response.status)) {
      const [toUser, toCapture] = response.body.tee();
      out = new Response(toUser, response);
      bodyPromise = readCapped(toCapture, plan.cap);
    }
    ctx.waitUntil(
      persist(env, plan, request, response, startedAt, sentPromise, bodyPromise).catch(async (err) => {
        console.error("persist failed", String(err));
        await recordGap(env, plan, request, startedAt, `capture failed: ${String(err)}`).catch(() => {});
      }),
    );
    return out;
  } catch (err) {
    console.error("capture setup failed", String(err));
    ctx.waitUntil(recordGap(env, plan, request, startedAt, `capture setup failed: ${String(err)}`).catch(() => {}));
    return response;
  }
}

async function planCapture(request, context, env) {
  const url = new URL(request.url);
  if (env.EVIDENCE_HOST && url.hostname === env.EVIDENCE_HOST) return null;

  let identity = null;
  try {
    identity = await context.identity();
  } catch (err) {
    console.error("identity lookup failed; request not captured", String(err));
    return null;
  }
  const c = activeCaseFor(env, identity?.email);
  if (!c) return null;

  return {
    caseId: c.id,
    captureSent: c.captureSent,
    cap: maxBytes(env),
    captureId: crypto.randomUUID(),
    subject: { email: identity.email, name: identity.name || null },
    gateway: {
      srcIp: context.srcIp,
      internalSrcIp: context.internalSrcIp,
      sni: context.sni,
      host: context.host,
      uri: context.uri,
      dstIp: context.dstIp,
      policyId: context.policyId,
      onrampType: context.onrampType,
    },
    gaps: [],
  };
}

async function readCapped(stream, cap) {
  const reader = stream.getReader();
  const chunks = [];
  let kept = 0;
  let total = 0;
  let truncated = false;
  let error = null;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (kept < cap) {
        const room = cap - kept;
        const part = value.byteLength > room ? value.subarray(0, room) : value;
        chunks.push(part);
        kept += part.byteLength;
      }
      if (total > cap) {
        truncated = true;
        // Cancelling our branch stops the tee from buffering for us.
        await reader.cancel("capture cap reached").catch(() => {});
        break;
      }
    }
  } catch (err) {
    truncated = true;
    error = String(err);
  }
  const bytes = new Uint8Array(kept);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.byteLength;
  }
  return { bytes, total, truncated, error };
}

async function storeBody(env, key, bytes, contentType, caseId, gaps, label) {
  const sha256 = await sha256Hex(bytes);
  if (!bytes.byteLength) return { key: null, sha256, storedBytes: 0, contentType };
  try {
    await env.EVIDENCE.put(key, bytes, {
      httpMetadata: { contentType: contentType || "application/octet-stream" },
      customMetadata: { sha256, caseId },
    });
    return { key, sha256, storedBytes: bytes.byteLength, contentType };
  } catch (err) {
    gaps.push(`${label} body not stored: ${String(err)}`);
    return { key: null, sha256, storedBytes: 0, contentType };
  }
}

async function persist(env, plan, request, response, startedAt, sentPromise, bodyPromise) {
  const gaps = [...plan.gaps];
  const prefix = `cases/${plan.caseId}/${plan.captureId}`;
  const reqType = request.headers.get("content-type") || "";
  const resType = response.headers.get("content-type") || "";
  const disposition = response.headers.get("content-disposition") || "";
  const nav = isNavigation(request);

  let sent = null;
  if (sentPromise) {
    const r = await sentPromise;
    if (r.total > 0) {
      const { bytes, redaction } = redactBody(r.bytes, reqType);
      sent = await storeBody(env, `${prefix}/request.bin`, bytes, reqType, plan.caseId, gaps, "request");
      Object.assign(sent, { totalBytes: r.total, truncated: r.truncated, redaction });
      if (r.truncated) {
        gaps.push(
          r.error
            ? `request body incomplete (stream ended early after ${r.total} bytes)`
            : `request body cut off at ${plan.cap} bytes`,
        );
      }
    }
  }

  let received = null;
  let title = null;
  if (bodyPromise) {
    const r = await bodyPromise;
    received = await storeBody(env, `${prefix}/response.bin`, r.bytes, resType, plan.caseId, gaps, "response");
    Object.assign(received, { totalBytes: r.total, truncated: r.truncated });
    if (r.truncated) {
      gaps.push(
        r.error
          ? `response incomplete (stream ended early after ${r.total} bytes)`
          : `response cut off at ${plan.cap} bytes`,
      );
    }
    if (nav) {
      try {
        title = extractTitle(await maybeDecompress(r.bytes, response.headers.get("content-encoding")), resType);
      } catch {
        title = null;
      }
    }
  }

  const isRedirect = response.status >= 300 && response.status < 400;
  const download = nav && !isRedirect && (/attachment/i.test(disposition) || (resType && !/html/i.test(resType)));

  const record = {
    type: "capture",
    caseId: plan.caseId,
    captureId: plan.captureId,
    ts: startedAt,
    durationMs: Date.now() - startedAt,
    subject: plan.subject,
    gateway: plan.gateway,
    nav: nav && !isRedirect,
    navRedirect: nav && isRedirect,
    download,
    sent: classifySend(request, sent),
    request: {
      method: request.method,
      url: request.url,
      referer: request.headers.get("referer"),
      fetch: {
        mode: request.headers.get("sec-fetch-mode"),
        dest: request.headers.get("sec-fetch-dest"),
        site: request.headers.get("sec-fetch-site"),
        user: request.headers.get("sec-fetch-user"),
      },
      headers: captureHeaders(request.headers),
      body: sent,
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      contentType: resType,
      disposition: disposition || null,
      headers: captureHeaders(response.headers),
      body: received,
      title,
    },
    gaps,
  };

  await enqueue(env, record);
}

async function recordGap(env, plan, request, ts, reason) {
  await enqueue(env, {
    type: "gap",
    caseId: plan.caseId,
    captureId: `${plan.captureId}:gap`,
    ts,
    subject: plan.subject,
    request: { method: request.method, url: request.url },
    gaps: [reason],
  });
}

async function enqueue(env, record) {
  if (JSON.stringify(record).length > MAX_MESSAGE_CHARS) {
    const keep = ["content-type", "content-encoding", "content-length", "content-disposition", "user-agent", "referer", "location"];
    for (const side of ["request", "response"]) {
      const h = record[side]?.headers;
      if (!h) continue;
      record[side].headers = Object.fromEntries(Object.entries(h).filter(([k]) => keep.includes(k)));
    }
    record.gaps.push("headers trimmed to fit the queue message limit");
  }
  try {
    await env.CAPTURE_QUEUE.send(record);
  } catch (err) {
    // Fall back to writing straight to the ledger so the record is not lost.
    console.error("queue send failed, writing to ledger directly", String(err));
    record.gaps.push(`queue unavailable, written directly: ${String(err)}`);
    await ledger(env, record.caseId).append([record]);
  }
}
