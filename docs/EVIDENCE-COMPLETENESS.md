# Evidence completeness and bounded Gate E2 follow-up

The prior single instrumented Harbor diagnostic returned from native Gemma inference, passed JSON/structural validation, and stopped at `AI_OUTPUT_REJECTED`, stage `evidence`, code `missing_evidence`, diagnostic path `/data/documentType`. The required model evidence pointer is `/documentType`. No accepted draft or field-accuracy claim followed. The diagnostic ended with both production live flags false.

## Narrow correction

Prompt version changes from `invoice-v1` to `invoice-v2-evidence`. Instructions explicitly require invoice/receipt classification evidence, data-relative pointers, exact normalized page excerpts, the actual supporting page, populated tax-mode coverage and complete row-value coverage. A generic conditional INVOICE example contains no fixture vendor, identifier or amount. Nulls, unknown enums and booleans retain their existing exemptions. Unsupported classifications remain unknown.

The authoritative schema, evidence matcher, arithmetic, provider options/model, protection and manual-review rules are unchanged. No synthetic evidence is inserted into real responses and no repair/fallback inference exists. Health now reports the public prompt version without invoking any service.

Test-only complete responses are constructed from independently authored Harbor/Saffron ground truth and selected source lines. Tests reject missing classification/tax-basis coverage, diagnostic-style pointers, wrong pages, fabricated quotes, incorrect classifications, unsupported money and incomplete line coverage. Mixed direct/row evidence, separate header excerpts and exemptions are covered. The actual externally blocked browser PDF/OCR tests feed their extracted text into the same strict validator; they do not substitute ideal text for Tesseract output. These responses are deterministic test data, not model observations.

The actual Saffron OCR separates row descriptions and numeric cells with line breaks. A description-only test quote was correctly rejected at `/data/lineItems/0/quantity`; the test helper now selects the exact multiline source span, not an invented joined line. Runtime instructions explicitly preserve original whitespace and OCR line breaks in evidence quotes. No validator defect or relaxation was required.

## Production boundary

Deploy the tested source with live AI disabled first. The owner permits at most two new sequential real calls: Harbor once, then Saffron once only after Harbor fully passes. Connect the content-filtered listener before submission, verify the new deployed prompt version, retain only sanitized diagnostic metadata and preserve Preview/local disabled settings. Any required acceptance failure stops the sequence and restores disabled production flags. Only two fully accepted and manually verified real workflows can complete Gate E2.

Local verification passed 264 unit/integration tests in 11 files, all 18 browser tests, types, zero-warning lint, formatting, the frontend production build, Worker dry-run and a zero-finding full dependency audit. Harbor native PDF text and Saffron actual OCR both passed complete evidence compatibility with external requests blocked. Model/protection tests remain mocked. Deployment identities and live outcomes are recorded after verification; this correction alone is not a Gate E2 completion claim.

## Actual bounded production outcome — 2026-11-12

Correction [PR 11](https://github.com/mubidotjs/ai-invoice-receipt-processor/pull/11) merged as `2805871e22e08643d9b08aefcea82f2cf9a5b3ae`. [Main CI 43259540928](https://github.com/mubidotjs/ai-invoice-receipt-processor/actions/runs/43259540928) passed. Initial disabled Worker `c0d3ca11-03ee-4f9f-8ac3-575a88b0b404` reported the new prompt version. Workers Free remained current, account-wide usage showed 53.01/10,000 daily neurons, and existing native AI/limiter bindings, encrypted secret, production sitekey, exact hosts and CSP were verified unchanged. The listener's redaction self-tests and real no-inference health-event reception passed before submission; Wrangler disk logging stayed disabled.

The tested live Worker was `e7def8b5-2467-4cc4-bf25-7f8fcd33233c`; Vercel was `dpl_Df1wPo5cQsdGJuWibNfWCQrkyLYM`. The actual Harbor PDF preview and native text extraction passed source-anchor checks with fresh consent. Real Turnstile passed server-side validation, established by reaching the subsequent native binding call. The single invocation attempt threw: `AI_INVOCATION_REJECTED`, stage `invocation`, category `unknown_invocation`, allowlisted name `AiError`. No recognized numeric code or code source was captured. The UI returned `AI_UNAVAILABLE`. No model output was returned for JSON, schema or evidence acceptance; no draft or ground-truth field comparison was accepted.

Testing stopped immediately. **One new invocation attempt was consumed; Saffron was not submitted to AI and the second slot remains unused.** The current rejection does not substantiate either success or failure of the new evidence instructions on real generated output. No response was repaired, no fallback was used, and no inference was retried.

Safe Worker `121c2a72-36ba-4de0-8bbb-b3d72f9010ad` restored `LIVE_AI_ENABLED=false` with `ABUSE_CONTROLS_VERIFIED=true`. Disabled Vercel build `dpl_5JQKxiSycFAZ1WQSnDnu5u4eMddx` is READY on the same tested application source. Health is HTTP 200, reports `invoice-v2-evidence` and disabled inference. Production/Preview/local live flags remain false. The temporary listener is stopped and retains only its sanitized metadata. A documentation-only successor can have a newer Vercel identity without changing this verified application bundle.

The branded post-rollback workflow passed actual Saffron Tesseract OCR, preview and source anchors without AI. Manual entry/correction triggered and cleared an arithmetic warning; invalid formats blocked export and edits reset review. JSON/CSV downloaded bytes retained corrected values, manual-correction provenance, synthetic status and acknowledged warnings, excluding full OCR text and protection tokens. These are manual-only production observations, not an accepted real-AI workflow. [Sanitized acceptance record](evidence/evidence-completeness-acceptance.json).

Gate E2 remains **blocked**. No additional extraction/evidence/model change is justified by an unknown invocation exception. The next decision needs a documented safe provider signal or Cloudflare-side operational diagnosis; this record does not authorize another inference or a speculative compatibility change.
