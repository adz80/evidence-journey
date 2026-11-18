// Evidence UI + API on EVIDENCE_HOST. Every request must carry a valid Access JWT.
// The API cannot change or delete evidence. The only writes it makes are
// append-only: reconstruction records and access (audit) records.

import { findCase, getCases, isActive, ledger } from "./config.js";
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
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed" }, 405);

  try {
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

  if (parts.length === 2 && parts[1] === "cases") {
    return json({
      cases: getCases(env).map((c) => ({
        id: c.id,
        title: c.title,
        subject: c.subject,
        start: Number.isFinite(c.start) ? new Date(c.start).toISOString() : null,
        end: Number.isFinite(c.end) ? new Date(c.end).toISOString() : null,
        captureSent: c.captureSent,
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
    };
    if (meta.chainSeq) headers["x-evidence-chain-seq"] = meta.chainSeq;
    return new Response(body, { headers });
  }

  throw new HttpError(404, "Not found");
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
