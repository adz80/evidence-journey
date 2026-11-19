// Everything Gateway's Forward action hands the Worker, and what it means.
//
// Reference: https://developers.cloudflare.com/cloudflare-one/traffic-controls/integrate-workers/available-context/
//   context fields  srcIp srcPort dstIp dstPort networkProtocol sni onrampType vnetId
//                   proxyEndpoint internalSrcIp accountId policyId host uri
//                   embeddedProtocols[] domainCategories[] (Cloudflare category IDs)
//   context.identity()      -> {email, name, groups[{id,email,name}], samlAttributes[], oidcClaims[]} | null
//   context.devicePosture() -> {checks: {passed: [postureCheckUUID]}}
// Not provided by Gateway: DLP match details, custom function results, failed posture checks,
// device ID. (Those live in Gateway's own logs.)

export const CONTEXT_FIELDS = [
  "srcIp", "srcPort", "dstIp", "dstPort", "networkProtocol", "sni", "onrampType", "vnetId",
  "proxyEndpoint", "internalSrcIp", "accountId", "policyId", "host", "uri",
];
const LIST_FIELDS = ["embeddedProtocols", "domainCategories"];

// Copies every documented field, plus any other plain value Gateway adds later, so
// nothing it sends is lost. Functions (identity, devicePosture) are skipped.
export function snapshotContext(context) {
  const out = {};
  const take = (k) => {
    let v;
    try {
      v = context[k];
    } catch {
      return;
    }
    if (v == null || typeof v === "function") return;
    if (Array.isArray(v) || (typeof v === "object" && typeof v[Symbol.iterator] === "function")) {
      const arr = Array.from(v).slice(0, 100);
      if (arr.length) out[k] = arr.map((x) => (typeof x === "object" ? JSON.parse(JSON.stringify(x)) : x));
      return;
    }
    if (typeof v === "object") {
      try {
        out[k] = JSON.parse(JSON.stringify(v));
      } catch {
        /* not serialisable */
      }
      return;
    }
    out[k] = typeof v === "string" ? v.slice(0, 2048) : v;
  };
  for (const k of CONTEXT_FIELDS) take(k);
  for (const k of LIST_FIELDS) take(k);
  try {
    for (const k of Object.keys(context)) if (!(k in out)) take(k);
  } catch {
    /* context may not be enumerable */
  }
  return out;
}

// Small per-record identity summary. The full identity (including SAML attributes and
// OIDC claims) is stored once per distinct value in R2 and referenced by its SHA-256.
export function identitySummary(identity) {
  if (!identity) return null;
  const groups = Array.isArray(identity.groups) ? identity.groups : identity.groups ? Array.from(identity.groups) : [];
  return {
    email: identity.email || null,
    name: identity.name || null,
    groups: groups.slice(0, 30).map((g) => g?.name || g?.email || g?.id || "?"),
    groupCount: groups.length,
    samlAttributeCount: identity.samlAttributes ? Array.from(identity.samlAttributes).length : 0,
    oidcClaimCount: identity.oidcClaims ? Array.from(identity.oidcClaims).length : 0,
  };
}

export function plainIdentity(identity) {
  if (!identity) return null;
  try {
    return JSON.parse(JSON.stringify(identity));
  } catch {
    return { email: identity.email || null, name: identity.name || null };
  }
}

