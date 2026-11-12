# Gate E2 offline diagnosis

Investigated 2026-11-12 from main 4fecc9035f537729e367666c5b5e72d7a101921c and the recorded attempts in [gate-e2.json](evidence/gate-e2.json). Safe deployed Worker c8b89a14-9973-4820-92d4-273459c12343 was read back through version metadata: LIVE_AI_ENABLED=false, ABUSE_CONTROLS_VERIFIED=true, unchanged exact origins/hostnames, native AI, visitor 12001 (2/60s), aggregate 12002 (5/60s), encrypted secret present. Its script ETag is recorded in the [offline report](evidence/gate-e2-offline-diagnosis.json). Repository source and immutable historical commits were inspected; historical model bodies were not retained or recovered.

**No inference, production Turnstile challenge, historical retry slot, DNS/credential/limiter change or paid service was used in this task.** Preview/Production frontend flags and Worker health were independently read back as disabled. This correction is not a completed Gate E2 acceptance.

## Pipeline and historical certainty

| Stage                                              | Harbor invoice                                                              | Saffron receipt                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Browser local extraction / consent                 | Actual PDF text and explicit guarded submission observed                    | Actual OCR and explicit guarded submission observed                                                |
| CORS / request / limiters / verified flags         | Backend stage cannot be recovered from the old generic client message       | Handler ordering plus returned AI_INVALID_OUTPUT establishes these gates were passed               |
| Real Siteverify                                    | Standalone production protection had passed; this attempt's outcome unknown | Passed before native invocation                                                                    |
| Native model invocation                            | Unconfirmed; counted conservatively against the old budget                  | Binding returned to the output acceptance block                                                    |
| Envelope / JSON / structural / evidence validation | Unknown                                                                     | One of these stages rejected, or the common acceptance block failed; no retained substage metadata |
| Financial checks / frontend draft                  | No accepted draft                                                           | No accepted draft; arithmetic mismatches ordinarily yield warnings, not AI_INVALID_OUTPUT          |

Harbor's root cause cannot be ranked from the retained evidence. Saffron's most specific substantiated diagnosis is **post-invocation output acceptance rejection**, not a particular envelope or hallucinated value. The former generic browser mapping could conceal capacity, protection, provider or internal failures; no one category is established. The earlier Siteverify redirect:error defect was fixed before these attempts and must not be presented as their proven cause.

## Provider contracts and demonstrated defects

The pinned @cloudflare/workers-types 5.20261110.1 maps the exact Gemma model to ChatCompletionsOutput. Its required message content is string or null; finish_reason is required. The [exact model specification](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/) and [official machine-readable schema](https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/workers-ai-models/gemma-4-26b-a4b-it.json) agree. This model's object-valued chat content, content-part arrays, parsed members and REST result wrappers are not accepted.

Cloudflare's separate [general JSON Mode documentation](https://developers.cloudflare.com/workers-ai/features/json-mode/) documents a response object wrapper. The old adapter rejected this documented representation. The new adapter unwraps only the recognized Workers response wrapper, with a string or plain object, then applies the same authoritative strict Zod and evidence validation. It does not accept a bare draft or arbitrary top-level object. **That generic compatibility fix does not prove Gemma returned that representation historically.**

Other reproduced defects/corrections:

- Missing/empty finish reasons could pass previously. Chat output now requires exactly one choice, assistant role and explicit stop; refusal, legacy function calls, unexpected/malformed tool lists and ambiguous wrappers fail closed.
- Only content-string bytes were bounded previously. The complete serialized envelope, including object content and metadata, now has the same 64-KiB acceptance limit. No content repair, Markdown stripping or automatic retry.
- Named-date normalization examined only the first date in an evidence excerpt. A regression failed before correction when two valid named dates shared a quote. All supported named-date occurrences are now checked. ISO dates also require numeric-token boundaries; a date prefix inside a longer number is rejected. These tests do not establish a cause for the historically ISO-dated fixtures.

## Safe diagnostics

Internal OutputValidationError carries only an application-owned stage (envelope, json, schema, evidence, value, limits), bounded issue code and optional allowlisted schema path. Unknown provider keys, Zod messages/issue objects, quote contents and financial values are never copied. A single AI_OUTPUT_REJECTED console event contains only this sanitized object. Persistent observability remains disabled; no prompt/body logging, content telemetry or raw response capture was added.

Public responses remain the same safe AI_INVALID_OUTPUT code/message. Provider invocation errors/timeouts retain their separate safe public categories. No raw document, OCR text, prompt, model body, secret, token, provider exception or field value is logged. Tests inject private markers and assert exact sanitized console arguments and unchanged public error bodies. Future operator observation can use only these bounded events under a separately authorized retest; absence of historical events cannot reconstruct prior output.

## Schema and fixture feasibility

The [actual generated provider JSON Schema](evidence/provider-output-schema.json) is unchanged: **3,601 compact UTF-8 bytes**, SHA-256 733d9032d659d1e18cf728d284101f58c88e4b11c3ac95b8907b636d1cb6c6bd. Five closed objects, required nullable fields, 20-item / 5-tax / 100-evidence limits and string decimal contracts remain. The exact model documents the existing named strict schema request shape; the general JSON Mode example uses a different wrapper convention, so it is not substituted into this model's request.

Deterministically constructed Harbor and Saffron drafts from independently authored ground truth pass every populated field, line, tax, date, currency and total with exact source evidence. Row evidence covers only values present in its quote; each populated line discount separately cites the explicit Line discounts source line. Missing evidence, fabricated quotes, wrong pages/paths, unsupported amounts, ambiguous dates/currencies and invented zeros remain rejected. Fixture data is test-only and is never an AI fallback.

Required nulls, duplicate row/value evidence, quote limits, provider grammar support and completion truncation remain possible causes for a future observed failure, not proven historical causes. The 6,144 completion-token bound and schema complexity were not tested against the real provider here. Offline acceptance proves these two authored cases are expressible, not that the model will produce them. No incompatibility requiring a schema or token-limit change was demonstrated, so neither changed.

## Validation and disabled publication

The full suite passed: **174 unit/integration tests across nine files, 18 browser tests**, types, lint, frontend production build and Worker dry-run. Formatting passed on authored changes. npm audit reported zero findings, including development dependencies. New coverage includes exact installed model output types, documented string/object wrappers, null/missing/multiple choices, incomplete finishes, malformed JSON, whole-envelope limits, tools/refusals, six diagnostic stages, safe paths/logs, both complete financial fixtures and date regressions. Existing mocks cover provider failures, deadlines, no retries, protection and manual provenance. Browser tests still perform actual local OCR/PDF processing with external access blocked.

The favicon is a same-origin SVG matching the existing green L/dot brand mark; no font, CDN or generated raster dependency. Publication/deployment identities and final disabled public checks are recorded in the deployment record after release. The existing production controls stay unchanged, allowing ABUSE_CONTROLS_VERIFIED=true to remain truthful.

## Smallest proposed future retest — not authorized here

Request a new budget of **at most two sequential attempts**, Harbor invoice then Saffron receipt, with no automatic retry and immediate stop/disable on the first rejection. Recheck Free eligibility/shared quota/protection first. Use displayed synthetic text, fresh consent and legitimate protection; observe only sanitized stage/code/path metadata. Require accepted evidence-supported ground-truth comparisons and real-AI manual correction/downloads before claiming Gate E2. No historical unused slot is consumed or carried into this task.
