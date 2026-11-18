# AGENTS.md: building and deploying the evidence-capture Worker from Cloudflare OS

How to edit this Worker in Cloudflare OS (OSv2), push it to GitHub, and let **Workers Builds**
deploy it. Adapted from the proven hello-world-cf-os workflow (Nov 2026). Follow this; don't
rediscover it.

> **Why Git, not a direct API upload:** this Worker has 16 modules (~90 KB). That's too big for a
> single CF Portal `execute` call, which has a 64 KB limit on arguments. Workers Builds runs
> `wrangler deploy`, so `wrangler.jsonc` is the single source of truth. It covers bindings, the
> queue consumer, the Durable Object migration, the custom domain, and the static assets for the web UI.

## This repo

| Thing | Value |
| --- | --- |
| GitHub repo | `adz80/evidence-journey` (public), default branch `main` |
| GitHub owner ID / repo ID | `40626478` / `1462819588` |
| Repo layout | Repo root = the gadget's `worker/` folder (`wrangler.jsonc` at root) |
| Cloudflare account | `cb3485d35912cf35f42f5f3505062d9b` (Adam Boyce Personal Sandbox - SaaS) |
| Zone | `chewbacca.dev` / `7daa530713d6ec22b68dad4e26f03bfb` |
| Worker name / script tag | **`evidence-journey`** / `793120f87cb34a148bf4a1e423f4648e` (the dashboard import named it after the repo; `wrangler.jsonc` `name` matches) |
| Worker ID (for Gateway) | `793120f87cb34a148bf4a1e423f4648e` (same as the tag, from `GET /workers/workers`) |
| Live URL | https://evidence.chewbacca.dev (custom domain, **behind Access**). No workers.dev URL: `workers_dev: false` |
| Workers Builds trigger | `2c2420af-bb60-497e-9d3f-e1a0b856678a` (branch `main`, build cmd empty, deploy `npx wrangler deploy`, root `/`) |
| Repo connection | `6bb5d629-5b90-4251-b0ab-111a810957dd` |
| Custom domain | `evidence.chewbacca.dev` → `evidence-journey` (id `02958ac4e34a0bb6bbc7f8e29178b40ce1f017a3`) |

### Cloudflare resources (already created)

| Resource | Name / ID |
| --- | --- |
| R2 bucket | `insider-evidence-poc`, lifecycle rule `poc-expire-30-days` (deletes objects after 30 days) |
| Queue | `evidence-capture` / `0a589c652cfd45dcb4d6767088af2497` |
| Dead-letter queue | `evidence-capture-dlq` / `b8e3e6f5590f4d0c9347129fae71b2ae` |
| Zero Trust team domain | `https://hometesting8080.cloudflareaccess.com` |
| Access app | "Evidence Journey (PoC)" / `93bee9a4-235e-4486-bc2f-115e133b7a89` |
| Access AUD (in `ACCESS_AUD`) | `213080684c76bf274a8616eb3754456b3d59ec555e1555ff8e191de4a7659c16` |
| Access policies | Allow: aboyce@cloudflare.com, adamboyce.home@gmail.com (`efb13d2e-…`). Service Auth: token below (`adc2b13c-…`) |
| Service token (gadget) | `evidence-journey-gadget` / id `095475f5-4df1-458d-8d0b-98a26dc3325c`, client id `43e6ceaf2641df9cc1159063d9a4bd59.access` |
| Gateway Forward rule | "Evidence PoC: forward test subject to evidence-journey" / `e047acd9-00ff-4477-9853-48cd8cae95e0`, precedence 50, subject `headoffice@chewbacca.dev` |

**Never commit the service token secret.** It belongs only in the gadget's HTTP connection.
The AUD and team domain are not secrets.

Every push to `main` builds and deploys automatically. No manual deploy step.

## Read this before every change: Forward fails closed

Gateway calls `GatewayMiddleware.handle()` on every request from the case subject. **If the Worker
throws, fails to deploy correctly, or is deleted, the subject's browsing breaks** (HTTP 500).
So:

- Always run `npx wrangler deploy --dry-run` in the container before pushing (see the recipe below).
- Keep the "page always wins" rule in `src/capture.js`. Capture errors must fall back to the original
  response and be recorded as gaps. Never let them throw.
- If a deploy breaks browsing, **disable the Gateway rule first** (snippet below), then fix.
- Never delete or rename the Worker while a Forward rule points at it. Disable or delete the rule first.

## Connections to request in a new chat

