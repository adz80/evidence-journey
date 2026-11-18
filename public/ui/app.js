// Shared investigator UI, used by both the gadget and the Worker's web front end.
//
// mountApp(root, api, { mode }) where api provides:
//   status?()                 -> { connected: boolean }        (gadget only)
//   me()                      -> { actor: { type, id } }
//   cases()                   -> { cases: [...] }
//   journey(caseId)           -> { sessions, totals, unattributed, head }
//   record(caseId, seq)       -> ledger record (+ related sends/gaps, reconstructions)
//   screenshot(caseId, seq)   -> { src, meta }
//   verify(caseId, fromSeq)   -> { ok, checked, total, nextSeq, headHash, failure }
//   resetCase(caseId, confirm) -> { ok, deletedRecords, deletedObjects }  (PoC cases with allowReset)

import { injectStyles } from "./styles.js";
import { el, fmtBytes, fmtDateTime, fmtDay, fmtTime, fmtUtc, hostOf, pathOf, plural, shortHash } from "./dom.js";

const POLL_MS = 10_000;

export async function mountApp(root, api, opts = {}) {
  const mode = opts.mode || "web";
  injectStyles(root.ownerDocument || document);
  root.classList.add("ej-root");

  const s = {
    me: null,
    cases: [],
    caseId: null,
    journey: null,
    visitIndex: new Map(),
    selectedSeq: null,
    record: null,
    recordError: null,
    shot: null,
    shotState: "idle",
    shotError: null,
    verify: null,
    bulk: null, // "save all reconstructions" progress
    reset: null, // PoC "clear case data" panel
  };

  // ---- shell ---------------------------------------------------------------
  const caseSelect = el("select", { class: "ej-select", "aria-label": "Case", onchange: (e) => switchCase(e.target.value) });
  const verifyBtn = el("button", { class: "ej-btn", onclick: () => runVerify() }, "Verify chain");
  const verifyPill = el("span", { class: "ej-pill" }, "Chain not checked");
  const whoPill = el("span", { class: "ej-pill" }, "…");
  const top = el(
    "div",
    { class: "ej-top" },
    el("div", { class: "ej-brand" }, el("span", { class: "ej-dot" }), "Insider Risk Incident Response"),
    caseSelect,
    el("div", { class: "ej-spacer" }),
    verifyPill,
    verifyBtn,
    whoPill,
  );
  const banner = el("div", { class: "ej-banner" });
  const summary = el("div", { class: "ej-summary" });
  const list = el("div", { role: "list" });
  const tools = el("div", { class: "ej-tools" });
  const listWrap = el("div", { class: "ej-list" }, summary, tools, list);
  const detail = el("div", { class: "ej-detail" });
  const main = el("div", { class: "ej-main" }, listWrap, detail);
  const shell = el("div", { class: "ej-shell" }, top, banner, main);
  root.replaceChildren(shell);

  // ---- boot ----------------------------------------------------------------
  try {
    if (typeof api.status === "function") {
      const st = await api.status();
      if (!st?.connected) {
        renderSetup();
        return;
      }
    }
    const [me, cases] = await Promise.all([api.me().catch(() => null), api.cases()]);
    s.me = me?.actor || null;
    s.cases = cases?.cases || [];
    whoPill.textContent = s.me ? `${s.me.type === "user" ? "Viewer" : "Service token"}: ${s.me.id}` : "Viewer unknown";
    caseSelect.replaceChildren(
      ...s.cases.map((c) => el("option", { value: c.id }, `${c.title} (${c.id})${c.active ? "" : " · inactive"}`)),
    );
    s.caseId = (s.cases.find((c) => c.active) || s.cases[0])?.id || null;
    if (s.caseId) caseSelect.value = s.caseId;
    renderBanner();
    renderDetail();
    if (s.caseId) await loadJourney();
    else list.replaceChildren(el("div", { class: "ej-empty" }, "No cases configured. Add one to CASES in the Worker configuration and redeploy."));
  } catch (err) {
    showFatal(err);
    return;
  }

  setInterval(poll, POLL_MS);

  // ---- data ----------------------------------------------------------------
  async function loadJourney() {
    try {
      s.journey = await api.journey(s.caseId);
      indexVisits();
      renderSummary();
      renderList();
    } catch (err) {
      list.replaceChildren(el("div", { class: "ej-error" }, `Could not load the journey: ${msg(err)}`));
    }
  }

  async function poll() {
    if (!s.caseId || document.hidden || s.verify?.running) return;
    try {
      const j = await api.journey(s.caseId);
      if (j?.head?.seq !== s.journey?.head?.seq) {
        s.journey = j;
        indexVisits();
        renderSummary();
        renderList();
      }
    } catch {
      /* transient; next poll retries */
    }
  }

  function indexVisits() {
    s.visitIndex = new Map();
    for (const sess of s.journey?.sessions || []) for (const v of sess.visits) s.visitIndex.set(v.seq, v);
  }

  async function switchCase(id) {
    s.caseId = id;
    s.selectedSeq = null;
    s.record = null;
    s.verify = null;
    clearShot();
    renderBanner();
    renderVerify();
    renderDetail();
    list.replaceChildren(el("div", { class: "ej-empty" }, spinner(), "Loading journey…"));
    await loadJourney();
  }

  async function selectVisit(seq) {
    s.selectedSeq = seq;
    s.record = null;
    s.recordError = null;
    clearShot();
    main.classList.add("show-detail");
    renderList();
    renderDetail();
    try {
      const rec = await api.record(s.caseId, seq);
      if (s.selectedSeq !== seq) return;
      s.record = rec;
    } catch (err) {
      if (s.selectedSeq !== seq) return;
      s.recordError = msg(err);
    }
    renderDetail();
    if (s.record?.kind === "capture" && s.record.data?.nav && !s.record.data.download) loadShot(seq);
  }

  async function loadShot(seq) {
    s.shotState = "loading";
    s.shotError = null;
    renderDetail();
    try {
      const shot = await api.screenshot(s.caseId, seq);
      if (s.selectedSeq !== seq) {
        revoke(shot?.src);
        return;
      }
      s.shot = shot;
      s.shotState = "ready";
      const v = s.visitIndex.get(seq);
      if (v) v.rendered = true;
    } catch (err) {
      if (s.selectedSeq !== seq) return;
      s.shotState = "error";
      s.shotError = msg(err);
    }
    renderDetail();
  }

  function clearShot() {
    revoke(s.shot?.src);
    s.shot = null;
    s.shotState = "idle";
    s.shotError = null;
  }

  async function runVerify() {
    if (!s.caseId || s.verify?.running) return;
    s.verify = { running: true, checked: 0, total: s.journey?.head?.seq || 0 };
    renderVerify();
    let from = 1;
    try {
      for (;;) {
        const r = await api.verify(s.caseId, from);
        s.verify.checked += r.checked || 0;
        s.verify.total = r.total;
        if (!r.ok) {
          s.verify = { running: false, ok: false, failure: r.failure, total: r.total, checked: s.verify.checked };
          break;
        }
        if (r.nextSeq == null) {
          s.verify = { running: false, ok: true, total: r.total, checked: s.verify.checked, headHash: r.headHash, at: Date.now() };
          break;
        }
        from = r.nextSeq;
        renderVerify();
      }
    } catch (err) {
      s.verify = { running: false, ok: false, failure: { seq: null, reason: msg(err) } };
    }
    renderVerify();
  }

  // ---- rendering -------------------------------------------------------------
  function renderBanner() {
    const c = s.cases.find((x) => x.id === s.caseId);
    banner.replaceChildren(
      el("span", {}, el("strong", {}, "Proof of concept."), " Captures only the case subject, only during the case window."),
      c ? el("span", {}, `Subject: ${c.subject}`) : null,
      c ? el("span", {}, `Window: ${c.start ? fmtDay(Date.parse(c.start)) : "?"} → ${c.end ? fmtDay(Date.parse(c.end)) : "?"}`) : null,
      c ? el("span", {}, `What was sent: ${c.captureSent ? "captured" : "not captured"}`) : null,
      el("span", {}, mode === "gadget" ? "View: gadget" : "View: web"),
    );
  }

  function renderSummary() {
    const j = s.journey;
    if (!j) return summary.replaceChildren();
    const t = j.totals || {};
    summary.replaceChildren(
      el("span", { class: "ej-pill" }, plural(j.sessions.length, "session")),
      el("span", { class: "ej-pill" }, plural(t.visits || 0, "page visit")),
      t.sends ? el("span", { class: "ej-pill bad" }, plural(t.sends, "upload/form", "uploads/forms")) : null,
      t.downloads ? el("span", { class: "ej-pill brand" }, plural(t.downloads, "download")) : null,
      t.gaps ? el("span", { class: "ej-pill warn" }, plural(t.gaps, "gap")) : null,
      el("span", { class: "ej-pill", title: j.head?.hash || "" }, `Chain #${j.head?.seq || 0} · ${shortHash(j.head?.hash)}`),
    );
    if (!s.reset?.open) renderTools(); // don't wipe the confirm box while it's being typed in
  }

  // ---- tools: save all reconstructions, clear PoC data -------------------------
  function pageVisits() {
    const out = [];
    for (const sess of s.journey?.sessions || []) for (const v of sess.visits) if (!v.download) out.push(v);
    return out;
  }

  function renderTools() {
    const c = s.cases.find((x) => x.id === s.caseId);
    if (!s.journey || !c) return tools.replaceChildren();
    const pages = pageVisits();
    const b = s.bulk;
    const r = s.reset;
    const row = [];

    if (b?.running) {
      row.push(
        el("span", { class: "ej-pill" }, spinner(), `Saving reconstruction ${Math.min(b.done + 1, b.total)} of ${b.total}…`),
        el("button", { class: "ej-btn", disabled: !!b.stop, onclick: () => ((s.bulk.stop = true), renderTools()) }, b.stop ? "Stopping…" : "Stop"),
      );
    } else {
      row.push(
        el(
          "button",
          {
            class: "ej-btn",
            disabled: !pages.length || !!r?.running,
            title: "Render every page visit offline from captured responses and store each JPEG in R2",
            onclick: () => saveAll(),
          },
          `Save all reconstructions to R2 (${plural(pages.length, "page")})`,
        ),
      );
      if (b?.result) row.push(el("span", { class: `ej-pill ${b.failed ? "warn" : "ok"}`, title: b.detail || "" }, b.result));
    }

    if (c.allowReset) {
      row.push(el("div", { class: "ej-spacer" }));
      if (r?.result) row.push(el("span", { class: "ej-pill ok" }, r.result));
      if (!r?.open) {
        row.push(
          el(
            "button",
            { class: "ej-btn danger", disabled: !!b?.running, onclick: () => ((s.reset = { open: true }), renderTools()) },
            "Clear PoC data…",
          ),
        );
      }
    }
    const children = [el("div", { class: "ej-tools-row" }, row)];

    if (c.allowReset && r?.open) {
      const input = el("input", {
        class: "ej-input",
        placeholder: `Type ${c.id} to confirm`,
        "aria-label": "Case ID to confirm",
        autocomplete: "off",
        disabled: !!r.running,
        oninput: (e) => {
          s.reset.text = e.target.value;
          go.disabled = e.target.value.trim() !== c.id;
        },
      });
      input.value = r.text || "";
      const go = el(
        "button",
        { class: "ej-btn danger solid", disabled: r.running || (r.text || "").trim() !== c.id, onclick: () => runReset(c.id) },
        r.running ? "Clearing…" : "Clear everything",
      );
      children.push(
        el(
          "div",
          { class: "ej-confirm" },
          el(
            "div",
            {},
            el("strong", {}, `Clear all data for ${c.id}? `),
            "This deletes every captured page, upload, gap and reconstruction for this case, in the ledger and in R2, and starts a new chain. It can't be undone. Capture carries on for new browsing.",
          ),
          r.error ? el("div", { class: "ej-bad" }, r.error) : null,
          el(
            "div",
            { class: "ej-tools-row" },
            input,
            go,
            el("button", { class: "ej-btn", disabled: !!r.running, onclick: () => ((s.reset = null), renderTools()) }, "Cancel"),
          ),
        ),
      );
      tools.replaceChildren(...children);
      if (!r.running) input.focus();
      return;
    }
    tools.replaceChildren(...children);
  }

  // Renders (or re-uses) the reconstruction of every page visit, one at a time.
  // Each JPEG is stored in R2 by the Worker and hashed into the chain.
  async function saveAll() {
    if (s.bulk?.running) return;
    const caseId = s.caseId;
    const pages = pageVisits();
    s.bulk = { running: true, done: 0, total: pages.length, saved: 0, reused: 0, failed: 0, stop: false };
    renderTools();
    const errors = [];
    for (const v of pages) {
      if (s.bulk.stop || s.caseId !== caseId) break;
      try {
        const shot = await api.screenshot(caseId, v.seq);
        revoke(shot?.src);
        if (shot?.meta?.cached) s.bulk.reused++;
        else s.bulk.saved++;
        v.rendered = true;
      } catch (err) {
        s.bulk.failed++;
        errors.push(`#${v.seq} ${hostOf(v.url)}: ${msg(err)}`);
      }
      s.bulk.done++;
      renderTools();
    }
    const b = s.bulk;
    const stopped = b.done < b.total ? ` (stopped after ${b.done} of ${b.total})` : "";
    s.bulk = {
      running: false,
      failed: b.failed,
      result: `${b.saved} new, ${b.reused} already saved${b.failed ? `, ${b.failed} failed` : ""}${stopped}`,
      detail: errors.join("\n"),
    };
    renderList();
    renderTools();
  }

  async function runReset(caseId) {
    if (!s.reset || s.reset.running) return;
    s.reset.running = true;
    s.reset.error = null;
    renderTools();
    try {
      const out = await api.resetCase(caseId, caseId);
      s.reset = { result: `Cleared ${plural(out.deletedRecords ?? 0, "record")} and ${plural(out.deletedObjects ?? 0, "stored file")}` };
      s.bulk = null;
      s.verify = null;
      s.selectedSeq = null;
      s.record = null;
      clearShot();
      main.classList.remove("show-detail");
      renderVerify();
      renderDetail();
      await loadJourney();
    } catch (err) {
      s.reset.running = false;
      s.reset.error = `Could not clear: ${msg(err)}`;
      renderTools();
    }
  }

  function renderList() {
    const j = s.journey;
    if (!j) return;
    if (!j.sessions.length) {
      list.replaceChildren(
        el(
          "div",
          { class: "ej-empty" },
          "No page visits captured yet. Browse as the case subject through Gateway, then wait a few seconds — this view refreshes every 10 seconds.",
        ),
      );
      return;
    }
    const sessions = [...j.sessions].reverse();
    list.replaceChildren(
      ...sessions.map((sess) =>
        el(
          "div",
          { class: "ej-session" },
          el(
            "div",
            { class: "ej-session-h" },
            `Session ${sess.id} · ${fmtDay(sess.start)} · ${fmtTime(sess.start)}–${fmtTime(sess.end)} · ${plural(sess.visits.length, "page")}`,
          ),
          ...sess.visits.map(renderVisitRow),
        ),
      ),
    );
    if (j.unattributed?.sends || j.unattributed?.gaps) {
      list.append(
        el(
          "div",
          { class: "ej-empty" },
          `Not linked to a page visit: ${plural(j.unattributed.sends, "upload/form", "uploads/forms")}, ${plural(j.unattributed.gaps, "gap")}.`,
        ),
      );
    }
  }

  function renderVisitRow(v) {
    const parent = v.parentSeq ? s.visitIndex.get(v.parentSeq) : null;
    const uploads = v.sends.filter((x) => x.label === "upload").length;
    const forms = v.sends.filter((x) => x.label === "form").length;
    return el(
      "button",
      {
        class: `ej-visit${s.selectedSeq === v.seq ? " sel" : ""}`,
        role: "listitem",
        onclick: () => selectVisit(v.seq),
      },
      el("span", { class: "ej-visit-time" }, fmtTime(v.ts)),
      el("span", { class: "ej-visit-title" }, v.title || hostOf(v.url)),
      el("span", { class: "ej-visit-url" }, `${hostOf(v.url)}${pathOf(v.url)}`),
      el(
        "span",
        { class: "ej-visit-chips" },
        v.download ? el("span", { class: "ej-chip dl" }, "⬇ download") : null,
        uploads ? el("span", { class: "ej-chip upload" }, `⬆ upload ×${uploads}`) : null,
        forms ? el("span", { class: "ej-chip form" }, `✎ form ×${forms}`) : null,
        v.gaps ? el("span", { class: "ej-chip gap" }, `⚠ ${plural(v.gaps, "gap")}`) : null,
        v.status && v.status >= 400 ? el("span", { class: "ej-chip" }, `HTTP ${v.status}`) : null,
        parent ? el("span", { class: "ej-chip" }, `↳ from ${trim(parent.title || hostOf(parent.url), 28)}`) : null,
        v.rendered ? el("span", { class: "ej-chip" }, "▣ rendered") : null,
      ),
    );
  }

  function renderVerify() {
    const v = s.verify;
    verifyBtn.disabled = !!v?.running || !s.caseId;
    if (!v) {
      verifyPill.className = "ej-pill";
      verifyPill.textContent = "Chain not checked";
      return;
    }
    if (v.running) {
      verifyPill.className = "ej-pill";
      verifyPill.replaceChildren(spinner(), `Checking ${v.checked.toLocaleString()} of ${(v.total || 0).toLocaleString()}…`);
      return;
    }
    if (v.ok) {
      verifyPill.className = "ej-pill ok";
      verifyPill.textContent = `✓ Chain verified · ${plural(v.total, "record")} · head ${shortHash(v.headHash)}`;
      verifyPill.title = `Verified ${fmtDateTime(v.at)}. Head hash ${v.headHash}`;
      return;
    }
    verifyPill.className = "ej-pill bad";
    verifyPill.replaceChildren(
      `✗ Chain broken${v.failure?.seq ? ` at #${v.failure.seq}` : ""}: ${v.failure?.reason || "unknown error"}`,
    );
    if (v.failure?.seq && s.visitIndex.has(v.failure.seq)) {
      verifyPill.append(" ", el("button", { class: "ej-btn", onclick: () => selectVisit(v.failure.seq) }, "Open"));
    }
  }

  function renderDetail() {
    const back = el("button", { class: "ej-btn ej-back", onclick: () => main.classList.remove("show-detail") }, "← Back to journey");
    if (!s.selectedSeq) {
      detail.replaceChildren(
        el(
          "div",
          { class: "ej-empty" },
          "Select a page visit to see its reconstruction, what was sent from it, and its place in the evidence chain.",
        ),
      );
      return;
    }
    if (s.recordError) {
      detail.replaceChildren(back, el("div", { class: "ej-error" }, `Could not load record #${s.selectedSeq}: ${s.recordError}`));
      return;
    }
    if (!s.record) {
      detail.replaceChildren(back, el("div", { class: "ej-empty" }, spinner(), "Loading record…"));
      return;
    }
    const r = s.record;
    const d = r.data || {};
    const req = d.request || {};
    const res = d.response || {};
    detail.replaceChildren(
      back,
      el("h2", { class: "ej-h2" }, res.title || hostOf(req.url) || `Record #${r.seq}`),
      el("div", { class: "ej-url" }, `${req.method || ""} ${req.url || ""}`),
      el("div", { class: "ej-url" }, `${fmtDateTime(r.ts)} local · ${fmtUtc(r.ts)}`),
      renderShot(d),
      renderSends(r),
      renderGaps(r),
      section(
        "Page request",
        el(
          "div",
          { class: "ej-card" },
          kv([
            ["Status", `${res.status ?? "—"} ${res.statusText || ""}`],
            ["Content type", res.contentType || "—"],
            ["Response size", sizeLine(res.body)],
            ["Response SHA-256", mono(res.body?.sha256)],
            ["Came from", req.referer || "—"],
            ["Fetch metadata", fetchLine(req.fetch)],
            ["Duration", d.durationMs != null ? `${d.durationMs} ms` : "—"],
          ]),
          headersBlock("Request headers (stored copy, secrets hidden)", req.headers),
          headersBlock("Response headers (stored copy, secrets hidden)", res.headers),
        ),
      ),
      section(
        "Evidence chain",
        el(
          "div",
          { class: "ej-card" },
          kv([
            ["Record", `#${r.seq} (${r.kind})`],
            ["Capture ID", mono(r.captureId)],
            ["Previous hash", mono(r.prevHash)],
            ["Record hash", mono(r.hash)],
          ]),
        ),
      ),
      section(
        "Who and where (from Gateway)",
        el(
          "div",
          { class: "ej-card" },
          kv([
            ["Subject", d.subject ? `${d.subject.name ? d.subject.name + " · " : ""}${d.subject.email}` : "—"],
            ["Source IP", d.gateway?.srcIp || "—"],
            ["Internal IP", d.gateway?.internalSrcIp || "—"],
            ["On-ramp", d.gateway?.onrampType || "—"],
            ["Destination IP", d.gateway?.dstIp || "—"],
            ["Gateway policy", mono(d.gateway?.policyId)],
          ]),
        ),
      ),
    );
  }

  function renderShot(d) {
    if (d.download) {
      const b = d.response?.body;
      return section(
        "File download",
        el(
          "div",
          { class: "ej-card" },
          kv([
            ["File", d.response?.disposition || "—"],
            ["Type", d.response?.contentType || "—"],
            ["Size", sizeLine(b)],
            ["SHA-256", mono(b?.sha256)],
          ]),
        ),
      );
    }
    let body;
    if (s.shotState === "loading" || s.shotState === "idle") {
      body = el(
        "div",
        { class: "ej-shot-wait" },
        spinner(),
        "Rendering the reconstruction from captured responses… this can take 10–30 seconds the first time.",
      );
    } else if (s.shotState === "error") {
      body = el(
        "div",
        { class: "ej-shot-wait" },
        `Could not render: ${s.shotError}`,
        el("div", {}, el("button", { class: "ej-btn", onclick: () => loadShot(s.selectedSeq) }, "Try again")),
      );
    } else {
      const m = s.shot.meta || {};
      body = [
        el("img", { src: s.shot.src, alt: "Reconstruction of the page from captured responses" }),
        el(
          "div",
          { class: "ej-caption" },
          el("strong", {}, "Reconstruction — not a screenshot of the user's screen."),
          el("span", {}, m.renderedAt ? `Rendered ${fmtUtc(Date.parse(m.renderedAt))}` : ""),
          el("span", {}, `${m.replayed ?? "?"} replayed · ${m.approximate ?? "?"} approximate · ${m.missing ?? "?"} missing`),
          el("span", { class: "ej-mono" }, `JPEG SHA-256 ${m.sha256 || "—"}`),
          m.browser ? el("span", {}, m.browser) : null,
          m.chainSeq ? el("span", {}, `Chain #${m.chainSeq}`) : null,
          m.cached ? el("span", {}, "Stored render") : null,
          m.key ? el("span", { class: "ej-mono" }, `Saved in R2: ${m.key}`) : null,
        ),
      ];
    }
    return section("Reconstruction", el("div", { class: "ej-shot" }, body));
  }

  function renderSends(r) {
    const rel = r.related;
    if (!rel) return null;
    const own = r.data?.sent?.level === 2 ? [{ ...sendFromSelf(r) }] : [];
    const sends = [...own, ...rel.sends.filter((x) => x.seq !== r.seq)];
    if (!sends.length && !rel.backgroundSends) return null;
    return section(
      "Sent from this page",
      sends.map((x) =>
        el(
          "div",
          { class: "ej-send" },
          el(
            "div",
            { class: "ej-send-h" },
            el("span", { class: `ej-chip ${x.label}` }, x.label === "upload" ? "⬆ upload" : x.label === "form" ? "✎ form" : x.label),
            el("strong", {}, `${x.method} ${hostOf(x.url)}`),
            el("span", { class: "ej-url" }, fmtTime(x.ts)),
            el("span", { class: "ej-url" }, `${fmtBytes(x.bytes)}${x.truncated ? ` (stored ${fmtBytes(x.storedBytes)}, cut off)` : ""}`),
          ),
          el("div", { class: "ej-url" }, x.url),
          kv([
            ["Content type", x.contentType || "—"],
            ["Secrets", x.redaction || "—"],
            ["SHA-256", mono(x.sha256)],
            ["Record", `#${x.seq}`],
          ]),
          x.preview ? el("pre", { class: "ej-pre" }, x.preview) : null,
        ),
      ),
      rel.backgroundSends
        ? el("div", { class: "ej-url" }, `Plus ${plural(rel.backgroundSends, "background data request")} (analytics, app sync and similar) in the same window.`)
        : null,
    );
  }

  function sendFromSelf(r) {
    const b = r.data.request?.body || {};
    return {
      seq: r.seq,
      ts: r.ts,
      method: r.data.request.method,
      url: r.data.request.url,
      label: r.data.sent.label,
      bytes: b.totalBytes,
      storedBytes: b.storedBytes,
      truncated: b.truncated,
      contentType: b.contentType,
      sha256: b.sha256,
      redaction: b.redaction,
      preview: b.preview,
    };
  }

  function renderGaps(r) {
    const own = (r.data?.gaps || []).map((g) => ({ seq: r.seq, ts: r.ts, url: r.data.request?.url, reasons: [g] }));
    const rel = (r.related?.gaps || []).filter((g) => g.seq !== r.seq);
    const gaps = [...own, ...rel];
    if (!gaps.length) return null;
    return section(
      "Gaps",
      gaps.map((g) =>
        el(
          "div",
          { class: "ej-gap" },
          el("div", {}, `${fmtTime(g.ts)} · #${g.seq} · ${g.reasons.join("; ")}`),
          g.url ? el("div", { class: "ej-url" }, g.url) : null,
        ),
      ),
    );
  }

  function renderSetup() {
    main.replaceChildren(
      el(
        "div",
        { class: "ej-setup" },
        el("h2", { class: "ej-h2" }, "Connect the Evidence API"),
        el("p", {}, "This gadget shows evidence stored in your Cloudflare account. It isn't connected yet."),
        el(
          "ol",
          {},
          el("li", {}, "Deploy the evidence-capture Worker (see worker/README.md in this gadget)."),
          el("li", {}, "Put its hostname behind a Cloudflare Access application, with a service token allowed."),
          el("li", {}, "Give the assistant the hostname and service token so it can connect this gadget."),
        ),
        el("p", { class: "ej-url" }, "The same interface is also served by the Worker itself at its hostname."),
      ),
    );
    verifyBtn.disabled = true;
    whoPill.textContent = "Not connected";
  }

  function showFatal(err) {
    main.replaceChildren(el("div", { class: "ej-error" }, `Could not load: ${msg(err)}`));
  }
}

