import { WorkerEntrypoint } from "cloudflare:workers";
import { handleGateway } from "./capture.js";
import { handleApi } from "./api.js";
import { consumeBatch } from "./queue.js";

export { CaseLedger } from "./ledger.js";

// Invoked by the Gateway Forward policy. The class name must stay exactly
// "GatewayMiddleware".
export class GatewayMiddleware extends WorkerEntrypoint {
  async handle(request, context, next) {
    return handleGateway(request, context, next, this.env, this.ctx);
  }
}

export default {
  // Evidence UI + read-only API on EVIDENCE_HOST (behind Cloudflare Access).
  async fetch(request, env, ctx) {
    return handleApi(request, env, ctx);
  },

  // Capture summaries -> per-case hash-chained ledger.
  async queue(batch, env) {
    await consumeBatch(batch, env);
  },
};
