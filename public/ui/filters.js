// Filter rail (behaviours, categories, time, risk) and the hour-of-day activity chart.

import { el, plural } from "./dom.js";
import { RISK_LEVELS, SIGNALS, SIGNAL_ORDER, activeFilterCount, categoryColor, facets, matches } from "./insights.js";

export function renderRail(container, { visits, f, insights, collapsed, onChange, onToggle }) {
  const fc = facets(visits, f);
  const n = activeFilterCount(f);
  const toggle = (set, key) => {
    set.has(key) ? set.delete(key) : set.add(key);
    onChange();
  };

  const head = el(
    "div",
    { class: "ej-rail-h" },
    el(
      "button",
      { class: "ej-rail-toggle", "aria-expanded": String(!collapsed), onclick: onToggle },
      collapsed ? "▸" : "▾",
      " Filters",
      n ? el("span", { class: "ej-count" }, String(n)) : null,
    ),
    el("span", { class: "ej-rail-title" }, "Filters", n ? el("span", { class: "ej-count" }, String(n)) : null),
    el("div", { class: "ej-spacer" }),
    n
      ? el(
          "button",
          {
            class: "ej-link",
            onclick: () => {
              f.signals.clear();
              f.categories.clear();
              f.hours.clear();
              f.afterHours = false;
              f.risk = "all";
              f.q = "";
              onChange({ clearSearch: true });
            },
          },
          "Clear all",
        )
      : null,
  );

  const risk = el(
    "div",
    { class: "ej-seg", role: "group", "aria-label": "Risk" },
    RISK_LEVELS.map((r) =>
      el(
        "button",
        {
          class: f.risk === r.id ? "on" : "",
          "aria-pressed": String(f.risk === r.id),
          onclick: () => {
            f.risk = r.id;
            onChange();
          },
        },
        r.label,
        el("span", { class: "n" }, String(fc.risk.get(r.id) || 0)),
      ),
    ),
  );

  const present = new Set();
  for (const v of visits) for (const s of v.signals || []) present.add(s.id);
  const sigItems = SIGNAL_ORDER.filter((id) => present.has(id) || f.signals.has(id)).map((id) => {
    const m = SIGNALS[id];
    return facetButton({
      on: f.signals.has(id),
      label: m.label,
      icon: el("span", { class: `ej-sig-i ${m.tone}` }, m.icon),
      count: fc.signals.get(id) || 0,
      title: m.desc,
      onclick: () => toggle(f.signals, id),
    });
  });

  const cats = new Map();
  for (const v of visits) cats.set(v.category, 0);
  for (const [k, c] of fc.categories) cats.set(k, c);
  for (const k of f.categories) if (!cats.has(k)) cats.set(k, 0);
  const catItems = [...cats.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) =>
      facetButton({
        on: f.categories.has(name),
        label: name,
        icon: el("span", { class: "ej-sw", style: `background:${categoryColor(name)}` }),
        count,
        onclick: () => toggle(f.categories, name),
      }),
    );

  const hours = [...f.hours].sort((a, b) => a - b);
  const time = [
    facetButton({
      on: f.afterHours,
      label: "After hours only",
      icon: el("span", { class: "ej-sig-i info" }, "☾"),
      count: fc.afterHours,
      title: insights?.workHours ? `Working hours ${insights.workHours}, ${insights.tz}` : "",
      onclick: () => {
        f.afterHours = !f.afterHours;
        onChange();
      },
    }),
    hours.length
      ? el(
          "div",
          { class: "ej-hourchips" },
          hours.map((h) =>
            el("button", { class: "ej-chip on", onclick: () => toggle(f.hours, h), title: "Remove" }, `${pad(h)}:00 ×`),
          ),
        )
      : el("div", { class: "ej-hint" }, "Tip: click a bar in the activity chart to filter by hour."),
  ];

  container.classList.toggle("collapsed", !!collapsed);
  container.replaceChildren(
    head,
    el(
      "div",
      { class: "ej-rail-body" },
      group("Risk", risk),
      group("Behaviours", sigItems.length ? sigItems : el("div", { class: "ej-hint" }, "No behaviours flagged yet.")),
      group("Categories", catItems.length ? catItems : el("div", { class: "ej-hint" }, "No visits yet.")),
      group("Time", time),
      el(
        "p",
        { class: "ej-hint ej-foot" },
        "Behaviours are leads for review, not proof. Categories: ",
        insights?.categorySources || "built-in",
        ". Times in ",
        insights?.tz || "UTC",
        ".",
      ),
    ),
  );
}

