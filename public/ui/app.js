// Shared investigator UI, used by both the gadget and the Worker's web front end.
//
// mountApp(root, api, { mode }) where api provides:
//   status?()                 -> { connected: boolean }        (gadget only)
//   me()                      -> { actor: { type, id } }
//   cases()                   -> { cases: [...] }
//   journey(caseId)           -> { sessions, totals, unattributed, head, insights }
//   record(caseId, seq)       -> ledger record (+ related sends/gaps, reconstructions)
//   screenshot(caseId, seq)   -> { src, meta }
//   verify(caseId, fromSeq)   -> { ok, checked, total, nextSeq, headHash, failure }
//   resetCase(caseId, confirm) -> { ok, deletedRecords, deletedObjects }  (PoC cases with allowReset)
//
// Layout: filter rail | journey list | detail. Below 1200px the rail folds above the
// list; below 820px the list and detail become separate screens.
// Keys: j / k next / previous visit, / focus search.

import { injectStyles } from "./styles.js";
import { el, fmtBytes, fmtDateTime, fmtDay, fmtTime, fmtUtc, hostOf, pathOf, plural, shortHash } from "./dom.js";
import { SIGNALS, SIGNAL_ORDER, activeFilterCount, categoryColor, matches, newFilters } from "./insights.js";
import { renderChart, renderRail } from "./filters.js";

const POLL_MS = 10_000;