// ---- small helpers -----------------------------------------------------------

function section(title, ...children) {
  return el("div", { class: "ej-section" }, el("h3", {}, title), ...children);
}

function kv(rows) {
  return el(
    "dl",
    { class: "ej-kv" },
    rows.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, v ?? "—")]),
  );
}

function mono(v) {
  return el("span", { class: "ej-mono" }, v || "—");
}

function headersBlock(title, headers) {
  const entries = Object.entries(headers || {});
  if (!entries.length) return null;
  return el(
    "details",
    { class: "ej-more ej-section" },
    el("summary", {}, `${title} · ${entries.length}`),
    el("pre", { class: "ej-pre" }, entries.map(([k, v]) => `${k}: ${v}`).join("\n")),
  );
}

function sizeLine(b) {
  if (!b) return "—";
  return `${fmtBytes(b.totalBytes)}${b.truncated ? ` (stored ${fmtBytes(b.storedBytes)}, cut off)` : ""}`;
}

function fetchLine(f) {
  if (!f) return "—";
  return [f.mode && `mode=${f.mode}`, f.dest && `dest=${f.dest}`, f.site && `site=${f.site}`, f.user && `user=${f.user}`]
    .filter(Boolean)
    .join(" · ") || "—";
}

function spinner() {
  return el("span", { class: "ej-spin", "aria-hidden": "true" });
}

function trim(t, n) {
  t = String(t || "");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function msg(err) {
  return (err && (err.message || String(err))) || "unknown error";
}

function revoke(src) {
  if (src && typeof src === "string" && src.startsWith("blob:")) URL.revokeObjectURL(src);
}
