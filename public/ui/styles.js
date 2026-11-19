// Styles for the shared investigator UI.
//
// Palette: dark slate console (light variant via prefers-color-scheme). Cloudflare orange
// and amber are the brand/action colours; blue marks selection, focus and neutral data;
// red/amber/green are reserved for risk and integrity states. No pinks or magentas.
//
// Layout: on desktop the app is exactly one screen (no page scroll); each column scrolls
// on its own. Filters become a drawer below 1200px; list and detail become separate
// screens below 820px, where the page scrolls normally.

const CSS = `
.ej-root {
  --ej-bg: #0b0e14;
  --ej-panel: rgba(255,255,255,.035);
  --ej-panel2: rgba(255,255,255,.065);
  --ej-solid: #121621;
  --ej-line: rgba(255,255,255,.08);
  --ej-line2: rgba(255,255,255,.15);
  --ej-text: #e7eaf0;
  --ej-subtle: #8c95a8;
  --ej-brand: #f6821f;
  --ej-amber: #fbad41;
  --ej-info: #4c8dff;
  --ej-ok: #3ecf8e;
  --ej-warn: #f5b83d;
  --ej-bad: #f2555a;
  --ej-grad: linear-gradient(135deg, #fbad41, #f6821f);
  --ej-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 12px 32px -18px rgba(0,0,0,.7);
  --ej-r: 12px;
  color: var(--ej-text);
  background:
    radial-gradient(1000px 420px at 0% -10%, rgba(246,130,31,.10), transparent 60%),
    radial-gradient(900px 420px at 100% -10%, rgba(76,141,255,.10), transparent 60%),
    var(--ej-bg);
  font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  margin: 0;
  min-height: 100vh;
}
@media (prefers-color-scheme: light) {
  .ej-root {
    --ej-bg: #f3f5f9; --ej-panel: rgba(255,255,255,.82); --ej-panel2: #ffffff; --ej-solid: #ffffff;
    --ej-line: rgba(15,23,42,.09); --ej-line2: rgba(15,23,42,.18); --ej-text: #111827; --ej-subtle: #5b6475;
    --ej-info: #2563eb; --ej-ok: #0f9f6e; --ej-warn: #b7791f; --ej-bad: #dc2626;
    --ej-shadow: 0 1px 2px rgba(15,23,42,.05), 0 10px 28px -20px rgba(15,23,42,.35);
    background:
      radial-gradient(1000px 420px at 0% -10%, rgba(246,130,31,.10), transparent 60%),
      radial-gradient(900px 420px at 100% -10%, rgba(37,99,235,.08), transparent 60%),
      var(--ej-bg);
  }
}
.ej-root * { box-sizing: border-box; }
.ej-root ::selection { background: color-mix(in srgb, var(--ej-info) 35%, transparent); }
.ej-root ::-webkit-scrollbar { width: 10px; height: 10px; }
.ej-root ::-webkit-scrollbar-thumb { background: var(--ej-line2); border-radius: 10px; border: 3px solid transparent; background-clip: content-box; }
.ej-root :focus-visible { outline: 2px solid var(--ej-info); outline-offset: 2px; }
.ej-shell { height: 100vh; height: 100dvh; display: grid; grid-template-rows: auto auto minmax(0, 1fr); }

/* ---- header ---- */
.ej-head { position: relative; z-index: 10; }
.ej-top { display: flex; align-items: center; gap: 10px 14px; padding: 10px 16px; border-bottom: 1px solid var(--ej-line);
  background: color-mix(in srgb, var(--ej-bg) 80%, transparent); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
.ej-brand { display: flex; align-items: center; gap: 10px; flex: none; }
.ej-logo { width: 30px; height: 30px; flex: none; filter: drop-shadow(0 4px 12px rgba(246,130,31,.35)); }
.ej-logo svg { width: 100%; height: 100%; display: block; }
.ej-brand-t { display: flex; flex-direction: column; line-height: 1.15; }
.ej-brand-n { font-weight: 750; font-size: 14px; letter-spacing: -.01em; white-space: nowrap; }
.ej-brand-s { font-size: 10.5px; color: var(--ej-subtle); display: inline-flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: .12em; }
.ej-live { width: 7px; height: 7px; border-radius: 50%; background: var(--ej-ok); animation: ej-ping 2.4s infinite; }
@keyframes ej-ping { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ej-ok) 60%, transparent); } 80%, 100% { box-shadow: 0 0 0 6px transparent; } }
.ej-case { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 0 1 300px; padding-left: 14px; border-left: 1px solid var(--ej-line); }
.ej-case .ej-select { font-weight: 650; font-size: 13px; padding: 2px 24px 2px 6px; margin-left: -6px; border-color: transparent; background-color: transparent; max-width: 100%; }
.ej-case .ej-select:hover { border-color: var(--ej-line); }
.ej-ctx { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--ej-subtle); white-space: nowrap; overflow: hidden; min-width: 0; }
.ej-ctx-sub { overflow: hidden; text-overflow: ellipsis; }
.ej-poc { font-size: 10px; font-weight: 700; letter-spacing: .06em; color: var(--ej-warn); border: 1px solid color-mix(in srgb, var(--ej-warn) 50%, transparent);
  border-radius: 5px; padding: 0 5px; line-height: 15px; flex: none; }
.ej-chain { display: inline-flex; align-items: center; gap: 4px; padding: 3px; border: 1px solid var(--ej-line); border-radius: 11px; background: var(--ej-panel); flex: none; max-width: 46vw; }
.ej-chain .ej-pill { border: 0; background: none; padding: 2px 6px; overflow: hidden; text-overflow: ellipsis; }
.ej-chain .ej-pill.ok, .ej-chain .ej-pill.bad { background: none; }
.ej-chain .ej-btn { padding: 4px 10px; font-size: 12px; }
.ej-spacer { flex: 1; }

/* case tools popover */
.ej-pop { position: absolute; right: 16px; top: calc(100% + 6px); width: min(620px, calc(100vw - 24px)); background: var(--ej-solid); border: 1px solid var(--ej-line2);
  border-radius: var(--ej-r); box-shadow: 0 24px 60px -20px rgba(0,0,0,.6); padding: 6px 0 4px; animation: ej-rise .18s ease-out both; }
.ej-pop[hidden] { display: none; }
.ej-pop-h { display: flex; align-items: center; gap: 8px; padding: 6px 14px 4px; font-size: 13px; }
.ej-who { max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
.ej-tools:empty { display: none; }
.ej-tools-row { padding: 8px 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.ej-confirm { margin: 0 14px 10px; padding: 10px 0 0; border: 1px solid var(--ej-bad); border-radius: 10px; font-size: 13px; background: color-mix(in srgb, var(--ej-bad) 6%, transparent); }
.ej-confirm > div:first-child, .ej-confirm .ej-bad { padding: 0 12px; }
.ej-bad { color: var(--ej-bad); margin-top: 6px; }

/* ---- controls ---- */
.ej-select, .ej-btn { font: inherit; font-size: 13px; color: inherit; background: var(--ej-panel); border: 1px solid var(--ej-line);
  border-radius: 9px; padding: 6px 11px; transition: border-color .15s, background .15s, box-shadow .15s; }
.ej-select option { background: var(--ej-solid); color: var(--ej-text); }
.ej-btn { cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.ej-btn:hover { border-color: var(--ej-line2); background: var(--ej-panel2); }
.ej-btn[disabled] { opacity: .45; cursor: default; }
.ej-btn.on { border-color: var(--ej-info); color: var(--ej-info); }
.ej-btn.primary { background: var(--ej-grad); color: #1a1205; border-color: transparent; box-shadow: 0 6px 18px -10px rgba(246,130,31,.9); }
.ej-btn.primary:hover { filter: brightness(1.06); }
.ej-btn.danger { color: var(--ej-bad); border-color: color-mix(in srgb, var(--ej-bad) 50%, transparent); }
.ej-btn.danger.solid { background: var(--ej-bad); color: #fff; }
.ej-icon { width: 32px; height: 32px; padding: 0; justify-content: center; font-size: 16px; flex: none; }
.ej-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 500;
  border: 1px solid var(--ej-line); background: var(--ej-panel); color: var(--ej-subtle); white-space: nowrap; }
.ej-pill.ok { color: var(--ej-ok); border-color: color-mix(in srgb, var(--ej-ok) 45%, transparent); background: color-mix(in srgb, var(--ej-ok) 9%, transparent); }
.ej-pill.bad { color: var(--ej-bad); border-color: color-mix(in srgb, var(--ej-bad) 45%, transparent); background: color-mix(in srgb, var(--ej-bad) 9%, transparent); }
.ej-pill.warn { color: var(--ej-warn); border-color: color-mix(in srgb, var(--ej-warn) 45%, transparent); background: color-mix(in srgb, var(--ej-warn) 9%, transparent); }
.ej-pill.brand { color: var(--ej-brand); border-color: color-mix(in srgb, var(--ej-brand) 45%, transparent); }
.ej-search { font: inherit; color: inherit; background: var(--ej-panel); border: 1px solid var(--ej-line); border-radius: 10px;
  padding: 7px 12px 7px 34px; flex: 1 1 240px; min-width: 0; max-width: 620px; margin: 0 auto;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%238c95a8' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='7' cy='7' r='5'/%3E%3Cpath d='m11 11 3.5 3.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: 11px 50%; }
.ej-search:focus, .ej-input:focus, .ej-select:focus { outline: none; border-color: var(--ej-info); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ej-info) 22%, transparent); }
.ej-input { font: inherit; color: inherit; background: var(--ej-panel); border: 1px solid var(--ej-line); border-radius: 9px; padding: 6px 10px; flex: 1 1 160px; min-width: 0; }
.ej-link { font: inherit; font-size: 12px; color: var(--ej-info); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.ej-hint { font-size: 12px; color: var(--ej-subtle); }
.ej-count { display: inline-block; min-width: 18px; padding: 0 5px; border-radius: 999px; background: var(--ej-info); color: #fff; font-size: 11px; line-height: 18px; text-align: center; font-weight: 700; }
.ej-root kbd { font: 600 11px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 1px 6px; border-radius: 5px; border: 1px solid var(--ej-line2); border-bottom-width: 2px; background: var(--ej-panel); color: var(--ej-text); }

/* ---- overview band ---- */
.ej-hero { padding: 12px 16px 0; }
.ej-hero:empty { display: none; }
.ej-hero-in { display: flex; gap: 10px; align-items: stretch; }
.ej-gauge, .ej-kpi, .ej-pulse { background: var(--ej-panel); border: 1px solid var(--ej-line); border-radius: var(--ej-r); box-shadow: var(--ej-shadow); }
.ej-gauge { --g: var(--ej-ok); display: flex; align-items: center; gap: 12px; padding: 10px 16px 10px 12px; flex: none; animation: ej-rise .45s ease-out both; }
.ej-gauge.warn { --g: var(--ej-warn); } .ej-gauge.elev { --g: var(--ej-brand); } .ej-gauge.bad { --g: var(--ej-bad); }
.ej-g-wrap { position: relative; width: 64px; height: 64px; flex: none; }
.ej-g-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.ej-g-track { fill: none; stroke: var(--ej-line); stroke-width: 7; }
.ej-g-val { fill: none; stroke: var(--g); stroke-width: 7; stroke-linecap: round; transition: stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1);
  filter: drop-shadow(0 0 5px color-mix(in srgb, var(--g) 55%, transparent)); }
.ej-g-mid { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.ej-g-num { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.ej-g-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--ej-subtle); white-space: nowrap; }
.ej-g-level { font-size: 16px; font-weight: 800; color: var(--g); }
.ej-kpis { display: grid; grid-template-columns: repeat(6, minmax(92px, 1fr)); gap: 10px; flex: 3 1 560px; min-width: 0; }
.ej-kpi { position: relative; text-align: left; font: inherit; color: inherit; padding: 9px 12px; display: flex; flex-direction: column; justify-content: center; gap: 1px;
  min-width: 0; overflow: hidden; animation: ej-rise .45s ease-out both; }
.ej-kpi:nth-child(2) { animation-delay: .04s } .ej-kpi:nth-child(3) { animation-delay: .08s } .ej-kpi:nth-child(4) { animation-delay: .12s }
.ej-kpi:nth-child(5) { animation-delay: .16s } .ej-kpi:nth-child(6) { animation-delay: .2s }
.ej-kpi::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 0 3px 3px 0; background: transparent; }
.ej-kpi.bad::before { background: var(--ej-bad); } .ej-kpi.warn::before { background: var(--ej-warn); } .ej-kpi.ok::before { background: var(--ej-ok); }
.ej-kpi.click { cursor: pointer; transition: border-color .15s, background .15s, transform .15s; }
.ej-kpi.click:hover { border-color: var(--ej-line2); background: var(--ej-panel2); transform: translateY(-1px); }
.ej-k-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--ej-subtle); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ej-k-num { font-size: 22px; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; line-height: 1.2; }
.ej-kpi.bad .ej-k-num { color: var(--ej-bad); } .ej-kpi.warn .ej-k-num { color: var(--ej-warn); }
.ej-k-sub { font-size: 11.5px; color: var(--ej-subtle); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ej-kpi.ok .ej-k-sub { color: var(--ej-ok); } .ej-kpi.bad .ej-k-sub { color: var(--ej-bad); }
.ej-pulse { flex: 2 1 260px; min-width: 220px; padding: 8px 12px 6px; display: flex; flex-direction: column; animation: ej-rise .45s .1s ease-out both; }
.ej-pulse-empty { align-items: center; justify-content: center; }
.ej-p-svg { width: 100%; height: 56px; display: block; overflow: visible; flex: 1; }
.ej-p-line { fill: none; stroke: var(--ej-brand); stroke-width: 2; stroke-dasharray: 1; stroke-dashoffset: 1; animation: ej-draw 1.4s .15s ease-out forwards; vector-effect: non-scaling-stroke; }
.ej-p-base { stroke: var(--ej-line); stroke-width: 1; vector-effect: non-scaling-stroke; }
.ej-p-dot { fill: var(--ej-warn); } .ej-p-dot.high { fill: var(--ej-bad); }
.ej-p-axis { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--ej-subtle); margin-top: 2px; }
@keyframes ej-draw { to { stroke-dashoffset: 0; } }
.ej-hero-tog { align-self: flex-start; }
.ej-hero.collapsed { padding-top: 8px; }
.ej-hero.collapsed .ej-gauge { padding: 4px 12px 4px 6px; }
.ej-hero.collapsed .ej-g-wrap { width: 34px; height: 34px; }
.ej-hero.collapsed .ej-g-num { font-size: 11px; }
.ej-hero.collapsed .ej-g-label { display: none; }
.ej-hero.collapsed .ej-g-level { font-size: 13px; }
.ej-hero.collapsed .ej-kpi { flex-direction: row; align-items: baseline; gap: 8px; padding: 6px 12px; }
.ej-hero.collapsed .ej-k-num { font-size: 15px; order: -1; }
.ej-hero.collapsed .ej-k-sub { display: none; }
.ej-hero.collapsed .ej-hero-tog { align-self: center; }

/* ---- main: filters | list | detail ---- */
.ej-main { display: grid; grid-template-columns: 260px minmax(320px, 400px) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: 12px; padding: 12px 16px 16px; min-height: 0; }
.ej-railcol, .ej-list, .ej-detail { background: var(--ej-panel); border: 1px solid var(--ej-line); border-radius: var(--ej-r); box-shadow: var(--ej-shadow); min-height: 0; min-width: 0; }
.ej-scrim, .ej-rail-foot, .ej-filters-btn { display: none; }

/* filter panel */
.ej-railcol { overflow: auto; display: flex; flex-direction: column; }
.ej-rail-h { display: flex; align-items: center; gap: 8px; padding: 12px 14px 4px; }
.ej-rail-toggle { display: none; }
.ej-rail-title { font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; }
.ej-rail-body { padding: 0 10px 8px; }
.ej-group h4 { margin: 14px 6px 6px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--ej-subtle); }
.ej-facet { position: relative; display: flex; align-items: center; gap: 8px; width: 100%; padding: 5px 8px; border: 0; border-radius: 8px; background: transparent;
  color: inherit; font: inherit; font-size: 13px; cursor: pointer; text-align: left; isolation: isolate; transition: background .12s, box-shadow .12s; }
.ej-facet.bar::after { content: ""; position: absolute; left: 0; top: 3px; bottom: 3px; width: var(--p); z-index: -1; border-radius: 6px;
  background: color-mix(in srgb, var(--fc) 16%, transparent); transform-origin: left; animation: ej-grow .7s ease-out both; }
.ej-facet:hover { background: var(--ej-panel2); }
.ej-facet.on { box-shadow: inset 0 0 0 1.5px var(--ej-info); background: color-mix(in srgb, var(--ej-info) 8%, transparent); }
.ej-facet.zero { opacity: .45; }
.ej-facet .l { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ej-facet .n { color: var(--ej-subtle); font-variant-numeric: tabular-nums; font-size: 12px; }
@keyframes ej-grow { from { transform: scaleX(0); } }
.ej-sw { width: 10px; height: 10px; border-radius: 3px; flex: none; }
.ej-sig-i { width: 20px; height: 20px; flex: none; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;
  font-size: 11px; border: 1px solid var(--ej-line); color: var(--ej-subtle); background: var(--ej-panel); }
.ej-sig-i.bad { color: var(--ej-bad); border-color: color-mix(in srgb, var(--ej-bad) 50%, transparent); }
.ej-sig-i.warn { color: var(--ej-warn); border-color: color-mix(in srgb, var(--ej-warn) 50%, transparent); }
.ej-seg { display: flex; border: 1px solid var(--ej-line); border-radius: 9px; overflow: hidden; margin: 0 4px; }
.ej-seg button { flex: 1; font: inherit; font-size: 12px; padding: 5px 4px; border: 0; border-right: 1px solid var(--ej-line); background: transparent;
  color: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; }
.ej-seg button:last-child { border-right: 0; }
.ej-seg button:hover { background: var(--ej-panel2); }
.ej-seg button.on { background: var(--ej-info); color: #fff; }
.ej-seg .n { font-size: 11px; opacity: .8; font-variant-numeric: tabular-nums; }
.ej-hourchips { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; }
.ej-hourchips .ej-chip { cursor: pointer; font: inherit; font-size: 11px; color: var(--ej-info); border-color: var(--ej-info); }
.ej-group .ej-hint { padding: 2px 6px; }
.ej-foot { margin: 12px 6px 0; }
.ej-chartwrap { padding: 4px 16px 14px; }
.ej-chartwrap:empty { display: none; }
.ej-chart-h { display: flex; justify-content: space-between; gap: 8px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--ej-subtle); font-weight: 600; margin-bottom: 6px; flex-wrap: wrap; }
.ej-chart-h .ej-hint { text-transform: none; letter-spacing: 0; font-weight: 400; font-size: 11px; }
.ej-chart { display: grid; grid-template-columns: repeat(24, 1fr); gap: 1px; height: 64px; align-items: end; }
.ej-col { height: 100%; display: flex; flex-direction: column; justify-content: flex-end; padding: 0; border: 0; border-radius: 3px; background: transparent; cursor: pointer; min-width: 0; }
.ej-col.ah { background: color-mix(in srgb, var(--ej-info) 7%, transparent); }
.ej-col:hover { background: color-mix(in srgb, var(--ej-info) 16%, transparent); }
.ej-col.on { box-shadow: inset 0 0 0 1.5px var(--ej-info); }
.ej-col-stack { display: flex; flex-direction: column-reverse; gap: 1px; transform-origin: bottom; animation: ej-growy .6s ease-out both; }
@keyframes ej-growy { from { transform: scaleY(0); } }
.ej-seg-bar { border-radius: 2px; width: 100%; }
.ej-seg-bar.off { opacity: .18; }
.ej-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--ej-subtle); margin-top: 3px; }

/* visit list */
.ej-list { display: flex; flex-direction: column; overflow: hidden; }
.ej-summary { padding: 10px 12px 8px; border-bottom: 1px solid var(--ej-line); flex: none; }
.ej-sum-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ej-sum-n { font-weight: 700; font-size: 13px; }
.ej-sort { font-size: 12px; padding: 4px 8px; }
.ej-fchips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; align-items: center; }
.ej-fchip { display: inline-flex; align-items: center; gap: 5px; font: inherit; font-size: 11.5px; padding: 2px 4px 2px 9px; border-radius: 999px; cursor: pointer;
  color: var(--ej-info); border: 1px solid color-mix(in srgb, var(--ej-info) 50%, transparent); background: color-mix(in srgb, var(--ej-info) 9%, transparent); }
.ej-fchip.bad { color: var(--ej-bad); border-color: color-mix(in srgb, var(--ej-bad) 50%, transparent); background: color-mix(in srgb, var(--ej-bad) 9%, transparent); }
.ej-fchip.warn { color: var(--ej-warn); border-color: color-mix(in srgb, var(--ej-warn) 50%, transparent); background: color-mix(in srgb, var(--ej-warn) 9%, transparent); }
.ej-fchip .x { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 12px; }
.ej-fchip:hover .x { background: color-mix(in srgb, currentColor 20%, transparent); }
.ej-items { overflow: auto; flex: 1; min-height: 0; padding-bottom: 8px; }
.ej-session-h { padding: 10px 14px 5px; font-size: 10.5px; color: var(--ej-subtle); font-weight: 600; text-transform: uppercase; letter-spacing: .06em;
  position: sticky; top: 0; z-index: 1; background: color-mix(in srgb, var(--ej-solid) 92%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ej-visit { display: grid; grid-template-columns: 58px 1fr auto; gap: 1px 10px; width: calc(100% - 12px); margin: 2px 6px; text-align: left; font: inherit; color: inherit;
  background: transparent; border: 1px solid transparent; border-radius: 10px; padding: 8px 10px 8px 9px; cursor: pointer; position: relative;
  transition: background .12s, border-color .12s; }
.ej-visit::before { content: ""; position: absolute; left: -1px; top: 9px; bottom: 9px; width: 3px; border-radius: 3px; background: transparent; }
.ej-visit:hover { background: var(--ej-panel2); }
.ej-visit.r-high::before { background: var(--ej-bad); }
.ej-visit.r-medium::before { background: var(--ej-warn); }
.ej-visit.sel { background: color-mix(in srgb, var(--ej-info) 10%, transparent); border-color: color-mix(in srgb, var(--ej-info) 55%, transparent); }
.ej-anim .ej-visit { animation: ej-rise .35s calc(var(--i, 0) * 22ms) ease-out both; }
.ej-visit-time { color: var(--ej-subtle); font-variant-numeric: tabular-nums; font-size: 12px; padding-top: 1px; }
.ej-visit-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ej-av { display: inline-flex; width: 18px; height: 18px; border-radius: 5px; margin-right: 7px; vertical-align: -3px; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 800; color: #fff; background: var(--c); }
.ej-visit-url { grid-column: 2 / 4; color: var(--ej-subtle); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ej-visit-q { grid-column: 2 / 4; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ej-visit-chips { grid-column: 2 / 4; display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.ej-chip { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--ej-line); color: var(--ej-subtle); background: transparent; }
.ej-chip.cat { color: var(--ej-text); border-color: color-mix(in srgb, var(--c) 55%, transparent); background: color-mix(in srgb, var(--c) 14%, transparent); }
.ej-chip.sig.bad, .ej-chip.upload, .ej-chip.form { color: var(--ej-bad); border-color: color-mix(in srgb, var(--ej-bad) 50%, transparent); font-weight: 600; }
.ej-chip.sig.warn { color: var(--ej-warn); border-color: color-mix(in srgb, var(--ej-warn) 50%, transparent); font-weight: 600; }
.ej-chip.gap { color: var(--ej-warn); border-color: color-mix(in srgb, var(--ej-warn) 50%, transparent); }
.ej-chip.dl { color: var(--ej-brand); border-color: color-mix(in srgb, var(--ej-brand) 50%, transparent); }
.ej-empty { color: var(--ej-subtle); padding: 28px 18px; text-align: center; }

/* risk badges */
.ej-risk { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 6px; border: 1px solid var(--ej-line); color: var(--ej-subtle);
  white-space: nowrap; text-transform: capitalize; align-self: start; margin-left: 6px; }
.ej-risk.high { color: #fff; background: var(--ej-bad); border-color: var(--ej-bad); }
.ej-risk.medium { color: var(--ej-warn); border-color: color-mix(in srgb, var(--ej-warn) 55%, transparent); }
.ej-flags-h { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-bottom: 8px; }
.ej-flags-h .ej-risk { margin-left: 0; font-size: 12px; }
.ej-flag-list { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 8px; }
.ej-flag-list li { display: grid; grid-template-columns: 24px 1fr auto; gap: 8px; align-items: start; font-size: 13px; }
.ej-flags .ej-kv { margin-bottom: 8px; }
.ej-q { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: var(--ej-panel2); padding: 1px 6px; border-radius: 5px; }

/* detail */
.ej-detail { overflow: auto; padding-bottom: 32px; }
.ej-detail > :not(.ej-dhead) { margin-left: 20px; margin-right: 20px; }
.ej-dhead { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 8px; padding: 8px 12px 8px 20px; margin-bottom: 12px;
  border-bottom: 1px solid var(--ej-line); background: color-mix(in srgb, var(--ej-solid) 90%, transparent); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.ej-dhead-t { font-weight: 650; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.ej-dhead .ej-icon { width: 28px; height: 28px; font-size: 14px; }
.ej-back { display: none; }
.ej-dhero { position: relative; overflow: hidden; border-radius: var(--ej-r); padding: 14px 16px; border: 1px solid var(--ej-line);
  background: linear-gradient(120deg, color-mix(in srgb, var(--c) 16%, transparent), transparent 55%), var(--ej-panel); animation: ej-rise .3s ease-out both; }
.ej-dhero.r-high { border-color: color-mix(in srgb, var(--ej-bad) 55%, transparent); }
.ej-dhero-top { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px; }
.ej-dhero-top .ej-risk { margin-left: 0; }
.ej-h2 { font-size: 20px; font-weight: 750; letter-spacing: -.015em; margin: 0 0 6px; word-break: break-word; line-height: 1.3; }
.ej-url { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--ej-subtle); word-break: break-all; }
.ej-secnav { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.ej-secnav:empty { display: none; }
.ej-navchip { font: inherit; font-size: 12px; color: var(--ej-subtle); background: var(--ej-panel); border: 1px solid var(--ej-line); border-radius: 999px; padding: 3px 10px; cursor: pointer; }
.ej-navchip:hover { color: var(--ej-text); border-color: var(--ej-line2); }
.ej-section { margin-top: 22px; scroll-margin-top: 60px; }
.ej-section h3 { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--ej-subtle); margin: 0 0 8px; display: flex; align-items: center; gap: 8px; }
.ej-section h3::after { content: ""; flex: 1; height: 1px; background: var(--ej-line); }
.ej-card { border: 1px solid var(--ej-line); border-radius: 10px; background: var(--ej-panel); padding: 14px; }
.ej-shot { border: 1px solid var(--ej-line); border-radius: 10px; overflow: hidden; background: var(--ej-panel); }
.ej-shot img { display: block; width: 100%; height: auto; animation: ej-fade .4s ease both; }
.ej-shot-wait { padding: 44px 16px; text-align: center; color: var(--ej-subtle);
  background: linear-gradient(100deg, transparent 20%, color-mix(in srgb, var(--ej-info) 8%, transparent) 50%, transparent 80%) 0 0 / 200% 100%; animation: ej-shimmer 1.6s linear infinite; }
@keyframes ej-shimmer { to { background-position: -200% 0; } }
.ej-caption { font-size: 12px; color: var(--ej-subtle); padding: 8px 12px; border-top: 1px solid var(--ej-line); display: flex; flex-wrap: wrap; gap: 6px 12px; }
.ej-caption strong { color: var(--ej-warn); }
.ej-kv { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; font-size: 13px; }
.ej-kv dt { color: var(--ej-subtle); }
.ej-kv dd { margin: 0; word-break: break-word; }
.ej-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; word-break: break-all; }
.ej-send { border: 1px solid var(--ej-line); border-left: 3px solid var(--ej-bad); border-radius: 9px; padding: 10px 12px; margin-bottom: 8px; background: var(--ej-panel); }
.ej-send-h { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 13px; margin-bottom: 4px; }
.ej-pre { white-space: pre-wrap; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; max-height: 220px; overflow: auto;
  background: color-mix(in srgb, var(--ej-bg) 70%, transparent); border: 1px solid var(--ej-line); border-radius: 8px; padding: 10px; margin: 6px 0 0; }
.ej-gap { border-left: 3px solid var(--ej-warn); padding: 7px 11px; margin-bottom: 6px; background: color-mix(in srgb, var(--ej-warn) 7%, transparent); border-radius: 8px; font-size: 13px; }
.ej-error { margin: 14px; padding: 12px; border: 1px solid var(--ej-bad); color: var(--ej-bad); border-radius: 10px; background: color-mix(in srgb, var(--ej-bad) 7%, transparent); }
.ej-welcome { padding: 72px 24px; max-width: 440px; margin: 0 auto !important; }
.ej-welcome h3 { color: var(--ej-text); font-size: 18px; margin: 18px 0 6px; }
.ej-orb { position: relative; width: 96px; height: 96px; margin: 0 auto; }
.ej-orb span { position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid var(--ej-brand); opacity: 0; animation: ej-orb 3.2s ease-out infinite; }
.ej-orb span:nth-child(2) { animation-delay: 1.05s; } .ej-orb span:nth-child(3) { animation-delay: 2.1s; }
.ej-orb::after { content: ""; position: absolute; inset: 38%; border-radius: 50%; background: var(--ej-grad); box-shadow: 0 0 32px 4px rgba(246,130,31,.45); }
@keyframes ej-orb { 0% { transform: scale(.35); opacity: .8; } 100% { transform: scale(1); opacity: 0; } }
.ej-setup { max-width: 720px; margin: 24px auto; padding: 0 18px; }
.ej-setup ol { padding-left: 20px; }
.ej-setup li { margin-bottom: 8px; }
.ej-spin { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--ej-line2); border-top-color: var(--ej-brand); border-radius: 50%;
  animation: ej-spin .8s linear infinite; vertical-align: -2px; margin-right: 6px; }
@keyframes ej-spin { to { transform: rotate(360deg); } }
@keyframes ej-rise { from { opacity: 0; transform: translateY(6px); } }
@keyframes ej-fade { from { opacity: 0; } }
details.ej-more summary { cursor: pointer; color: var(--ej-subtle); font-size: 13px; }

/* ---- responsive ---- */
@media (min-width: 1600px) {
  .ej-main { grid-template-columns: 280px minmax(360px, 440px) minmax(0, 1fr); }
}
@media (max-width: 1360px) {
  .ej-brand-t { display: none; }
}
@media (max-width: 1199px) {
  .ej-pulse { display: none; }
  .ej-main { grid-template-columns: minmax(300px, 380px) minmax(0, 1fr); }
  .ej-filters-btn { display: inline-flex; }
  .ej-railcol { position: fixed; z-index: 30; left: 0; top: 0; bottom: 0; width: min(340px, 88vw); border-radius: 0 var(--ej-r) var(--ej-r) 0;
    background: var(--ej-solid); transform: translateX(-105%); transition: transform .22s ease; }
  .ej-main.show-filters .ej-railcol { transform: none; box-shadow: 0 0 60px rgba(0,0,0,.5); }
  .ej-main.show-filters .ej-scrim { display: block; position: fixed; inset: 0; z-index: 25; background: rgba(0,0,0,.45); }
  .ej-rail-foot { display: block; position: sticky; bottom: 0; margin-top: auto; padding: 10px 14px; background: var(--ej-solid); border-top: 1px solid var(--ej-line); }
  .ej-rail-foot .ej-btn { width: 100%; justify-content: center; }
  .ej-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 820px) {
  .ej-shell { height: auto; display: block; }
  .ej-head { position: sticky; top: 0; }
  .ej-top { flex-wrap: wrap; padding: 8px 12px; }
  .ej-case { flex: 1 1 0; border-left: 0; padding-left: 0; }
  .ej-search { order: 10; flex-basis: 100%; max-width: none; }
  .ej-chain .ej-pill { display: none; }
  .ej-hero { padding: 10px 12px 0; }
  .ej-hero-in { flex-wrap: wrap; }
  .ej-gauge { flex: 1 1 auto; }
  .ej-kpis { flex-basis: 100%; order: 3; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .ej-k-num { font-size: 19px; }
  .ej-main { display: block; padding: 10px 12px 16px; }
  .ej-list, .ej-detail { overflow: visible; }
  .ej-items { overflow: visible; }
  .ej-main.show-detail .ej-list { display: none; }
  .ej-main:not(.show-detail) .ej-detail { display: none; }
  .ej-back { display: inline-flex; }
  .ej-dhead { position: static; padding-left: 12px; }
  .ej-dhead-t { display: none; }
  .ej-detail > :not(.ej-dhead) { margin-left: 14px; margin-right: 14px; }
  .ej-flag-list li { grid-template-columns: 24px 1fr; }
  .ej-flag-list li .ej-link { grid-column: 2; justify-self: start; }
  .ej-h2 { font-size: 18px; }
  .ej-kv { grid-template-columns: 1fr; gap: 0 0; }
  .ej-kv dd { margin-bottom: 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .ej-root *, .ej-root *::before, .ej-root *::after { animation: none !important; transition: none !important; }
  .ej-p-line { stroke-dashoffset: 0; }
}
@media print {
  .ej-root { background: #fff; color: #000; --ej-text: #000; --ej-subtle: #444; --ej-panel: #fff; --ej-solid: #fff; --ej-line: #ccc; }
  .ej-root *, .ej-root *::before { animation: none !important; box-shadow: none !important; backdrop-filter: none !important; }
  .ej-p-line { stroke-dashoffset: 0; }
  .ej-shell { height: auto; display: block; }
  .ej-btn, .ej-select, .ej-search, .ej-link, .ej-pop, .ej-railcol, .ej-scrim, .ej-secnav { display: none !important; }
  .ej-main { display: block; }
  .ej-list, .ej-items, .ej-detail { overflow: visible; max-height: none; border: 0; display: block !important; }
  .ej-dhead { position: static; }
  .ej-session-h { position: static; }
  .ej-visit, .ej-send, .ej-card, .ej-shot, .ej-hero-in { break-inside: avoid; }
}
`;

export function injectStyles(doc = document) {
  if (doc.getElementById("ej-styles")) return;
  const s = doc.createElement("style");
  s.id = "ej-styles";
  s.textContent = CSS;
  doc.head.append(s);
}
