# Security, privacy and cost boundaries

Production status on 2026-11-12: **live AI disabled after unsuccessful bounded model acceptance**. Real server-side Turnstile hostname/action validation and replay/invalid-token rejection passed. The deployed Siteverify adapter uses Workers-supported `redirect:manual` and rejects redirects. Native throttling was observed; isolated aggregate/global enforcement is not claimed. See [actual deployment evidence and limitations](DEPLOYMENT.md). Local/CI protection and failure tests remain mocked.

## Data handling

Uploaded files, previews, OCR and corrections remain in memory. No document localStorage/IndexedDB, database, history, analytics, session replay or service worker is used. Reset aborts work, destroys tasks/workers, revokes object URLs and releases document references; it cannot guarantee forensic erasure or retract a transmitted request. User-initiated downloads intentionally save the reviewed export.

Local/demo workflows make no external requests. All OCR/PDF assets are bundled from pinned dependencies. Turnstile loads only after the user checks the per-attempt consent and requests AI. Siteverify receives only token/secret; the model receives normalized displayed page text, never raw files or filenames.

Cloudflare inference is **cloud processing**, not on-device privacy. Do not claim absolute provider retention guarantees. Review [Workers AI data handling](https://developers.cloudflare.com/workers-ai/platform/data-usage/) at Gate E. Application code does not log content, enable AI Gateway or cache prompt/output data. Operational provider metadata and documented policy exceptions may apply.

## Untrusted files and text

Use patched PDF.js core APIs, no viewer/scripting manager, XFA, interactive forms, annotation actions or attachments. Uploaded PDFs are never embedded into an iframe/object. Document links and instructions are never executed or fetched. Preview images are locally rendered. Review current [PDF.js advisories](https://github.com/mozilla/pdf.js/security/advisories) before launch.

The 10-MiB/page/dimension/canvas/time/text limits prevent routine oversized processing; neither PDF.js workers nor decoder checks are a proof of isolation against every malicious file. User documents and AI strings render as React text. Schema evidence/decimal rules reduce unsupported claims; human review remains necessary.

Vercel/preview headers restrict scripts, workers, frames, network destinations, objects, framing and browser capabilities. WASM compilation is allowed without JavaScript eval. Inline styles are permitted for browser/PDF compatibility, but unrestricted inline scripts are not. Development uses a random startup nonce for Vite's refresh preamble; built production uses external scripts. No CDN is permitted in the local OCR/PDF path.

## Protection

Live inference needs `LIVE_AI_ENABLED=true`, `ABUSE_CONTROLS_VERIFIED=true`, native AI and both limiter bindings, configured non-test Turnstile secret/hostnames and Cloudflare visitor identity. Missing/failing protection is closed. CORS uses exact origins and rejects missing/null origins for extraction, but is not authentication.

Native throttles are 2 visitor attempts and 5 project attempts per 60s. Counters are approximate and location-local; neither a project key nor browser counter is a strict worldwide/daily budget. Siteverify is mandatory and must match the production hostname and `invoice-extract` action. Tokens are per-attempt and never reused automatically.

Production rejects known Turnstile test-key patterns. Local test widget/secret strings exist only in test files; they do not create a real verification integration or enable the default application. Production secrets are absent from tracked files and frontend configuration. The separately authorized E1 CLI login keeps OAuth state in ignored, workspace-scoped tooling configuration; the Turnstile secret exists only as an encrypted Worker secret. Never publish those ignored files.

Rejection diagnostics contain only fixed stage/issue categories and allowlisted schema paths. No Zod issue messages, arbitrary keys, provider error objects, document text, field values, tokens or response bodies are logged. Persistent observability remains disabled. See the [offline diagnosis](AI-OUTPUT-DIAGNOSIS.md).

## Cost controls

No billing activation, paid fallback, credits, automatic upgrades, external commercial APIs, databases or additional paid services. Reverify model eligibility and account plans at Gate E. Workers AI's documented 10,000 neurons/day is account-wide, resets at 00:00 UTC (05:00 Karachi), and is shared with other apps. This project cannot reserve a share without additional state, which is outside scope. [Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [rate-limit semantics](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Use the project-only kill switch on abuse or quota pressure. No retries occur automatically. The application always retains local processing, manual review and export when cloud services fail.

## Test and artifact policy

Only synthetic documents in tests, screenshots and traces. CI has no cloud credentials and no inference. Vitest mocks AI/Siteverify/limiters; Playwright intercepts both the test widget script and AI endpoint. These checks do not verify real model accuracy, production challenge behavior or distributed abuse resistance. Failure artifacts expire after three days in CI.
