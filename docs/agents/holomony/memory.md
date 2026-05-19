# Holomony Memory

Purpose: retain concise, durable operating memory for Holomony's media optimization and performance work.

## Current Operating State

- Maturity: `Level 1: Supervised`.
- Contract created: 2026-05-15.
- Local instruction overlay created: 2026-05-15.
- Active milestone: `stable and strong media panel`.
- First durable scope:
  - AI Studio media panel performance
  - Elements media panel performance
  - media KPI tooling
  - media capture/audit helpers

## Active Milestone

Holomony's current milestone is:

- make the approved media panels `stable and strong`

For this milestone, `stable and strong` means:

- no meaningful visible correctness regressions
- low or zero resolver dependence in normal browse
- low signing cost on repeated opens
- strong canonical preview coverage on visible rows
- low visible state churn before settle
- trustworthy repeated KPI packet evidence on both approved surfaces

## Guardrail Summary

- Optimize only the user-approved media surface.
- Prefer evidence-backed performance claims over intuition.
- Never let score tooling overclaim on weak evidence.
- Load Holomony's local `AGENTS.md` overlay for substantive runs after the root repo contract.
- Preserve visible correctness and browse/save trust while tuning speed.
- Treat canonical preview coverage as a first-class performance and correctness concern, but only score it against rows that actually had durable candidates available.
- Do not infer image-preview failure from the panel's synthetic `uploaded_images` sign lane alone; confirm the open-phase list payload mix first.
- Use root-tab-scoped KPI capture when the default `All Media` payload is too mixed to support an honest diagnosis.
- When the mixed `All Media` open is audio-heavy, prefer removing eager audio signing pressure before changing the default browse product semantics.
- Mixed-open sign-budget cuts must be judged by first paint and settle, not just signed-row count. The `1/2/1` experiment reduced signed rows but regressed both surfaces badly; keep the mixed-open budget at the less aggressive `2/3/2` profile unless new evidence says otherwise.
- When the user interrupts to ask why a lane is happening, treat it as a trust-and-ROI checkpoint. Re-explain the current diagnosis, what evidence changed, and whether the lane is still the highest-value real product work before continuing.
- Mixed-grid video browse signing is a separate lane from the main preview-sign budget. Always check whether `MediaLibraryAllItemsGrid` is passing `visibleMediaIdsRef`; if not, poster/hover-video signing can fan out across the loaded batch and distort mixed-open performance evidence.

## Notes

- The standalone `/media-library` route is currently treated as dead and excluded from Holomony's active optimization surface unless the user explicitly reopens it.
- Keep KPI contract truth in code and SOPs together.
- Keep live capture helpers honest: unsupported measurements must stay null.
- Use the scorecard, ledger, failure taxonomy, and experiment ledger as real operating tools, not passive documentation.
- Upstream preview coverage improvements usually outperform downstream browse recovery work.
- Durable lesson: if cross-surface mixed-open KPI diverges again, check whether `MediaLibraryAllItemsGrid` still receives `visibleMediaIdsRef` on every approved surface. Elements regressed because that prop was missing even after the AI Studio path was fixed.
- Orphaned media data should become an explicit cleanup/remediation lane, not an endless preview-generation lane.
- Always distinguish `branch`, `environment`, and `database` explicitly in media-performance work.
- The user is highly sensitive to KPI theater and instrumentation drift. Holomony must keep proving that tooling changes are in service of real panel decisions and real runtime changes, not a substitute for them.
- When the user asks a meta-validity question such as `are our measure tools still valid?`, answer in decision layers instead of one blended status summary:
  - tool logic validity,
  - evidence freshness,
  - and surface coverage completeness.
    Give the direct verdict first, then the layered explanation, then the best next step.
- The user approves work that is concrete, causal, and product-facing:
  - real runtime or persistence changes,
  - direct validation,
  - explicit continue/pivot/stop decisions,
  - and clear explanation of what evidence changed and why the next lane is justified.
- The user disapproves work that feels like momentum or theater:
  - dead-surface drift,
  - instrumentation ahead of product need,
  - vague "why this next?" answers,
  - or self-scoring/retention that cannot defend its own math.
- When a repo instruction points to a local skill path under this repository, open that literal file path first. Do not search Codex-global skill roots before checking the repo-local `skills/` path the contract named.
- Retained reports are valuable historical evidence. Prefer fresh direct proof for present-tense audits when available, but do not talk about reports as if they are disposable or low-value just because they are not the freshest evidence.
- When the runtime is materially healthier and the remaining gaps are mostly persistence proof or evidence depth, default to `done enough for now` instead of inventing another optimization lane.
- A dedicated persistence-proof path now exists: `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:media-panel-persistence`. Use that audit to prove save/reopen browse readiness before reopening runtime tuning.
- Both approved panel surfaces now have direct production save/reopen browse-readiness proof.
- Kirk prefers the current `Kirk.html` visual direction: dark ShortPulse-style gray surfaces, light text, `#25a9bf` accent, flatter technical layout, and report-like sections over bubbly summary cards.
- Current classification: `done enough for now`.
- The next justified lane is regression monitoring or an explicitly approved new surface, not more tuning on the current approved media panels without fresh evidence.
- Active layout lane: `reports/2026-05-18-media-library-five-column-density-plan.md`.
  - Implementation is now in code for AI Studio Media Library panel, Elements embedded Media Library panel, and Character bottom embedded Media Library browser via shared Elements embedding.
  - Treat five columns as a capped wide-container masonry-column contract, not a forced layout everywhere.
  - Exclude the full modal, Character QuickSwap, Reference Grid, Quick Slot Inventory, and standalone `/media-library` unless explicitly reopened.
  - Code/test validation is complete for the implementation path; direct browser visual proof and fresh KPI proof are still required before calling the lane fully done.
- `character-panel-media-assignment` is now an onboarded Holomony candidate surface.
  - Treat it as a hybrid boundary:
    - shared embedded browse/runtime surface below
    - character-owned assignment, copy, persistence, and restore path above
  - Do not score it with the panel KPI family as if it were just another `elements-media-panel` run.
  - Promote it only with character-specific evidence:
    - selection/drop to saved-character latency or failure evidence
    - save/reopen trust
    - `character_media_assets` isolation correctness
