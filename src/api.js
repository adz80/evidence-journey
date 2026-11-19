// Evidence UI + API on EVIDENCE_HOST. Every request must carry a valid Access JWT.
// The API cannot change evidence. Its writes are append-only reconstruction and
// access (audit) records, plus one PoC-only exception: POST .../reset clears a
// case whose config has allowReset: true (never set on a real case).

import { currentColo, findCase, getCases, isActive, ledger, ledgerByName } from "./config.js";
import { verifyAccess } from "./access.js";
import { renderVisit } from "./render.js";
import { serveAsset } from "./assets.js";
import { HttpError, isTextual, json } from "./util.js";

const PREVIEW_BYTES = 4096;
const MAX_PREVIEWS = 20;

export async function handleApi(request, env) {
  let actor;
  try {
    actor = await verifyAccess(request, env);
  } catch (err) {
    return json({ error: "Unauthorized", detail: err.message }, 401);
  }

  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return serveAsset(request, env);
  // The only write: POST /api/cases/:id/reset, for PoC cases with allowReset.
  const isReset = request.method === "POST" && /^\/api\/cases\/[^/]+\/reset$/.test(url.pathname);
  if (!isReset && request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed" }, 405);

  try {
    if (isReset) return await resetCase(request, url, env, actor);
    return await route(url, env, actor);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error("api error", err?.stack || String(err));
    return json({ error: err.message || "Internal error" }, status);
  }
}

async function route(url, env, actor) {
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent); // ["api", ...]

  if (parts.length === 2 && parts[1] === "me") return json({ actor });

  // GET /api/placement — where the API Worker and each case ledger are running.
  if (parts.length === 2 && parts[1] === "placement") {
    const ledgers = {};
    for (const c of getCases(env)) {
      ledgers[c.id] = {
        name: c.ledgerName,
        colo: await ledger(env, c.id).where().then((w) => w.colo, (e) => "error: " + e.message),
      };
    }
    return json({
      workerColo: await currentColo(),
      placementRegion: env.PLACEMENT_REGION || null,
      ledgerLocationHint: env.LEDGER_LOCATION_HINT || null,
      bucket: env.EVIDENCE_BUCKET_NAME || null,
      ledgers,
    });
  }

  if (parts.length === 2 && parts[1] === "cases") {
    return json({
      cases: getCases(env).map((c) => ({
        id: c.id,
        title: c.title,
        subject: c.subject,
        start: Number.isFinite(c.start) ? new Date(c.start).toISOString() : null,
        end: Number.isFinite(c.end) ? new Date(c.end).toISOString() : null,
        captureSent: c.captureSent,
        allowReset: c.allowReset,
        active: isActive(c),
      })),
    });
  }

  if (parts[1] !== "cases" || parts.length < 4) throw new HttpError(404, "Not found");
  const caseId = parts[2];
  const c = findCase(env, caseId);
  if (!c) throw new HttpError(404, "Unknown case");
  const lg = ledger(env, caseId);

  // GET /api/cases/:id/journey
  if (parts.length === 4 && parts[3] === "journey") {
    return json(await lg.journey());
  }

  // GET /api/cases/:id/verify?from=1
  if (parts.length === 4 && parts[3] === "verify") {
    const from = Number(url.searchParams.get("from") || "1");
    if (from <= 1) await lg.appendEvent(caseId, "access", { actor, action: "verify-chain" });
    return json(await lg.verify(from, Number(url.searchParams.get("limit") || "200")));
  }

  const seq = Number(parts[4]);
  if (!Number.isInteger(seq) || seq < 1) throw new HttpError(400, "Bad record number");

  // GET /api/cases/:id/records/:seq
  if (parts.length === 5 && parts[3] === "records") {
    const rec = await lg.record(seq);
    if (!rec) throw new HttpError(404, "No such record");
    await lg.appendEvent(caseId, "access", { actor, action: "view-record", seq });
    if (rec.data?.request?.body) rec.data.request.body.preview = await preview(env, rec.data.request.body);
    if (rec.related?.sends) {
      let n = 0;
      for (const s of rec.related.sends) {
        if (n >= MAX_PREVIEWS) break;
        s.preview = await preview(env, s);
        n++;
      }
    }
    return json(rec);
  }

  // GET /api/cases/:id/visits/:seq/screenshot
  if (parts.length === 6 && parts[3] === "visits" && parts[5] === "screenshot") {
    const { body, meta } = await renderVisit(env, caseId, seq, actor);
    const headers = {
      "content-type": "image/jpeg",
      "cache-control": "no-store",
      "x-evidence-sha256": meta.sha256 || "",
      "x-evidence-replayed": meta.replayed || "0",
      "x-evidence-approximate": meta.approximate || "0",
      "x-evidence-missing": meta.missing || "0",
      "x-evidence-rendered-at": meta.renderedAt || "",
      "x-evidence-browser": meta.browser || "",
      "x-evidence-viewport": meta.viewport || "",
      "x-evidence-cached": meta.cached || "false",
      "x-evidence-key": meta.key || "",
    };
    if (meta.chainSeq) headers["x-evidence-chain-seq"] = meta.chainSeq;
    return new Response(body, { headers });
  }

  throw new HttpError(404, "Not found");
}

