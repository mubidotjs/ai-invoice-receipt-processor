# Gate E: separate authorization required

This procedure is documentation only. No repository, project, Worker, Turnstile widget, DNS record or live inference has been created. Gates A–D do not authorize Gate E. Keep both committed enablement flags false and remote bindings absent.

## E1 — publish with AI disabled

1. Obtain explicit owner authorization for the exact new repository `mubidotjs/ai-invoice-receipt-processor` and independent Vercel/Cloudflare resources. If unavailable, do not rename silently.
2. Verify GitHub Free, Vercel Hobby and Workers Free, current shared usage, dependencies and licenses. No billing/trial/paid fallback.
3. Publish the reviewed commit; verify hosted CI and require quality checks before merging main. No deployment tokens in CI.
4. Create the Vercel project with repository root as its Root Directory. Set Node 24 before dependency installation and verify the build logs. Root `vercel.json` installs/builds workspaces and serves `web/dist`; no Vercel backend. Keep `VITE_LIVE_AI_ENABLED=false`. Default hostnames suffice; no DNS change needed.
5. Create a separate Worker using reviewed project-specific settings. Keep live flags false. Review enabling the default workers.dev hostname only for this Worker; the local config currently has `workers_dev=false` to avoid accidental publication.
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

## Local platform notes

Windows ports 5401/5402 and 8788 are outside the observed exclusions. Vite uses strict ports. If unavailable, update local CORS/test URLs together; never remove OS exclusions or run as administrator.

Wrangler uses workspace-local ignored config/log state and disables metrics/Request.cf fetching. Playwright binaries live in `.cache/browsers`. A Windows npm-managed preview child may linger during test teardown; stop that owned server or start the two local preview/test servers yourself and set `PLAYWRIGHT_EXTERNAL_SERVER=1` for tests. Do not kill unrelated processes.

`npm run build` is safe local bundling (`wrangler deploy --dry-run`), not publication. Actual deployment commands require the separate owner authorization above.
