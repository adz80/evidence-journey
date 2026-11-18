// Reads reconstruction provenance from the screenshot response headers.
// Shared by the web front end (browser fetch) and the gadget server.

export function metaFromHeaders(headers) {
  const g = (n) => headers.get(`x-evidence-${n}`);
  const num = (v) => (v == null || v === "" ? null : Number(v));
  return {
    sha256: g("sha256") || null,
    replayed: num(g("replayed")),
    approximate: num(g("approximate")),
    missing: num(g("missing")),
    renderedAt: g("rendered-at") || null,
    browser: g("browser") || null,
    viewport: g("viewport") || null,
    cached: g("cached") === "true",
    chainSeq: num(g("chain-seq")),
    key: g("key") || null,
  };
}
