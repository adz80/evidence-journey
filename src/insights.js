// Categories and behaviour signals for the journey view.
//
// Everything here is computed when the journey is read, from records already in
// the ledger, so older captures get categories and signals too and nothing in the
// evidence itself changes. Signals are leads for an investigator to review, not
// findings: every one links back to the captured request it came from.
//
// Category sources, most trusted first:
//   1. "gateway"   - CATEGORY_POLICIES maps a Gateway policy ID to a category name.
//   2. "corporate" - CORP_DOMAINS (the organisation's own domains).
//   3. "gateway-category" - Cloudflare's own domain categories, which Gateway sends with
//                    every forwarded request (context.domainCategories). Security threats
//                    always win; a path-specific built-in entry (linkedin.com/jobs) beats
//                    the rest.
//   4. "built-in"  - the domain list below (most specific match wins).
//
// Tunables (all optional wrangler vars):
//   WORK_HOURS "08:00-18:00", WORK_DAYS "1-5" (Mon=1 … Sun=7), WORK_TZ "Australia/Sydney"
//   POSTURE_CHECKS {"<uuid>": "name"}  (names for device posture checks)
//   WATCH_TERMS {"evasion":[…],"watch":[…],"job":[…]}   AI_SHARE_BYTES "2000"
//   EXFIL_WINDOW_MINUTES "30"   LARGE_SEND_BYTES "5242880"

import { NEW_DOMAIN_IDS, REMOTE_ACCESS_IDS, THREAT_IDS, cfCategoryLabel, cfCategoryNames, journeyCategoryFromCf } from "./gatewayctx.js";

export const CATEGORY_RULES = {
  "Artificial Intelligence": [
    "chatgpt.com", "openai.com", "oaiusercontent.com", "claude.ai", "anthropic.com", "gemini.google.com",
    "bard.google.com", "aistudio.google.com", "notebooklm.google.com", "copilot.microsoft.com", "perplexity.ai",
    "poe.com", "character.ai", "huggingface.co", "chat.mistral.ai", "mistral.ai", "deepseek.com", "grok.com",
    "x.ai", "you.com", "meta.ai", "pi.ai", "groq.com", "cohere.com", "phind.com", "jasper.ai", "writesonic.com",
  ],
  "Cloud Storage & File Sharing": [
    "drive.google.com", "drive.usercontent.google.com", "docs.google.com", "dropbox.com", "dropboxusercontent.com",
    "box.com", "onedrive.live.com", "1drv.ms", "wetransfer.com", "we.tl", "mega.nz", "mega.io", "mediafire.com",
    "icloud.com", "pcloud.com", "sync.com", "sendspace.com", "file.io", "gofile.io", "transfer.sh", "filemail.com",
    "swisstransfer.com", "4shared.com", "terabox.com", "jumpshare.com", "tresorit.com", "idrive.com",
  ],
  "Personal Email": [
    "mail.google.com", "gmail.com", "outlook.live.com", "mail.yahoo.com", "proton.me", "protonmail.com",
    "tutanota.com", "tuta.com", "gmx.com", "gmx.net", "mail.com", "mail.zoho.com", "mail.aol.com",
    "fastmail.com", "hey.com", "mail.yandex.com", "mail.ru", "yopmail.com", "guerrillamail.com", "10minutemail.com",
  ],
  "Job Search & Careers": [
    "linkedin.com/jobs", "indeed.com", "glassdoor.com", "glassdoor.co.uk", "monster.com", "reed.co.uk",
    "totaljobs.com", "cv-library.co.uk", "ziprecruiter.com", "dice.com", "hired.com", "wellfound.com",
    "otta.com", "welcometothejungle.com", "greenhouse.io", "lever.co", "workable.com", "smartrecruiters.com",
    "myworkdayjobs.com", "ashbyhq.com", "seek.com.au", "stepstone.com", "stepstone.de", "jobsite.co.uk",
    "careerbuilder.com", "simplyhired.com", "teamtailor.com", "recruitee.com", "bamboohr.com/careers",
  ],
  "Messaging & Chat": [
    "web.whatsapp.com", "whatsapp.com", "web.telegram.org", "telegram.org", "t.me", "discord.com",
    "discordapp.com", "signal.org", "messenger.com", "teams.live.com", "skype.com", "wechat.com", "element.io",
    "app.element.io", "line.me", "viber.com",
  ],
  "Social Networks": [
    "facebook.com", "instagram.com", "x.com", "twitter.com", "tiktok.com", "reddit.com", "linkedin.com",
    "pinterest.com", "snapchat.com", "threads.net", "bsky.app", "tumblr.com", "mastodon.social", "quora.com",
  ],
  "Anonymizers & VPN": [
    "torproject.org", "hide.me", "hidemyass.com", "proxysite.com", "croxyproxy.com", "kproxy.com",
    "nordvpn.com", "expressvpn.com", "protonvpn.com", "surfshark.com", "mullvad.net", "privateinternetaccess.com",
    "windscribe.com", "tunnelbear.com", "cyberghostvpn.com", "4everproxy.com", "proxyium.com", "blockaway.net",
    "whoer.net", "psiphon.ca", "ultrasurf.us", "hola.org", "browsec.com", "urban-vpn.com", "hidester.com",
    "croxy.network", "vpnbook.com",
  ],
  "Code & Paste Sites": [
    "github.com", "gist.github.com", "githubusercontent.com", "gitlab.com", "bitbucket.org", "pastebin.com",
    "paste.ee", "hastebin.com", "privatebin.net", "rentry.co", "controlc.com", "dpaste.org", "justpaste.it",
    "codepen.io", "jsfiddle.net", "replit.com", "codesandbox.io", "stackblitz.com", "pastes.io",
  ],
  "Hacking & Security Tools": [
    "exploit-db.com", "hackforums.net", "nulled.to", "kali.org", "metasploit.com", "shodan.io",
    "crackstation.net", "hashes.com", "cracked.io",
  ],
  "Search Engines": [
    /^(www\.)?google\.[a-z.]+$/, "bing.com", "duckduckgo.com", "search.yahoo.com", "search.brave.com",
    "ecosia.org", "startpage.com", "yandex.com", "baidu.com", "kagi.com",
  ],
  Shopping: [/(^|\.)amazon\.[a-z.]+$/, /(^|\.)ebay\.[a-z.]+$/, "etsy.com", "aliexpress.com", "temu.com", "shein.com", "argos.co.uk"],
  "News & Media": ["bbc.co.uk", "bbc.com", "cnn.com", "theguardian.com", "nytimes.com", "reuters.com", "ft.com", "bloomberg.com", "news.google.com"],
  "Streaming & Entertainment": ["youtube.com", "youtu.be", "netflix.com", "twitch.tv", "spotify.com", "disneyplus.com", "primevideo.com", "vimeo.com"],
  "Business & Productivity": [
    "slack.com", "zoom.us", "teams.microsoft.com", "office.com", "microsoft365.com", "sharepoint.com", "notion.so",
    "atlassian.net", "atlassian.com", "salesforce.com", "force.com", "workday.com", "okta.com", "cloudflareaccess.com",
    "dash.cloudflare.com", "calendar.google.com", "meet.google.com",
  ],
};

