// Behaviour signals, category colours and filter matching for the investigator UI.
// The server works out each visit's category and signals (src/insights.js); this
// file only describes them and filters the list.

export const SIGNALS = {
  "security-threat": { label: "Security threat site", icon: "☠", tone: "bad", desc: "Cloudflare categorises this site as a security threat (phishing, malware, scam, command and control…)." },
  "exfil-chain": { label: "Download → upload", icon: "⇄", tone: "bad", desc: "A file was downloaded, then something was uploaded to a non-work site within the exfiltration window." },
  "personal-upload": { label: "Sent to personal service", icon: "⬆", tone: "bad", desc: "An upload or form went to personal cloud storage, webmail, messaging or a code/paste site." },
  evasion: { label: "Evasion / anonymiser", icon: "◌", tone: "bad", desc: "An anonymiser or VPN site, or searches about bypassing monitoring." },
  "ai-share": { label: "Data shared with AI", icon: "✦", tone: "warn", desc: "A file or a large block of text was sent to an AI service." },
  "watch-term": { label: "Watch-list search", icon: "⌕", tone: "warn", desc: "A search matched a term on the case watch list." },
  "large-send": { label: "Large upload", icon: "▲", tone: "warn", desc: "A lot of data was sent from this page." },
  job: { label: "Job hunting", icon: "☍", tone: "warn", desc: "Job sites, careers pages, CV uploads or job-related searches." },
  "remote-access": { label: "Remote access / P2P", icon: "⇆", tone: "warn", desc: "Cloudflare categorises this site as remote-access or peer-to-peer software, which can move data off the device." },
  "posture-change": { label: "Device posture dropped", icon: "⛨", tone: "warn", desc: "The device stopped passing a posture check it passed earlier in the case (from Gateway's device posture)." },
  "new-domain": { label: "New domain", icon: "✳", tone: "warn", desc: "Cloudflare marks this as a new or newly seen domain." },
  "new-network": { label: "New network", icon: "⌖", tone: "info", desc: "First visit from this source IP or connection method in the case (from Gateway)." },
  upload: { label: "Upload", icon: "⬆", tone: "info", desc: "A file or large body was sent." },
  form: { label: "Form submitted", icon: "✎", tone: "info", desc: "A form was submitted." },
  download: { label: "File download", icon: "⬇", tone: "info", desc: "A file was downloaded." },
  "after-hours": { label: "After hours", icon: "☾", tone: "info", desc: "Activity outside the configured working hours." },
};

export const SIGNAL_ORDER = Object.keys(SIGNALS);

const CATEGORY_COLORS = {
  "Artificial Intelligence": "#8b5cf6",
  "Cloud Storage & File Sharing": "#3b82f6",
  "Personal Email": "#38bdf8",
  "Job Search & Careers": "#f59e0b",
  "Messaging & Chat": "#14b8a6",
  "Social Networks": "#06b6d4",
  "Anonymizers & VPN": "#ef4444",
  "Code & Paste Sites": "#6366f1",
  "Hacking & Security Tools": "#b91c1c",
  "Search Engines": "#64748b",
  Shopping: "#84cc16",
  "News & Media": "#a16207",
  "Streaming & Entertainment": "#0e7490",
  "Business & Productivity": "#10b981",
  "Corporate (work)": "#059669",
  "Security threats": "#991b1b",
  "Remote Access": "#ea580c",
  P2P: "#c2410c",
  "New Domains": "#f97316",
  Uncategorised: "#94a3b8",
};

export function categoryColor(name) {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  // Hash onto hues that avoid pinks/magentas (which read as "danger" next to red).
  const HUES = [205, 190, 170, 150, 125, 95, 50, 35, 225, 245, 265];
  return `hsl(${HUES[h % HUES.length]} 55% 50%)`;
}

export const RISK_LEVELS = [
  { id: "all", label: "All" },
  { id: "flagged", label: "Flagged", min: 1 },
  { id: "medium", label: "Medium+", min: 3 },
  { id: "high", label: "High", min: 6 },
];

export function newFilters() {
  return { signals: new Set(), categories: new Set(), hours: new Set(), afterHours: false, risk: "all", q: "", sort: "time" };
}

export function activeFilterCount(f) {
  return f.signals.size + f.categories.size + f.hours.size + (f.afterHours ? 1 : 0) + (f.risk !== "all" ? 1 : 0) + (f.q ? 1 : 0);
}

export function haystack(v) {
  if (v._hay) return v._hay;
  v._hay = [
    v.url,
    v.title,
    v.category,
    ...(v.cfCategories || []),
    v.searchTerms,
    ...(v.fileNames || []),
    ...(v.signals || []).map((s) => `${SIGNALS[s.id]?.label || s.id} ${s.detail || ""}`),
    ...(v.sends || []).map((s) => s.url),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return v._hay;
}

// skip: name of one facet to ignore (so its own counts show what selecting it would add)
export function matches(v, f, skip = null) {
  if (skip !== "signals" && f.signals.size && !(v.signals || []).some((s) => f.signals.has(s.id))) return false;
  if (skip !== "categories" && f.categories.size && !f.categories.has(v.category)) return false;
  if (skip !== "hours" && f.hours.size && !f.hours.has(v.local?.hour)) return false;
  if (skip !== "afterHours" && f.afterHours && !v.local?.afterHours) return false;
  if (skip !== "risk" && f.risk !== "all") {
    const min = RISK_LEVELS.find((r) => r.id === f.risk)?.min || 0;
    if ((v.risk || 0) < min) return false;
  }
  if (skip !== "q" && f.q && !haystack(v).includes(f.q)) return false;
  return true;
}

export function facets(visits, f) {
  const signals = new Map();
  const categories = new Map();
  let afterHours = 0;
  const risk = new Map(RISK_LEVELS.map((r) => [r.id, 0]));
  for (const v of visits) {
    if (matches(v, f, "signals")) for (const s of v.signals || []) signals.set(s.id, (signals.get(s.id) || 0) + 1);
    if (matches(v, f, "categories")) categories.set(v.category, (categories.get(v.category) || 0) + 1);
    if (matches(v, f, "afterHours") && v.local?.afterHours) afterHours++;
    if (matches(v, f, "risk")) {
      for (const r of RISK_LEVELS) if ((v.risk || 0) >= (r.min || 0)) risk.set(r.id, risk.get(r.id) + 1);
    }
  }
  return { signals, categories, afterHours, risk };
}
