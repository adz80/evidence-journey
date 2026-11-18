// Serves the investigator web UI (public/) through Workers static assets.
// wrangler.jsonc sets run_worker_first: true, so every asset request passes the
// Access JWT check in api.js before it reaches here.

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "cache-control": "no-cache",
  "content-security-policy":
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
};

export async function serveAsset(request, env) {
  if (!env.ASSETS) return new Response("Web UI not deployed", { status: 404, headers: { "content-type": "text/plain" } });
  const res = await env.ASSETS.fetch(request);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