export const UNCATEGORISED = "Uncategorised";
const PERSONAL_DEST = new Set(["Cloud Storage & File Sharing", "Personal Email", "Messaging & Chat", "Code & Paste Sites", "P2P"]);

const DEFAULT_TERMS = {
  evasion: [
    "bypass dlp", "bypass proxy", "bypass firewall", "bypass gateway", "disable warp", "uninstall warp", "turn off warp",
    "delete browser history", "clear browser history", "delete history", "clear history", "incognito", "tor browser",
    "proxy site", "unblock site", "hide my ip", "free vpn", "avoid monitoring", "is my employer watching",
    "employee monitoring", "disable antivirus",
  ],
  watch: [
    "resignation letter", "how to resign", "notice period", "garden leave", "non-compete", "non compete",
    "copy files to usb", "usb drive", "forward to personal email", "download all files", "export all contacts",
    "export customer list", "competitor", "sell data",
  ],
  job: ["jobs", "job interview", "careers", "salary", "cv template", "resume template", "cover letter", "recruiter"],
};

// Signal weights for the per-visit risk score. high >= 6, medium >= 3, low > 0.
export const SIGNAL_WEIGHTS = {
  "exfil-chain": 5,
  "security-threat": 5,
  "remote-access": 3,
  "posture-change": 2,
  "new-domain": 2,
  "new-network": 1,
  "personal-upload": 4,
  evasion: 4,
  "ai-share": 3,
  "watch-term": 3,
  "large-send": 3,
  job: 2,
  upload: 1,
  form: 1,
  download: 1,
  "after-hours": 1,
};

// ---- configuration --------------------------------------------------------------

