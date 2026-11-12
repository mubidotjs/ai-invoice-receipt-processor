# Provider invocation diagnosis and disabled diagnostic release

Investigated 2026-11-12. Base Ledger Lens commit d0ad0d0714281e1f3f5710b27bd12dea8ea932fa. The latest real Harbor attempt failed with AI_UNAVAILABLE at invocation; its provider exception was not retained. This task performs **zero real inference calls and zero production Turnstile challenges**. Production, Preview and local live flags stay false. The reference project is read-only and none of its deployment configuration, secrets, origins or namespaces is reused.

## Confirmed defects and corrections

1. The former providerError in worker/src/handler.ts read Error.message only. A synthetic exception with code=3036 and an unrelated message was treated as unknown. worker/src/provider-error.ts now prioritizes exact allowlisted code/internalCode data properties, including numeric strings. Structured codes outrank message text and error names; unknown/conflicting structured codes stay unknown.
2. The invocation catch emitted no diagnostic, while output rejection had a separate event. The handler now emits **AI_INVOCATION_REJECTED** with fixed invocation category/reason, allowlisted error name, optional recognized provider code and fixed codeSource. Output failures retain **AI_OUTPUT_REJECTED** with their existing safe stage/path metadata. No provider message, body, stack, prompt, OCR, token or field value is logged.
3. Broad word/HTTP-number matching could confuse arbitrary text or a 429 with capacity/quota. It is replaced by explicit code/name identification. The [official workerd adapter](https://github.com/cloudflare/workerd/blob/main/src/cloudflare/internal/ai-api.ts) can throw a numeric-prefix message rather than attach code; only its anchored four-digit-code/colon protocol prefix is recognized, never the rest of the description. No arbitrary String(error), getter evaluation, cause/body traversal or shared mutable binding-last-request metadata is used.
4. The input byte guard serialized messages plus schema, omitting other provider options. A regression constructs a valid under-12,000-character multibyte input whose old measurement passed but complete serialized request exceeded 32 KiB. The handler now bounds the exact built input before AI.run. This is **not an explanation for the historical 513-character Harbor input**.

There is **no demonstrated model-parameter incompatibility**. The only request-side change is the complete byte measurement and a pure typed input builder. Model, prompt, named schema, completion limit, temperature, thinking/store settings and authoritative extraction/evidence/financial contracts are unchanged.

## Comparison with the working Release Notes Generator

Read [worker/src/ai.ts](https://github.com/mubidotjs/ai-release-notes-generator/blob/df2e59a8cce3b2ddb58107cfa42281999d88dbdb/worker/src/ai.ts), shared definitions, package manifest and lockfile at **df2e59a8cce3b2ddb58107cfa42281999d88dbdb**. Previous real success is the owner's verified reference result, not a new inference observation here. [Machine-readable comparison](evidence/provider-invocation-comparison.json).

| Concern              | Release Notes Generator                                                | Ledger Lens                                                                                           |
| -------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Model                | @cf/google/gemma-4-26b-a4b-it                                          | Same exact model                                                                                      |
| Locked Workers types | 5.20261110.1                                                           | 5.20261110.1                                                                                          |
| Request              | system/user messages; temperature 0.1; stream false; thinking false    | Same envelope/settings; different fixed task prompt/text                                              |
| Schema request       | json_schema with name, strict true and schema                          | Same request shape                                                                                    |
| Schema structure     | Hand-authored entries/category/text/evidence                           | Zod-generated data/document/line/tax/evidence objects                                                 |
| Compact schema size  | 654 UTF-8 bytes                                                        | 3,601 UTF-8 bytes; unchanged SHA-256 733d9032d659d1e18cf728d284101f58c88e4b11c3ac95b8907b636d1cb6c6bd |
| Complexity           | 3 objects; 6 required properties; 0 null branches; 1 pattern           | 5 objects; 30 required properties; 20 null branches; 14 patterns                                      |
| Completion bound     | 4,096 tokens                                                           | 6,144 tokens                                                                                          |
| Deadline             | 45 seconds                                                             | 90 seconds Worker / 105 browser                                                                       |
| Output bound         | 48,000 JS characters                                                   | 65,536 UTF-8 bytes, entire envelope                                                                   |
| store                | Omitted                                                                | Explicit false                                                                                        |
| Error handling       | Structured code plus broad message regex; a subset of provider codes   | Exact structured/prefix codes, allowlisted names, separate invocation/output diagnostics              |
| Output               | Workers response or one stopped chat choice, then schema and grounding | Recognized wrappers, complete/tool-free chat, then strict schema and field evidence                   |

The reference schema's simpler successful run does not establish support for Ledger Lens's grammar or extraction accuracy. Its error mapping is a useful precedent for reading code, not a template copied wholesale.

## Official invocation contract and JSON Mode discrepancy

The [exact Gemma model](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/), its [machine-readable model schema](https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/workers-ai-models/gemma-4-26b-a4b-it.json) and the pinned AiModels mapping accept the named response_format.json_schema wrapper used here. The published fields accept integer max_completion_tokens, boolean stream/store and boolean enable_thinking. No maximum of 4,096 is published in that input field; reducing 6,144 solely to imitate the other app is unjustified. The published schema describes the nested extraction schema only as an object; it does not certify every grammar keyword/combination in production.

The [general JSON Mode page](https://developers.cloudflare.com/workers-ai/features/json-mode/) omits Gemma from its supported-model list and shows a different schema-wrapper example. It warns that generation may fail to satisfy a schema. This conflicts with the model-specific advertised request format; neither list omission nor generic typed input proves serving support or incompatibility. We retain the exact-model named wrapper and test against its captured public field constraints in tests/fixtures/gemma-invocation-contract.json. The new pure buildAiInput also satisfies AiModels[typeof MODEL][inputs] at compile time. These are offline shape checks, **not provider grammar execution**.

No schema simplification, generic JSON-object fallback, store removal, token reduction or model substitution was performed. Custom semantic refinements still run in authoritative application validation. A real provider code could later narrow request rejection, model eligibility or grammar-generation failure; this task cannot recover the old exception.

## Explicit safe classification policy

Mappings follow the [Workers AI error catalog](https://developers.cloudflare.com/workers-ai/platform/errors/) checked 2026-11-12. Original provider HTTP statuses are not blindly used as application classifications.

| Category                                       | Allowed internal codes / signal                                               | Safe application code     |
| ---------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------- |
| Account request rejected                       | 3023                                                                          | AI_REQUEST_REJECTED       |
| Invalid parameters/configuration               | 3003, 3006, 3039, 5004, 5005, 5019                                            | AI_INVALID_PARAMETERS     |
| Model/access/plan unavailable                  | 3041, 3042, 5007, 5016, 5018, 5028, 5035                                      | AI_MODEL_UNAVAILABLE      |
| Free quota exhausted                           | 3036                                                                          | AI_QUOTA_EXHAUSTED        |
| Capacity                                       | 3040                                                                          | AI_CAPACITY               |
| Timeout/abort                                  | 3007, 3008; exact TimeoutError/AbortError names; trusted application deadline | AI_TIMEOUT                |
| Structured JSON generation                     | Exact documented fixed JSON Mode failure marker; no invented numeric code     | AI_JSON_GENERATION_FAILED |
| Unrecognized or conflicting invocation failure | Bounded unknown category, no original unknown value retained                  | AI_UNAVAILABLE            |
| Returned output fails acceptance               | Existing envelope/JSON/schema/evidence/value/limit stages                     | AI_INVALID_OUTPUT         |

Allowlisted diagnostic names are Error, AiError, InferenceUpstreamError, AiInternalError, TypeError, TimeoutError and AbortError. Only timeout names themselves determine a failure category; a generic TypeError/internal/upstream name is not assumed to mean invalid parameters. Unknown names/codes are not echoed. Public messages are static, meaningful and keep manual workflows available. The frontend recognizes the three new safe application codes and never displays remote messages or unknown codes.

The exact fixed JSON Mode marker is distinguishable only when received in that form. Arbitrary descriptions containing those words, undocumented numeric codes and generic HTTP 403/429 remain unknown. This avoids assigning an invented provider cause.

## Tests, privacy and release boundary

Fresh local verification passed **253 unit/integration tests in 11 files**, **18 browser tests**, strict types, zero-warning lint, frontend build, Worker dry-run, full formatting and zero-finding full dependency audit. New tests cover all allowlisted codes, independent numeric/string code fields, structured precedence, native prefix representation, invalid/conflicting codes, native timeout names, application deadlines, fixed JSON marker, redaction and hostile property access. Handler regressions verify safe public messages, exact sanitized log arguments, no retries and separation from post-invocation validation. The input-budget regression demonstrates rejection before model invocation. Local browser tests perform real OCR/PDF processing with external requests blocked; cloud/protection tests remain mocked.

The full formatter check passed with checkout-compatible --end-of-line auto. Temporary newline-only working-copy normalization was restored; no Git settings were changed and unrelated files have no canonical diff. No dependency or lockfile change was needed. Persistent observability stays disabled; approved diagnostic tail consumers must retain only bounded metadata. Temporary reference snapshots are ignored and no other repository was modified.

The diagnostic release may be published/deployed only with both live flags false. Its exact commit, CI, Worker version, frontend build and post-deployment local workflow evidence are recorded in DEPLOYMENT.md after verification. No production challenge, inference or acceptance retry is part of this task.

## Verified disabled deployment

Correction [PR 9](https://github.com/mubidotjs/ai-invoice-receipt-processor/pull/9) merged as **5355c172330f60a6f5f27f0666fdd0ad4040fe73**. [Main CI 43247599418](https://github.com/mubidotjs/ai-invoice-receipt-processor/actions/runs/43247599418) passed. The tested frontend **dpl_CqDe4pSf2qkD8E3zHmAhaKW5UZLk** is READY; actual logs report Node **24.22.3** / npm **11.19.1**. Worker **b4541598-3558-4d85-abe4-689ecce3505a** has live AI false, verified protection true, unchanged AI/limiter bindings, exact hosts and encrypted secret. Frontend Production/Preview and local live flags remain false.

The [post-deployment public regression](evidence/provider-diagnostics-local-production.json) passed six actual PDF/image/scanned/mixed local workflows, twelve manual JSON/CSV byte checks and all **228 same-origin assets / 52,994,366 bytes**, plus bounded accessibility, schema/review/acknowledgment, CORS/request/disabled/throttle paths. It uses fresh browser contexts with external/non-GET requests blocked; no model or real protection call occurred. Production invocation classification remains unexercised while disabled; its proof is the mocked handler regressions, not a real provider success. A documentation-only successor may have a newer deployment identity with this same verified application bundle.

For any future separately authorized diagnostic attempt, connect the existing Worker's sanitized tail before submission, select AI_INVOCATION_REJECTED events and retain only the documented fixed fields. Do not retain full tail request envelopes, arbitrary logs or provider bodies. This run authorizes no such submission.

## Remaining uncertainty and next decision

The historical AI_UNAVAILABLE provider code/name remains unknown. Offline tests prove the classifier and full-input guard, not that inference now succeeds. Another acceptance cycle is not justified by these results. After this disabled release is verified, a **separately authorized single synthetic diagnostic invocation** could be useful with the sanitized listener connected before submission. Its purpose would be to capture the bounded category/code and stop, then decide the specific correction before any further acceptance attempt. Unknown cases must remain unknown; no billing, model or source-validation relaxation is an automatic response.
