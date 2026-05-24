---
title: AI Studio Character Panel Lean Hardening Implementation Entry Checklist
status: active
owner: Product + Engineering
created: 2026-05-23
last_updated: 2026-05-23
---

# AI Studio Character Panel Lean Hardening Implementation Entry Checklist

Purpose: keep the execution lane disciplined as the character-panel lean hardening program moves from planning into implementation.

## Program-Level Checklist

- [ ] Confirm the master plan is the active reading path for this lane.
- [ ] Confirm current code and passing tests are being treated as source of truth over stale docs and ADRs.
- [ ] Confirm QuickSwap eradication remains full-system scope.
- [ ] Confirm style conversion remains top-workspace-only scope.
- [ ] Confirm the bottom carriage media library is excluded from style rewrite work.
- [ ] Confirm preserved behaviors are locked before destructive cleanup begins.

## Phase 1 Entry Checklist

- [ ] Expand or update regression coverage for the current character-panel contract.
- [ ] Lock the replacement-surface model as top workspace plus bottom carriage media library.
- [ ] Validate whether embedded media-library click-to-assign is truly live behavior or a stale intended path.
- [ ] Capture the live validation path for drag/drop, upload bridge, save/load, and generation injection.

## Phase 2 Entry Checklist

- [ ] Phase 1 preserved-behavior contract is explicit.
- [ ] Runtime targets for QuickSwap eradication are listed.
- [ ] Dead-file candidates and active-hook contamination are separated clearly.
- [ ] Removal sequence preserves drag/drop, upload, and generation paths.

## Phase 3 Entry Checklist

- [ ] Active runtime is no longer dependent on QuickSwap concepts.
- [ ] Stored-data usage has been checked before compatibility retirement.
- [ ] Delete flow and orphan cleanup impact have been reviewed.
- [ ] Legacy fallback removal is being treated as gated rather than assumed safe.

## Phase 4 Entry Checklist

- [ ] Styling work is limited to the top workspace.
- [ ] Shared bottom-carriage media-library styles are out of scope.
- [ ] Active class-based style hooks in the top workspace are identified.
- [ ] CSS-variable usage in top-workspace-owned surfaces is identified.
- [ ] A replacement strategy exists for class-selector-based drag styling.
- [ ] A live visual baseline has been captured for the top workspace, including actual colors, fonts, spacing, radii, shadows, and interaction states.
- [ ] The style rebuild plan is based on rendered visual truth, not just token or selector names from stylesheets.
- [ ] The character library modal and confirmation-dialog surfaces launched from the top workspace are included in the raw-style scope.
- [ ] Shared picker/modal primitives used only for the character top-surface path have an ownership strategy: inline locally, inline via character-owned wrappers, or shared primitive refactor with bounded impact.

## Phase 5 Entry Checklist

- [ ] Runtime and persistence truth already match the new intended contract.
- [ ] Active docs and SQL references targeted for cleanup are listed.
- [ ] Stale plans and SOP text are being updated only after runtime changes are real.
- [ ] Archive or de-index work is bounded and explicit.

## Phase Exit Checklist

Apply this at the end of every phase:

- [ ] UI and behavior still match the locked contract.
- [ ] Validation for this phase has been run or explicitly deferred with reason.
- [ ] No new work has been opened by adjacency alone.
- [ ] The next phase still has better ROI than stopping.

## Final Program Closeout Checklist

- [ ] No active character-panel runtime path references QuickSwap.
- [ ] Top workspace no longer depends on character-specific stylesheets or CSS variables.
- [ ] Preserved behavior checklist still holds.
- [ ] Active planning docs and SOPs no longer describe QuickSwap as live behavior.
- [ ] Remaining legacy references, if any, are clearly classified as historical or gated compatibility.
- [ ] Top-workspace raw inline styles reproduce the live visual contract without stylesheet fallback.
- [ ] Character-library modal and confirmation-dialog surfaces in the top workflow no longer rely on stylesheet-driven presentation.
