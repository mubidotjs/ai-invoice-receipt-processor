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
