// Case overview band: review-priority gauge, headline numbers and an activity pulse
// across the case. Deliberately one compact row: it answers "how bad, how much, when",
// and every number is a shortcut into the filtered list. Breakdowns by behaviour and
// category live in the filter panel (as proportion bars), so they aren't repeated here.
// Describes the whole case (not the current filters); re-renders only when data changes.

import { el, plural, shortHash } from "./dom.js";

const NS = "http://www.w3.org/2000/svg";
const prev = new Map(); // last value shown per counter, so numbers count up from where they were

function svg(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, String(v));
  for (const k of kids.flat()) if (k) n.append(k);
  return n;
}

function reduced() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches || typeof globalThis.gadgetExportFormatId !== "undefined";
}

function countUp(node, key, to) {
  const fmt = (n) => Math.round(n).toLocaleString();
  const from = prev.has(key) ? prev.get(key) : 0;
  prev.set(key, to);
  if (reduced() || from === to) {
    node.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / 800);
    node.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  node.textContent = fmt(from);
  requestAnimationFrame(step);
}

// 0–100 "review priority": grows with the total behaviour score, saturating.
export function reviewScore(visits) {
  const sum = visits.reduce((a, v) => a + (v.risk || 0), 0);
  return Math.round(100 * (1 - Math.exp(-sum / 30)));
}

function level(score) {
  if (score >= 75) return { name: "High", tone: "bad" };
  if (score >= 50) return { name: "Elevated", tone: "elev" };
  if (score >= 25) return { name: "Guarded", tone: "warn" };
  return { name: "Low", tone: "ok" };
}

function gauge(score) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const lv = level(score);
  const ring = svg("circle", { cx: 36, cy: 36, r, class: "ej-g-val", "stroke-dasharray": c.toFixed(1) });
  const from = prev.get("score") ?? 0;
  ring.setAttribute("stroke-dashoffset", (c * (1 - from / 100)).toFixed(1));
  requestAnimationFrame(() => requestAnimationFrame(() => ring.setAttribute("stroke-dashoffset", (c * (1 - score / 100)).toFixed(1))));
  const num = el("div", { class: "ej-g-num" }, "0");
  countUp(num, "score", score);
  return el(
    "div",
    { class: `ej-gauge ${lv.tone}`, title: "Review priority (0–100), from the behaviour flags across the case. A lead for review, not proof." },
    el(
      "div",
      { class: "ej-g-wrap" },
      svg("svg", { viewBox: "0 0 72 72", class: "ej-g-svg", "aria-hidden": "true" }, svg("circle", { cx: 36, cy: 36, r, class: "ej-g-track" }), ring),
      el("div", { class: "ej-g-mid" }, num),
    ),
    el("div", { class: "ej-g-txt" }, el("div", { class: "ej-g-label" }, "Review priority"), el("div", { class: "ej-g-level" }, lv.name)),
  );
}

function tile({ key, label, value, sub, tone, onclick, title }) {
  const num = el("div", { class: "ej-k-num" }, "0");
  countUp(num, key, value);
  return el(
    onclick ? "button" : "div",
    { class: `ej-kpi${tone ? ` ${tone}` : ""}${onclick ? " click" : ""}`, onclick, title },
    el("div", { class: "ej-k-label" }, label),
    num,
    sub ? el("div", { class: "ej-k-sub" }, sub) : null,
  );
}

