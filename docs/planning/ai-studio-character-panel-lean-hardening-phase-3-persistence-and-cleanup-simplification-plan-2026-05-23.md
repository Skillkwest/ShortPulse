---
title: AI Studio Character Panel Lean Hardening Phase 3 Persistence And Cleanup Simplification Plan
status: active
owner: Product + Engineering
created: 2026-05-23
last_updated: 2026-05-23
---

# Phase 3: Persistence And Cleanup Simplification

Purpose: reduce the persistence and cleanup burden left behind by QuickSwap and legacy compatibility paths after the active runtime is already simplified.

## Goal

Make character-panel persistence leaner by removing QuickSwap-driven runtime work, reducing compatibility branches, and simplifying expensive cleanup paths without breaking historical data safety.

## Phase Scope

In scope:

1. QuickSwap persistence retirement from the live runtime.
2. Delete-flow simplification.
3. Orphan cleanup simplification.
4. Legacy slot-assignment compatibility review and reduction where data-safe.

Out of scope:

1. Styling conversion.
2. Bottom carriage media-library changes.
3. SQL migration retirement before data gates are satisfied.

## Critical Gate

Do not remove legacy compatibility or SQL-backed persistence assumptions until stored-data usage is checked. This phase is the highest-risk trim lane in the program.

## Entry Gates

1. Phase 2 has already removed QuickSwap from the live runtime path.
2. The persistence targets being cleaned are no longer required by active UI code.
3. A stored-data review plan exists before destructive compatibility retirement.

## Workstreams

### Workstream 1: Remove QuickSwap Persistence From Live Operations

Retire QuickSwap persistence code after Phase 2 has eliminated live runtime callers.

### Workstream 2: Simplify Delete Flows

Remove QuickSwap-related delete work from character deletion and replacement behavior where no longer needed.

### Workstream 3: Simplify Orphan Cleanup

Reduce cleanup work that still scans QuickSwap references or full character metadata when that cost no longer serves the live system.

### Workstream 4: Review Legacy Fallback Burden

Evaluate whether legacy slot-based fallback and preset-hydration compatibility can be reduced safely, and only do so behind a real data gate.

Questions to answer:

1. Is `character_sheet_presets_v1` universal enough to remove fallback for the supported dataset?
2. Which delete or cleanup paths still touch `character_quick_swap_items` only because of historical architecture?
3. Which compatibility branches still protect real data and which are only carrying dead weight?

## Recommended Order Inside The Phase

1. Remove QuickSwap persistence call sites from live operations.
2. Simplify delete flows that still query QuickSwap structures.
3. Simplify orphan cleanup where the new runtime no longer needs those scans.
4. Review legacy fallback code last and only behind evidence.

## Primary Target Files

1. `frontend/features/character-manager/logic/characterManagerPersistence.ts`
2. `frontend/features/character-manager/logic/characterManagerPersistenceCore.ts`
3. `frontend/features/character-manager/logic/characterQuickSwapPersistence.ts`
4. `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`

## Data And Compatibility Audit Requirements

Before destructive fallback removal:

1. Identify which persisted rows still rely on legacy assignment fallback.
2. Identify whether cleanup and delete paths still need to honor legacy references.
3. Keep a documented list of intentionally retained compatibility seams if evidence is inconclusive.

Current audit refresh note:

1. This phase should assume QuickSwap persistence is still live in docs and likely still referenced in delete and cleanup code until Phase 2 is genuinely complete.

## Manual QA

1. Save a character and reload it.
2. Switch between saved characters and confirm the correct look data hydrates.
3. Delete a character and confirm the next fallback selection is unchanged.
4. Confirm assigned references still persist and reopen correctly after refresh.
5. Submit a generation after reload and confirm selected look data still injects correctly.

## Acceptance Criteria

1. Live character-panel operations no longer depend on QuickSwap persistence.
2. Delete flow and orphan cleanup no longer do unnecessary QuickSwap work.
3. Any legacy fallback removed in this phase is backed by explicit compatibility evidence.
4. Save/load/reopen behavior remains unchanged for supported data.

## Validation

1. Re-run targeted character-panel and persistence-related tests.
2. Manually verify character create, save, delete, reload, and switch flows.
3. Confirm generation injection still resolves the same selected look data after persistence changes.
4. Document any compatibility surfaces intentionally left in place because the data gate failed.

## Phase Risks

1. Removing fallback that still protects historical rows.
2. Making delete or cleanup behavior faster but incorrect.
3. Regressing generation injection through changed hydration semantics.

## Stop Rule

Stop Phase 3 when live persistence work is leaner and QuickSwap-free, even if some gated compatibility code must remain for historical safety.
