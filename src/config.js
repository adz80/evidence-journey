// Case configuration and shared helpers for reading Worker settings.

export function getCases(env) {
  let raw = env.CASES;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c.id === "string" && /^[\w.-]{1,64}$/.test(c.id) && typeof c.subject === "string")
    .map((c) => ({
      id: c.id,
      title: typeof c.title === "string" ? c.title : c.id,
      subject: c.subject.trim().toLowerCase(),
      start: Date.parse(c.start), // NaN => case never active (fail safe)
      end: Date.parse(c.end),
      captureSent: c.captureSent !== false,
      allowReset: c.allowReset === true,
      // Durable Object name of the case ledger. A new name gives a fresh ledger,
      // created where LEDGER_LOCATION_HINT says (a ledger can't move once created).
      ledgerName: typeof c.ledgerName === "string" && c.ledgerName ? c.ledgerName : c.id,
      // Old ledgers of this case, wiped completely by the PoC reset.
      retiredLedgers: Array.isArray(c.retiredLedgers) ? c.retiredLedgers.filter((n) => typeof n === "string" && n) : [],
    }));
}

export function findCase(env, caseId) {
  return getCases(env).find((c) => c.id === caseId) || null;
}

export function isActive(c, now = Date.now()) {
  return !!c && now >= c.start && now < c.end;
}

export function activeCaseFor(env, email, now = Date.now()) {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  return getCases(env).find((c) => c.subject === e && isActive(c, now)) || null;
}

export function maxBytes(env) {
  const n = Number(env.MAX_CAPTURE_BYTES);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2 * 1024 * 1024;
}

export function idleMs(env) {
  const n = Number(env.SESSION_IDLE_MINUTES);
  return (Number.isFinite(n) && n > 0 ? n : 30) * 60_000;
}

// LEDGER_LOCATION_HINT ("oc" = Oceania) decides where a case's ledger is created.
// It only applies the first time a case's Durable Object is created; an existing
// one stays where it is.
export function ledger(env, caseId) {
  return ledgerByName(env, findCase(env, caseId)?.ledgerName || caseId);
}

export function ledgerByName(env, name) {
  const hint = env.LEDGER_LOCATION_HINT || undefined;
  return env.LEDGER.get(env.LEDGER.idFromName(name), hint ? { locationHint: hint } : undefined);
}

// Cloudflare data centre code (e.g. "SYD") of whoever runs this code.
export async function currentColo() {
  try {
    const t = await (await fetch("https://cloudflare.com/cdn-cgi/trace")).text();
    return /^colo=(.+)$/m.exec(t)?.[1] || null;
  } catch {
    return null;
  }
}
