# Evaluation and gate evidence

Evaluation date: **2026-11-12**, Asia/Karachi. Host: Windows 10, Node **24.22.1**, npm **11.16.0**. Gates A–D and Gate E1 passed. The owner subsequently authorized the branded domain and Gate E2. **Real production Turnstile passed, but two bounded AI submissions yielded no accepted draft. Live AI is disabled; Gate E2 remains incomplete.** The historical E1 observations below are retained with their original verification boundary.

## Observed checks

| Check                     | Observed result                 | Verification boundary                                                                                                      |
| ------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                | Passed                          | Strict shared/UI/Worker/test types, including the installed native AI adapter type                                         |
| ESLint                    | Passed, zero warnings           | Authored source; generated caches/builds excluded                                                                          |
| Vitest                    | **174 passed**, nine test files | Contracts, financial arithmetic, evidence, manual provenance, React review lifecycle, mocked cloud/protection and failures |
| Frontend build            | Passed                          | Vite production assets, lazy OCR/PDF imports                                                                               |
| Worker bundle             | Passed                          | `wrangler deploy --dry-run`; no deployment; flags false, remote bindings absent                                            |
| Playwright                | **18 passed**                   | Actual local PDF/OCR, downloads, offline privacy, accessibility, cancellation, rejection and mocked AI browser paths       |
| Formatting                | Passed                          | Prettier check of source/config/docs                                                                                       |
| Runtime dependency audit  | Zero findings                   | npm advisory database at evaluation time                                                                                   |
| Complete dependency audit | Zero findings                   | Includes development tooling after the fixes described below                                                               |
| Local workerd health      | HTTP 200, `liveEnabled:false`   | Actual local runtime only, no upstream call                                                                                |
| Local workerd extraction  | HTTP 503, `LIVE_AI_DISABLED`    | Synthetic text only; no Siteverify or inference                                                                            |

