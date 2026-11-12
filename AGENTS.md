# AI Invoice & Receipt Processor

- This independent project implements only the approved English invoice/receipt MVP: React/Vite, browser OCR/PDF processing, strict shared contracts, manual review/exports and an optional Cloudflare Worker.
- Use Node 24 and npm workspaces. Preserve the lockfile and bundled runtime assets; no runtime CDN dependencies in local processing.
- Gates A–D are local only. Keep Workers AI, Turnstile and native protection mocked in tests. Never enable remote inference while completing these gates.
- Gate E requires separate explicit owner authorization for repository publication, deployment, cloud configuration and live inference. No paid models, billing, fallback or automatic upgrades.
- Do not modify or share production configuration with the Release Notes Generator or other projects.
- No database, authentication, RAG, agents, permanent document history, analytics or PWA.
- Source evidence is mandatory for AI-populated values only. Manual values carry separate provenance. Invalid formats block export; unresolved warnings require explicit acknowledgment.
- Preserve offline actual OCR/PDF-to-review-to-download verification, strict limits, decimal-safe arithmetic, cancellation and stale-result protection.
- Run types, lint, meaningful unit/integration tests, builds and Playwright after material changes. Report mocked, actual local and real remote evidence separately.
- Never weaken host permissions or delete unrelated caches to resolve tooling restrictions.