1. **GitHub repository**: `https://github.com/adz80/evidence-journey` (to read, commit and push).
2. **Linux Container**: for `npm install` and `wrangler deploy --dry-run` (create it as a new resource).
3. **CF Portal / Cloudflare API**: to inspect builds, read the Worker ID, or manage Gateway/Access.
   `search`, `docs` and `execute` all need approval for each call. **Batch everything for one task into a
   single `execute`**, keep the code under 64 KB, and always pass
   `account_id: "cb3485d35912cf35f42f5f3505062d9b"` (the session sees 12 accounts).
4. Optional: **Cloudflare Worker observability** for `evidence-capture` logs (`observability` is on).
5. The **Evidence Journey gadget** reads evidence through an **HTTP** connection to
   `https://evidence.chewbacca.dev` using the service-token headers `CF-Access-Client-Id` and
   `CF-Access-Client-Secret`, bound as `EVIDENCE_API`. Set `API_BASE` in the gadget's `server.js` to
   that URL.

## Change → deploy loop

1. `repo.resolveRef("main")`, then `createWorktree` at that full SHA. Always start from the current
   head, because pushes must fast-forward.
2. Edit files with the worktree file tools.
   - **Shared UI:** `public/ui/*.js` is the same code the gadget imports from its `worker/public/ui/`.
     When you change it in one place, copy it to the other.
   - **Cases:** edit `CASES` in `wrangler.jsonc` and push. The subject must be you or a test account.
   - **Durable Object:** never edit migration `v1`. New classes need a new tag (`v2`, …).
3. Test in the container: `npm install`, then `npx wrangler deploy --dry-run`. Check that the
   `public/` assets are picked up and that the build has no errors.
4. `worktree.commit(msg)`, then `repo.push("main", commitId)`. The push waits for user approval.
5. Verify:
   - Builds API (below): `status`/`build_outcome` for the new commit hash.
   - `webFetch https://evidence.chewbacca.dev/?t=N` should land on the **Access login page**
     (`hometesting8080.cloudflareaccess.com`). That shows the Worker is routed and protected. You can't
     see the UI without signing in.
   - Through the gadget (service token): `env.EVIDENCE_JOURNEY.rpc.cases()` returns the CASES list.
   - In Worker logs: no `GatewayMiddleware` exceptions after the subject browses.

Workers Builds doesn't report check runs on GitHub, so `getChecks()` showing `state: "none"` is
normal. Verify with the Builds API instead.

## Container recipe (Debian 12, nothing preinstalled)

```sh
set -e
mkdir -p /opt/tools && cd /opt/tools
V=$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | grep 'linux-x64.tar.xz' | awk '{print $2}')
curl -fsSL -o "$V" "https://nodejs.org/dist/latest-v22.x/$V"
curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | grep " $V\$" | sha256sum -c -
tar -xJf "$V" && rm "$V" && ln -sfn "/opt/tools/$(basename "$V" .tar.xz)" /opt/tools/node
```

Then run each command like this (every exec is a fresh shell):

```sh
export PATH=/opt/tools/node/bin:$PATH WRANGLER_SEND_METRICS=false CI=1
cd <path from getStatus().mounts>
npm install --no-fund --no-audit
npx wrangler deploy --dry-run --outdir /tmp/out   # bundle check, works offline
ls /tmp/out                                        # expect index.js; wrangler lists the public/ assets
```

`wrangler dev` is of limited use here. Gateway `context`, the Browser binding, and Access JWTs
don't exist locally, so the API answers 401. A useful smoke test is only "it starts":

```sh
npx wrangler dev --port 8787 --ip 127.0.0.1 > /tmp/dev.log 2>&1 & DEV=$!
for i in $(seq 1 30); do sleep 1; curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/ && break; done
kill $DEV; wait $DEV 2>/dev/null || true   # expect 401 (Access check), not a crash
```

Gotchas:
- **Never `pkill -f "wrangler dev"`.** It matches and kills your own `bash -lc` (exit 143). Kill by PID.
- **`wrangler deploy`, `login` and `whoami` can't work from the container.** It has no browser, auth headers are
  stripped, and `api.cloudflare.com` is blocked. Deploy with Workers Builds (push).
- Set `WRANGLER_SEND_METRICS=false`, because telemetry is blocked.
- Mount worktrees at a fresh, unused name. `.gitignore` (node_modules, .wrangler, dist) must exist
  **before** the first exec in a mount. It is already in this repo.
