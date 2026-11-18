// Verify the Cloudflare Access JWT on every UI/API request (defence in depth:
// Access already blocks unauthenticated requests at the edge).

let certCache = { team: null, at: 0, keys: [] };

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

async function getKeys(team, force = false) {
  if (!force && certCache.team === team && Date.now() - certCache.at < 3600_000 && certCache.keys.length) {
    return certCache.keys;
  }
  const res = await fetch(`${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`could not load Access signing keys (${res.status})`);
  const body = await res.json();
  certCache = { team, at: Date.now(), keys: body.keys || [] };
  return certCache.keys;
}

export async function verifyAccess(request, env) {
  const team = String(env.ACCESS_TEAM_DOMAIN || "").replace(/\/+$/, "");
  const aud = String(env.ACCESS_AUD || "");
  if (!team || !aud || team.includes("YOUR-TEAM")) {
    throw new Error("ACCESS_TEAM_DOMAIN and ACCESS_AUD must be configured before the evidence UI can be used");
  }
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) throw new Error("missing Cloudflare Access token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed Access token");

  const header = b64urlJson(parts[0]);
  const payload = b64urlJson(parts[1]);

  let keys = await getKeys(team);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await getKeys(team, true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error("Access token signed with an unknown key");

  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new Error("invalid Access token signature");

  const now = Date.now() / 1000;
  if (typeof payload.exp === "number" && now > payload.exp) throw new Error("Access token expired");
  if (typeof payload.nbf === "number" && now < payload.nbf - 60) throw new Error("Access token not yet valid");
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new Error("Access token is for a different application");
  if (payload.iss && payload.iss.replace(/\/+$/, "") !== team) throw new Error("Access token issuer mismatch");

  return payload.email
    ? { type: "user", id: payload.email }
    : { type: "service-token", id: payload.common_name || payload.sub || "unknown" };
}