export async function mountApp(root, api, opts = {}) {
  const mode = opts.mode || "web";
  const doc = root.ownerDocument || document;
  injectStyles(doc);
  root.classList.add("ej-root");

  const s = {
    me: null,
    cases: [],
    caseId: null,
    journey: null,
    visits: [], // flat, chronological
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
    f: newFilters(),
    railCollapsed: (doc.defaultView?.innerWidth || 1400) < 1200,
    shown: [], // seqs currently listed, in display order (for j/k)
  };

  // ---- shell ---------------------------------------------------------------
  const caseSelect = el("select", { class: "ej-select", "aria-label": "Case", onchange: (e) => switchCase(e.target.value) });
  let searchTimer = null;
  const search = el("input", {
    class: "ej-search",
    type: "search",
    placeholder: "Search sites, titles, search terms, file names…  ( / )",
    "aria-label": "Search the journey",
    oninput: (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        s.f.q = e.target.value.trim().toLowerCase();
        renderAll();
      }, 150);
    },
  });
  const verifyBtn = el("button", { class: "ej-btn", onclick: () => runVerify() }, "Verify chain");
  const verifyPill = el("span", { class: "ej-pill" }, "Chain not checked");
  const whoPill = el("span", { class: "ej-pill" }, "…");
  const top = el(
    "div",
    { class: "ej-top" },
    el("div", { class: "ej-brand" }, el("span", { class: "ej-dot" }), "Insider Threat Incident Response"),
    caseSelect,
    search,
    verifyPill,
    verifyBtn,
    whoPill,
  );
  const banner = el("div", { class: "ej-banner" });
  const rail = el("aside", { class: "ej-rail", "aria-label": "Filters" });
  const summary = el("div", { class: "ej-summary" });
  const chart = el("div", { class: "ej-chartwrap" });
  const tools = el("div", { class: "ej-tools" });
  const list = el("div", { role: "list" });
  const listWrap = el("div", { class: "ej-list" }, summary, chart, tools, list);
  const side = el("div", { class: "ej-side" }, rail, listWrap);
  const detail = el("div", { class: "ej-detail" });
  const main = el("div", { class: "ej-main" }, side, detail);
  const shell = el("div", { class: "ej-shell" }, top, banner, main);
  root.replaceChildren(shell);

  doc.addEventListener("keydown", onKey);

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
      setJourney(await api.journey(s.caseId));
      renderAll();
    } catch (err) {
      list.replaceChildren(el("div", { class: "ej-error" }, `Could not load the journey: ${msg(err)}`));
    }
  }

  function setJourney(j) {
    s.journey = j;
    s.visits = [];
    s.visitIndex = new Map();
    for (const sess of j?.sessions || []) {
      for (const v of sess.visits) {
        v.sessionId = sess.id;
        v.signals = v.signals || [];
        v.category = v.category || "Uncategorised";
        s.visits.push(v);
        s.visitIndex.set(v.seq, v);
      }
    }
  }

  async function poll() {
    if (!s.caseId || doc.hidden || s.verify?.running || s.bulk?.running) return;
    try {
      const j = await api.journey(s.caseId);
      if (j?.head?.seq !== s.journey?.head?.seq) {
        setJourney(j);
        renderAll();
      }
    } catch {
      /* transient; next poll retries */
    }
  }

  async function switchCase(id) {
    s.caseId = id;
    s.selectedSeq = null;
    s.record = null;
    s.verify = null;
    s.f = newFilters();
    search.value = "";
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
    detail.scrollTop = 0;
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

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if (e.key === "/" && !typing) {
      e.preventDefault();
      search.focus();
      return;
    }
    if (e.key === "Escape" && t === search) {
      search.blur();
      return;
    }
    if (typing || (e.key !== "j" && e.key !== "k") || !s.shown.length) return;
    e.preventDefault();
    const i = s.shown.indexOf(s.selectedSeq);
    const next = e.key === "j" ? (i < 0 ? 0 : Math.min(s.shown.length - 1, i + 1)) : i < 0 ? 0 : Math.max(0, i - 1);
    if (s.shown[next] !== s.selectedSeq) {
      selectVisit(s.shown[next]).catch(() => {});
      list.querySelector(`[data-seq="${s.shown[next]}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }

  // ---- rendering -------------------------------------------------------------
  function renderAll() {
    renderRailNow();
    renderSummary();
    renderChartNow();
    renderList();
  }

  function onFilterChange(o = {}) {
    if (o.clearSearch) search.value = "";
    renderAll();
  }

  function renderRailNow() {
    renderRail(rail, {
      visits: s.visits,
      f: s.f,
      insights: s.journey?.insights,
      collapsed: s.railCollapsed,
      onChange: onFilterChange,
      onToggle: () => {
        s.railCollapsed = !s.railCollapsed;
        renderRailNow();
      },
    });
  }

  function renderChartNow() {
    if (!s.visits.length) return chart.replaceChildren();
    renderChart(chart, {
      visits: s.visits,
      f: s.f,
      insights: s.journey?.insights,
      onHour: (h) => {
        s.f.hours.has(h) ? s.f.hours.delete(h) : s.f.hours.add(h);
        renderAll();
      },
    });
  }

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

  function filtered() {
    return s.visits.filter((v) => matches(v, s.f));
  }

  function renderSummary() {
    const j = s.journey;
    if (!j) return summary.replaceChildren();
    const t = j.totals || {};
    const shown = filtered();
    const high = shown.filter((v) => v.riskLevel === "high").length;
    const med = shown.filter((v) => v.riskLevel === "medium").length;
    const nf = activeFilterCount(s.f);
    const sort = el(
      "select",
      {
        class: "ej-select ej-sort",
        "aria-label": "Sort",
        onchange: (e) => {
          s.f.sort = e.target.value;
          renderList();
        },
      },
      el("option", { value: "time" }, "Newest sessions first"),
      el("option", { value: "risk" }, "Highest risk first"),
    );
    sort.value = s.f.sort;
    summary.replaceChildren(
      el("span", { class: "ej-pill" }, nf ? `${shown.length} of ${plural(s.visits.length, "visit")}` : plural(t.visits || 0, "page visit")),
      el("span", { class: "ej-pill" }, plural(j.sessions.length, "session")),
      high ? el("span", { class: "ej-pill bad" }, `${high} high risk`) : null,
      med ? el("span", { class: "ej-pill warn" }, `${med} medium`) : null,
      t.sends ? el("span", { class: "ej-pill bad" }, plural(t.sends, "upload/form", "uploads/forms")) : null,
      t.downloads ? el("span", { class: "ej-pill brand" }, plural(t.downloads, "download")) : null,
      t.gaps ? el("span", { class: "ej-pill warn" }, plural(t.gaps, "gap")) : null,
      el("span", { class: "ej-pill", title: j.head?.hash || "" }, `Chain #${j.head?.seq || 0} · ${shortHash(j.head?.hash)}`),
      el("div", { class: "ej-spacer" }),
      sort,
    );
    if (!s.reset?.open) renderTools(); // don't wipe the confirm box while it's being typed in
  }

  // ---- tools: save all reconstructions, clear PoC data -------------------------
  function pageVisits() {
    return s.visits.filter((v) => !v.download);
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
      // Large cases are cleared in batches: the server returns done:false until all files are gone.
      let out;
      let files = 0;
      for (let round = 0; round < 200; round++) {
        out = await api.resetCase(caseId, caseId);
        files += out.deletedObjects ?? 0;
        if (out.done !== false) break;
        s.reset.progress = files;
        renderTools();
      }
      if (out?.done === false) throw new Error(`stopped after deleting ${files} files; try again`);
      s.reset = { result: `Cleared ${plural(out.deletedRecords ?? 0, "record")} and ${plural(files, "stored file")}` };
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

  // ---- journey list ------------------------------------------------------------
  function renderList() {
    const j = s.journey;
    if (!j) return;
    s.shown = [];
    if (!s.visits.length) {
      list.replaceChildren(
        el(
          "div",
          { class: "ej-empty" },
          "No page visits captured yet. Browse as the case subject through Gateway, then wait a few seconds — this view refreshes every 10 seconds.",
        ),
      );
      return;
    }
    const shown = filtered();
    if (!shown.length) {
      list.replaceChildren(
        el(
          "div",
          { class: "ej-empty" },
          "Nothing matches these filters. ",
          el(
            "button",
            {
              class: "ej-link",
              onclick: () => {
                s.f = { ...newFilters(), sort: s.f.sort };
                onFilterChange({ clearSearch: true });
              },
            },
            "Clear filters",
          ),
        ),
      );
      return;
    }

    if (s.f.sort === "risk") {
      const sorted = [...shown].sort((a, b) => (b.risk || 0) - (a.risk || 0) || b.ts - a.ts);
      s.shown = sorted.map((v) => v.seq);
      list.replaceChildren(
        el("div", { class: "ej-session" }, el("div", { class: "ej-session-h" }, `Highest risk first · ${plural(sorted.length, "visit")}`), sorted.map((v) => renderVisitRow(v, true))),
      );
    } else {
      const keep = new Set(shown.map((v) => v.seq));
      const sessions = [...j.sessions].reverse();
      const blocks = [];
      for (const sess of sessions) {
        const vs = sess.visits.filter((v) => keep.has(v.seq));
        if (!vs.length) continue;
        const risky = vs.filter((v) => v.riskLevel === "high" || v.riskLevel === "medium").length;
        for (const v of vs) s.shown.push(v.seq);
        blocks.push(
          el(
            "div",
            { class: "ej-session" },
            el(
              "div",
              { class: "ej-session-h" },
              `Session ${sess.id} · ${fmtDay(sess.start)} · ${fmtTime(sess.start)}–${fmtTime(sess.end)} · `,
              vs.length === sess.visits.length ? plural(sess.visits.length, "page") : `${vs.length} of ${plural(sess.visits.length, "page")}`,
              risky ? el("span", { class: "ej-risk medium" }, `${risky} flagged`) : null,
            ),
            vs.map((v) => renderVisitRow(v, false)),
          ),
        );
      }
      list.replaceChildren(...blocks);
    }
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

  function renderVisitRow(v, withDate) {
    const parent = v.parentSeq ? s.visitIndex.get(v.parentSeq) : null;
    const sigs = [...v.signals].sort((a, b) => SIGNAL_ORDER.indexOf(a.id) - SIGNAL_ORDER.indexOf(b.id));
    return el(
      "button",
      {
        class: `ej-visit${s.selectedSeq === v.seq ? " sel" : ""} r-${v.riskLevel || "none"}`,
        role: "listitem",
        "data-seq": v.seq,
        onclick: () => selectVisit(v.seq),
      },
      el("span", { class: "ej-visit-time" }, withDate ? [fmtShortDay(v.ts), el("br", {}), fmtTime(v.ts)] : fmtTime(v.ts)),
      el("span", { class: "ej-visit-title" }, v.title || hostOf(v.url)),
      v.risk ? el("span", { class: `ej-risk ${v.riskLevel}`, title: `Risk score ${v.risk}` }, `${v.riskLevel} · ${v.risk}`) : el("span", {}),
      el("span", { class: "ej-visit-url" }, `${hostOf(v.url)}${pathOf(v.url)}`),
      v.searchTerms ? el("span", { class: "ej-visit-q" }, `⌕ “${trim(v.searchTerms, 80)}”`) : null,
      el(
        "span",
        { class: "ej-visit-chips" },
        el("span", { class: "ej-chip cat", style: `--c:${categoryColor(v.category)}` }, v.category),
        sigs.map((x) => {
          const m = SIGNALS[x.id] || { label: x.id, icon: "•", tone: "info" };
          return el("span", { class: `ej-chip sig ${m.tone}`, title: x.detail || m.desc }, `${m.icon} ${m.label}`);
        }),
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

  // ---- detail panel --------------------------------------------------------------
  function renderDetail() {
    const back = el("button", { class: "ej-btn ej-back", onclick: () => main.classList.remove("show-detail") }, "← Back to journey");
    if (!s.selectedSeq) {
      detail.replaceChildren(
        el(
          "div",
          { class: "ej-empty" },
          el("p", {}, "Select a page visit to see why it was flagged, its reconstruction, what was sent from it, and its place in the evidence chain."),
          el("p", { class: "ej-hint" }, "Start with Risk → High or a behaviour in the filter panel. Keys: j / k to move, / to search."),
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
      renderFlags(s.visitIndex.get(r.seq)),
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

  function renderFlags(v) {
    if (!v) return null;
    const ins = s.journey?.insights || {};
    const sigs = [...v.signals].sort((a, b) => SIGNAL_ORDER.indexOf(a.id) - SIGNAL_ORDER.indexOf(b.id));
    const src = { gateway: "Cloudflare Gateway", corporate: "your corporate domains", "built-in": "built-in list", none: "no match" }[v.categorySource] || v.categorySource || "built-in list";
    const linked = v.chainFromSeq ? s.visitIndex.get(v.chainFromSeq) : null;
    return section(
      v.signals.length ? "Why this was flagged" : "Behaviour",
      el(
        "div",
        { class: "ej-card ej-flags" },
        el(
          "div",
          { class: "ej-flags-h" },
          v.risk ? el("span", { class: `ej-risk ${v.riskLevel}` }, `${v.riskLevel} risk · score ${v.risk}`) : el("span", { class: "ej-risk none" }, "No behaviours flagged"),
          el("span", { class: "ej-chip cat", style: `--c:${categoryColor(v.category)}` }, v.category),
          el("span", { class: "ej-hint" }, `Category from ${src}`),
          el(
            "button",
            {
              class: "ej-link",
              onclick: () => {
                s.f.categories.add(v.category);
                onFilterChange();
              },
            },
            "Show all in this category",
          ),
        ),
        sigs.length
          ? el(
              "ul",
              { class: "ej-flag-list" },
              sigs.map((x) => {
                const m = SIGNALS[x.id] || { label: x.id, icon: "•", tone: "info", desc: "" };
                return el(
                  "li",
                  {},
                  el("span", { class: `ej-sig-i ${m.tone}` }, m.icon),
                  el("div", {}, el("strong", {}, m.label), x.detail ? el("span", {}, ` — ${x.detail}`) : null, el("div", { class: "ej-hint" }, m.desc)),
                  el(
                    "button",
                    {
                      class: "ej-link",
                      title: "Filter the journey to this behaviour",
                      onclick: () => {
                        s.f.signals.add(x.id);
                        onFilterChange();
                      },
                    },
                    "Filter",
                  ),
                );
              }),
            )
          : null,
        kv(
          [
            v.searchTerms ? ["Search terms", el("span", { class: "ej-q" }, v.searchTerms)] : null,
            v.fileNames?.length ? ["File names", v.fileNames.join(", ")] : null,
            v.sentBytes ? ["Data sent", `${fmtBytes(v.sentBytes)} across ${plural(v.sends.length + (v.backgroundSends || 0), "request")}`] : null,
            ["Local time", `${fmtDay(v.ts)} ${fmtTime(v.ts)} · ${pad2(v.local?.hour)}:xx in ${ins.tz || "UTC"}${v.local?.afterHours ? " (after hours)" : ""}`],
            linked
              ? [
                  "Linked download",
                  el("button", { class: "ej-link", onclick: () => selectVisit(linked.seq) }, `#${linked.seq} ${trim(linked.title || hostOf(linked.url), 50)}`),
                ]
              : null,
          ].filter(Boolean),
        ),
        el("div", { class: "ej-hint" }, "A behaviour is a lead to review, not proof of wrongdoing. Check the reconstruction and what was sent before drawing conclusions."),
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
          kv(
            [
              x.fileNames?.length ? ["File names", x.fileNames.join(", ")] : null,
              ["Content type", x.contentType || "—"],
              ["Secrets", x.redaction || "—"],
              ["SHA-256", mono(x.sha256)],
              ["Record", `#${x.seq}`],
            ].filter(Boolean),
          ),
          x.preview ? el("pre", { class: "ej-pre" }, x.preview) : null,
        ),
      ),
      rel.backgroundSends
        ? el("div", { class: "ej-url" }, `Plus ${plural(rel.backgroundSends, "background data request")} (analytics, app sync, chat messages and similar) in the same window.`)
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
      fileNames: b.fileNames,
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

function fmtShortDay(ts) {
  return new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" });
}

function pad2(n) {
  return n == null ? "--" : String(n).padStart(2, "0");
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