function group(title, ...children) {
  return el("div", { class: "ej-group" }, el("h4", {}, title), ...children);
}

function facetButton({ on, label, icon, count, title, onclick }) {
  return el(
    "button",
    { class: `ej-facet${on ? " on" : ""}${!count && !on ? " zero" : ""}`, "aria-pressed": String(!!on), title: title || "", onclick },
    icon,
    el("span", { class: "l" }, label),
    el("span", { class: "n" }, String(count)),
  );
}

function pad(h) {
  return String(h).padStart(2, "0");
}

function workRange(insights) {
  const m = /^(\d{1,2}):?(\d{2})?-(\d{1,2}):?(\d{2})?$/.exec(insights?.workHours || "08:00-18:00");
  if (!m) return [8 * 60, 18 * 60];
  return [Number(m[1]) * 60 + Number(m[2] || 0), Number(m[3]) * 60 + Number(m[4] || 0)];
}

// 24 columns (hour of day in the case time zone), stacked by category.
// Visits that don't match the current filters are faded. Click a column to filter by that hour.
export function renderChart(container, { visits, f, insights, onHour }) {
  const byHour = Array.from({ length: 24 }, () => new Map());
  let max = 0;
  const totals = new Array(24).fill(0);
  for (const v of visits) {
    const h = v.local?.hour;
    if (h == null) continue;
    const m = byHour[h];
    const e = m.get(v.category) || { on: 0, off: 0 };
    matches(v, f, "hours") ? e.on++ : e.off++;
    m.set(v.category, e);
    totals[h]++;
    if (totals[h] > max) max = totals[h];
  }
  const [ws, we] = workRange(insights);
  const H = 64;
  const cols = byHour.map((m, h) => {
    const after = h * 60 < ws || h * 60 >= we;
    const segs = [];
    const entries = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [cat, e] of entries) {
      for (const [n, on] of [
        [e.on, true],
        [e.off, false],
      ]) {
        if (!n) continue;
        segs.push(
          el("div", {
            class: `ej-seg-bar${on ? "" : " off"}`,
            style: `height:${Math.max(2, Math.round((n / (max || 1)) * H))}px;background:${categoryColor(cat)}`,
            title: `${pad(h)}:00 · ${cat}: ${n}${on ? "" : " (filtered out)"}`,
          }),
        );
      }
    }
    return el(
      "button",
      {
        class: `ej-col${after ? " ah" : ""}${f.hours.has(h) ? " on" : ""}`,
        title: `${pad(h)}:00–${pad(h)}:59 · ${plural(totals[h], "visit")}${after ? " · after hours" : ""}`,
        "aria-label": `${pad(h)}:00, ${plural(totals[h], "visit")}`,
        onclick: () => onHour(h),
      },
      el("div", { class: "ej-col-stack" }, segs),
    );
  });
  container.replaceChildren(
    el(
      "div",
      { class: "ej-chart-h" },
      el("span", {}, "Activity by hour of day"),
      el("span", { class: "ej-hint" }, `${insights?.tz || "UTC"} · shaded = after hours`),
    ),
    el("div", { class: "ej-chart" }, cols),
    el("div", { class: "ej-axis" }, ["00", "06", "12", "18", "23"].map((t) => el("span", {}, t))),
  );
}