- After an exec changes mounted files, end the step before using the file tools again.
- Use container git only to read. Commit and push through the worktree and GitHub APIs.
- The web UI in `public/` is uploaded as Workers static assets with `run_worker_first: true`, so
  every request still passes the Access check in `src/api.js` first. Don't remove that flag.

## Cloudflare API snippets (CF Portal `cloudflare-api_execute`)

All paths are under `/accounts/cb3485d35912cf35f42f5f3505062d9b`. Each snippet is the body of `async () => { ... }`.

- **List builds:** `GET /builds/workers/{scriptTag}/builds?per_page=5`. Fields: `status`,
  `build_outcome`, `build_trigger_metadata.commit_hash`. Logs: `GET /builds/builds/{build_uuid}/logs`.
- **Start a build by hand:** `POST /builds/triggers/{trigger_uuid}/builds` with `{ branch: "main" }`.
- **Script tag:** `GET /workers/scripts`, match `id === "evidence-journey"`, read `tag`.
- **Worker ID for Gateway:** `GET /workers/workers?per_page=100`, match `name === "evidence-journey"`, read `id`.
- Note: the queue `evidence-capture` keeps its name; only the Worker is called `evidence-journey`.
- **Create the Gateway Forward rule** (once, after the first successful deploy). Do a pass-through test
  first if you are unsure:
  ```js
  await cloudflare.request({ method: "POST", path: `/accounts/${a}/gateway/rules`, body: {
    name: "Evidence PoC: forward test subject to evidence-capture",
    enabled: true, precedence: 50, action: "forward", filters: ["http"],
    traffic: 'not(http.request.host in {"evidence.chewbacca.dev" "hometesting8080.cloudflareaccess.com"})',
    identity: 'identity.email == "<CASES subject>"',
    rule_settings: { forward: { worker_id: "<32-hex Worker ID>" } } } });
  ```
  TLS decryption is already on in this account. The test device needs the Cloudflare root certificate.
- **Disable the rule (emergency):** `GET /gateway/rules`, find it by name, then
  `PUT /gateway/rules/{id}` with the same body and `enabled: false`.
- **Direct deploy without Git** (only for a tiny emergency patch): the 64 KB `execute` limit rules out
  uploading the whole Worker, so prefer a push. If you must, `PUT /workers/scripts/evidence-capture`
  with FormData. Upload `src/*` as `application/javascript+module`. The metadata
  must repeat **every** binding (R2 `EVIDENCE`, queue `CAPTURE_QUEUE`, DO `LEDGER`/`CaseLedger`,
  browser `BROWSER`, assets `ASSETS`, the plain-text vars and the `CASES` json var) or they are dropped.
  Gzip+base64 the files inside the code to fit.

## Setting up the repo (first time)

1. Create the repo `adz80/evidence-journey` and push the gadget's `worker/` folder as the
   repo root: `wrangler.jsonc`, `package.json`, `src/`, `public/`, `README.md`, `AGENTS.md`,
   `.gitignore`.
2. Get it deployed once. The easiest way is for the user to create the Worker in the dashboard: **Workers &
   Pages → Create → Import a repository**, GitHub `adz80`, repo `evidence-journey`, branch `main`,
   build command empty, deploy command `npx wrangler deploy`. The Worker name must be `evidence-capture`
   to match `wrangler.jsonc`. The Cloudflare GitHub app is already installed on `adz80`. If the repo isn't
   listed, add it under GitHub Settings → Applications → Cloudflare Workers and Pages → Repository access.
3. The first build creates the custom domain `evidence.chewbacca.dev` (no DNS record exists for it, so
   nothing conflicts), the queue consumer, and the `CaseLedger` migration.
4. Fill in the TBD rows above: script tag, Worker ID, trigger, repo connection, repo ID.
5. Create the Gateway Forward rule, then connect the gadget (HTTP connection + `API_BASE`).

API-only alternative to step 2: get the numeric repo ID (names give a 500), then call
`PUT /builds/repos/connections` with `{ provider_type: "github", provider_account_id: "40626478",
provider_account_name: "adz80", repo_id, repo_name: "evidence-journey" }`. Next, take a build token
from `GET /builds/tokens`, then call `POST /builds/triggers` with `external_script_id` (the script
**tag**), so the Worker must exist first, plus `repo_connection_uuid`, `build_token_uuid`,
`build_command: ""`, `deploy_command: "npx wrangler deploy"`, `root_directory: "/"`,
`branch_includes: ["main"]`, `branch_excludes: []`, `path_includes: ["*"]` and `path_excludes: []`.
Finally, start one manual build.
