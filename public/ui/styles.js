// Styles for the shared UI. Uses Workshop theme variables when present and
// falls back to its own light/dark palette in the standalone web front end.

const CSS = `
.ej-root {
  --ej-bg: var(--color-kumo-base, #ffffff);
  --ej-panel: var(--color-kumo-elevated, #f5f6f8);
  --ej-line: var(--color-kumo-line, #dfe3e8);
  --ej-text: var(--text-color-kumo-default, #1b1f24);
  --ej-subtle: var(--text-color-kumo-subtle, #5f6b7a);
  --ej-brand: var(--color-kumo-brand, #f6821f);
  --ej-ok: var(--color-kumo-success, #1f9d55);
  --ej-warn: var(--color-kumo-warning, #b7791f);
  --ej-bad: var(--color-kumo-danger, #d64545);
  color: var(--ej-text);
  background: var(--ej-bg);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  margin: 0;
}
@media (prefers-color-scheme: dark) {
  .ej-root {
    --ej-bg: var(--color-kumo-base, #121519);
    --ej-panel: var(--color-kumo-elevated, #1b1f25);
    --ej-line: var(--color-kumo-line, #2c323a);
    --ej-text: var(--text-color-kumo-default, #e7eaee);
    --ej-subtle: var(--text-color-kumo-subtle, #9aa5b1);
  }
}
.ej-root * { box-sizing: border-box; }
.ej-shell { display: flex; flex-direction: column; min-height: 100vh; }
.ej-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 14px;
  border-bottom: 1px solid var(--ej-line); position: sticky; top: 0; background: var(--ej-bg); z-index: 3; }
.ej-brand { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px; }
.ej-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--ej-brand); display: inline-block; }
.ej-spacer { flex: 1; }
.ej-select, .ej-btn { font: inherit; color: inherit; background: var(--ej-panel); border: 1px solid var(--ej-line);
  border-radius: 8px; padding: 6px 10px; }
.ej-btn { cursor: pointer; }
.ej-btn:hover { border-color: var(--ej-brand); }
.ej-btn[disabled] { opacity: .6; cursor: default; }
.ej-btn.primary { background: var(--ej-brand); color: #fff; border-color: var(--ej-brand); }
.ej-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; font-size: 12px;
  border: 1px solid var(--ej-line); background: var(--ej-panel); color: var(--ej-subtle); white-space: nowrap; }
.ej-pill.ok { color: var(--ej-ok); border-color: var(--ej-ok); }
.ej-pill.bad { color: var(--ej-bad); border-color: var(--ej-bad); }
.ej-pill.warn { color: var(--ej-warn); border-color: var(--ej-warn); }
.ej-pill.brand { color: var(--ej-brand); border-color: var(--ej-brand); }
.ej-banner { padding: 8px 14px; font-size: 12px; color: var(--ej-subtle); border-bottom: 1px solid var(--ej-line);
  background: var(--ej-panel); display: flex; flex-wrap: wrap; gap: 6px 14px; }
.ej-main { display: grid; grid-template-columns: minmax(320px, 440px) 1fr; flex: 1; min-height: 0; }
.ej-side { border-right: 1px solid var(--ej-line); overflow: auto; max-height: calc(100vh - 92px); min-width: 0; }
.ej-list { min-width: 0; }
.ej-detail { overflow: auto; max-height: calc(100vh - 92px); padding: 16px 18px 40px; min-width: 0; }
.ej-summary { padding: 10px 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; border-bottom: 1px solid var(--ej-line); }
.ej-sort { font-size: 12px; padding: 4px 8px; }
.ej-search { font: inherit; color: inherit; background: var(--ej-panel); border: 1px solid var(--ej-line); border-radius: 8px;
  padding: 6px 10px; flex: 1 1 220px; min-width: 0; max-width: 560px; margin-right: auto; }
.ej-search:focus, .ej-input:focus, .ej-select:focus { outline: 2px solid var(--ej-brand); outline-offset: -1px; }
.ej-link { font: inherit; font-size: 12px; color: var(--ej-brand); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
.ej-hint { font-size: 12px; color: var(--ej-subtle); }
.ej-count { display: inline-block; min-width: 18px; padding: 0 5px; margin-left: 6px; border-radius: 999px; background: var(--ej-brand);
  color: #fff; font-size: 11px; line-height: 18px; text-align: center; font-weight: 700; }

/* filter rail */
.ej-rail { border-bottom: 1px solid var(--ej-line); background: var(--ej-panel); }
.ej-rail-h { display: flex; align-items: center; gap: 8px; padding: 10px 14px; }
.ej-rail-title { display: none; font-weight: 700; font-size: 13px; }
.ej-rail-toggle { font: inherit; font-weight: 700; font-size: 13px; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.ej-rail.collapsed .ej-rail-body { display: none; }
.ej-rail-body { padding: 0 10px 12px; }
.ej-group h4 { margin: 12px 4px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--ej-subtle); }
.ej-facet { display: flex; align-items: center; gap: 8px; width: 100%; padding: 5px 6px; border: 0; border-radius: 6px; background: transparent;
  color: inherit; font: inherit; font-size: 13px; cursor: pointer; text-align: left; }
.ej-facet:hover { background: var(--ej-bg); }
.ej-facet.on { background: var(--ej-bg); box-shadow: inset 0 0 0 1px var(--ej-brand); }
.ej-facet.zero { opacity: .5; }
.ej-facet .l { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ej-facet .n { color: var(--ej-subtle); font-variant-numeric: tabular-nums; font-size: 12px; }
.ej-sw { width: 10px; height: 10px; border-radius: 3px; flex: none; }
.ej-sig-i { width: 18px; height: 18px; flex: none; display: inline-flex; align-items: center; justify-content: center; border-radius: 5px;
  font-size: 11px; border: 1px solid var(--ej-line); color: var(--ej-subtle); }
.ej-sig-i.bad { color: var(--ej-bad); border-color: var(--ej-bad); }
.ej-sig-i.warn { color: var(--ej-warn); border-color: var(--ej-warn); }
.ej-seg { display: flex; border: 1px solid var(--ej-line); border-radius: 8px; overflow: hidden; margin: 0 4px; }
.ej-seg button { flex: 1; font: inherit; font-size: 12px; padding: 5px 4px; border: 0; border-right: 1px solid var(--ej-line); background: var(--ej-bg);
  color: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0; }
.ej-seg button:last-child { border-right: 0; }
.ej-seg button.on { background: var(--ej-brand); color: #fff; }
.ej-seg .n { font-size: 11px; opacity: .8; font-variant-numeric: tabular-nums; }
.ej-hourchips { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; }
.ej-hourchips .ej-chip { cursor: pointer; background: none; font: inherit; font-size: 11px; color: var(--ej-brand); border-color: var(--ej-brand); }
.ej-group .ej-hint { padding: 2px 6px; }
.ej-foot { margin: 14px 6px 0; }

/* activity chart */
.ej-chartwrap { padding: 8px 14px 6px; border-bottom: 1px solid var(--ej-line); }
.ej-chartwrap:empty { display: none; }
.ej-chart-h { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 600; margin-bottom: 4px; flex-wrap: wrap; }
.ej-chart { display: grid; grid-template-columns: repeat(24, 1fr); gap: 2px; height: 72px; align-items: end; }
.ej-col { height: 100%; display: flex; flex-direction: column; justify-content: flex-end; padding: 0; border: 0; border-radius: 3px;
  background: transparent; cursor: pointer; min-width: 0; }
.ej-col.ah { background: color-mix(in srgb, var(--ej-warn) 10%, transparent); }
.ej-col:hover { background: color-mix(in srgb, var(--ej-brand) 12%, transparent); }
.ej-col.on { box-shadow: inset 0 0 0 1.5px var(--ej-brand); }
.ej-col-stack { display: flex; flex-direction: column-reverse; gap: 1px; }
.ej-seg-bar { border-radius: 2px; width: 100%; }
.ej-seg-bar.off { opacity: .18; }
.ej-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--ej-subtle); margin-top: 2px; }

/* risk */
.ej-risk { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 6px; border: 1px solid var(--ej-line); color: var(--ej-subtle);
  white-space: nowrap; text-transform: capitalize; align-self: start; margin-left: 6px; }
.ej-risk.high { color: #fff; background: var(--ej-bad); border-color: var(--ej-bad); }
.ej-risk.medium { color: var(--ej-warn); border-color: var(--ej-warn); }
.ej-risk.low { color: var(--ej-subtle); }
.ej-flags-h { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-bottom: 8px; }
.ej-flags-h .ej-risk { margin-left: 0; font-size: 12px; }
.ej-flag-list { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 8px; }
.ej-flag-list li { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: start; font-size: 13px; }
.ej-flags .ej-kv { margin-bottom: 8px; }
.ej-q { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: var(--ej-bg); padding: 1px 5px; border-radius: 4px; }
.ej-tools { border-bottom: 1px solid var(--ej-line); }
.ej-tools:empty { display: none; }
.ej-tools-row { padding: 8px 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.ej-tools .ej-btn { font-size: 13px; padding: 5px 9px; }
.ej-btn.danger { color: var(--ej-bad); border-color: var(--ej-bad); }
.ej-btn.danger.solid { background: var(--ej-bad); color: #fff; }
.ej-confirm { margin: 0 14px 10px; padding: 10px 0 0; border: 1px solid var(--ej-bad); border-radius: 8px; font-size: 13px; }
.ej-confirm > div:first-child, .ej-confirm .ej-bad { padding: 0 12px; }
.ej-bad { color: var(--ej-bad); margin-top: 6px; }
.ej-input { font: inherit; color: inherit; background: var(--ej-bg); border: 1px solid var(--ej-line); border-radius: 8px;
  padding: 6px 10px; flex: 1 1 160px; min-width: 0; }
.ej-session { border-bottom: 1px solid var(--ej-line); }
.ej-session-h { padding: 10px 14px 6px; font-size: 12px; color: var(--ej-subtle); font-weight: 600;
  position: sticky; top: 0; background: var(--ej-bg); z-index: 1; }
.ej-visit { display: grid; grid-template-columns: 62px 1fr auto; gap: 2px 10px; width: 100%; text-align: left; font: inherit; color: inherit;
  background: transparent; border: 0; border-left: 3px solid transparent; padding: 8px 14px 8px 11px; cursor: pointer; }
.ej-visit:hover { background: var(--ej-panel); }
.ej-visit.sel { background: var(--ej-panel); border-left-color: var(--ej-brand); }
.ej-visit-time { color: var(--ej-subtle); font-variant-numeric: tabular-nums; font-size: 12px; padding-top: 1px; }
.ej-visit-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ej-visit-url { grid-column: 2 / 4; color: var(--ej-subtle); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ej-visit-q { grid-column: 2 / 4; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ej-visit-chips { grid-column: 2 / 4; display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
.ej-visit.r-high { border-left-color: var(--ej-bad); }
.ej-visit.r-medium { border-left-color: var(--ej-warn); }
.ej-visit.sel { border-left-color: var(--ej-brand); }
.ej-chip.cat { color: var(--ej-text); border-color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); }
.ej-chip.sig.bad { color: var(--ej-bad); border-color: var(--ej-bad); font-weight: 600; }
.ej-chip.sig.warn { color: var(--ej-warn); border-color: var(--ej-warn); font-weight: 600; }
.ej-chip { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--ej-line); color: var(--ej-subtle); }
.ej-chip.upload, .ej-chip.form { color: var(--ej-bad); border-color: var(--ej-bad); font-weight: 600; }
.ej-chip.gap { color: var(--ej-warn); border-color: var(--ej-warn); }
.ej-chip.dl { color: var(--ej-brand); border-color: var(--ej-brand); }
.ej-empty { color: var(--ej-subtle); padding: 28px 18px; text-align: center; }
.ej-back { display: none; margin-bottom: 12px; }
.ej-h2 { font-size: 18px; margin: 0 0 4px; word-break: break-word; }
.ej-url { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--ej-subtle); word-break: break-all; }
.ej-section { margin-top: 18px; }
.ej-section h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--ej-subtle); margin: 0 0 8px; }
.ej-card { border: 1px solid var(--ej-line); border-radius: 10px; background: var(--ej-panel); padding: 12px; }
.ej-shot { border: 1px solid var(--ej-line); border-radius: 10px; overflow: hidden; background: var(--ej-panel); }
.ej-shot img { display: block; width: 100%; height: auto; }
.ej-shot-wait { padding: 40px 16px; text-align: center; color: var(--ej-subtle); }
.ej-caption { font-size: 12px; color: var(--ej-subtle); padding: 8px 10px; border-top: 1px solid var(--ej-line); display: flex; flex-wrap: wrap; gap: 6px 12px; }
.ej-caption strong { color: var(--ej-warn); }
.ej-kv { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; font-size: 13px; }
.ej-kv dt { color: var(--ej-subtle); }
.ej-kv dd { margin: 0; word-break: break-word; }
.ej-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; word-break: break-all; }
.ej-send { border: 1px solid var(--ej-line); border-left: 3px solid var(--ej-bad); border-radius: 8px; padding: 10px; margin-bottom: 8px; background: var(--ej-bg); }
.ej-send-h { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 13px; margin-bottom: 4px; }
.ej-pre { white-space: pre-wrap; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
  max-height: 220px; overflow: auto; background: var(--ej-panel); border: 1px solid var(--ej-line); border-radius: 6px; padding: 8px; margin: 6px 0 0; }
.ej-gap { border-left: 3px solid var(--ej-warn); padding: 6px 10px; margin-bottom: 6px; background: var(--ej-bg); border-radius: 6px; font-size: 13px; }
.ej-error { margin: 14px; padding: 12px; border: 1px solid var(--ej-bad); color: var(--ej-bad); border-radius: 8px; }
.ej-setup { max-width: 720px; margin: 24px auto; padding: 0 18px; }
.ej-setup ol { padding-left: 20px; }
.ej-setup li { margin-bottom: 8px; }
.ej-spin { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--ej-line); border-top-color: var(--ej-brand);
  border-radius: 50%; animation: ej-spin 0.8s linear infinite; vertical-align: -2px; margin-right: 6px; }
@keyframes ej-spin { to { transform: rotate(360deg); } }
details.ej-more summary { cursor: pointer; color: var(--ej-subtle); font-size: 13px; }

@media (min-width: 1200px) {
  .ej-main { grid-template-columns: 250px minmax(340px, 460px) 1fr; }
  .ej-side { display: contents; }
  .ej-rail, .ej-list { overflow: auto; max-height: calc(100vh - 92px); border-right: 1px solid var(--ej-line); }
  .ej-rail { border-bottom: 0; }
  .ej-rail.collapsed .ej-rail-body { display: block; }
  .ej-rail-toggle { display: none; }
  .ej-rail-title { display: inline; }
}
@media (max-width: 820px) {
  .ej-main { grid-template-columns: 1fr; }
  .ej-side, .ej-detail { max-height: none; border-right: 0; }
  .ej-main.show-detail .ej-side { display: none; }
  .ej-main:not(.show-detail) .ej-detail { display: none; }
  .ej-back { display: inline-block; }
  .ej-search { order: 10; flex-basis: 100%; max-width: none; }
  .ej-flag-list li { grid-template-columns: 22px 1fr; }
  .ej-flag-list li .ej-link { grid-column: 2; justify-self: start; }
}
@media print {
  .ej-top { position: static; }
  .ej-btn, .ej-select, .ej-back { display: none !important; }
  .ej-main { display: block; }
  .ej-rail, .ej-tools, .ej-search, .ej-link { display: none !important; }
  .ej-side, .ej-list, .ej-detail { max-height: none; overflow: visible; border: 0; display: block !important; }
  .ej-session, .ej-send, .ej-card, .ej-shot { break-inside: avoid; }
}
`;

export function injectStyles(doc = document) {
  if (doc.getElementById("ej-styles")) return;
  const s = doc.createElement("style");
  s.id = "ej-styles";
  s.textContent = CSS;
  doc.head.append(s);
}