// PoC reset: delete every stored object for the case (bodies and reconstructions)
// and clear its ledger. Requires {"confirm": "<caseId>"} and allowReset on the case.
async function resetCase(request, url, env, actor) {
  const caseId = decodeURIComponent(url.pathname.split("/")[3]);
  const c = findCase(env, caseId);
  if (!c) throw new HttpError(404, "Unknown case");
  if (!c.allowReset) throw new HttpError(403, "This case cannot be cleared");
  // Browsers send Origin on POST; only accept our own page (the gadget server sends none).
  const origin = request.headers.get("origin");
  if (origin && origin !== `https://${env.EVIDENCE_HOST}`) throw new HttpError(403, "Cross-site request refused");
  if (!(request.headers.get("content-type") || "").includes("application/json")) throw new HttpError(415, "Send JSON");
  let body = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if (body?.confirm !== caseId) throw new HttpError(400, `To clear this case, send {"confirm": "${caseId}"}`);
  const at = Date.now();
  const deletedObjects = await deletePrefix(env, `cases/${caseId}/`, at);
  const r = await ledger(env, caseId).reset(caseId, { actor, at, deletedObjects });
  const purgedLedgers = {};
  for (const name of c.retiredLedgers) {
    if (name === c.ledgerName) continue;
    purgedLedgers[name] = await ledgerByName(env, name).purge().then(() => "wiped", (e) => "error: " + e.message);
  }
  console.log(`case ${caseId} cleared by ${actor.type}:${actor.id}: ${r.deletedRecords} records, ${deletedObjects} objects`);
  return json({ ok: true, deletedRecords: r.deletedRecords, deletedObjects, purgedLedgers, at: new Date(at).toISOString() });
}

// Deletes objects under prefix uploaded before `before` (later uploads belong to new captures).
async function deletePrefix(env, prefix, before) {
  let cursor;
  let n = 0;
  do {
    const page = await env.EVIDENCE.list({ prefix, cursor, limit: 1000 });
    const keys = page.objects.filter((o) => o.uploaded.getTime() < before).map((o) => o.key);
    if (keys.length) {
      await env.EVIDENCE.delete(keys);
      n += keys.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return n;
}

async function preview(env, body) {
  if (!body?.key || !isTextual(body.contentType)) return null;
  try {
    const obj = await env.EVIDENCE.get(body.key, { range: { offset: 0, length: PREVIEW_BYTES } });
    if (!obj) return null;
    return new TextDecoder().decode(await obj.arrayBuffer());
  } catch {
    return null;
  }
}