The fresh E1 `npm ci` and `npm run check` exited successfully: 102 Vitest and 18 browser tests (55.9s), types, lint and both builds. The first installation hit an owned preview process holding a native module; stopping that preview and rerunning `npm ci` resolved it. The fresh suite used its managed servers. Earlier A–D Windows verification had used separately started servers because teardown had lingered. [Hosted CI run 43160690098](https://github.com/mubidotjs/ai-invoice-receipt-processor/actions/runs/43160690098) also passed using Ubuntu managed servers, without cloud credentials/inference.

## Offline Gate E2 correction

The [diagnosis report](AI-OUTPUT-DIAGNOSIS.md) records demonstrated envelope/date defects and the unchanged provider schema. Fresh verification passed 174 unit/integration tests, 18 browser tests, types, lint, both builds, scoped formatting and a zero-finding full dependency audit. All model/protection successes in these new tests are constructed locally; this task made zero real model calls or production challenges. Production live AI remains disabled.

## Branded production / Gate E2 observations

See [deployment and rollback](DEPLOYMENT.md), [real launch record](evidence/gate-e2.json) and [post-rollback local production regression](evidence/gate-e2-local-production.json). Verified application commit 023656b5e35a77109f27950be2cd8a2d8e83f053 passed [hosted CI 43204278338](https://github.com/mubidotjs/ai-invoice-receipt-processor/actions/runs/43204278338): 119 unit/integration and 18 browser tests plus types/lint/builds.

- The branded HTTPS domain resolves through the sole authorized invoice CNAME. Vercel Hobby/Workers Free and exact project identities were confirmed; no paid or unrelated resource changes.
- Legitimate production Siteverify passed expected hostname/action; replay/invalid/dummy tokens failed. Workers-supported manual redirect handling fixed a genuine deployment blocker; temporary probes were removed. Native throttle denial was observed, aggregate configuration read back; isolated/global aggregate denial is not claimed.
- Harbor's consented native-PDF submission failed with a generic unavailable message; backend stage unknown. Saffron's consented actual-OCR submission reached the native binding and failed AI_INVALID_OUTPUT. No draft was applied; zero model ground-truth/evidence comparisons passed. Two budget slots conservatively counted, one unused; no automatic retry or sample fallback.
- Worker LIVE_AI_ENABLED=false and frontend Production/Preview VITE_LIVE_AI_ENABLED=false were deployed and read back. Production ABUSE_CONTROLS_VERIFIED=true records actual protection verification; local defaults remain false.
- After rollback, all six actual local-processing paths and twelve downloaded exports passed on the branded site, with 228 same-origin assets / 52,994,366 bytes hash-verified, fresh contexts, no unexpected external requests and no page errors.
- Actual in-app manual correction/downloads passed, including Juniper's mismatch, invalid-format blocking, revision reset, explicit warning acknowledgment and spreadsheet-safe CSV. After a real cloud error, Harbor manual-entry export worked with no invented evidence. Real-AI correction remains unverified because no accepted AI draft existed.
- Separate production Playwright runs asserted actual 390/768/1280 widths, no overflow, keyboard skip links and zero serious/critical axe findings. In-app manual viewport overrides did not resize the DOM; a manual three-width audit is not claimed. Existing light theme retained.
- Free quota dashboard ended at 24.81/10k today and 56.79 on its last-24h Gemma chart. These shared/asynchronous numbers are not per-project/call costs. No model accuracy, latency benchmark or provider-reliability metric is inferred from the failed attempts.

## Public E1 observations (historical)

Application/config commit `140802619c36c96c6fd027cbca63c46bc5870153` deployed READY as `dpl_xRnWVdHvAgsdBWNNmGa6jJQCpm3P`. Vercel build logs explicitly reported Node **24.22.3** and npm **11.19.1**. [Deployment identities and rollback](DEPLOYMENT.md) and the [machine-readable synthetic-only report](evidence/gate-e1.json) preserve the actual observations.

- The HTTPS canonical application returned 200 with restrictive CSP, `nosniff`, and `no-referrer` headers.
- All **228** deployed OCR/PDF assets (**52,994,366 bytes**) matched their manifest SHA-256 and size and loaded from the application origin.
- All six documents in the table below passed actual hosted native/OCR processing, previews/page navigation, manual correction, schema/review/acknowledgment gates, JSON and CSV byte checks. Fresh contexts blocked external and non-GET requests; no unexpected request or page error occurred. Actual extraction left review fields blank until manual entry.
- Harbor's corrected total changed its arithmetic diagnostic from warning to pass. Invalid totals blocked exports and later edits reset confirmation. Downloads retained synthetic status and manual provenance.
- At **390/768/1280px**, the deployed deterministic sample view had no page overflow, a working keyboard skip link and zero serious/critical axe findings. This is bounded automated coverage, not a complete assistive-technology audit.
- Worker `/health` returned 200 with `liveEnabled:false`; allowed-origin preflight returned 204, foreign origin 403, unknown document-body fields 400. Three synthetic valid requests returned 503 `LIVE_AI_DISABLED`, followed by 429 `RATE_LIMITED` with `Retry-After`. Approximate native throttling was observed; aggregate exhaustion/distributed protection were not proven.
- Independent native bindings and false flags were read back from Cloudflare. The separate Managed Turnstile widget has the exact canonical hostname, no pre-clearance and an encrypted Worker secret. Real widget tokens/Siteverify were not exercised. Test-key rejection, missing/failing protection and provider failures remain mocked tests.
- Vercel **Hobby** and Workers **Free** were confirmed without changing billing. No live AI, AI Gateway, paid fallback, DNS or other project configuration was enabled or modified.

The production screenshot shows an explicitly labeled deterministic sample. It is separate from the six real-processing tests and cannot demonstrate inference. The public verifier is `scripts/verify-production.mjs`; generated working artifacts remain ignored, while the committed report contains only public metadata and synthetic test findings.

## Externally blocked actual processing

Every test starts with a fresh browser context, no prior browser storage/cache and blocked service workers. Request interception permits only the localhost frontend and its assets; unexpected external requests abort and fail the test. Dedicated OCR/PDF runtimes load local resources. The six real-processing tests each inspect preview/text, enter manual values, confirm invalid formats block export, acknowledge warnings and read both downloaded JSON and CSV bytes. Document localStorage/sessionStorage and IndexedDB remain empty.

| Synthetic document                  | Actual text methods                   | Verified text anchors                                                                             |
| ----------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Harbor Studio / USD                 | Native PDF text                       | Vendor, total 165.00                                                                              |
| Saffron Cafe / PKR                  | Tesseract OCR of PNG                  | Vendor, total 680.00                                                                              |
| Northstar Supply / GBP              | Tesseract OCR of both PDF pages       | Vendor on first page, total 20.40 on second                                                       |
| Alder Workshop / EUR                | Native PDF text then scanned-page OCR | Vendor on first page, total 102.00 on second                                                      |
| Juniper Kitchen / USD               | Tesseract OCR of JPEG                 | Vendor, total 37.40; authored structured sample deliberately contains an arithmetic mismatch      |
| Cedar Market / unspecified currency | Tesseract OCR of PNG                  | Vendor, total 40.00; authored structured sample preserves ambiguous date/missing currency as null |

These are stable text-anchor checks, not full transcription accuracy measurements. Real OCR does not secretly populate fixture data: the tests verify the vendor review field remains blank until manual entry. Uploaded fixture files follow normal upload provenance; the explicit sample-document action separately labels bundled source documents synthetic.

Separate browser tests prove a native page can be explicitly OCRed, 90-degree rotation changes preview orientation, cancellation cannot apply a late result, and encrypted/corrupt/spoofed/over-limit documents are rejected. An authored PDF with an embedded JavaScript probe does not execute its script or remote fetch. This is one regression case, not proof of safety against all malicious PDFs.

## Review, accessibility and cloud mocks

- Manual-only records export without AI evidence, including incomplete records after warning acknowledgment.
- Invalid formats prevent download; editing resets review/acknowledgment.
- Corrected AI/sample fields receive manual provenance and lose active AI evidence; initial evidence remains separately in session state.
- Deterministic sample results remain labeled and preserve synthetic/extraction metadata in downloads.
- Mocked browser paths cover AI success, disabled inference, quota error, unsupported output and a result arriving after manual editing. Both widget JavaScript and Worker responses are intercepted locally; they do not contact the real services.
- Mocked Worker paths check actual handler admission, protection ordering, token/hostname/action failures, missing bindings, throttles, deadlines, bounded bodies, unsupported evidence and no retries.
- Keyboard skip navigation, no horizontal page overflow and zero serious/critical axe findings were observed at **390px, 768px and 1280px**. Automated scans do not replace a complete assistive-technology audit.

## Findings corrected during verification

- Resolved an unavailable package version and React-hooks peer compatibility without force/legacy dependency installation.
- Bundled the upstream trained-data license because its npm package does not include a license file. Assets are local; runtime CDN fallback is absent.
- Default OCR segmentation omitted a separated vendor heading. Sparse-text segmentation recovered the tested headings; broader OCR accuracy remains unmeasured.
- Moved test helpers out of the Worker runtime entry after workerd rejected a named string export. Both local health and disabled extraction then passed.
- Corrected text contrast, accessible brand naming and keyboard access to the scrollable preview.
- Added a development-only random CSP nonce for Vite refresh; production retains restricted external scripts without unrestricted inline JavaScript.
- Corrected OCR rerun progress and asynchronous preview assertions; rotation and cancellation then passed.
- Full audit found a vulnerable development `shell-quote` chain and `minimatch` versions. Updated `concurrently` to 9.2.5 and pinned the affected minimatch range to patched 11.0.1 using a documented root override. Named exports/Node compatibility were reviewed; lint and the full suite passed with the new lockfile. No `npm audit fix --force` or unsupported parser downgrade was used.

## Gate status

| Gate                                    | Status                             | Evidence                                                                                                                                                           |
| --------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A — Contracts/foundation                | Complete locally                   | Independent workspaces, strict schemas, exact arithmetic, six authored fixtures, disabled defaults and reproducible lockfile                                       |
| B — Local processing                    | Complete locally                   | Actual native/scanned/mixed processing and complete externally blocked correction/export flow                                                                      |
| C — AI/review/export                    | Complete locally with mocks        | Consent, evidence/manual provenance, protected handler, failure behavior and export bytes                                                                          |
| D — Release readiness                   | Complete locally                   | Full checks, dependency review, responsive/accessibility checks, architecture/privacy/evaluation and launch/rollback documentation                                 |
| E1 — Disabled public launch             | Complete                           | Published source/hosted CI; Vercel Hobby, disabled Workers Free service and separate Turnstile; six public processing/export workflows and bundled assets verified |
| E2 — Real protection/model verification | Attempted; incomplete; AI disabled | Branded domain and real protection passed; no accepted model draft in two bounded submissions; further live testing requires a new explicit budget                 |

No model field-accuracy score, general hallucination rate, production availability, shared-quota reservation or distributed abuse-resistance claim is made. Source text and mechanical evidence checks do not establish authenticity or semantic truth. Every financial value remains subject to human verification.
