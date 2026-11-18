// Tiny DOM + formatting helpers. All text goes through textContent; captured URLs
// are never rendered as links, so an investigator cannot accidentally contact a
// site the subject visited.

export function el(tag, attrs, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    n.append(c instanceof Node ? c : String(c));
  }
  return n;
}

export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function fmtDay(ts) {
  return new Date(ts).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(ts) {
  return `${fmtDay(ts)} ${fmtTime(ts)}`;
}

export function fmtUtc(ts) {
  return new Date(ts).toISOString();
}

export function fmtBytes(n) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function shortHash(h) {
  return h ? `${h.slice(0, 12)}…` : "—";
}

export function hostOf(u) {
  try {
    return new URL(u).host;
  } catch {
    return u || "";
  }
}

export function pathOf(u) {
  try {
    const x = new URL(u);
    return x.pathname + (x.search ? x.search : "");
  } catch {
    return u || "";
  }
}

export function plural(n, one, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}