function parseJson(v, fallback) {
  if (v == null || v === "") return fallback;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function insightConfig(env) {
  const [startS, endS] = String(env.WORK_HOURS || "08:00-18:00").split("-");
  const toMin = (s, d) => {
    const m = /^(\d{1,2}):?(\d{2})?$/.exec((s || "").trim());
    return m ? Number(m[1]) * 60 + Number(m[2] || 0) : d;
  };
  const [d1, d2] = String(env.WORK_DAYS || "1-5").split("-").map(Number);
  const terms = parseJson(env.WATCH_TERMS, {});
  const lower = (a, d) => (Array.isArray(a) ? a : d).map((x) => String(x).toLowerCase()).filter(Boolean);
  let tz = env.WORK_TZ || "Australia/Sydney";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
  } catch {
    tz = "UTC";
  }
  return {
    tz,
    workStart: toMin(startS, 8 * 60),
    workEnd: toMin(endS, 18 * 60),
    workDays: [d1 || 1, d2 || d1 || 5],
    workHours: env.WORK_HOURS || "08:00-18:00",
    terms: {
      evasion: lower(terms.evasion, DEFAULT_TERMS.evasion),
      watch: lower(terms.watch, DEFAULT_TERMS.watch),
      job: lower(terms.job, DEFAULT_TERMS.job),
    },
    corp: lower(parseJson(env.CORP_DOMAINS, []), []),
    policies: parseJson(env.CATEGORY_POLICIES, {}),
    postureNames: parseJson(env.POSTURE_CHECKS, {}),
    aiShareBytes: Number(env.AI_SHARE_BYTES) || 2000,
    exfilMs: (Number(env.EXFIL_WINDOW_MINUTES) || 30) * 60_000,
    largeSendBytes: Number(env.LARGE_SEND_BYTES) || 5 * 1024 * 1024,
  };
}

// ---- categorisation ---------------------------------------------------------------

function hostMatches(host, entry) {
  return host === entry || host.endsWith("." + entry);
}

export function categorize(url, policyId, cfg, cfIds = null) {
  if (policyId && cfg.policies && cfg.policies[policyId]) return { name: cfg.policies[policyId], source: "gateway" };
  let u;
  try {
    u = new URL(url);
  } catch {
    return { name: UNCATEGORISED, source: "none" };
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (cfg.corp.some((d) => hostMatches(host, d))) return { name: "Corporate (work)", source: "corporate" };
  const cf = journeyCategoryFromCf(cfIds);
  if (cf && cf.name === "Security threats") return { name: cf.name, source: "gateway-category" };
  const built = builtInCategory(u, host);
  if (built && built.len >= 100) return { name: built.name, source: "built-in" };
  if (cf && cf.mapped) return { name: cf.name, source: "gateway-category" };
  if (built) return { name: built.name, source: "built-in" };
  if (cf) return { name: cf.name, source: "gateway-category" };
  return { name: UNCATEGORISED, source: "none" };
}

function builtInCategory(u, host) {
  const hostPath = host.replace(/^www\./, "") + u.pathname.toLowerCase();
  let best = null;
  let bestLen = -1;
  for (const [name, entries] of Object.entries(CATEGORY_RULES)) {
    for (const e of entries) {
      let len = -1;
      if (e instanceof RegExp) {
        if (e.test(host)) len = 1;
      } else if (e.includes("/")) {
        const [h, ...rest] = e.split("/");
        const p = "/" + rest.join("/");
        const bare = host.replace(/^www\./, "");
        if (hostMatches(bare, h) && hostPath.slice(bare.length).startsWith(p)) len = e.length + 100;
      } else if (hostMatches(host, e)) {
        len = e.length;
      }
      if (len > bestLen) {
        bestLen = len;
        best = name;
      }
    }
  }
  return best ? { name: best, len: bestLen } : null;
}

// ---- search terms and file names -------------------------------------------------

const SEARCH_PARAMS = ["q", "p", "query", "text", "wd", "search_query", "k", "search", "keywords", "kw"];

export function searchTerms(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  for (const p of SEARCH_PARAMS) {
    const v = u.searchParams.get(p);
    if (v && v.trim() && v.length <= 500 && !/^https?:\/\//i.test(v)) return v.trim();
  }
  return null;
}

export function dispositionFileName(disposition) {
  if (!disposition) return null;
  const star = /filename\*\s*=\s*(?:[\w-]+'[^']*')?"?([^";]+)"?/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return star[1];
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : null;
}

// ---- local time ---------------------------------------------------------------------

const fmtCache = new Map();
function localParts(ts, tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
    fmtCache.set(tz, f);
  }
  const parts = Object.fromEntries(f.formatToParts(new Date(ts)).map((p) => [p.type, p.value]));
  const dow = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday] || 1;
  return { hour: Number(parts.hour) % 24, minute: Number(parts.minute), dow };
}

