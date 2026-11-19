// The "command centre" band at the top of the investigator UI: review-priority gauge,
// count-up headline numbers, an activity pulse line over the case, top behaviours and
// the category mix. It describes the whole case (not the current filters) and only
// re-renders when the journey or the chain check changes.

import { el, plural, shortHash } from "./dom.js";
import { SIGNALS, SIGNAL_ORDER, categoryColor } from "./insights.js";

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

// Animate a number from its previous value to `to`.
function countUp(node, key, to, fmt = (n) => Math.round(n).toLocaleString()) {
  const from = prev.has(key) ? prev.get(key) : 0;
  prev.set(key, to);
  if (reduced() || from === to) {
    node.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const dur = 900;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    node.textContent = fmt(from + (to - from) * e);
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
  if (score >= 50) return { name: "Elevated", tone: "warn" };
  if (score >= 25) return { name: "Guarded", tone: "warn" };
  return { name: "Low", tone: "ok" };
}

function gauge(score) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const lv = level(score);
  const ring = svg("circle", { cx: 64, cy: 64, r, class: "ej-g-val", "stroke-dasharray": c.toFixed(1), "stroke-dashoffset": c.toFixed(1) });
  const node = svg(
    "svg",
    { viewBox: "0 0 128 128", class: "ej-g-svg", "aria-hidden": "true" },
    svg(
      "defs",
      {},
      svg(
        "linearGradient",
        { id: "ejg", x1: "0", y1: "0", x2: "1", y2: "1" },
        svg("stop", { offset: "0%", "stop-color": "#f6821f" }),
        svg("stop", { offset: "55%", "stop-color": "#ff3d7f" }),
        svg("stop", { offset: "100%", "stop-color": "#7c5cff" }),
      ),
    ),
    svg("circle", { cx: 64, cy: 64, r, class: "ej-g-track" }),
    ring,
  );
  const num = el("div", { class: "ej-g-num" }, "0");
  const from = prev.get("score") ?? 0;
  const target = c * (1 - score / 100);
  ring.setAttribute("stroke-dashoffset", (c * (1 - from / 100)).toFixed(1));
  requestAnimationFrame(() => requestAnimationFrame(() => ring.setAttribute("stroke-dashoffset", target.toFixed(1))));
  countUp(num, "score", score);
  return el(
    "div",
    { class: "ej-gauge", title: "Review priority, from the behaviour signals across the case. A lead for review, not proof." },
    el("div", { class: "ej-g-wrap" }, node, el("div", { class: "ej-g-mid" }, num, el("div", { class: "ej-g-of" }, "/ 100"))),
    el("div", { class: "ej-g-label" }, "Review priority"),
    el("div", { class: `ej-g-level ${lv.tone}` }, lv.name),
  );
}

function tile({ key, label, value, sub, tone, onclick, icon }) {
  const num = el("div", { class: "ej-k-num" }, "0");
  countUp(num, key, value);
  return el(
    onclick ? "button" : "div",
    { class: `ej-kpi${tone ? ` ${tone}` : ""}${onclick ? " click" : ""}`, onclick },
    el("div", { class: "ej-k-top" }, el("span", { class: "ej-k-ic" }, icon), el("span", { class: "ej-k-label" }, label)),
    num,
    sub ? el("div", { class: "ej-k-sub" }, sub) : null,
  );
}

