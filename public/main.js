// Web front end for the evidence Worker. Same UI as the gadget; data comes from
// the Worker's own /api endpoints, authenticated by the Cloudflare Access session.

import { mountApp } from "./ui/app.js";
import { metaFromHeaders } from "./ui/meta.js";

const enc = encodeURIComponent;

async function call(path) {
  const res = await fetch(path, { credentials: "same-origin", headers: { accept: "application/json" } });
  return check(res);
}

async function check(res) {
  const type = res.headers.get("content-type") || "";
  if (res.redirected || type.includes("text/html")) {
    throw new Error("Your Cloudflare Access session has expired. Reload the page to sign in again.");
  }
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const j = await res.json();
      detail = j.detail ? `${j.error}: ${j.detail}` : j.error || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res;
}

const api = {
  me: async () => (await call("/api/me")).json(),
  cases: async () => (await call("/api/cases")).json(),
  journey: async (caseId) => (await call(`/api/cases/${enc(caseId)}/journey`)).json(),
  record: async (caseId, seq) => (await call(`/api/cases/${enc(caseId)}/records/${seq}`)).json(),
  verify: async (caseId, from) => (await call(`/api/cases/${enc(caseId)}/verify?from=${from}`)).json(),
  screenshot: async (caseId, seq) => {
    const res = await check(await fetch(`/api/cases/${enc(caseId)}/visits/${seq}/screenshot`, { credentials: "same-origin" }));
    const blob = await res.blob();
    return { src: URL.createObjectURL(blob), meta: metaFromHeaders(res.headers) };
  },
};

mountApp(document.getElementById("app"), api, { mode: "web" });
