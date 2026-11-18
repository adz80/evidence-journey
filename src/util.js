// Hashing, canonical JSON, header/body redaction and small helpers.

const encoder = new TextEncoder();

export async function sha256Hex(bytes) {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(buf));
}

export function toHex(u8) {
  let s = "";
  for (const b of u8) s += b.toString(16).padStart(2, "0");
  return s;
}

// Canonical JSON: JSON round-trip (drops undefined, NaN -> null) then sorted keys.
// The ledger hashes this form, and verification recomputes it from stored JSON.
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}

export function stableStringify(value) {
  return canonical(JSON.parse(JSON.stringify(value ?? null)));
}

// ---------------------------------------------------------------------------
// Redaction. Applied to the STORED COPY only; the request sent upstream is never
// modified. Hashes are computed after redaction and the record says what was done.

const SECRET_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
  "x-csrf-token",
  "x-xsrf-token",
  "x-amz-security-token",
]);
const MAX_HEADER_VALUE = 2048;

// Field names treated as secrets. Deliberately broad: over-redacting is safer.
const SECRET_KEY =
  /(pass(word|wd|phrase|code)?|pwd|secret|token|credential|api[-_]?key|access[-_]?key|authorization|auth[-_]?code|(^|[^a-z])(otp|mfa|totp|cvv|cvc)([^a-z]|$))/i;

export function captureHeaders(headers) {
  const out = {};
  for (const [name, value] of headers) {
    const n = name.toLowerCase();
    if (n === "set-cookie") continue;
    out[n] = redactHeaderValue(n, value);
  }
  const setCookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  if (setCookies.length) {
    out["set-cookie"] = setCookies.map((c) => `${c.split("=")[0].trim()}=[redacted]`).join(", ");
  }
  return out;
}

function redactHeaderValue(n, v) {
  if (SECRET_HEADERS.has(n)) return "[redacted]";
  if (n === "cookie") {
    return v
      .split(";")
      .map((p) => p.split("=")[0].trim())
      .filter(Boolean)
      .map((k) => `${k}=[redacted]`)
      .join("; ");
  }
  return v.length > MAX_HEADER_VALUE ? v.slice(0, MAX_HEADER_VALUE) + "…[cut]" : v;
}

export function redactBody(bytes, contentType) {
  const ct = (contentType || "").toLowerCase();
  if (!bytes.byteLength) return { bytes, redaction: "empty" };
  if (ct.startsWith("multipart/")) return { bytes, redaction: "not checked (multipart)" };
  const isForm = ct.includes("application/x-www-form-urlencoded");
  const isJson = ct.includes("json");
  if (!isForm && !isJson && !ct.startsWith("text/")) return { bytes, redaction: "not checked (non-text)" };

  const text = new TextDecoder().decode(bytes);
  const fields = new Set();
  let out = null;
  if (isForm) {
    const params = new URLSearchParams(text);
    const next = new URLSearchParams();
    for (const [k, v] of params) {
      if (SECRET_KEY.test(k)) {
        fields.add(k);
        next.append(k, "[redacted]");
      } else {
        next.append(k, v);
      }
    }
    if (fields.size) out = next.toString();
  } else if (isJson) {
    try {
      const redacted = walkJson(JSON.parse(text), fields);
      if (fields.size) out = JSON.stringify(redacted);
    } catch {
      const r = regexRedact(text, fields);
      if (fields.size) out = r;
    }
  } else {
    const r = regexRedact(text, fields);
    if (fields.size) out = r;
  }
  if (out == null) return { bytes, redaction: "nothing to redact" };
  return { bytes: encoder.encode(out), redaction: `redacted: ${[...fields].slice(0, 20).join(", ")}` };
}

function walkJson(v, fields) {
  if (Array.isArray(v)) return v.map((x) => walkJson(x, fields));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (SECRET_KEY.test(k) && (x === null || typeof x !== "object")) {
        fields.add(k);
        o[k] = "[redacted]";
      } else {
        o[k] = walkJson(x, fields);
      }
    }
    return o;
  }
  return v;
}

function regexRedact(text, fields) {
  return text
    .replace(/("([^"\\]{1,80})"\s*:\s*)"(?:[^"\\]|\\.)*"/g, (m, pre, key) => {
      if (!SECRET_KEY.test(key)) return m;
      fields.add(key);
      return `${pre}"[redacted]"`;
    })
    .replace(/(^|[?&\s])([\w.\-[\]]{1,80})=([^&\s]*)/g, (m, lead, key) => {
      if (!SECRET_KEY.test(key)) return m;
      fields.add(key);
      return `${lead}${key}=[redacted]`;
    });
}

// ---------------------------------------------------------------------------

export function isNavigation(request) {
  const mode = request.headers.get("sec-fetch-mode");
  const dest = request.headers.get("sec-fetch-dest");
  if (mode || dest) return mode === "navigate" && (!dest || dest === "document");
  return request.method === "GET" && (request.headers.get("accept") || "").includes("text/html");
}

// level 0 = nothing sent, 1 = background data, 2 = highlighted (upload / form).
export function classifySend(request, sent) {
  if (!sent || !sent.totalBytes) return { level: 0, label: null };
  const ct = (sent.contentType || "").toLowerCase();
  if (ct.startsWith("multipart/form-data")) return { level: 2, label: "upload" };
  if (request.headers.get("sec-fetch-mode") === "navigate") return { level: 2, label: "form" };
  if (ct.startsWith("application/octet-stream")) return { level: 2, label: "upload" };
  if (/^(image|video|audio)\/|^application\/(pdf|zip|x-zip|vnd\.|msword)/.test(ct)) return { level: 2, label: "upload" };
  if (sent.totalBytes >= 50 * 1024) return { level: 2, label: "upload" };
  return { level: 1, label: "data" };
}

export function extractTitle(bytes, contentType) {
  if (!(contentType || "").toLowerCase().includes("html") || !bytes.byteLength) return null;
  const text = new TextDecoder().decode(bytes.subarray(0, 65536));
  const m = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const t = m[1]
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.slice(0, 200) : null;
}

// Captured bodies may still be gzip-compressed depending on how the upstream
// response was delivered. Detect by magic bytes rather than trusting headers.
export async function maybeDecompress(bytes) {
  if (bytes.byteLength > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch {
      return bytes;
    }
  }
  return bytes;
}

export function isTextual(contentType) {
  const ct = (contentType || "").toLowerCase();
  return ct.startsWith("text/") || ct.includes("json") || ct.includes("xml") || ct.includes("x-www-form-urlencoded") || ct.includes("javascript");
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