// Visits across the case timeline; flagged visits as dots on a baseline track.
function pulse(visits) {
  if (visits.length < 2) return el("div", { class: "ej-pulse ej-hint ej-pulse-empty" }, "Activity appears here once there are a few visits.");
  const W = 600;
  const H = 56;
  const N = 60;
  const t0 = visits[0].ts;
  const span = Math.max(1, visits[visits.length - 1].ts - t0);
  const b = new Array(N).fill(0);
  for (const v of visits) b[Math.min(N - 1, Math.floor(((v.ts - t0) / span) * N))]++;
  const max = Math.max(...b, 1);
  const pts = b.map((n, i) => [(i / (N - 1)) * W, H - 12 - (n / max) * (H - 18)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  const dots = visits
    .filter((v) => v.riskLevel === "high" || v.riskLevel === "medium")
    .slice(-80)
    .map((v) => svg("circle", { cx: (((v.ts - t0) / span) * W).toFixed(1), cy: H - 3, r: v.riskLevel === "high" ? 3 : 2.2, class: `ej-p-dot ${v.riskLevel}` }));
  const fmt = (ts) => new Date(ts).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return el(
    "div",
    { class: "ej-pulse" },
    svg(
      "svg",
      { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", class: "ej-p-svg", "aria-hidden": "true" },
      svg(
        "defs",
        {},
        svg(
          "linearGradient",
          { id: "ejpa", x1: "0", y1: "0", x2: "0", y2: "1" },
          svg("stop", { offset: "0%", "stop-color": "#f6821f", "stop-opacity": ".28" }),
          svg("stop", { offset: "100%", "stop-color": "#f6821f", "stop-opacity": "0" }),
        ),
      ),
      svg("path", { d: `${d} L${W},${H - 8} L0,${H - 8} Z`, fill: "url(#ejpa)" }),
      svg("path", { d, class: "ej-p-line", pathLength: 1 }),
      svg("line", { x1: 0, x2: W, y1: H - 3, y2: H - 3, class: "ej-p-base" }),
      dots,
    ),
    el("div", { class: "ej-p-axis" }, el("span", {}, fmt(t0)), el("span", {}, fmt(t0 + span))),
  );
}

export function renderHero(container, { journey, visits, verify, collapsed, onToggle, onRisk, onVerify, onSends, onAfterHours, onGaps }) {
  if (!journey) return container.replaceChildren();
  const t = journey.totals || {};
  const high = visits.filter((v) => v.riskLevel === "high").length;
  const med = visits.filter((v) => v.riskLevel === "medium").length;
  const after = visits.filter((v) => v.local?.afterHours).length;
  const nets = journey.insights?.gateway?.networks?.length || 0;
  const chain = !verify
    ? { tone: "", sub: "Not checked — click to verify" }
    : verify.running
      ? { tone: "", sub: `Checking ${verify.checked.toLocaleString()}…` }
      : verify.ok
        ? { tone: "ok", sub: `✓ Intact · ${shortHash(verify.headHash)}` }
        : { tone: "bad", sub: `✗ Broken${verify.failure?.seq ? ` at #${verify.failure.seq}` : ""}` };

  container.replaceChildren(
    el(
      "div",
      { class: "ej-hero-in" },
      gauge(reviewScore(visits)),
      el(
        "div",
        { class: "ej-kpis" },
        tile({ key: "visits", label: "Visits", value: t.visits || 0, sub: `${plural(journey.sessions?.length || 0, "session")}${nets ? ` · ${plural(nets, "network")}` : ""}` }),
        tile({ key: "high", label: "High risk", value: high, sub: `${med} medium`, tone: high ? "bad" : med ? "warn" : "", onclick: high || med ? () => onRisk(high ? "high" : "medium") : null, title: "Show high-risk visits" }),
        tile({ key: "sends", label: "Uploads & forms", value: t.sends || 0, sub: plural(t.downloads || 0, "download"), tone: t.sends ? "warn" : "", onclick: t.sends ? onSends : null, title: "Show visits with uploads or forms" }),
        tile({ key: "after", label: "After hours", value: after, sub: journey.insights?.workHours ? `outside ${journey.insights.workHours}` : "", onclick: after ? onAfterHours : null, title: "Show after-hours visits" }),
        tile({ key: "gaps", label: "Gaps", value: t.gaps || 0, sub: "capture problems", tone: t.gaps ? "warn" : "", onclick: t.gaps ? onGaps : null, title: "Show visits with capture gaps" }),
        tile({ key: "records", label: "Evidence", value: journey.head?.seq || 0, sub: chain.sub, tone: chain.tone, onclick: onVerify, title: "Verify the evidence chain" }),
      ),
      collapsed ? null : pulse(visits),
      el("button", { class: "ej-btn ej-icon ej-hero-tog", title: collapsed ? "Show overview" : "Collapse overview", "aria-label": collapsed ? "Show overview" : "Collapse overview", onclick: onToggle }, collapsed ? "▾" : "▴"),
    ),
  );
}
