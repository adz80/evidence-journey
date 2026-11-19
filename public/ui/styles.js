// Styles for the shared UI: a dark "evidence console" look (with a light variant),
// glass panels, gradient accents and restrained motion. Honours prefers-reduced-motion
// and prints cleanly.

const CSS = `
.ej-root {
  --ej-bg: #070910;
  --ej-bg2: #0c0f1a;
  --ej-panel: rgba(255,255,255,.045);
  --ej-panel2: rgba(255,255,255,.075);
  --ej-solid: #11141f;
  --ej-line: rgba(255,255,255,.085);
  --ej-line2: rgba(255,255,255,.16);
  --ej-text: #eceff7;
  --ej-subtle: #8f97ad;
  --ej-brand: #f6821f;
  --ej-pink: #ff3d7f;
  --ej-violet: #7c5cff;
  --ej-ok: #2ee59d;
  --ej-warn: #ffb547;
  --ej-bad: #ff4d6a;
  --ej-grad: linear-gradient(120deg, #f6821f 0%, #ff3d7f 55%, #7c5cff 100%);
  --ej-glow: 0 0 0 1px rgba(255,255,255,.06), 0 10px 30px -12px rgba(0,0,0,.6);
  --ej-r: 14px;
  --ej-top-h: 64px;
  color: var(--ej-text);
  background:
    radial-gradient(900px 500px at -10% -10%, rgba(246,130,31,.16), transparent 60%),
    radial-gradient(800px 520px at 110% -20%, rgba(124,92,255,.20), transparent 60%),
    radial-gradient(700px 500px at 50% 120%, rgba(255,61,127,.10), transparent 60%),
    var(--ej-bg);
  background-attachment: fixed;
  font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  margin: 0;
  min-height: 100vh;
}
.ej-root::before { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
  background-size: 44px 44px; mask-image: radial-gradient(ellipse at 50% 0%, #000 20%, transparent 75%); }
@media (prefers-color-scheme: light) {
  .ej-root {
    --ej-bg: #f4f6fb; --ej-bg2: #ffffff; --ej-panel: rgba(255,255,255,.72); --ej-panel2: rgba(255,255,255,.95); --ej-solid: #ffffff;
    --ej-line: rgba(15,23,42,.08); --ej-line2: rgba(15,23,42,.16); --ej-text: #0d1426; --ej-subtle: #5b6478;
    --ej-ok: #0f9f6e; --ej-warn: #c27803; --ej-bad: #e11d48;
    --ej-glow: 0 0 0 1px rgba(15,23,42,.05), 0 12px 32px -16px rgba(15,23,42,.25);
    background:
      radial-gradient(900px 500px at -10% -10%, rgba(246,130,31,.14), transparent 60%),
      radial-gradient(800px 520px at 110% -20%, rgba(124,92,255,.14), transparent 60%),
      var(--ej-bg);
  }
  .ej-root::before { background-image: linear-gradient(rgba(15,23,42,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,.04) 1px, transparent 1px); }
}
.ej-root * { box-sizing: border-box; }
.ej-root ::selection { background: rgba(255,61,127,.35); }
.ej-root ::-webkit-scrollbar { width: 10px; height: 10px; }
.ej-root ::-webkit-scrollbar-thumb { background: var(--ej-line2); border-radius: 10px; border: 3px solid transparent; background-clip: content-box; }
.ej-shell { position: relative; z-index: 1; display: flex; flex-direction: column; min-height: 100vh; }

/* top bar */
.ej-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 18px;
  position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--ej-bg) 72%, transparent);
  backdrop-filter: blur(18px) saturate(160%); -webkit-backdrop-filter: blur(18px) saturate(160%); border-bottom: 1px solid var(--ej-line); }
.ej-top::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: var(--ej-grad); opacity: .55; }
.ej-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ej-logo { width: 32px; height: 32px; flex: none; filter: drop-shadow(0 4px 14px rgba(255,61,127,.45)); }
.ej-logo svg { width: 100%; height: 100%; display: block; }
.ej-brand-t { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
.ej-brand-n { font-weight: 800; font-size: 15px; letter-spacing: -.01em; background: linear-gradient(90deg, var(--ej-text), color-mix(in srgb, var(--ej-text) 70%, var(--ej-pink)));
  -webkit-background-clip: text; background-clip: text; color: transparent; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ej-brand-s { font-size: 11px; color: var(--ej-subtle); display: inline-flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: .12em; }
.ej-live { width: 7px; height: 7px; border-radius: 50%; background: var(--ej-ok); box-shadow: 0 0 0 0 var(--ej-ok); animation: ej-ping 2s infinite; }
@keyframes ej-ping { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--ej-ok) 70%, transparent); } 80%, 100% { box-shadow: 0 0 0 7px transparent; } }
.ej-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--ej-brand); display: inline-block; }
.ej-spacer { flex: 1; }
.ej-who { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }

/* controls */
.ej-select, .ej-btn { font: inherit; font-size: 13px; color: inherit; background: var(--ej-panel); border: 1px solid var(--ej-line);
  border-radius: 10px; padding: 7px 12px; transition: border-color .2s, background .2s, transform .15s, box-shadow .2s; }
.ej-select { max-width: 280px; }
.ej-select option { background: var(--ej-solid); color: var(--ej-text); }
.ej-btn { cursor: pointer; font-weight: 600; }
.ej-btn:hover { border-color: var(--ej-line2); background: var(--ej-panel2); transform: translateY(-1px); }
.ej-btn:active { transform: translateY(0); }
.ej-btn[disabled] { opacity: .55; cursor: default; transform: none; }
.ej-btn.primary { background: var(--ej-grad); color: #fff; border-color: transparent; box-shadow: 0 8px 24px -10px rgba(255,61,127,.8); }
.ej-btn.primary:hover { box-shadow: 0 10px 30px -8px rgba(255,61,127,.95); filter: brightness(1.06); }
.ej-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 500;
  border: 1px solid var(--ej-line); background: var(--ej-panel); color: var(--ej-subtle); white-space: nowrap; }
.ej-pill.ok { color: var(--ej-ok); border-color: color-mix(in srgb, var(--ej-ok) 45%, transparent); background: color-mix(in srgb, var(--ej-ok) 10%, transparent); }
.ej-pill.bad { color: var(--ej-bad); border-color: color-mix(in srgb, var(--ej-bad) 45%, transparent); background: color-mix(in srgb, var(--ej-bad) 10%, transparent); }
.ej-pill.warn { color: var(--ej-warn); border-color: color-mix(in srgb, var(--ej-warn) 45%, transparent); background: color-mix(in srgb, var(--ej-warn) 10%, transparent); }
.ej-pill.brand { color: var(--ej-brand); border-color: color-mix(in srgb, var(--ej-brand) 45%, transparent); }
.ej-search { font: inherit; color: inherit; background: var(--ej-panel); border: 1px solid var(--ej-line); border-radius: 12px;
  padding: 8px 14px 8px 36px; flex: 1 1 220px; min-width: 0; max-width: 560px; margin-right: auto; transition: border-color .2s, box-shadow .2s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%238f97ad' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='7' cy='7' r='5'/%3E%3Cpath d='m11 11 3.5 3.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: 12px 50%; }
.ej-search:focus, .ej-input:focus, .ej-select:focus { outline: none; border-color: color-mix(in srgb, var(--ej-pink) 60%, transparent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ej-pink) 18%, transparent); }
.ej-link { font: inherit; font-size: 12px; color: var(--ej-pink); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.ej-hint { font-size: 12px; color: var(--ej-subtle); }
.ej-count { display: inline-block; min-width: 18px; padding: 0 5px; margin-left: 6px; border-radius: 999px; background: var(--ej-grad);
  color: #fff; font-size: 11px; line-height: 18px; text-align: center; font-weight: 700; }
.ej-root kbd { font: 600 11px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 1px 6px; border-radius: 6px; border: 1px solid var(--ej-line2);
  border-bottom-width: 2px; background: var(--ej-panel); color: var(--ej-text); }

.ej-banner { padding: 7px 18px; font-size: 12px; color: var(--ej-subtle); display: flex; flex-wrap: wrap; gap: 4px 16px; border-bottom: 1px solid var(--ej-line); }
.ej-banner strong { color: var(--ej-warn); }

/* hero / command centre */
.ej-hero { padding: 16px 18px 6px; }
.ej-hero:empty { display: none; }
.ej-hero-in { display: grid; grid-template-columns: auto minmax(0, 1.25fr) minmax(0, 1fr); gap: 14px; align-items: stretch; }
.ej-gauge, .ej-kpi, .ej-hero-side, .ej-mix { background: var(--ej-panel); border: 1px solid var(--ej-line); border-radius: var(--ej-r);
  box-shadow: var(--ej-glow); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.ej-gauge { padding: 14px 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-width: 176px;
  position: relative; overflow: hidden; animation: ej-rise .6s cubic-bezier(.2,.8,.2,1) both; }
.ej-gauge::before { content: ""; position: absolute; inset: -40%; background: conic-gradient(from 0deg, transparent, rgba(255,61,127,.14), transparent 30%);
  animation: ej-spin 9s linear infinite; }
.ej-g-wrap { position: relative; width: 128px; height: 128px; }
.ej-g-svg { width: 100%; height: 100%; transform: rotate(-90deg); filter: drop-shadow(0 0 10px rgba(255,61,127,.45)); }
.ej-g-track { fill: none; stroke: var(--ej-line); stroke-width: 10; }
.ej-g-val { fill: none; stroke: url(#ejg); stroke-width: 10; stroke-linecap: round; transition: stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1); }
.ej-g-mid { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ej-g-num { font-size: 36px; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums; line-height: 1; }
.ej-g-of { font-size: 11px; color: var(--ej-subtle); }
.ej-g-label { position: relative; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: var(--ej-subtle); margin-top: 4px; }
.ej-g-level { position: relative; font-weight: 800; font-size: 15px; }
.ej-g-level.ok { color: var(--ej-ok); } .ej-g-level.warn { color: var(--ej-warn); } .ej-g-level.bad { color: var(--ej-bad); text-shadow: 0 0 18px rgba(255,77,106,.6); }
.ej-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.ej-kpi { position: relative; overflow: hidden; text-align: left; font: inherit; color: inherit; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px;
  min-width: 0; animation: ej-rise .6s cubic-bezier(.2,.8,.2,1) both; }
.ej-kpi:nth-child(2) { animation-delay: .05s } .ej-kpi:nth-child(3) { animation-delay: .1s } .ej-kpi:nth-child(4) { animation-delay: .15s }
.ej-kpi:nth-child(5) { animation-delay: .2s } .ej-kpi:nth-child(6) { animation-delay: .25s }
.ej-kpi::after { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--ej-line2); }
.ej-kpi.bad::after { background: var(--ej-bad); box-shadow: 0 0 16px var(--ej-bad); }
.ej-kpi.warn::after { background: var(--ej-warn); }
.ej-kpi.ok::after { background: var(--ej-ok); }
.ej-kpi.click { cursor: pointer; transition: transform .2s, border-color .2s, background .2s; }
.ej-kpi.click:hover { transform: translateY(-2px); border-color: var(--ej-line2); background: var(--ej-panel2); }
.ej-k-top { display: flex; align-items: center; gap: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--ej-subtle); }
.ej-k-ic { opacity: .8; }
.ej-k-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ej-k-num { font-size: 28px; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums; line-height: 1.1; }
.ej-kpi.bad .ej-k-num { color: var(--ej-bad); } .ej-kpi.warn .ej-k-num { color: var(--ej-warn); }
.ej-k-sub { font-size: 12px; color: var(--ej-subtle); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ej-kpi.ok .ej-k-sub { color: var(--ej-ok); } .ej-kpi.bad .ej-k-sub { color: var(--ej-bad); }
.ej-hero-side { padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; min-width: 0; animation: ej-rise .6s .15s cubic-bezier(.2,.8,.2,1) both; }
.ej-h-title { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--ej-subtle); font-weight: 600; }
.ej-h-title .ej-hint { text-transform: none; letter-spacing: 0; font-weight: 400; }
.ej-pulse { height: 70px; }
.ej-p-svg { width: 100%; height: 100%; display: block; overflow: visible; }
.ej-p-line { fill: none; stroke: url(#ejpl); stroke-width: 2.2; stroke-dasharray: 1; stroke-dashoffset: 1; animation: ej-draw 1.6s .2s ease-out forwards;
  vector-effect: non-scaling-stroke; filter: drop-shadow(0 0 6px rgba(255,61,127,.55)); }
.ej-p-dot { fill: var(--ej-warn); } .ej-p-dot.high { fill: var(--ej-bad); filter: drop-shadow(0 0 4px var(--ej-bad)); }
@keyframes ej-draw { to { stroke-dashoffset: 0; } }
.ej-bars { display: grid; gap: 5px; }
.ej-bar { position: relative; display: flex; justify-content: space-between; gap: 8px; align-items: center; font: inherit; font-size: 12px; color: inherit;
  background: transparent; border: 0; border-radius: 8px; padding: 4px 8px; cursor: pointer; overflow: hidden; text-align: left; }
.ej-bar:hover { background: var(--ej-panel2); }
.ej-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; width: var(--w); border-radius: 8px; z-index: -1; opacity: .9;
  background: linear-gradient(90deg, color-mix(in srgb, var(--t, var(--ej-violet)) 34%, transparent), transparent);
  transform-origin: left; animation: ej-grow .9s calc(var(--i) * 70ms + .2s) cubic-bezier(.2,.8,.2,1) both; }
.ej-bar { isolation: isolate; }
.ej-bar.bad { --t: var(--ej-bad); } .ej-bar.warn { --t: var(--ej-warn); } .ej-bar.info { --t: var(--ej-violet); }
.ej-bar-l { display: inline-flex; gap: 6px; align-items: center; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ej-bar-ic { color: var(--t); width: 14px; text-align: center; }
.ej-bar-n { font-weight: 700; font-variant-numeric: tabular-nums; }
@keyframes ej-grow { from { transform: scaleX(0); } }
.ej-pad { padding: 6px 2px; }
.ej-mix { margin-top: 12px; padding: 10px 14px; animation: ej-rise .6s .25s cubic-bezier(.2,.8,.2,1) both; }
.ej-mix-bar { display: flex; height: 10px; border-radius: 99px; overflow: hidden; gap: 2px; background: var(--ej-line); }
.ej-mix-seg { border: 0; padding: 0; cursor: pointer; min-width: 4px; transform-origin: left; animation: ej-grow 1s .3s cubic-bezier(.2,.8,.2,1) both; }
.ej-mix-seg:hover { filter: brightness(1.25); }
.ej-mix-seg.rest { background: var(--ej-line2); cursor: default; }
.ej-mix-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; }
.ej-mix-key { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 12px; color: var(--ej-subtle); background: none; border: 0; padding: 2px 0; cursor: pointer; }
.ej-mix-key:hover { color: var(--ej-text); }
.ej-mix-pc { color: var(--ej-text); font-weight: 600; font-variant-numeric: tabular-nums; }

/* main three-column layout */
.ej-main { display: grid; grid-template-columns: minmax(320px, 440px) 1fr; gap: 14px; padding: 10px 18px 18px; flex: 1; align-items: start; }
.ej-side, .ej-detail, .ej-rail, .ej-list { background: var(--ej-panel); border: 1px solid var(--ej-line); border-radius: var(--ej-r); box-shadow: var(--ej-glow);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.ej-side { overflow: auto; position: sticky; top: calc(var(--ej-top-h) + 10px); max-height: calc(100vh - var(--ej-top-h) - 20px); min-width: 0; }
.ej-side .ej-rail, .ej-side .ej-list { background: none; border: 0; border-radius: 0; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
.ej-list { min-width: 0; }
.ej-detail { overflow: auto; position: sticky; top: calc(var(--ej-top-h) + 10px); max-height: calc(100vh - var(--ej-top-h) - 20px); padding: 18px 20px 40px; min-width: 0; }
.ej-summary { padding: 10px 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; border-bottom: 1px solid var(--ej-line); }
.ej-sort { font-size: 12px; padding: 5px 9px; }

/* filter rail */
.ej-rail { border-bottom: 1px solid var(--ej-line); }
.ej-rail-h { display: flex; align-items: center; gap: 8px; padding: 12px 14px; }
.ej-rail-title { display: none; font-weight: 700; font-size: 13px; }
.ej-rail-toggle { font: inherit; font-weight: 700; font-size: 13px; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.ej-rail.collapsed .ej-rail-body { display: none; }
.ej-rail-body { padding: 0 10px 12px; }
.ej-group h4 { margin: 14px 6px 6px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .12em; color: var(--ej-subtle); }
.ej-facet { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: 0; border-radius: 9px; background: transparent;
  color: inherit; font: inherit; font-size: 13px; cursor: pointer; text-align: left; transition: background .15s, box-shadow .15s; }
.ej-facet:hover { background: var(--ej-panel2); }
.ej-facet.on { background: color-mix(in srgb, var(--ej-pink) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ej-pink) 55%, transparent); }
.ej-facet.zero { opacity: .45; }
.ej-facet .l { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ej-facet .n { color: var(--ej-subtle); font-variant-numeric: tabular-nums; font-size: 12px; }
.ej-sw { width: 10px; height: 10px; border-radius: 3px; flex: none; box-shadow: 0 0 8px -1px currentColor; }
.ej-sig-i { width: 20px; height: 20px; flex: none; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;
  font-size: 11px; border: 1px solid var(--ej-line); color: var(--ej-subtle); background: var(--ej-panel); }
.ej-sig-i.bad { color: var(--ej-bad); border-color: color-mix(in srgb, var(--ej-bad) 50%, transparent); background: color-mix(in srgb, var(--ej-bad) 10%, transparent); }
.ej-sig-i.warn { color: var(--ej-warn); border-color: color-mix(in srgb, var(--ej-warn) 50%, transparent); background: color-mix(in srgb, var(--ej-warn) 10%, transparent); }
.ej-seg { display: flex; border: 1px solid var(--ej-line); border-radius: 10px; overflow: hidden; margin: 0 4px; background: var(--ej-panel); }
.ej-seg button { flex: 1; font: inherit; font-size: 12px; padding: 6px 4px; border: 0; border-right: 1px solid var(--ej-line); background: transparent;
  color: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0; transition: background .2s; }
.ej-seg button:last-child { border-right: 0; }
.ej-seg button:hover { background: var(--ej-panel2); }
.ej-seg button.on { background: var(--ej-grad); color: #fff; }
.ej-seg .n { font-size: 11px; opacity: .8; font-variant-numeric: tabular-nums; }
.ej-hourchips { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; }
.ej-hourchips .ej-chip { cursor: pointer; background: none; font: inherit; font-size: 11px; color: var(--ej-pink); border-color: var(--ej-pink); }
.ej-group .ej-hint { padding: 2px 6px; }
.ej-foot { margin: 14px 6px 0; }

/* activity chart */
.ej-chartwrap { padding: 10px 14px 8px; border-bottom: 1px solid var(--ej-line); }
.ej-chartwrap:empty { display: none; }
.ej-chart-h { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 600; margin-bottom: 6px; flex-wrap: wrap; }
.ej-chart { display: grid; grid-template-columns: repeat(24, 1fr); gap: 2px; height: 72px; align-items: end; }
.ej-col { height: 100%; display: flex; flex-direction: column; justify-content: flex-end; padding: 0; border: 0; border-radius: 4px;
  background: transparent; cursor: pointer; min-width: 0; transition: background .15s; }
.ej-col.ah { background: color-mix(in srgb, var(--ej-violet) 9%, transparent); }
.ej-col:hover { background: color-mix(in srgb, var(--ej-pink) 14%, transparent); }
.ej-col.on { box-shadow: inset 0 0 0 1.5px var(--ej-pink); }
.ej-col-stack { display: flex; flex-direction: column-reverse; gap: 1px; transform-origin: bottom; animation: ej-growy .8s cubic-bezier(.2,.8,.2,1) both; }
@keyframes ej-growy { from { transform: scaleY(0); } }
.ej-seg-bar { border-radius: 2px; width: 100%; }
.ej-seg-bar.off { opacity: .18; }
.ej-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--ej-subtle); margin-top: 3px; }

/* risk */
.ej-risk { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 7px; border: 1px solid var(--ej-line); color: var(--ej-subtle);
  white-space: nowrap; text-transform: capitalize; align-self: start; margin-left: 6px; }
.ej-risk.high { color: #fff; background: linear-gradient(135deg, #ff4d6a, #ff3d7f); border-color: transparent; box-shadow: 0 0 18px -4px rgba(255,77,106,.9); }
.ej-risk.medium { color: var(--ej-warn); border-color: color-mix(in srgb, var(--ej-warn) 50%, transparent); background: color-mix(in srgb, var(--ej-warn) 10%, transparent); }
.ej-risk.low { color: var(--ej-subtle); }
.ej-flags-h { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-bottom: 8px; }
.ej-flags-h .ej-risk { margin-left: 0; font-size: 12px; }
.ej-flag-list { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 8px; }
.ej-flag-list li { display: grid; grid-template-columns: 24px 1fr auto; gap: 8px; align-items: start; font-size: 13px; }
.ej-flags .ej-kv { margin-bottom: 8px; }
.ej-q { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: var(--ej-panel2); padding: 1px 6px; border-radius: 5px; }
.ej-tools { border-bottom: 1px solid var(--ej-line); }
.ej-tools:empty { display: none; }
.ej-tools-row { padding: 8px 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.ej-tools .ej-btn { font-size: 12px; padding: 5px 10px; }
.ej-btn.danger { color: var(--ej-bad); border-color: color-mix(in srgb, var(--ej-bad) 50%, transparent); }
.ej-btn.danger.solid { background: var(--ej-bad); color: #fff; }
.ej-confirm { margin: 0 14px 10px; padding: 10px 0 0; border: 1px solid var(--ej-bad); border-radius: 12px; font-size: 13px; background: color-mix(in srgb, var(--ej-bad) 6%, transparent); }
.ej-confirm > div:first-child, .ej-confirm .ej-bad { padding: 0 12px; }
.ej-bad { color: var(--ej-bad); margin-top: 6px; }
.ej-input { font: inherit; color: inherit; background: var(--ej-panel); border: 1px solid var(--ej-line); border-radius: 10px;
  padding: 7px 11px; flex: 1 1 160px; min-width: 0; }

/* journey list */
.ej-session { padding-bottom: 6px; }
.ej-session-h { padding: 12px 14px 6px; font-size: 11px; color: var(--ej-subtle); font-weight: 600; text-transform: uppercase; letter-spacing: .06em;
  position: sticky; top: 0; z-index: 1; background: color-mix(in srgb, var(--ej-solid) 88%, transparent); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.ej-visit { display: grid; grid-template-columns: 62px 1fr auto; gap: 2px 10px; width: calc(100% - 16px); margin: 3px 8px; text-align: left; font: inherit; color: inherit;
  background: transparent; border: 1px solid transparent; border-radius: 12px; padding: 9px 12px 9px 10px; cursor: pointer; position: relative;
  transition: background .18s, border-color .18s, transform .18s, box-shadow .18s; }
.ej-visit::before { content: ""; position: absolute; left: -1px; top: 10px; bottom: 10px; width: 3px; border-radius: 3px; background: transparent; transition: background .2s; }
.ej-visit:hover { background: var(--ej-panel2); border-color: var(--ej-line); transform: translateX(2px); }
.ej-visit.sel { background: color-mix(in srgb, var(--ej-pink) 9%, var(--ej-panel2)); border-color: color-mix(in srgb, var(--ej-pink) 45%, transparent);
  box-shadow: 0 8px 28px -14px rgba(255,61,127,.8); }
.ej-visit.sel::before { background: var(--ej-grad); }
.ej-visit.r-high::before { background: var(--ej-bad); box-shadow: 0 0 12px var(--ej-bad); animation: ej-glowpulse 2.4s ease-in-out infinite; }
.ej-visit.r-medium::before { background: var(--ej-warn); }
@keyframes ej-glowpulse { 50% { box-shadow: 0 0 2px var(--ej-bad); } }
.ej-anim .ej-visit { animation: ej-rise .45s calc(var(--i, 0) * 28ms) cubic-bezier(.2,.8,.2,1) both; }
.ej-visit-time { color: var(--ej-subtle); font-variant-numeric: tabular-nums; font-size: 12px; padding-top: 2px; }
.ej-visit-title { font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ej-av { display: inline-flex; width: 18px; height: 18px; border-radius: 6px; margin-right: 7px; vertical-align: -3px; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 800; color: #fff; background: linear-gradient(135deg, var(--c), color-mix(in srgb, var(--c) 55%, #000)); box-shadow: 0 2px 8px -2px var(--c); }
.ej-visit-url { grid-column: 2 / 4; color: var(--ej-subtle); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ej-visit-q { grid-column: 2 / 4; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: color-mix(in srgb, var(--ej-text) 85%, var(--ej-violet)); }
.ej-visit-chips { grid-column: 2 / 4; display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.ej-chip { font-size: 11px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--ej-line); color: var(--ej-subtle); background: var(--ej-panel); }
.ej-chip.cat { color: var(--ej-text); border-color: color-mix(in srgb, var(--c) 60%, transparent); background: color-mix(in srgb, var(--c) 16%, transparent); }
.ej-chip.sig.bad, .ej-chip.upload, .ej-chip.form { color: var(--ej-bad); border-color: color-mix(in srgb, var(--ej-bad) 50%, transparent); background: color-mix(in srgb, var(--ej-bad) 9%, transparent); font-weight: 600; }
.ej-chip.sig.warn { color: var(--ej-warn); border-color: color-mix(in srgb, var(--ej-warn) 50%, transparent); background: color-mix(in srgb, var(--ej-warn) 9%, transparent); font-weight: 600; }
.ej-chip.gap { color: var(--ej-warn); border-color: color-mix(in srgb, var(--ej-warn) 50%, transparent); }
.ej-chip.dl { color: var(--ej-brand); border-color: color-mix(in srgb, var(--ej-brand) 50%, transparent); }
.ej-empty { color: var(--ej-subtle); padding: 28px 18px; text-align: center; }

/* detail */
.ej-welcome { padding: 60px 24px; max-width: 460px; margin: 0 auto; }
.ej-welcome h3 { color: var(--ej-text); font-size: 20px; margin: 18px 0 6px; letter-spacing: -.01em; }
.ej-orb { position: relative; width: 110px; height: 110px; margin: 0 auto; }
.ej-orb span { position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid transparent; background: var(--ej-grad) border-box;
  -webkit-mask: linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: ej-orb 3.2s ease-out infinite; opacity: 0; }
.ej-orb span:nth-child(2) { animation-delay: 1.05s; } .ej-orb span:nth-child(3) { animation-delay: 2.1s; }
.ej-orb::after { content: ""; position: absolute; inset: 38%; border-radius: 50%; background: var(--ej-grad); box-shadow: 0 0 40px 6px rgba(255,61,127,.55); }
@keyframes ej-orb { 0% { transform: scale(.35); opacity: .9; } 100% { transform: scale(1); opacity: 0; } }
.ej-back { display: none; margin-bottom: 12px; }
.ej-dhero { position: relative; overflow: hidden; border-radius: var(--ej-r); padding: 16px 18px; margin-bottom: 6px; border: 1px solid var(--ej-line);
  background: linear-gradient(135deg, color-mix(in srgb, var(--c) 22%, transparent), transparent 60%), var(--ej-panel); animation: ej-rise .45s cubic-bezier(.2,.8,.2,1) both; }
.ej-dhero::after { content: ""; position: absolute; right: -60px; top: -60px; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--c) 40%, transparent), transparent 70%); pointer-events: none; }
.ej-dhero.r-high { border-color: color-mix(in srgb, var(--ej-bad) 50%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--ej-bad) 25%, transparent), 0 16px 40px -20px var(--ej-bad); }
.ej-dhero-top { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px; }
.ej-dhero-top .ej-risk { margin-left: 0; }
.ej-h2 { font-size: 22px; font-weight: 800; letter-spacing: -.02em; margin: 0 0 6px; word-break: break-word; line-height: 1.25; }
.ej-url { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--ej-subtle); word-break: break-all; }
.ej-section { margin-top: 20px; animation: ej-rise .5s cubic-bezier(.2,.8,.2,1) both; }
.ej-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: var(--ej-subtle); margin: 0 0 8px; display: flex; align-items: center; gap: 8px; }
.ej-section h3::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, var(--ej-line2), transparent); }
.ej-card { border: 1px solid var(--ej-line); border-radius: 12px; background: var(--ej-panel); padding: 14px; }
.ej-shot { border: 1px solid var(--ej-line); border-radius: 12px; overflow: hidden; background: var(--ej-panel); box-shadow: 0 20px 50px -28px rgba(0,0,0,.9); }
.ej-shot img { display: block; width: 100%; height: auto; animation: ej-fade .6s ease both; }
.ej-shot-wait { padding: 44px 16px; text-align: center; color: var(--ej-subtle);
  background: linear-gradient(100deg, transparent 20%, color-mix(in srgb, var(--ej-violet) 10%, transparent) 50%, transparent 80%) 0 0 / 200% 100%; animation: ej-shimmer 1.6s linear infinite; }
@keyframes ej-shimmer { to { background-position: -200% 0; } }
.ej-caption { font-size: 12px; color: var(--ej-subtle); padding: 8px 12px; border-top: 1px solid var(--ej-line); display: flex; flex-wrap: wrap; gap: 6px 12px; }
.ej-caption strong { color: var(--ej-warn); }
.ej-kv { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; font-size: 13px; }
.ej-kv dt { color: var(--ej-subtle); }
.ej-kv dd { margin: 0; word-break: break-word; }
.ej-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; word-break: break-all; }
.ej-send { border: 1px solid var(--ej-line); border-left: 3px solid var(--ej-bad); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--ej-bad) 7%, transparent), transparent 40%), var(--ej-panel); }
.ej-send-h { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 13px; margin-bottom: 4px; }
.ej-pre { white-space: pre-wrap; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
  max-height: 220px; overflow: auto; background: color-mix(in srgb, var(--ej-bg) 70%, transparent); border: 1px solid var(--ej-line); border-radius: 8px; padding: 10px; margin: 6px 0 0; }
.ej-gap { border-left: 3px solid var(--ej-warn); padding: 7px 11px; margin-bottom: 6px; background: color-mix(in srgb, var(--ej-warn) 7%, transparent); border-radius: 8px; font-size: 13px; }
.ej-error { margin: 14px; padding: 12px; border: 1px solid var(--ej-bad); color: var(--ej-bad); border-radius: 12px; background: color-mix(in srgb, var(--ej-bad) 7%, transparent); }
.ej-setup { max-width: 720px; margin: 24px auto; padding: 0 18px; }
.ej-setup ol { padding-left: 20px; }
.ej-setup li { margin-bottom: 8px; }
.ej-spin { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--ej-line2); border-top-color: var(--ej-pink);
  border-radius: 50%; animation: ej-spin 0.8s linear infinite; vertical-align: -2px; margin-right: 6px; }
@keyframes ej-spin { to { transform: rotate(360deg); } }
@keyframes ej-rise { from { opacity: 0; transform: translateY(8px); } }
@keyframes ej-fade { from { opacity: 0; } }
details.ej-more summary { cursor: pointer; color: var(--ej-subtle); font-size: 13px; }

@media (min-width: 1200px) {
  .ej-main { grid-template-columns: 250px minmax(340px, 460px) 1fr; }
  .ej-side { display: contents; }
  .ej-side .ej-rail, .ej-side .ej-list { background: var(--ej-panel); border: 1px solid var(--ej-line); border-radius: var(--ej-r); box-shadow: var(--ej-glow);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); overflow: auto; position: sticky; top: calc(var(--ej-top-h) + 10px);
    max-height: calc(100vh - var(--ej-top-h) - 20px); }
  .ej-rail.collapsed .ej-rail-body { display: block; }
  .ej-rail-toggle { display: none; }
  .ej-rail-title { display: inline; }
}
@media (max-width: 1100px) {
  .ej-hero-in { grid-template-columns: auto minmax(0, 1fr); }
  .ej-hero-side { grid-column: 1 / -1; }
}
@media (max-width: 820px) {
  .ej-top { padding: 10px 12px; }
  .ej-brand-n { font-size: 14px; }
  .ej-who { display: none; }
  .ej-hero { padding: 12px 12px 4px; }
  .ej-hero-in { grid-template-columns: 1fr; }
  .ej-gauge { flex-direction: row; gap: 14px; min-width: 0; }
  .ej-g-wrap { width: 96px; height: 96px; }
  .ej-g-num { font-size: 28px; }
  .ej-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ej-k-num { font-size: 24px; }
  .ej-main { grid-template-columns: 1fr; padding: 8px 12px 12px; }
  .ej-side, .ej-detail { position: static; max-height: none; }
  .ej-main.show-detail .ej-side { display: none; }
  .ej-main:not(.show-detail) .ej-detail { display: none; }
  .ej-back { display: inline-block; }
  .ej-search { order: 10; flex-basis: 100%; max-width: none; }
  .ej-select { max-width: none; flex: 1 1 auto; }
  .ej-flag-list li { grid-template-columns: 24px 1fr; }
  .ej-flag-list li .ej-link { grid-column: 2; justify-self: start; }
  .ej-h2 { font-size: 19px; }
}
@media (prefers-reduced-motion: reduce) {
  .ej-root *, .ej-root *::before, .ej-root *::after { animation: none !important; transition: none !important; }
  .ej-p-line { stroke-dashoffset: 0; }
}
@media print {
  .ej-root { background: #fff; color: #000; --ej-text: #000; --ej-subtle: #444; --ej-panel: #fff; --ej-line: #ccc; }
  .ej-root::before, .ej-gauge::before { display: none; }
  .ej-root *, .ej-root *::before { animation: none !important; box-shadow: none !important; backdrop-filter: none !important; }
  .ej-p-line { stroke-dashoffset: 0; }
  .ej-top { position: static; }
  .ej-btn, .ej-select, .ej-back { display: none !important; }
  .ej-main { display: block; }
  .ej-rail, .ej-tools, .ej-search, .ej-link { display: none !important; }
  .ej-side, .ej-list, .ej-detail { position: static; max-height: none; overflow: visible; border: 0; display: block !important; }
  .ej-session, .ej-send, .ej-card, .ej-shot, .ej-hero-in { break-inside: avoid; }
}
`;

export function injectStyles(doc = document) {
  if (doc.getElementById("ej-styles")) return;
  const s = doc.createElement("style");
  s.id = "ej-styles";
  s.textContent = CSS;
  doc.head.append(s);
}
