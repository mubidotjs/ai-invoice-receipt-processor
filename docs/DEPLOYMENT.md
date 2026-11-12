# Deployment: branded production launch in verification

The owner separately authorized Gate E1 and subsequently authorized the branded hostname and Gate E2 production verification on **2026-11-12**. The default local environment has no remote bindings and remains disabled; only the explicit `production` environment has the independent deployed bindings and approved activation flags. Production model acceptance is in progress and must not be inferred from mocks.

The canonical hostname is [invoice.mubashirhussain.dev](https://invoice.mubashirhussain.dev); the original Vercel URL remains available. Only a Dynadot `invoice` CNAME to Vercel's supplied `db955ab68dd01317.vercel-dns-017.com` was added, retaining the 300-second TTL and all original DNS records/nameservers. Both authoritative servers, public resolvers, Vercel association and HTTPS certificate validation passed. No ownership TXT record was required.

Real production Turnstile verification passed on the branded hostname with server-validated action `invoice-extract`; a replayed token and a deliberately invalid token were rejected. The existing widget, sitekey, encrypted secret and native limiter namespaces were preserved. Before activation, the temporary no-inference verification page/header/diagnostic were removed. Siteverify now uses Workers-supported `redirect:manual` and rejects redirects; `redirect:error` had thrown before any upstream request. The production origins and Turnstile hostname lists contain exactly the branded host and original canonical Vercel host. Native aggregate configuration is verified as 5/60 seconds per location; isolated/global aggregate denial is not claimed.

## Verified E1 baseline (historical)

| Resource                         | Actual identity / evidence                                                                                                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository                       | [mubidotjs/ai-invoice-receipt-processor](https://github.com/mubidotjs/ai-invoice-receipt-processor), existing empty public repository; no replacement repository                                                                         |
| Application/config commit tested | `140802619c36c96c6fd027cbca63c46bc5870153`                                                                                                                                                                                               |
| Hosted CI                        | [Run 43160690098](https://github.com/mubidotjs/ai-invoice-receipt-processor/actions/runs/43160690098), success: 102 unit/integration and 18 browser tests, types/lint/build                                                              |
| Frontend                         | [Public Vercel domain](https://ai-invoice-receipt-processor.vercel.app), project `prj_hRfp70QSVa7ab6XvU1R1PcpxFIRB`, personal scope `mubidotjs-projects`                                                                                 |
| Verified deployment              | `dpl_xRnWVdHvAgsdBWNNmGa6jJQCpm3P`, [build/deployment details](https://vercel.com/mubidotjs-projects/ai-invoice-receipt-processor/xRnWVdHvAgsdBWNNmGa6jJQCpm3P), Git-connected `main`, READY                                             |
| Actual hosted toolchain          | Build logs: Node `v24.22.3`, npm `11.19.1`; explicit `node --version` before `npm ci`                                                                                                                                                    |
| Static build                     | Repository root; `npm run assets && npm run build -w web`; output `web/dist`; no Functions/database/integrations                                                                                                                         |
| Worker                           | [workers.dev health](https://ai-invoice-receipt-processor.mubikhan69.workers.dev/health), service `ai-invoice-receipt-processor`                                                                                                         |
| Worker version                   | `969cb007-b0fa-4512-8449-e9107376475d`, 100% deployed; includes encrypted `TURNSTILE_SECRET`                                                                                                                                             |
| Protection bindings              | Native `AI`; visitor namespace `12001` (2/60s); project namespace `12002` (5/60s per location)                                                                                                                                           |
| Turnstile                        | Separate **Ledger Lens**, Managed, no pre-clearance, sole hostname `ai-invoice-receipt-processor.vercel.app`; public sitekey `0x4AAAAAAF9u_exNZlyI1Aql`                                                                                  |
| Flags                            | Worker `LIVE_AI_ENABLED=false`, `ABUSE_CONTROLS_VERIFIED=false`; frontend `VITE_LIVE_AI_ENABLED=false` in production and preview                                                                                                         |
| Plans                            | Vercel CLI account response confirmed `hobby`; Cloudflare Workers plans showed **Free**, current plan, $0. Public standard Ubuntu GitHub Actions used without deployment secrets. No billing/subscription changes or paid infrastructure |

Only the canonical frontend origin is allowed by the Worker. The public Worker URL/sitekey are production frontend configuration; the production secret exists only as an encrypted Worker secret. No production test credentials or localhost Turnstile allowance were added. Expected Siteverify action remains `invoice-extract`. Real widget/Siteverify behavior is **not verified** by E1 and must pass E2 before either enablement flag changes.

The [public verification report](evidence/gate-e1.json) records all six actual PDF/OCR workflows, twelve successful downloads, review/provenance checks, three responsive/accessibility widths, 228 same-origin asset SHA-256 checks, and disabled/native-throttle responses. The [production screenshot](images/gate-e1-production.png) deliberately displays a labeled deterministic sample result, not AI output.

Reproduce the public check only against these authorized resources with synthetic inputs:

```sh
node scripts/verify-production.mjs https://ai-invoice-receipt-processor.vercel.app https://ai-invoice-receipt-processor.mubikhan69.workers.dev
```

Install the local Playwright browser first. On Windows set `PLAYWRIGHT_BROWSERS_PATH` to the absolute workspace `.cache/browsers` path. Results/screenshots go to ignored `.cache`. This verifier never enables flags or invokes inference. Rate limits are approximate; HTTP 429 was observed on the fourth sequential valid attempt, after three disabled responses, rather than claiming exact global admission. Aggregate quota exhaustion and real protection failure/success were not exercised remotely.

The public canonical domain returned HTTP 200 under the existing Vercel deployment-protection configuration; no authentication/protection setting was weakened. CSP permits local OCR/PDF resources, excludes the Worker while inference is disabled, and prohibits objects/framing/JavaScript eval. Logs/traces/issues and Worker content caching are disabled. No document bytes, OCR text, or Turnstile requests left the frontend during the six local-processing browser flows. Separate Worker probes contained only explicit synthetic rejection/disabled-path test text.

No release blocker remains for E1. E2 model eligibility/license/output behavior, account quota headroom, real Siteverify and inference remain unverified. Do not treat E1 as completion of the combined E1/E2 gate.

## E1 — publish with AI disabled

1. Obtain explicit owner authorization for the exact new repository `mubidotjs/ai-invoice-receipt-processor` and independent Vercel/Cloudflare resources. If unavailable, do not rename silently.
2. Verify GitHub Free, Vercel Hobby and Workers Free, current shared usage, dependencies and licenses. No billing/trial/paid fallback.
3. Publish the reviewed commit; verify hosted CI and require quality checks before merging main. No deployment tokens in CI.
4. Create the Vercel project with repository root as its Root Directory. Set Node 24 before dependency installation and verify the build logs. Root `vercel.json` installs/builds workspaces and serves `web/dist`; no Vercel backend. Keep `VITE_LIVE_AI_ENABLED=false`. Default hostnames suffice; no DNS change needed.
5. Create a separate Worker using reviewed project-specific settings. Keep live flags false. The default local environment has `workers_dev=false`; the independently named production environment explicitly enables only this Worker's workers.dev hostname.
6. Configure only the exact production frontend origins, production Turnstile hostname list and new native limiter namespaces. Each 60-second limiter must have the approved visitor 2/project 5 limits. Do not copy another application's namespaces/configuration.
7. Create a Free Turnstile widget for those exact hostnames. Keep site key public and secret in Worker secrets. Reject known test credentials. No test keys or localhost hostname allowances in production.
8. Test deployed headers, preview assets, real local PDF/OCR, manual review/downloads, rejected origins, disabled inference and actual native throttling. Disabled responses must make no inference calls. Record commit, Vercel deployment and Worker version.

The root CSP deliberately has no external Worker origin while AI is disabled. On approved activation, add only the exact new Worker HTTPS origin to `connect-src`; do not use wildcards. Rebuild public frontend configuration with that origin/site key and live UI flag only after the E2 safeguards pass. Preview environments remain disabled and are not added by wildcard.

## E2 — real protection and model verification

1. Reverify the exact `@cf/google/gemma-4-26b-a4b-it` model's Free-plan eligibility, license, structured-output shape and installed official adapter types. A local typecheck/mock is not real model verification. If unavailable or paid, leave AI disabled and return for a revised decision.
2. Verify actual production Turnstile server-side success/rejection, expected hostname/action, native protection bindings, exact-origin policies and account-wide quota headroom. Test credentials must remain isolated.
3. Obtain explicit authorization to enable inference and run at most three synthetic model calls: one invoice, one receipt and one explicit retry if needed. Do not submit private documents or test quota exhaustion against the account.
4. Verify consent precedes transmission; only displayed normalized text is sent; outputs pass strict schemas/evidence checks. Require correct vendor/currency/issue date/total on both documents, plus invoice identifier and expected line/tax coverage.
5. Correct/review/export through the deployed UI. Record actual discrepancies, latency, deployment identities and verification limits. Quota/provider error behavior remains mocked rather than consuming account allocation deliberately.

If E2 fails, restore this Worker's disabled flags and frontend disabled UI; preserve the local public demonstration. No automatic model changes or billing. If only E1 passes, report a public deployment with live AI disabled; do not mark Gate E complete.

## Rollback and operations

Disable only this Worker's live flag to stop new inference. Waiting timeouts do not guarantee cancellation of existing provider computation. Keep documents/manual export working. Roll frontend back to the last tested commit when needed; do not alter other projects or DNS. Check shared quota manually before demonstrations; native throttles cannot reserve a guaranteed project quota.

For this E1 release, keep both flags false when rolling back. In Vercel, select this project's tested deployment `dpl_xRnWVdHvAgsdBWNNmGa6jJQCpm3P` and use the project rollback flow; confirm the canonical domain and rerun health/local-processing smoke checks. A documentation-only successor does not change the application bundle. In Cloudflare, use this service's Deployments history to restore the disabled version `969cb007-b0fa-4512-8449-e9107376475d`, or deploy the reviewed checkout explicitly from `worker/` with `node scripts/wrangler.mjs deploy --env production`. Verify exact origins, both false flags, encrypted secret and all three bindings after any rollback. Avoid reverting to the first bootstrap version with an empty allowlist. CI never deploys the Worker.

## Local platform notes

Windows ports 5401/5402 and 8788 are outside the observed exclusions. Vite uses strict ports. If unavailable, update local CORS/test URLs together; never remove OS exclusions or run as administrator.

Wrangler uses workspace-local ignored config/log state and disables metrics/Request.cf fetching. Playwright binaries live in `.cache/browsers`. A Windows npm-managed preview child may linger during test teardown; stop that owned server or start the two local preview/test servers yourself and set `PLAYWRIGHT_EXTERNAL_SERVER=1` for tests. Do not kill unrelated processes.

`npm run build` is safe local bundling (`wrangler deploy --dry-run`), not publication. Actual deployment commands require the separate owner authorization above.