// Cloudflare Gateway content categories for this account
// (GET /accounts/{id}/gateway/categories, 2026-11-19). id: [name, parentId|null]
export const CF_CATEGORIES = {
  1: ["Ads", null], 66: ["Advertisements", 1], 195: ["Trackers/Analytics", 1],
  2: ["Adult Themes", null], 67: ["Adult Themes", 2], 125: ["Nudity", 2], 133: ["Pornography", 2],
  31: ["Blocked by Default", null], 170: ["Child Abuse", 31],
  3: ["Business & Economy", null], 186: ["Brokerage & Investing", 3], 75: ["Business", 3], 183: ["Cryptocurrency", 3], 89: ["Economy & Finance", 3], 185: ["Personal Finance", 3],
  34: ["CIPA", null], 182: ["CIPA Filter", 34],
  4: ["Deceptive Ads", null], 5: ["Drugs", null],
  6: ["Education", null], 90: ["Education", 6], 91: ["Educational Institutions", 6], 189: ["Reference", 6], 144: ["Science", 6], 150: ["Space & Astronomy", 6],
  7: ["Entertainment", null], 70: ["Arts", 7], 74: ["Audio Streaming", 7], 76: ["Cartoons & Anime", 7], 79: ["Comic Books", 7], 92: ["Entertainment", 7], 96: ["Fine Art", 7], 100: ["Gaming", 7], 106: ["Home Video/DVD", 7], 107: ["Humor", 7], 116: ["Magazines", 7], 120: ["Movies", 7], 121: ["Music", 7], 122: ["News & Media", 7], 127: ["Paranormal", 7], 139: ["Radio", 7], 156: ["Television", 7], 164: ["Video Streaming", 7],
  8: ["Gambling", null], 99: ["Gambling", 8],
  9: ["Government & Politics", null], 190: ["Charity and Non-profit", 9], 101: ["Government/Legal", 9], 137: ["Politics, Advocacy, and Government-Related", 9],
  10: ["Health", null], 103: ["Health & Fitness", 10], 146: ["Sex Education", 10],
  11: ["Information Technology", null],
  12: ["Internet Communication", null], 77: ["Chat", 12], 98: ["Forums", 12], 108: ["Information Security", 12], 110: ["Instant Messengers", 12], 111: ["Internet Phone & VOIP", 12], 118: ["Messaging", 12], 126: ["P2P", 12], 129: ["Personal Blogs", 12], 172: ["Photo Sharing", 12], 168: ["Webmail", 12],
  13: ["Job Search & Careers", null], 113: ["Job Search & Careers", 13],
  14: ["Login Screens", null],
  33: ["Military & Weapons", null], 179: ["Military", 33], 166: ["Weapons", 33],
  15: ["Miscellaneous", null], 115: ["Login Screens", 15], 119: ["Miscellaneous", 15], 124: ["No Content", 15], 141: ["URL Alias/Redirect", 15], 161: ["Unreachable", 15],
  16: ["No Content", null],
  17: ["Questionable Content", null], 85: ["Deceptive Ads", 17], 87: ["Drugs", 17], 102: ["Hacking", 17], 157: ["Militancy, Hate & Extremism", 17], 135: ["Profanity", 17], 138: ["Questionable Activities", 17], 180: ["School Cheating", 17], 162: ["Unreliable Information", 17],
  18: ["Real Estate", null], 140: ["Real Estate", 18],
  19: ["Religion", null], 142: ["Religion & Spirituality", 19],
  20: ["Safe for Kids", null], 143: ["Safe for Kids", 20],
  32: ["Security Risks", null], 169: ["New Domains", 32], 177: ["Newly Seen Domains", 32], 128: ["Parked & For Sale Domains", 32],
  21: ["Security threats", null], 68: ["Anonymizer", 21], 178: ["Brand Embedding", 21], 80: ["Command and Control & Botnet", 21], 187: ["Compromised Domain", 21], 83: ["Cryptomining", 21], 176: ["DGA Domains", 21], 175: ["DNS Tunneling", 21], 117: ["Malware", 21], 131: ["Phishing", 21], 188: ["Potentially unwanted software", 21], 134: ["Private IP Address", 21], 191: ["Scam", 21], 151: ["Spam", 21], 153: ["Spyware", 21],
  22: ["Shopping & Auctions", null], 73: ["Auctions & Marketplaces", 22], 82: ["Coupons", 22], 88: ["Ecommerce", 22], 148: ["Shopping", 22],
  23: ["Social & Family", null],
  24: ["Society & Lifestyle", null], 65: ["Abortion", 24], 181: ["Alcohol", 24], 71: ["Arts & Crafts", 24], 72: ["Astrology", 24], 173: ["Body Art", 24], 78: ["Clothing", 24], 84: ["Dating & Relationships", 24], 86: ["Digital Postcards", 24], 94: ["Fashion", 24], 97: ["Food & Drink", 24], 104: ["Hobbies & Interests", 24], 105: ["Home & Garden", 24], 112: ["Jewelry", 24], 171: ["LGBTQ", 24], 114: ["Lifestyle", 24], 174: ["Lingerie & Bikini", 24], 93: ["Parenting", 24], 130: ["Pets", 24], 132: ["Photography", 24], 136: ["Professional Networking", 24], 147: ["Sexuality", 24], 149: ["Social Networks", 24], 154: ["Swimsuits", 24], 158: ["Tobacco", 24],
  25: ["Sports", null], 152: ["Sports", 25],
  26: ["Technology", null], 69: ["APIs", 26], 184: ["Artificial Intelligence", 26], 81: ["Content Servers", 26], 95: ["File Sharing", 26], 109: ["Information Technology", 26], 194: ["Keep Awake Software", 26], 123: ["News, Portal & Search", 26], 192: ["Remote Access", 26], 145: ["Search Engines", 26], 193: ["Shareware/Freeware", 26], 155: ["Technology", 26], 159: ["Translator", 26],
  27: ["Travel", null], 160: ["Travel", 27],
  28: ["Vehicles", null], 163: ["Vehicles", 28],
  29: ["Violence", null], 165: ["Violence", 29],
  30: ["Weather", null], 167: ["Weather", 30],
};

