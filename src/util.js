// Hashing, canonical JSON, header/body redaction and small helpers.

import * as zlib from "node:zlib";

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
  if (sent.fileNames?.length) return { level: 2, label: "upload" };
  if (request.headers.get("sec-fetch-mode") === "navigate") return { level: 2, label: "form" };
  if (ct.startsWith("application/octet-stream")) return { level: 2, label: "upload" };
  if (/^(image|video|audio)\/|^application\/(pdf|zip|x-zip|vnd\.|msword)/.test(ct)) return { level: 2, label: "upload" };
  if (sent.totalBytes >= 50 * 1024) return { level: 2, label: "upload" };
  return { level: 1, label: "data" };
}

// File names of an upload: multipart part headers, plus common request headers.
// Read from the (capped) captured copy only; never affects the upstream request.
export function uploadFileNames(bytes, contentType, headers) {
  const out = new Set();
  const add = (n) => {
    n = String(n || "").trim();
    if (n && n.length <= 255) out.add(n);
  };
  try {
    for (const h of ["content-disposition", "x-file-name", "x-filename", "x-goog-upload-file-name", "x-upload-file-name"]) {
      const v = headers.get(h);
      if (!v) continue;
      const m = /filename\*?\s*=\s*(?:[\w-]+'[^']*')?"?([^";]+)"?/i.exec(v);
      add(m ? safeDecode(m[1]) : h === "content-disposition" ? null : safeDecode(v));
    }
    if (/^multipart\/form-data/i.test(contentType || "") && bytes?.byteLength) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, Math.min(bytes.byteLength, 2 * 1024 * 1024)));
      const re = /content-disposition:[^\r\n]*?filename\*?\s*=\s*(?:[\w-]+'[^']*')?"([^"\r\n]*)"/gi;
      let m;
      while ((m = re.exec(text)) && out.size < 20) add(safeDecode(m[1]));
    }
  } catch {
    /* best effort */
  }
  return [...out].slice(0, 20);
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
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

// Captured bodies are stored exactly as they came over the wire, which usually
// means still compressed (gzip, br, zstd...). Evidence keeps the original bytes;
// decoding only happens for display and replay.
//
// decodeBody(bytes, contentEncoding) -> { bytes, decoded, encoding }
//   decoded=false means the original bytes are returned and `encoding` is the
//   Content-Encoding that is still applied (so the replay browser can decode it).
export async function decodeBody(bytes, contentEncoding) {
  let encs = String(contentEncoding || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter((e) => e && e !== "identity");
  if (!encs.length) {
    const sniffed = sniffEncoding(bytes);
    if (!sniffed) return { bytes, decoded: true, encoding: null };
    encs = [sniffed];
  }
  let out = bytes;
  // Encodings are listed in the order they were applied: undo them in reverse.
  for (const e of [...encs].reverse()) {
    let d = null;
    try {
      d = await decodeOne(out, e);
    } catch {
      d = null;
    }
    if (!d) return { bytes, decoded: false, encoding: encs.join(", ") };
    out = d;
  }
  return { bytes: out, decoded: true, encoding: null };
}

// Backwards-compatible helper: decoded bytes, or the originals if decoding fails.
export async function maybeDecompress(bytes, contentEncoding) {
  return (await decodeBody(bytes, contentEncoding)).bytes;
}

function sniffEncoding(b) {
  if (b.byteLength > 2 && b[0] === 0x1f && b[1] === 0x8b) return "gzip";
  if (b.byteLength > 4 && b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd) return "zstd";
  return null; // Brotli has no magic number; rely on the header.
}

async function decodeOne(bytes, enc) {
  if (enc === "gzip" || enc === "x-gzip") return streamDecode(bytes, "gzip");
  if (enc === "deflate") return (await streamDecode(bytes, "deflate")) || streamDecode(bytes, "deflate-raw");
  if (enc === "br") {
    try {
      return new Uint8Array(zlib.brotliDecompressSync(bytes));
    } catch {
      return null;
    }
  }
  if (enc === "zstd" && typeof zlib.zstdDecompressSync === "function") {
    try {
      return new Uint8Array(zlib.zstdDecompressSync(bytes));
    } catch {
      return null;
    }
  }
  return null;
}

// Stream-decode; if the input was cut off (capture cap), keep what decoded.
async function streamDecode(bytes, format) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)).getReader();
  const chunks = [];
  let n = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      n += value.byteLength;
    }
  } catch {
    if (!n) return null;
  }
  const out = new Uint8Array(n);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
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
