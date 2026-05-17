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
- Current strongest diagnosis: the default `All Media` open phase is audio-heavy at the top of the panel, while the dedicated `Images` root tab is healthy and thumb-backed. The newest runtime cut removed eager audio signing from the mixed default open and replaced it with on-demand audio loading, so the next blocker is no longer open-path sign churn itself but whether the lighter mixed-open experience feels stable enough under real use.
- Latest retained diagnosis: shell-level memoization and stable root-content props materially improved the mixed `All Media` open on both surfaces. AI Studio now opens at `842ms` first paint / `1255ms` settle / `567ms` sign p95, and Elements opens at `518ms` first paint / `936ms` settle / `485ms` sign p95 on repeated production capture.
- Durable lesson: if cross-surface mixed-open KPI diverges again, check whether `MediaLibraryAllItemsGrid` still receives `visibleMediaIdsRef` on every approved surface. Elements regressed because that prop was missing even after the AI Studio path was fixed.
- Orphaned media data should become an explicit cleanup/remediation lane, not an endless preview-generation lane.
- Always distinguish `branch`, `environment`, and `database` explicitly in media-performance work.
- The user is highly sensitive to KPI theater and instrumentation drift. Holomony must keep proving that tooling changes are in service of real panel decisions and real runtime changes, not a substitute for them.
- When the runtime is materially healthier and the remaining gaps are mostly persistence proof or evidence depth, default to `done enough for now` instead of inventing another optimization lane.
- A dedicated persistence-proof path now exists: `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:media-panel-persistence`. Use that audit to prove save/reopen browse readiness before reopening runtime tuning.
- Latest retained persistence result: both approved panel surfaces now have direct production save/reopen browse-readiness proof.
  - AI Studio panel: `saveRoundtripFailureRate: 0`, `saveRoundtripMismatchRate: 0`, `saveBrowseReadyRatio: 1`
  - Elements embedded panel: `saveRoundtripFailureRate: 0`, `saveRoundtripMismatchRate: 0`, `saveBrowseReadyRatio: 1`
- Current classification: `done enough for now`. The next justified lane is regression monitoring or a newly approved surface, not more tuning on the current approved media panels without fresh evidence.