// Cloudflare sub-categories that map onto the journey's own categories. Checked in this
// order, so threats win over everything else.
const CF_TO_JOURNEY = [
  [[117, 131, 80, 187, 83, 176, 175, 191, 153, 188, 178], "Security threats"],
  [[68], "Anonymizers & VPN"],
  [[102], "Hacking & Security Tools"],
  [[184], "Artificial Intelligence"],
  [[95], "Cloud Storage & File Sharing"],
  [[168], "Personal Email"],
  [[113, 13], "Job Search & Careers"],
  [[77, 110, 118, 111], "Messaging & Chat"],
  [[192], "Remote Access"],
  [[126], "P2P"],
  [[149, 136, 172, 98], "Social Networks"],
  [[145], "Search Engines"],
  [[88, 148, 73, 82], "Shopping"],
  [[122], "News & Media"],
  [[164, 74, 120, 121, 156, 139, 100], "Streaming & Entertainment"],
  [[169, 177], "New Domains"],
];

// Cloudflare categories too broad to describe a site on their own.
const BROAD = new Set([81, 69, 155, 109, 26, 11, 15, 119]);

export const THREAT_IDS = new Set(CF_TO_JOURNEY[0][0]);
export const NEW_DOMAIN_IDS = new Set([169, 177]);
export const REMOTE_ACCESS_IDS = new Set([192, 126]);

export function cfCategoryLabel(id) {
  const c = CF_CATEGORIES[id];
  if (!c) return `Category ${id}`;
  const parent = c[1] != null ? CF_CATEGORIES[c[1]] : null;
  return parent && parent[0] !== c[0] ? `${parent[0]} › ${c[0]}` : c[0];
}

// Sub-categories first (they are the specific ones), parents only when alone.
export function cfCategoryNames(ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const set = new Set(ids.map(Number));
  const out = [];
  for (const id of set) {
    const c = CF_CATEGORIES[id];
    if (!c) {
      out.push(`Category ${id}`);
      continue;
    }
    if (c[1] == null && [...set].some((x) => CF_CATEGORIES[x]?.[1] === id)) continue; // parent of one listed
    out.push(cfCategoryLabel(id));
  }
  return out;
}

// -> { name, mapped } : the journey category Cloudflare's IDs point to, if any.
export function journeyCategoryFromCf(ids) {
  if (!Array.isArray(ids) || !ids.length) return null;
  const set = new Set(ids.map(Number));
  for (const [list, name] of CF_TO_JOURNEY) if (list.some((x) => set.has(x))) return { name, mapped: true };
  const specific = [...set].filter((x) => CF_CATEGORIES[x] && !BROAD.has(x) && CF_CATEGORIES[x][1] != null);
  if (specific.length) return { name: CF_CATEGORIES[specific[0]][0], mapped: false };
  return null;
}
