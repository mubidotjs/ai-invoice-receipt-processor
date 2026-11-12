# Local evaluation and gate evidence

Evaluation date: **2026-11-12**, Asia/Karachi. Host: Windows 10, Node **24.22.1**, npm **11.16.0**. This report covers local Gates A–D only. **Gate E is unperformed: no remote repository, deployment, real inference or real Turnstile verification is claimed.**

## Observed checks

| Check                     | Observed result                | Verification boundary                                                                                                      |
| ------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                | Passed                         | Strict shared/UI/Worker/test types, including the installed native AI adapter type                                         |
| ESLint                    | Passed, zero warnings          | Authored source; generated caches/builds excluded                                                                          |
| Vitest                    | **102 passed**, six test files | Contracts, financial arithmetic, evidence, manual provenance, React review lifecycle, mocked cloud/protection and failures |
| Frontend build            | Passed                         | Vite production assets, lazy OCR/PDF imports                                                                               |
| Worker bundle             | Passed                         | `wrangler deploy --dry-run`; no deployment; flags false, remote bindings absent                                            |
| Playwright                | **18 passed**, final run 56.0s | Actual local PDF/OCR, downloads, offline privacy, accessibility, cancellation, rejection and mocked AI browser paths       |
| Formatting                | Passed                         | Prettier check of source/config/docs                                                                                       |
| Runtime dependency audit  | Zero findings                  | npm advisory database at evaluation time                                                                                   |
| Complete dependency audit | Zero findings                  | Includes development tooling after the fixes described below                                                               |
| Local workerd health      | HTTP 200, `liveEnabled:false`  | Actual local runtime only, no upstream call                                                                                |
| Local workerd extraction  | HTTP 503, `LIVE_AI_DISABLED`   | Synthetic text only; no Siteverify or inference                                                                            |

The final `npm run check` exited successfully. Local preview/test servers were started separately and `PLAYWRIGHT_EXTERNAL_SERVER=1` was set because npm-managed Windows test-server teardown had lingered in an earlier run. This changes server lifecycle only: the complete test suite and production frontend build were used. CI uses the configured managed servers on Ubuntu; hosted GitHub Actions has **not** been run because publication is unauthorized.

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

| Gate                                | Status                                   | Evidence                                                                                                                           |
| ----------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A — Contracts/foundation            | Complete locally                         | Independent workspaces, strict schemas, exact arithmetic, six authored fixtures, disabled defaults and reproducible lockfile       |
| B — Local processing                | Complete locally                         | Actual native/scanned/mixed processing and complete externally blocked correction/export flow                                      |
| C — AI/review/export                | Complete locally with mocks              | Consent, evidence/manual provenance, protected handler, failure behavior and export bytes                                          |
| D — Release readiness               | Complete locally                         | Full checks, dependency review, responsive/accessibility checks, architecture/privacy/evaluation and launch/rollback documentation |
| E — Public launch/live verification | **Not performed; separately authorized** | No remote resources or real inference; exact model behavior, Free eligibility and production protection must be reverified         |

No model field-accuracy score, general hallucination rate, production availability, shared-quota reservation or distributed abuse-resistance claim is made. Source text and mechanical evidence checks do not establish authenticity or semantic truth. Every financial value remains subject to human verification.
