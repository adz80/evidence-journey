// Render a JPEG reconstruction of a page visit by replaying captured responses in
// Browser Run. The browser NEVER visits the live site:
//   1. The session is launched with guardrails { allowedDomains: [] }, which blocks
//      every real HTTP/HTTPS request at the Browser Run network layer.
//   2. Every request is intercepted (CDP Fetch domain) and answered from R2, or failed.
// The JPEG is hashed, stored, and recorded in the chain.
//
// Uses raw Chrome DevTools Protocol over the Browser binding (no npm dependency).

import { Buffer } from "node:buffer";
import { ledger } from "./config.js";
import { HttpError, decodeBody, sha256Hex } from "./util.js";

// Bump when the renderer changes so earlier (possibly wrong) renders are not reused.
// Old renders stay in storage and in the chain.
const RENDER_VERSION = "v2";

const VIEWPORT = { width: 1440, height: 900 };
const MAX_HEIGHT = 6000;
const JPEG_QUALITY = 80;
const NAV_TIMEOUT_MS = 30_000;
const IDLE_MS = 700;
const IDLE_MAX_MS = 10_000;
const STRIP_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "set-cookie",
  "strict-transport-security",
  "alt-svc",
  "connection",
  "keep-alive",
]);

const BLOCK_LIVE_CONNECTIONS = `(() => {
  const blocked = function () { throw new Error("Network access is blocked during evidence replay"); };
  try { window.WebSocket = blocked; } catch (e) {}
  try { window.RTCPeerConnection = blocked; window.webkitRTCPeerConnection = blocked; } catch (e) {}
  try { window.EventSource = blocked; } catch (e) {}
})();`;

export async function renderVisit(env, caseId, seq, actor) {
  const lg = ledger(env, caseId);
  const visit = await lg.record(seq);
  if (!visit || visit.kind !== "capture" || !visit.data.nav) throw new HttpError(404, "Not a page visit");
  if (visit.data.download) throw new HttpError(409, "This visit was a file download; there is no page to reconstruct");

  const key = `cases/${caseId}/renders/${RENDER_VERSION}/${seq}.jpg`;
  const existing = await env.EVIDENCE.get(key);
  if (existing) {
    await lg.appendEvent(caseId, "access", { actor, action: "view-reconstruction", visitSeq: seq });
    return { body: existing.body, meta: { ...existing.customMetadata, cached: "true" } };
  }

  const resources = await lg.resourcesForReplay(seq);
  const result = await replay(env, visit, resources);
  const sha256 = await sha256Hex(result.jpeg);
  const meta = {
    sha256,
    replayed: String(result.replayed),
    approximate: String(result.approximate),
    missing: String(result.missing),
    renderedAt: new Date().toISOString(),
    browser: result.browserVersion,
    viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
    visitSeq: String(seq),
  };
  await env.EVIDENCE.put(key, result.jpeg, { httpMetadata: { contentType: "image/jpeg" }, customMetadata: meta });
  const ev = await lg.appendEvent(caseId, "reconstruction", {
    visitSeq: seq,
    key,
    ...meta,
    missingUrls: result.missingUrls.slice(0, 50),
    actor,
    label: "Reconstruction rendered offline from captured responses. Not a screenshot of the user's screen.",
  });
  return { body: result.jpeg, meta: { ...meta, cached: "false", chainSeq: String(ev.seq) } };
}

// ---------- matching captured responses to replay requests ----------

function stripHash(u) {
  const i = u.indexOf("#");
  return i === -1 ? u : u.slice(0, i);
}

function pathKey(method, u) {
  try {
    const x = new URL(u);
    return `${method} ${x.origin}${x.pathname}`;
  } catch {
    return null;
  }
}

function buildIndex(resources) {
  const exact = new Map();
  const byPath = new Map();
  for (const r of resources) {
    const k = `${r.method} ${stripHash(r.url)}`;
    if (!exact.has(k)) exact.set(k, []);
    exact.get(k).push(r);
    const p = pathKey(r.method, r.url);
    if (p) {
      if (!byPath.has(p)) byPath.set(p, []);
      byPath.get(p).push(r);
    }
  }
  return { exact, byPath };
}

