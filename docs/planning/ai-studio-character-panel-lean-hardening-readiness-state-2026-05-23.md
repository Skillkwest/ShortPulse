---
title: AI Studio Character Panel Lean Hardening Readiness State
status: active
owner: Product + Engineering
created: 2026-05-23
last_updated: 2026-05-23
---

# AI Studio Character Panel Lean Hardening Readiness State

Purpose: define whether the character-panel lean hardening program is ready to execute and what gates still need to be respected.

## Readiness Verdict

Ready to execute Phase 1 immediately.

Phase 2 through Phase 5 are conditionally ready behind the gates in this document and the phase plans.

## Why This Program Is Ready

1. The live surface has already been audited deeply enough to identify the real active render path.
2. The replacement product model is clear: top character workspace plus bottom carriage media library.
3. QuickSwap has been explicitly classified as obsolete and should be eradicated rather than preserved.
4. The top-workspace-only styling boundary has been explicitly locked.
5. The major trim targets are known in runtime code, persistence, stylesheets, SQL references, and docs.

## Baseline Evidence

Current audit evidence supports this program:

1. The active panel is AI Studio-owned rather than a standalone `/character` experience.
2. The visible workspace contract is already narrower than the old docs imply.
3. The active runtime still contains QuickSwap contamination in hooks and persistence.
4. The top workspace still depends on stylesheet and class-based styling contracts.
5. Targeted validation previously passed for the live panel and AI Studio character-mode bridge:
   - `7` test files
   - `56` tests passed

Audit refresh confirms the same major blockers still exist in live code:

1. Active QuickSwap drag/drop and dropped-reference branches are still present.
2. Bottom-carriage click-to-assign is still unresolved at the host wiring layer.
3. Top-workspace child components still have real stylesheet dependencies.

## Locked Scope Boundaries

1. QuickSwap eradication is full-system.
2. Styling conversion is top-workspace only.
3. The bottom carriage media library is explicitly excluded from style rewrite scope.
4. This program is intended to preserve current UI, UX, and behavior.

## Known Risks That Must Stay Visible

1. Embedded media-library click-to-assign may not currently be wired in the character split host.
2. Legacy persistence fallback may still be needed for historical stored data.
3. Orphan cleanup and delete flows still query QuickSwap-backed persistence surfaces.
4. Drag behavior still depends on class selectors in active runtime code.
5. Existing docs and ADRs include stale assumptions and should not be used as implementation authority.

## Entry Gates By Phase

### Phase 1

Entry status: open.

Required conditions:

1. Treat current code and current tests as authority.
2. Keep the audit conclusions attached to the new planning docs.

### Phase 2

Entry status: open after Phase 1 contract lock.

Required conditions:

1. Preserved behavior checklist must be explicit.
2. Replacement-contract validation path must be defined.
3. Known click-to-assign uncertainty must be classified as either real behavior or non-behavior.

### Phase 3

Entry status: gated.

Required conditions:

1. Active runtime path must already be QuickSwap-free.
2. Stored-data and compatibility audit must happen before destructive persistence retirement.

### Phase 4

Entry status: gated.

Required conditions:

1. Runtime simplification should already be complete or stable enough that styling conversion is not masking logic churn.
2. Scope must remain top-workspace only.
3. Bottom carriage media-library styling must remain untouched.

### Phase 5

Entry status: gated.

Required conditions:

1. Runtime truth must already be updated.
2. SQL and docs cleanup must follow implementation truth rather than leading it.

## Stop Rules

1. Stop a phase when the next change no longer clearly reduces risk more than it adds churn.
2. Stop destructive cleanup if a preserved behavior changes unexpectedly.
3. Stop compatibility retirement if stored-data evidence is incomplete.
4. Stop style conversion if it starts forcing bottom-carriage rewrites or product-surface redesign.

## Readiness Summary

This program is ready to move into execution planning and implementation sequencing now. No additional discovery pass is required before opening Phase 1.
