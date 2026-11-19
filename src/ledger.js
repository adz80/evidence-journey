// CaseLedger: one Durable Object per case. It is the single place that orders
// records, so the hash chain is well defined even when many page parts are
// captured at the same instant.
//
// hash(n) = SHA-256( hash(n-1) + "\n" + canonicalJSON({seq, captureId, kind, ts, data}) )
// with hash(0) = 64 zeros. Record kinds:
//   case-open       first record; snapshot of the case configuration
//   capture         one request/response pair (bodies in R2, hashes here)
//   gap             something that could not be captured, and why
//   reconstruction  a JPEG rendered from captured responses (hash of the JPEG)
//   access          an investigator viewed a record / reconstruction / ran verify

import { DurableObject } from "cloudflare:workers";
import { createHash } from "node:crypto";
import { currentColo, findCase, idleMs } from "./config.js";
import { sha256Hex, stableStringify } from "./util.js";
import { annotateJourney } from "./insights.js";

const GENESIS = "0".repeat(64);
const MAX_TS = Number.MAX_SAFE_INTEGER;

export class CaseLedger extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS records (
        seq INTEGER PRIMARY KEY,
        capture_id TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        ts INTEGER NOT NULL,
        nav INTEGER NOT NULL DEFAULT 0,
        sent INTEGER NOT NULL DEFAULT 0,
        has_gap INTEGER NOT NULL DEFAULT 0,
        method TEXT,
        url TEXT,
        data TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_records_ts ON records(ts);
      CREATE INDEX IF NOT EXISTS idx_records_kind_ts ON records(kind, ts);
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    `);
  }

  #getMeta(k) {
    return this.sql.exec("SELECT v FROM meta WHERE k = ?", k).toArray()[0]?.v ?? null;
  }

  #setMeta(k, v) {
    this.sql.exec("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", k, String(v));
  }

  // PoC only (the API checks the case's allowReset flag). Deletes every ledger
  // record and starts a new chain whose first record says who cleared it and when.
  // Captures stamped before `at` that arrive later from the queue are dropped.
  reset(caseId, info) {
    const at = Number(info?.at) || Date.now();
    let deletedRecords = 0;
    let res;
    this.ctx.storage.transactionSync(() => {
      deletedRecords = this.sql.exec("SELECT COUNT(*) AS n FROM records").toArray()[0].n;
      this.sql.exec("DELETE FROM records");
      this.#setMeta("resetAt", at);
      const cfg = findCase(this.env, caseId);
      const iso = (t) => (Number.isFinite(t) ? new Date(t).toISOString() : null);
      res = this.#insert("case-open", `case-open:${caseId}:${at}`, at, {
        caseId,
        config: cfg ? { ...cfg, start: iso(cfg.start), end: iso(cfg.end) } : null,
        reset: { actor: info?.actor ?? null, at: new Date(at).toISOString(), deletedRecords, deletedObjects: info?.deletedObjects ?? null },
        note: "PoC case data was cleared. A new chain starts here.",
      });
    });
    return { deletedRecords, head: res };
  }

  // ---- writing ------------------------------------------------------------

  #hash(prev, entry) {
    return createHash("sha256").update(prev + "\n" + stableStringify(entry)).digest("hex");
  }

  #last() {
    return this.sql.exec("SELECT seq, hash, ts FROM records ORDER BY seq DESC LIMIT 1").toArray()[0] || null;
  }

  #insert(kind, captureId, ts, data) {
    const last = this.#last();
    const seq = last ? last.seq + 1 : 1;
    const prev = last ? last.hash : GENESIS;
    const hash = this.#hash(prev, { seq, captureId, kind, ts, data });
    const nav = kind === "capture" && data?.nav ? 1 : 0;
    const sent = kind === "capture" ? data?.sent?.level || 0 : 0;
    const hasGap = kind === "gap" || (Array.isArray(data?.gaps) && data.gaps.length > 0) ? 1 : 0;
    this.sql.exec(
      `INSERT INTO records (seq, capture_id, kind, ts, nav, sent, has_gap, method, url, data, prev_hash, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      seq,
      captureId,
      kind,
      ts,
      nav,
      sent,
      hasGap,
      data?.request?.method ?? null,
      data?.request?.url ?? null,
      JSON.stringify(data),
      prev,
      hash,
    );
    return { seq, hash };
  }

  #ensureOpen(caseId) {
    if (this.#last()) return;
    const cfg = findCase(this.env, caseId);
    const iso = (t) => (Number.isFinite(t) ? new Date(t).toISOString() : null);
    this.#insert("case-open", `case-open:${caseId}`, Date.now(), {
      caseId,
      config: cfg ? { ...cfg, start: iso(cfg.start), end: iso(cfg.end) } : null,
      note: "Ledger opened. Each following record is chained to the one before it.",
    });
  }

  // Called by the queue consumer (and as a fallback by the capture path).
  append(records) {
    const out = [];
    const resetAt = Number(this.#getMeta("resetAt") || 0);
    this.ctx.storage.transactionSync(() => {
      for (const r of records) {
        if (!r || !r.captureId || !r.caseId) continue;
        if (resetAt && Number(r.ts) < resetAt) continue; // captured before a PoC reset
        this.#ensureOpen(r.caseId);
        const existing = this.sql.exec("SELECT seq FROM records WHERE capture_id = ?", r.captureId).toArray()[0];
        if (existing) {
          out.push(existing.seq);
          continue;
        }
        const kind = r.type === "gap" ? "gap" : "capture";
        out.push(this.#insert(kind, r.captureId, Number(r.ts) || Date.now(), r).seq);
      }
    });
    return out;
  }

  appendEvent(caseId, kind, data) {
    if (kind !== "reconstruction" && kind !== "access") throw new Error("bad event kind");
    let res;
    this.ctx.storage.transactionSync(() => {
      this.#ensureOpen(caseId);
      res = this.#insert(kind, `${kind}:${crypto.randomUUID()}`, Date.now(), data);
    });
    return res;
  }

  // ---- reading ------------------------------------------------------------

  head() {
    const last = this.#last();
    const count = this.sql.exec("SELECT COUNT(*) AS n FROM records").toArray()[0].n;
    return last ? { seq: last.seq, hash: last.hash, ts: last.ts, count } : { seq: 0, hash: GENESIS, ts: null, count: 0 };
  }

  #row(seq) {
    return this.sql.exec("SELECT * FROM records WHERE seq = ?", seq).toArray()[0] || null;
  }

  journey() {
    const idle = idleMs(this.env);
    const rows = this.sql
      .exec(
        `SELECT seq, kind, ts, nav, sent, has_gap, data FROM records
         WHERE (kind = 'capture' AND (nav = 1 OR sent > 0 OR has_gap = 1)) OR kind = 'gap'
         ORDER BY ts, seq LIMIT 20000`,
      )
      .toArray();
    const rendered = new Set(
      this.sql
        .exec("SELECT json_extract(data, '$.visitSeq') AS v FROM records WHERE kind = 'reconstruction'")
        .toArray()
        .map((r) => Number(r.v)),
    );

    const sessions = [];
    const unattributed = { sends: 0, gaps: 0 };
    let cur = null;
    let lastVisit = null;
    let byUrl = new Map();
    let totals = { visits: 0, sends: 0, gaps: 0, downloads: 0 };

    for (const row of rows) {
      const d = JSON.parse(row.data);
      if (row.kind === "capture" && row.nav) {
        if (!cur || row.ts - cur.end > idle) {
          cur = { id: sessions.length + 1, start: row.ts, end: row.ts, visits: [] };
          sessions.push(cur);
          byUrl = new Map();
        }
        const v = {
          seq: row.seq,
          ts: row.ts,
          url: d.request.url,
          title: d.response?.title || null,
          status: d.response?.status ?? null,
          method: d.request.method,
          download: !!d.download,
          parentSeq: findParent(d.request.referer, byUrl, cur.visits),
          sends: [],
          backgroundSends: 0,
          gaps: (d.gaps || []).length,
          rendered: rendered.has(row.seq),
          policyId: d.gateway?.policyId || null,
          disposition: d.response?.disposition || null,
          sentBytes: 0,
          maxSendBytes: 0,
        };
        if (row.sent === 2) v.sends.push(sendSummary(row, d));
        if (row.sent > 0) addBytes(v, d);
        cur.visits.push(v);
        cur.end = row.ts;
        byUrl.set(stripHash(d.request.url), v);
        lastVisit = v;
        totals.visits++;
        if (v.download) totals.downloads++;
        if (v.gaps) totals.gaps++;
        continue;
      }
      const attach = lastVisit && cur && row.ts - cur.end <= idle ? lastVisit : null;
      if (row.kind === "capture" && row.sent === 2) {
        totals.sends++;
        if (attach) {
          if (attach.sends.length < 50) attach.sends.push(sendSummary(row, d));
          addBytes(attach, d);
          cur.end = Math.max(cur.end, row.ts);
        } else unattributed.sends++;
      } else if (row.kind === "capture" && row.sent === 1) {
        if (attach) {
          attach.backgroundSends++;
          addBytes(attach, d);
        }
      }
      if (row.has_gap) {
        totals.gaps++;
        if (attach) attach.gaps++;
        else unattributed.gaps++;
      }
    }
    const result = { sessions, totals, unattributed, head: this.head() };
    try {
      result.insights = annotateJourney(result, this.env);
    } catch (err) {
      // Never let the detectors break the journey view.
      console.error("annotateJourney failed", err?.stack || String(err));
      result.insights = { error: String(err) };
    }
    return result;
  }

  record(seq) {
    const r = this.#row(seq);
    if (!r) return null;
    const out = {
      seq: r.seq,
      captureId: r.capture_id,
      kind: r.kind,
      ts: r.ts,
      prevHash: r.prev_hash,
      hash: r.hash,
      data: JSON.parse(r.data),
    };
    if (r.kind === "capture" && r.nav) {
      const next = this.sql.exec("SELECT ts FROM records WHERE nav = 1 AND ts > ? ORDER BY ts LIMIT 1", r.ts).toArray()[0];
      const until = Math.min(next ? next.ts : MAX_TS, r.ts + idleMs(this.env));
      const rel = this.sql
        .exec(
          `SELECT seq, ts, kind, sent, has_gap, data FROM records
           WHERE ts >= ? AND ts < ? AND (sent > 0 OR has_gap = 1)
           ORDER BY ts, seq LIMIT 500`,
          r.ts,
          until,
        )
        .toArray();
      const sends = [];
      const gaps = [];
      let backgroundSends = 0;
      for (const x of rel) {
        const d = JSON.parse(x.data);
        if (x.sent === 2) sends.push(sendSummary(x, d));
        else if (x.sent === 1) backgroundSends++;
        if (x.has_gap) gaps.push({ seq: x.seq, ts: x.ts, url: d.request?.url ?? null, reasons: d.gaps || [] });
      }
      out.related = { sends, backgroundSends, gaps, windowEnd: until === MAX_TS ? null : until };
      out.reconstructions = this.sql
        .exec(
          "SELECT seq, ts, data FROM records WHERE kind = 'reconstruction' AND json_extract(data, '$.visitSeq') = ? ORDER BY seq",
          r.seq,
        )
        .toArray()
        .map((x) => ({ seq: x.seq, ts: x.ts, ...JSON.parse(x.data) }));
    }
    return out;
  }

  // Captured responses around a visit, for offline replay.
  resourcesForReplay(seq, windowMs = 120_000) {
    const v = this.#row(seq);
    if (!v) return [];
    return this.sql
      .exec(
        "SELECT seq, ts, method, url, data FROM records WHERE kind = 'capture' AND ts BETWEEN ? AND ? ORDER BY ts LIMIT 3000",
        v.ts - 2000,
        v.ts + windowMs,
      )
      .toArray()
      .map((r) => {
        const d = JSON.parse(r.data);
        return {
          seq: r.seq,
          ts: r.ts,
          method: r.method,
          url: r.url,
          status: d.response?.status ?? 200,
          headers: d.response?.headers ?? {},
          bodyKey: d.response?.body?.key ?? null,
          truncated: !!d.response?.body?.truncated,
        };
      });
  }

  // Where this case's ledger (and its SQLite data) lives.
  async where() {
    return { colo: await currentColo() };
  }

  // PoC only, for a retired ledger: wipe everything this object stores.
  async purge() {
    await this.ctx.storage.deleteAll();
    return { ok: true };
  }

  // ---- verification ---------------------------------------------------------

  // Verifies records [fromSeq, fromSeq+limit). Call repeatedly with nextSeq.
  // Checks: no missing/reordered sequence numbers, each prev_hash links to the
  // previous hash, each hash recomputes from the stored data, and every body or
  // JPEG referenced by a record still exists in R2 with the recorded SHA-256.
  async verify(fromSeq = 1, limit = 200) {
    fromSeq = Math.max(1, Number(fromSeq) || 1);
    limit = Math.min(500, Math.max(1, Number(limit) || 200));
    const head = this.head();
    let prev = GENESIS;
    if (fromSeq > 1) {
      const p = this.#row(fromSeq - 1);
      if (!p) return { ok: false, checked: 0, total: head.seq, failure: { seq: fromSeq - 1, reason: "record is missing from the ledger" } };
      prev = p.hash;
    }
    const rows = this.sql.exec("SELECT * FROM records WHERE seq >= ? ORDER BY seq LIMIT ?", fromSeq, limit).toArray();
    let expected = fromSeq;
    let checked = 0;
    for (const r of rows) {
      if (r.seq !== expected) {
        return fail(head, checked, expected, `record #${expected} is missing (next present record is #${r.seq})`);
      }
      if (r.prev_hash !== prev) return fail(head, checked, r.seq, "does not link to the previous record's hash");
      let data;
      try {
        data = JSON.parse(r.data);
      } catch {
        return fail(head, checked, r.seq, "stored data is not valid JSON");
      }
      const h = this.#hash(prev, { seq: r.seq, captureId: r.capture_id, kind: r.kind, ts: r.ts, data });
      if (h !== r.hash) return fail(head, checked, r.seq, "record contents do not match its hash (altered)");

      for (const ref of objectRefs(r.kind, data)) {
        const obj = await this.env.EVIDENCE.get(ref.key);
        if (!obj) return fail(head, checked, r.seq, `${ref.label} is missing from storage (${ref.key})`);
        const sha = await sha256Hex(await obj.arrayBuffer());
        if (sha !== ref.sha256) return fail(head, checked, r.seq, `${ref.label} in storage does not match its recorded SHA-256`);
      }
      prev = r.hash;
      expected = r.seq + 1;
      checked++;
    }
    const done = expected > head.seq;
    return { ok: true, checked, total: head.seq, nextSeq: done ? null : expected, headHash: done ? head.hash : null };
  }
}

