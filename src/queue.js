import { ledger } from "./config.js";

// Group capture summaries by case and append them to that case's ledger.
// Queues deliver at least once; the ledger de-duplicates by captureId.
export async function consumeBatch(batch, env) {
  const byCase = new Map();
  for (const m of batch.messages) {
    const caseId = m.body?.caseId;
    if (!caseId) {
      console.error("dropping message without caseId");
      m.ack();
      continue;
    }
    if (!byCase.has(caseId)) byCase.set(caseId, []);
    byCase.get(caseId).push(m);
  }
  for (const [caseId, msgs] of byCase) {
    msgs.sort((a, b) => (a.body.ts || 0) - (b.body.ts || 0));
    try {
      await ledger(env, caseId).append(msgs.map((m) => m.body));
      for (const m of msgs) m.ack();
    } catch (err) {
      console.error(`ledger append failed for ${caseId}`, String(err));
      for (const m of msgs) m.retry();
    }
  }
}