function isAfterHours(lp, cfg) {
  const [a, b] = cfg.workDays;
  if (lp.dow < a || lp.dow > b) return true;
  const m = lp.hour * 60 + lp.minute;
  return m < cfg.workStart || m >= cfg.workEnd;
}

function termHits(text, list) {
  if (!text) return [];
  const t = text.toLowerCase();
  return list.filter((w) => t.includes(w));
}

// ---- annotate the journey ---------------------------------------------------------------

// Adds to every visit: category, categorySource, searchTerms, fileNames, local
// {hour, dow, afterHours}, signals [{id, detail}], risk, riskLevel. Returns a
// summary of the detector settings for the UI.
export function annotateJourney(journey, env) {
  const cfg = insightConfig(env);
  const visits = [];
  for (const sess of journey.sessions) for (const v of sess.visits) visits.push(v);
  visits.sort((a, b) => a.ts - b.ts || a.seq - b.seq);

  const recentDownloads = []; // {ts, seq, name}
  // Gateway context seen so far in the case, for "first time" signals.
  const postureEver = new Set();
  const networks = new Map(); // "srcIp|onramp" -> {srcIp, onramp, proxyEndpoint, first, last, visits, firstSeq}
  const cfCounts = new Map();
  let postureErrors = 0;
  for (const v of visits) {
    const gw = v.gw || {};
    const cat = categorize(v.url, v.policyId, cfg, gw.cats);
    v.category = cat.name;
    v.categorySource = cat.source;
    v.cfCategories = cfCategoryNames(gw.cats);
    for (const n of v.cfCategories) cfCounts.set(n, (cfCounts.get(n) || 0) + 1);
    v.searchTerms = searchTerms(v.url);
    const lp = localParts(v.ts, cfg.tz);
    v.local = { hour: lp.hour, dow: lp.dow, afterHours: isAfterHours(lp, cfg) };

    const names = new Set();
    for (const s of v.sends) for (const n of s.fileNames || []) names.add(n);
    const dl = v.download ? dispositionFileName(v.disposition) || lastPathPart(v.url) : null;
    if (dl) names.add(dl);
    v.fileNames = [...names].slice(0, 20);

    const signals = [];
    const add = (id, detail) => {
      if (!signals.some((x) => x.id === id)) signals.push({ id, detail });
    };
    const uploads = v.sends.filter((s) => s.label === "upload");
    const forms = v.sends.filter((s) => s.label === "form");
    const totalSent = (v.sentBytes || 0) + 0;

    if (uploads.length) add("upload", `${uploads.length} upload${uploads.length === 1 ? "" : "s"}`);
    if (forms.length) add("form", `${forms.length} form submission${forms.length === 1 ? "" : "s"}`);
    if (v.download) add("download", dl ? `Downloaded ${dl}` : "File download");

    // Where the data went: the page's own category, or the category of each upload's destination.
    const destCats = new Set([v.category]);
    for (const s of uploads.concat(forms)) destCats.add(categorize(s.url, null, cfg).name);
    const personal = [...destCats].filter((c) => PERSONAL_DEST.has(c));
    if ((uploads.length || forms.length) && personal.length) add("personal-upload", `Sent to ${personal.join(", ")}`);

    if (destCats.has("Artificial Intelligence") && (uploads.length || (v.maxSendBytes || 0) >= cfg.aiShareBytes)) {
      add("ai-share", uploads.length ? "File uploaded to an AI service" : `Up to ${fmtKB(v.maxSendBytes)} sent in one request to an AI service`);
    }
    if (totalSent >= cfg.largeSendBytes) add("large-send", `${fmtKB(totalSent)} sent from this page`);

    const sendsSomething = uploads.length || forms.length;
    if (sendsSomething && v.category !== "Corporate (work)") {
      const prior = recentDownloads.filter((d) => v.ts - d.ts <= cfg.exfilMs && d.seq !== v.seq);
      if (prior.length) {
        const d = prior[prior.length - 1];
        add("exfil-chain", `Uploaded ${Math.max(1, Math.round((v.ts - d.ts) / 60000))} min after downloading ${d.name || "a file"} (visit #${d.seq})`);
        v.chainFromSeq = d.seq;
      }
    }

    const ev = termHits(v.searchTerms, cfg.terms.evasion);
    if (v.category === "Anonymizers & VPN") add("evasion", "Anonymiser / VPN site");
    else if (ev.length) add("evasion", `Searched: “${ev.join("”, “")}”`);
    const watch = termHits(v.searchTerms, cfg.terms.watch);
    if (watch.length) add("watch-term", `Searched: “${watch.join("”, “")}”`);

    const cvFile = [...names].find((n) => /\b(cv|resume|résumé|curriculum)\b/i.test(n));
    const jobTerms = termHits(v.searchTerms, cfg.terms.job);
    if (v.category === "Job Search & Careers") add("job", cvFile ? `Job site, uploaded ${cvFile}` : "Job site");
    else if (cvFile) add("job", `Uploaded ${cvFile}`);
    else if (/\/(careers?|jobs?|vacanc(y|ies)|apply)(\/|$)/i.test(safePath(v.url))) add("job", "Careers / jobs page");
    else if (jobTerms.length) add("job", `Searched: “${jobTerms.join("”, “")}”`);

    // ---- signals from Gateway's own metadata ----
    const ids = new Set((gw.cats || []).map(Number));
    const threats = [...ids].filter((x) => THREAT_IDS.has(x));
    if (threats.length) add("security-threat", `Cloudflare categorises this site as ${threats.map((x) => cfCategoryLabel(x).split(" › ").pop()).join(", ")}`);
    if ([...ids].some((x) => NEW_DOMAIN_IDS.has(x))) add("new-domain", "Cloudflare marks this as a new or newly seen domain");
    const ra = [...ids].filter((x) => REMOTE_ACCESS_IDS.has(x));
    if (ra.length) add("remote-access", `${ra.map((x) => cfCategoryLabel(x).split(" › ").pop()).join(", ")} site`);

    if (Array.isArray(gw.posture)) {
      const now = new Set(gw.posture);
      const lost = [...postureEver].filter((x) => !now.has(x));
      if (lost.length) add("posture-change", `Device no longer passing ${lost.map((x) => `“${cfg.postureNames[x] || x}”`).join(", ")}`);
      for (const x of now) postureEver.add(x);
    } else if (gw.postureError) postureErrors++;

    if (gw.srcIp) {
      const key = `${gw.srcIp}|${gw.onramp || ""}`;
      let n = networks.get(key);
      if (!n) {
        n = { srcIp: gw.srcIp, onramp: gw.onramp || null, proxyEndpoint: gw.proxyEndpoint || null, first: v.ts, last: v.ts, visits: 0, firstSeq: v.seq };
        if (networks.size) add("new-network", `First visit from ${gw.srcIp}${gw.onramp ? ` via ${gw.onramp}` : ""}`);
        networks.set(key, n);
      }
      n.last = v.ts;
      n.visits++;
    }

    if (v.local.afterHours && (signals.length || v.sends.length)) add("after-hours", `Outside working hours (${cfg.workHours}, ${cfg.tz})`);
    else if (v.local.afterHours) v.afterHoursOnly = true;

    v.signals = signals;
    v.risk = signals.reduce((a, s) => a + (SIGNAL_WEIGHTS[s.id] || 0), 0);
    v.riskLevel = v.risk >= 6 ? "high" : v.risk >= 3 ? "medium" : v.risk > 0 ? "low" : "none";

    if (v.download) recentDownloads.push({ ts: v.ts, seq: v.seq, name: dl });
    while (recentDownloads.length && v.ts - recentDownloads[0].ts > cfg.exfilMs) recentDownloads.shift();
  }

  return {
    tz: cfg.tz,
    workHours: cfg.workHours,
    workDays: cfg.workDays,
    categorySources: Object.keys(cfg.policies || {}).length ? "gateway policies + Cloudflare categories + built-in" : "Cloudflare categories + built-in",
    weights: SIGNAL_WEIGHTS,
    gateway: {
      networks: [...networks.values()].sort((a, b) => a.first - b.first).slice(0, 50),
      postureNames: cfg.postureNames,
      posturePassedEver: [...postureEver],
      postureErrors,
      cfCategories: [...cfCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
    },
  };
}

function lastPathPart(url) {
  try {
    const p = new URL(url).pathname.split("/").filter(Boolean).pop();
    return p ? decodeURIComponent(p).slice(0, 120) : null;
  } catch {
    return null;
  }
}

function safePath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function fmtKB(n) {
  if (!n) return "0 KB";
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