// Prefer the capture closest in time at/after the visit started.
function pick(list, visitTs) {
  let best = null;
  let bestScore = Infinity;
  for (const r of list) {
    const d = r.ts - visitTs;
    const score = d >= -2000 ? Math.abs(d) : 1e12 + Math.abs(d);
    if (score < bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

function lookup(index, method, url, visitTs) {
  const e = index.exact.get(`${method} ${stripHash(url)}`);
  if (e?.length) return { res: pick(e, visitTs), approx: false };
  const p = pathKey(method, url);
  const f = p && index.byPath.get(p);
  if (f?.length) return { res: pick(f, visitTs), approx: true };
  return null;
}

function replayHeaders(h) {
  const out = [];
  for (const [k, v] of Object.entries(h || {})) {
    if (STRIP_HEADERS.has(k) || String(v).includes("[redacted]")) continue;
    out.push({ name: k, value: String(v) });
  }
  return out;
}

// ---------- minimal CDP client ----------

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    socket.addEventListener("message", (ev) => this.#onMessage(ev));
    socket.addEventListener("close", () => this.#failAll(new Error("Browser connection closed")));
    socket.addEventListener("error", () => this.#failAll(new Error("Browser connection error")));
  }

  #failAll(err) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  #onMessage(ev) {
    let m;
    try {
      m = JSON.parse(typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data));
    } catch {
      return;
    }
    if (m.id != null) {
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      clearTimeout(p.timer);
      if (m.error) p.reject(new Error(`${p.method}: ${m.error.message}`));
      else p.resolve(m.result || {});
      return;
    }
    const list = m.method && this.handlers.get(m.method);
    if (list) for (const fn of list) fn(m.params || {}, m.sessionId);
  }

  send(method, params = {}, sessionId, timeoutMs = 30_000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      const msg = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      try {
        this.socket.send(JSON.stringify(msg));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- replay ----------

async function replay(env, visit, resources) {
  const index = buildIndex(resources);
  const bodies = new Map();
  const counts = { replayed: 0, approximate: 0, missing: 0 };
  const missingUrls = [];
  let lastActivity = Date.now();
  let inflight = 0;

  // Returns { b64, encoding }. encoding is non-null when the body could not be
  // decoded here; the Content-Encoding header is then passed to the browser.
  async function loadBody(r) {
    if (!r.bodyKey) return { b64: "", encoding: null };
    if (bodies.has(r.bodyKey)) return bodies.get(r.bodyKey);
    const obj = await env.EVIDENCE.get(r.bodyKey);
    let result = { b64: "", encoding: null };
    if (obj) {
      const raw = new Uint8Array(await obj.arrayBuffer());
      const d = await decodeBody(raw, r.headers?.["content-encoding"]);
      result = { b64: Buffer.from(d.bytes).toString("base64"), encoding: d.decoded ? null : d.encoding };
    }
    bodies.set(r.bodyKey, result);
    return result;
  }

  // Guardrails with an empty allowlist block every real web request from this browser.
  const conn = await env.BROWSER.launch({ keepAlive: 60_000, guardrails: { allowedDomains: [] } });
  let socket;
  try {
    const resp = await conn.webSocket.fetch("https://browser-binding.invalid", { headers: { Upgrade: "websocket" } });
    if (!resp.webSocket) throw new Error("Browser Run did not return a WebSocket");
    socket = resp.webSocket;
    socket.accept();
    const cdp = new Cdp(socket);

    const version = await cdp.send("Browser.getVersion").catch(() => ({}));
    const browserVersion = version.product || "unknown";

    async function answer(params, sid) {
      const { requestId, request } = params;
      const u = request.url;
      lastActivity = Date.now();
      inflight++;
      try {
        if (u.startsWith("data:") || u.startsWith("blob:")) {
          return await cdp.send("Fetch.continueRequest", { requestId }, sid);
        }
        const m = lookup(index, request.method, u, visit.ts);
        if (!m) {
          counts.missing++;
          if (missingUrls.length < 200) missingUrls.push(u);
          return await cdp.send("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }, sid);
        }
        if (m.approx || m.res.truncated || !m.res.bodyKey) counts.approximate++;
        else counts.replayed++;
        const { b64, encoding } = await loadBody(m.res);
        const responseHeaders = replayHeaders(m.res.headers);
        if (encoding) responseHeaders.push({ name: "content-encoding", value: encoding });
        return await cdp.send(
          "Fetch.fulfillRequest",
          { requestId, responseCode: m.res.status || 200, responseHeaders, body: b64 },
          sid,
        );
      } catch {
        await cdp.send("Fetch.failRequest", { requestId, errorReason: "Failed" }, sid).catch(() => {});
      } finally {
        inflight--;
        lastActivity = Date.now();
      }
    }

    // Prepare a target session (the page, or a cross-origin iframe) for replay.
    async function prepare(sid) {
      await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] }, sid);
      await cdp.send("Network.enable", {}, sid).catch(() => {});
      await cdp.send("Network.setBypassServiceWorker", { bypass: true }, sid).catch(() => {});
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: BLOCK_LIVE_CONNECTIONS }, sid).catch(() => {});
      await cdp
        .send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sid)
        .catch(() => {});
    }

    cdp.on("Fetch.requestPaused", (params, sid) => {
      answer(params, sid);
    });
    // Cross-origin iframes run as separate targets: intercept their requests too.
    cdp.on("Target.attachedToTarget", async (params) => {
      const sid = params.sessionId;
      try {
        await prepare(sid);
      } catch {
        /* guardrails still block live requests */
      }
      await cdp.send("Runtime.runIfWaitingForDebugger", {}, sid).catch(() => {});
    });

    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId: page } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, page);
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false },
      page,
    );
    const ua = visit.data.request?.headers?.["user-agent"];
    if (ua) await cdp.send("Emulation.setUserAgentOverride", { userAgent: String(ua) }, page).catch(() => {});
    await prepare(page);

    let loaded;
    const loadPromise = new Promise((r) => (loaded = r));
    cdp.on("Page.loadEventFired", (_p, sid) => {
      if (sid === page) loaded();
    });

    await cdp.send("Page.navigate", { url: visit.data.request.url }, page).catch(() => {});
    await Promise.race([loadPromise, sleep(NAV_TIMEOUT_MS)]);

    // Approximate "network idle": wait until no request has been answered for IDLE_MS.
    const idleStart = Date.now();
    while (Date.now() - idleStart < IDLE_MAX_MS) {
      if (inflight === 0 && Date.now() - lastActivity >= IDLE_MS) break;
      await sleep(150);
    }

    const evalRes = await cdp
      .send(
        "Runtime.evaluate",
        {
          expression:
            "Math.max(document.documentElement ? document.documentElement.scrollHeight : 0, document.body ? document.body.scrollHeight : 0)",
          returnByValue: true,
        },
        page,
      )
      .catch(() => null);
    const height = Number(evalRes?.result?.value) || VIEWPORT.height;
    const clipH = Math.min(Math.max(height, VIEWPORT.height), MAX_HEIGHT);

    const shot = await cdp.send(
      "Page.captureScreenshot",
      {
        format: "jpeg",
        quality: JPEG_QUALITY,
        clip: { x: 0, y: 0, width: VIEWPORT.width, height: clipH, scale: 1 },
        captureBeyondViewport: true,
      },
      page,
      45_000,
    );
    const jpeg = new Uint8Array(Buffer.from(shot.data, "base64"));
    return { jpeg, ...counts, missingUrls, browserVersion };
  } finally {
    try {
      socket?.close();
    } catch {
      /* ignore */
    }
    await env.BROWSER.closeSession(conn.sessionId).catch(() => {});
  }
}
