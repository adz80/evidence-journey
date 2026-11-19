# evidence-capture Worker (PoC)

Captures what one named test subject sees and sends through Cloudflare Gateway,
stores it as tamper-evident evidence, and serves the investigator UI.

**PoC rule:** the subject in `CASES` must be you or a test account. Do not point
this at a real employee without a case, an approver, and Legal/HR sign-off.

## What is in here

| Path | Role |
|---|---|
| `src/gatewayctx.js` | Everything Gateway's Forward action sends (all `context` fields, `identity()` incl. groups/SAML/OIDC, `devicePosture()`), plus this account's Cloudflare category ID → name table and how those categories map onto journey categories. The full identity is stored once per distinct value in R2 (`cases/<id>/identity/<sha>.json`) and checked by verify. |
| `src/capture.js` | `GatewayMiddleware` (Forward action). Tees request and response bodies, caps them at `MAX_CAPTURE_BYTES`, hides secrets in the stored copy, writes bodies to R2, sends a summary to the Queue. Never blocks or breaks the user's page. |
| `src/queue.js` | Queue consumer. Appends summaries to the case ledger (at-least-once, de-duplicated). |
| `src/ledger.js` | `CaseLedger` Durable Object, one per case. Orders records and hash-chains them. Builds the journey (sessions, visits, sends, gaps) and verifies the chain against R2. |
| `src/render.js` | Replays captured responses in Browser Run and saves a JPEG reconstruction. The browser never contacts live sites. |
| `src/api.js`, `src/access.js` | Read-only Evidence API and web UI on `EVIDENCE_HOST`. Every request needs a valid Cloudflare Access JWT. The one exception is PoC-only: `POST /api/cases/:id/reset` with `{"confirm":"<id>"}` deletes the case's R2 objects and ledger, and works only when the case has `"allowReset": true`. |
| `src/insights.js`, `public/ui/insights.js`, `public/ui/filters.js` | Categories and behaviour signals (download→upload, personal uploads, data shared with AI, evasion, watch-list searches, job hunting, large uploads, after hours) with a per-visit risk score, worked out when the journey is read so older captures are covered too. The UI filters by behaviour, category, hour and risk, and searches sites, titles, search terms and file names. Tune with the `WORK_*`, `CORP_DOMAINS`, `WATCH_TERMS` and `CATEGORY_POLICIES` vars. Signals are leads for review, not findings. |
| Reconstructions | Saved in R2 as JPEGs at `cases/<case>/reconstructions/v2/<UTC time>_<host>_visit-<seq>.jpg` and hashed into the chain. "Save all reconstructions to R2" in the UI renders every page visit. |
| `public/` | Web front end (static assets, served only after the Access check). `public/ui/` is the same UI code the gadget uses. |

## Deploy

**From Cloudflare OS, follow `AGENTS.md`:** push to GitHub and let Workers Builds deploy. The R2 bucket,
queues, Access app and service token in the chewbacca.dev account already exist. The steps below
are the manual path from a laptop with wrangler.

1. `npm install`
2. Create the storage and queues:
   ```sh
   npx wrangler r2 bucket create insider-evidence-poc
   npx wrangler queues create evidence-capture
   npx wrangler queues create evidence-capture-dlq
   ```
3. In the dashboard, add an R2 lifecycle rule on `insider-evidence-poc` that deletes objects after **30 days**.
   (Ledger records in the Durable Object are not deleted by this rule.)
4. Edit `wrangler.jsonc`:
   - `routes` / `EVIDENCE_HOST`: the hostname for the UI and API (a zone in this account).
   - `CASES`: your own email as `subject`, and the start and end dates.
   - `ACCESS_TEAM_DOMAIN`: `https://<your-team>.cloudflareaccess.com`.
5. Cloudflare One → Access → Applications → add a **self-hosted** app for `EVIDENCE_HOST`:
   - Policy 1: **Allow**, include your email.
   - Policy 2: **Service Auth**, include a new service token (for example `evidence-gadget`). Save its Client ID and Secret.
   - Copy the application's **AUD tag** into `ACCESS_AUD`.
6. `npx wrangler deploy`
7. Gateway (Cloudflare One → Traffic policies):
   - Make sure TLS decryption is on and the test device has the Cloudflare root certificate.
   - Add an HTTP policy: **User Email** is *your email*, **and** **Host** not in `EVIDENCE_HOST`, `<your-team>.cloudflareaccess.com`.
     Action **Forward**, Worker `evidence-capture`.
8. Browse a few sites as the subject, then open `https://EVIDENCE_HOST`.

## Known limits (PoC)

- Not captured: WebSockets, CONNECT tunnels, Do Not Inspect sites, protocol upgrades.
- Single-page apps show as one visit. In-app steps are background data requests.
- Bodies over 2 MB are cut off and marked as gaps. Multipart uploads are not checked for secrets.
- Tokens inside URLs (for example `?access_token=`) are stored as-is.
- Reconstructions are approximate: viewport 1440×900, no scroll or click state, and page parts that weren't captured are reported as missing.
- Whether captured bodies arrive compressed is not documented. gzip is detected and decoded; other encodings may not render.
- Rendering uses raw CDP over the Browser binding (no npm dependency). Every request is intercepted and answered from R2, and the session is launched with Browser Run guardrails `allowedDomains: []`, so live hosts are blocked even if interception misses something. Prove it on the first render.
- Deleting records at the very end of the chain can't be detected without an external anchor. Note the head hash shown after "Verify chain".
- Before any real case: write-once R2 storage, case approval, named investigators, and Legal/HR sign-off.