// Visits over the case timeline, with high/medium risk visits as glowing dots.
function pulse(visits) {
  if (visits.length < 2) return el("div", { class: "ej-pulse-empty ej-hint" }, "The activity pulse appears once there are a few visits.");
  const W = 600;
  const H = 70;
  const N = 48;
  const t0 = visits[0].ts;
  const t1 = visits[visits.length - 1].ts;
  const span = Math.max(1, t1 - t0);
  const b = new Array(N).fill(0);
  for (const v of visits) b[Math.min(N - 1, Math.floor(((v.ts - t0) / span) * N))]++;
  const max = Math.max(...b, 1);
  const pts = b.map((n, i) => [(i / (N - 1)) * W, H - 6 - (n / max) * (H - 14)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L${W},${H} L0,${H} Z`;
  const dots = visits
    .filter((v) => v.riskLevel === "high" || v.riskLevel === "medium")
    .slice(-60)
    .map((v) => {
      const x = ((v.ts - t0) / span) * W;
      return svg("circle", { cx: x.toFixed(1), cy: 10, r: v.riskLevel === "high" ? 4 : 3, class: `ej-p-dot ${v.riskLevel}` });
    });
  const line = svg("path", { d, class: "ej-p-line", pathLength: 1 });
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
          svg("stop", { offset: "0%", "stop-color": "#ff3d7f", "stop-opacity": ".35" }),
          svg("stop", { offset: "100%", "stop-color": "#7c5cff", "stop-opacity": "0" }),
        ),
        svg(
          "linearGradient",
          { id: "ejpl", x1: "0", y1: "0", x2: "1", y2: "0" },
          svg("stop", { offset: "0%", "stop-color": "#f6821f" }),
          svg("stop", { offset: "50%", "stop-color": "#ff3d7f" }),
          svg("stop", { offset: "100%", "stop-color": "#7c5cff" }),
        ),
      ),
      svg("path", { d: area, fill: "url(#ejpa)" }),
      line,
      dots,
    ),
  );
}

function signalBars(visits, onSignal) {
  const counts = new Map();
  for (const v of visits) for (const s of new Set((v.signals || []).map((x) => x.id))) counts.set(s, (counts.get(s) || 0) + 1);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || SIGNAL_ORDER.indexOf(a[0]) - SIGNAL_ORDER.indexOf(b[0]))
    .slice(0, 6);
  if (!top.length) return el("div", { class: "ej-hint ej-pad" }, "No behaviours flagged yet. Uploads, AI sharing, evasion and the like appear here.");
  const max = top[0][1];
  return el(
    "div",
    { class: "ej-bars" },
    top.map(([id, n], i) => {
      const m = SIGNALS[id] || { label: id, icon: "•", tone: "info" };
      return el(
        "button",
        { class: `ej-bar ${m.tone}`, title: m.desc || "", onclick: () => onSignal(id), style: `--w:${Math.max(6, (n / max) * 100)}%;--i:${i}` },
        el("span", { class: "ej-bar-l" }, el("span", { class: "ej-bar-ic" }, m.icon), m.label),
        el("span", { class: "ej-bar-n" }, String(n)),
        el("span", { class: "ej-bar-fill" }),
      );
    }),
  );
}

function categoryMix(visits, onCategory) {
  const c = new Map();
  for (const v of visits) c.set(v.category, (c.get(v.category) || 0) + 1);
  const all = [...c.entries()].sort((a, b) => b[1] - a[1]);
  if (!all.length) return null;
  const top = all.slice(0, 7);
  const rest = all.slice(7).reduce((a, [, n]) => a + n, 0);
  const total = visits.length;
  return el(
    "div",
    { class: "ej-mix" },
    el(
      "div",
      { class: "ej-mix-bar" },
      top.map(([name, n]) =>
        el("button", { class: "ej-mix-seg", title: `${name}: ${n}`, style: `flex:${n};background:${categoryColor(name)}`, onclick: () => onCategory(name) }),
      ),
      rest ? el("span", { class: "ej-mix-seg rest", style: `flex:${rest}`, title: `Other: ${rest}` }) : null,
    ),
    el(
      "div",
      { class: "ej-mix-legend" },
      top.map(([name, n]) =>
        el(
          "button",
          { class: "ej-mix-key", onclick: () => onCategory(name) },
          el("span", { class: "ej-sw", style: `background:${categoryColor(name)}` }),
          name,
          el("span", { class: "ej-mix-pc" }, `${Math.round((n / total) * 100)}%`),
        ),
      ),
    ),
  );
}

export function renderHero(container, { journey, visits, verify, onSignal, onCategory, onRisk, onVerify, onSends }) {
  if (!journey) return container.replaceChildren();
  const t = journey.totals || {};
  const high = visits.filter((v) => v.riskLevel === "high").length;
  const med = visits.filter((v) => v.riskLevel === "medium").length;
  const nets = journey.insights?.gateway?.networks?.length || 0;
  const after = visits.filter((v) => v.local?.afterHours).length;
  const chain = !verify
    ? { tone: "", sub: "Not checked yet", icon: "⛓" }
    : verify.running
      ? { tone: "", sub: `Checking ${verify.checked.toLocaleString()}…`, icon: "⛓" }
      : verify.ok
        ? { tone: "ok", sub: `✓ Verified · ${shortHash(verify.headHash)}`, icon: "✓" }
        : { tone: "bad", sub: `✗ Broken${verify.failure?.seq ? ` at #${verify.failure.seq}` : ""}`, icon: "✗" };

  container.replaceChildren(
    el(
      "div",
      { class: "ej-hero-in" },
      gauge(reviewScore(visits)),
      el(
        "div",
        { class: "ej-kpis" },
        tile({ key: "visits", label: "Page visits", value: t.visits || 0, sub: plural(journey.sessions?.length || 0, "session"), icon: "◎" }),
        tile({ key: "high", label: "High risk", value: high, sub: `${med} medium`, tone: high ? "bad" : "", icon: "▲", onclick: () => onRisk(high ? "high" : "medium") }),
        tile({ key: "sends", label: "Uploads & forms", value: t.sends || 0, sub: `${(t.downloads || 0).toLocaleString()} downloads`, tone: t.sends ? "warn" : "", icon: "⬆", onclick: t.sends ? onSends : null }),
        tile({ key: "after", label: "After hours", value: after, sub: journey.insights?.workHours ? `Outside ${journey.insights.workHours}` : "", icon: "☾" }),
        tile({ key: "records", label: "Evidence records", value: journey.head?.seq || 0, sub: chain.sub, tone: chain.tone, icon: chain.icon, onclick: onVerify }),
        tile({ key: "gaps", label: "Gaps", value: t.gaps || 0, sub: plural(nets, "network"), tone: t.gaps ? "warn" : "", icon: "◇" }),
      ),
      el(
        "div",
        { class: "ej-hero-side" },
        el("div", { class: "ej-h-title" }, "Activity pulse", el("span", { class: "ej-hint" }, "red dots = flagged visits")),
        pulse(visits),
        el("div", { class: "ej-h-title" }, "Top behaviours"),
        signalBars(visits, onSignal),
      ),
    ),
    categoryMix(visits, onCategory),
  );
}
