# Architecture and contracts

## Boundaries

The browser receives static React assets from Vercel. Uploaded bytes stay in browser memory. PDF.js renders previews and extracts native text; Tesseract.js performs OCR in a dedicated worker. The app stores no document history. Shared Zod contracts, decimal arithmetic and export functions run locally.

The optional Cloudflare Worker accepts **text JSON only**. It cannot upload raw documents, fetch document URLs or select arbitrary models. Native AI and protection bindings are deliberately absent from local configuration.

## Local document pipeline

Extension, supplied MIME, signature and decoder must agree. Reject empty/over-10-MiB files. Check PNG/JPEG header dimensions before decoding: at most 20 megapixels and 8,192 pixels per edge. The decoder still must succeed; these checks cannot eliminate browser decoder vulnerabilities.

PDFs load from bytes, reject encryption/corruption and more than three pages, and use only core text/rendering APIs. Render pages sequentially to canvases bounded to four megapixels and 3,000 pixels per edge. Native text uses positioned items to reconstruct lines; prefer it at 40 printable characters with at most 2% replacement characters. Otherwise run English OCR using sparse-text segmentation. A user can override the heuristic with page OCR, or rotate 90 degrees and rerun. OCR replaces page text rather than duplicating it.

Timeouts: image decode 10s; PDF load 15s; OCR operation 60s; entire document/explicit rerun 180s. Local text is limited to 50,000 characters. Cancellation releases workers/tasks/previews and invalidates response epochs. A later result cannot replace a newer document or manual edits. Browser resource limits reduce exposure; they are not a complete malicious-document sandbox.

## Review data

`shared/src/schema.ts` is the structural source of truth. Unknown keys fail. Missing extracted scalar values are null. Money is nonnegative, canonical and limited to nine integer digits/two decimals. Quantity allows three fractional digits; unit price and percentages allow four. Currencies are USD/EUR/GBP/PKR. Dates are valid ISO dates; ambiguous input is not silently interpreted.

There are at most 20 lines and five taxes. Document identity, dates, totals, tax treatment and coverage are explicit. Schema errors block export. Arithmetic uses scaled BigInts and half-up rounding, with a one-cent tolerance. Unavailable inputs produce not-checkable findings; unreported adjustments are zero only inside explicitly conditional diagnostics. Financial values are never silently repaired.

Each current field carries its own provenance: AI, deterministic sample, manual entry or manual correction. AI evidence can be direct or shared by a row, but must support the populated field. Corrections remove active AI evidence from that field; the initial draft, original quotes and submitted source text remain separate in session memory. Row deletion shifts current provenance without changing original evidence coordinates.

Review/acknowledgment resets after data/source edits, row changes or new extraction. Manual-only records can be reviewed/exported with nulls and acknowledged warnings. Manual values never need invented source evidence.

## Optional API

- `GET /health`: status, schema version, configured model, enablement flag. No upstream calls; not proof of provider readiness.
- `POST /api/extract`: strict `{ schemaVersion: "1", consent: true, pages: [{ page, text }], turnstileToken }`. One–three sequential pages, nonempty normalized text, 12,000 total characters, 64 KiB body checked while streaming.
- Success: schema version, `mode: "live-ai"`, exact model, prompt version, validated document, evidence and checks.
- Errors: `{ error: { code, message, retryAfterSeconds? } }`, sanitized and no-store. Unknown routes/methods return 404/405; origins and JSON content type are enforced.

After request admission, configured native visitor/project throttles run. Disabled deployments return `LIVE_AI_DISABLED` without token verification or inference. Enabled requests require verified flags, bindings and platform identity; then Siteverify must validate the token/hostname/action before one model call.

The sole planned model is `@cf/google/gemma-4-26b-a4b-it`. Fixed prompt, JSON-schema format, temperature 0.1, thinking disabled, no streaming/store/tools and 6,144 completion tokens. Full input is bounded to 32 KiB; output to 64 KiB. Worker waits 90s and browser 105s. Native provider computation may continue after cancellation. No automatic retry, JSON repair inference or fallback.

The provider schema is generated from structural Zod validation. Runtime validation additionally checks exact quote membership, allowed paths/pages and deterministic numeric/date equivalence. AI evidence is checked against the exact submitted text revision. Text membership is not semantic entailment or authenticity.

## Downloads

JSON includes corrected data, current provenance/evidence, processing mode, synthetic status, checks, acknowledged warning codes and review time. CSV repeats document metadata per line, with a fallback document row, JSON tax/provenance/check columns and formula-safe text cells. Both omit raw files, full OCR text, source filenames, protection tokens and IPs. Downloads are generated in the browser; synthetic labels are retained.