function fail(head, checked, seq, reason) {
  return { ok: false, checked, total: head.seq, failure: { seq, reason } };
}

function objectRefs(kind, data) {
  const refs = [];
  if (kind === "capture") {
    const q = data.request?.body;
    const s = data.response?.body;
    if (q?.key) refs.push({ key: q.key, sha256: q.sha256, label: "request body" });
    if (s?.key) refs.push({ key: s.key, sha256: s.sha256, label: "response body" });
  } else if (kind === "reconstruction" && data.key) {
    refs.push({ key: data.key, sha256: data.sha256, label: "reconstruction JPEG" });
  }
  return refs;
}

function sendSummary(row, d) {
  const b = d.request?.body || {};
  return {
    seq: row.seq,
    ts: row.ts,
    method: d.request?.method,
    url: d.request?.url,
    label: d.sent?.label,
    bytes: b.totalBytes ?? 0,
    storedBytes: b.storedBytes ?? 0,
    truncated: !!b.truncated,
    contentType: b.contentType || null,
    sha256: b.sha256 || null,
    key: b.key || null,
    redaction: b.redaction || null,
    fileNames: b.fileNames || [],
  };
}

function addBytes(v, d) {
  const n = Number(d.request?.body?.totalBytes) || 0;
  v.sentBytes += n;
  if (n > v.maxSendBytes) v.maxSendBytes = n;
}

function stripHash(u) {
  const i = (u || "").indexOf("#");
  return i === -1 ? u : u.slice(0, i);
}

function findParent(referer, byUrl, visits) {
  if (!referer) return null;
  const exact = byUrl.get(stripHash(referer));
  if (exact) return exact.seq;
  let origin;
  try {
    origin = new URL(referer).origin;
  } catch {
    return null;
  }
  for (let i = visits.length - 1; i >= 0; i--) {
    try {
      if (new URL(visits[i].url).origin === origin) return visits[i].seq;
    } catch {
      /* ignore */
    }
  }
  return null;
}
