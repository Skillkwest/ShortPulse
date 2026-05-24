---
title: AI Studio Character Panel Lean Hardening Phase 5 Docs SQL And Closeout Plan
status: active
owner: Product + Engineering
created: 2026-05-23
last_updated: 2026-05-23
---

# Phase 5: Docs, SQL, And Closeout

Purpose: clean the active documentation and compatibility story after the runtime truth has already been simplified.

## Goal

Make active docs, SQL references, and planning surfaces reflect the real post-cleanup character-panel system rather than the retired QuickSwap-era design.

## Phase Scope

In scope:

1. SOP cleanup.
2. Planning-index cleanup.
3. Docs index cleanup.
4. SQL and data-dictionary cleanup where runtime and data gates allow it.
5. Historical-plan de-indexing or archive-candidate follow-up.

Out of scope:

1. Runtime truth changes that should have happened in earlier phases.
2. Bottom media-library styling work.
3. New feature design work.

## Entry Gates

1. Runtime and styling truth from earlier phases is already real.
2. QuickSwap is no longer part of the live character-panel contract.
3. Remaining compatibility references are explicitly classified before doc removal begins.

## Workstreams

### Workstream 1: Update Active Character Docs

Refresh active docs that still describe QuickSwap as current behavior.

### Workstream 2: Clean SQL And Data References

Retire or reclassify QuickSwap SQL references only after runtime and data compatibility work says it is safe.

### Workstream 3: Clean The Planning Reading Path

Make the new character-panel lean hardening plan the active execution path and demote stale plans from active indexes.

### Workstream 4: Final Program Closeout

Confirm that remaining QuickSwap references are either:

1. intentionally historical,
2. intentionally gated compatibility, or
3. removed.

## Recommended Order Inside The Phase

1. Update active planning indexes first so the right reading path is clear.
2. Update active SOP and product docs to match the live runtime truth.
3. Clean SQL and data-dictionary references only when their compatibility posture is known.
4. Classify any survivors into active, compatibility, or historical buckets.

## Primary Target Files

1. `docs/sops/sop_character_manager_operations.md`
2. `docs/README.md`
3. `docs/planning/README.md`
4. `docs/planning/execution-authority.md`
5. `docs/planning/backlog.md`
6. `docs/database-migrations.md`
7. `docs/data-dictionary.md`
8. `docs/security-checklist.md`
9. `sql/migrations/045_add_character_quickswap_deck.sql`
10. `sql/migrations/059_add_user_preferences_ai_studio_character_quickswap_tip_hidden.sql`

## Cleanup Classification Rules

For every remaining QuickSwap reference, decide whether it is:

1. active and wrong, which means it must be fixed,
2. compatibility-held, which means it stays with an explicit note,
3. historical, which means it should leave the active reading path,
4. dead, which means it should be removed.

Current audit refresh confirms major active cleanup targets still include:

1. `docs/sops/sop_character_manager_operations.md`
2. `docs/database-migrations.md`
3. `docs/data-dictionary.md`
4. `docs/security-checklist.md`

## Manual QA

1. Read the active character SOP and confirm it matches the real current panel.
2. Check the planning indexes and confirm the new program docs are the active path.
3. Search active docs for QuickSwap-as-live statements and classify any survivors.

## Acceptance Criteria

1. Active docs no longer present QuickSwap as part of the live character-panel contract.
2. Active planning indexes point readers to the new program docs.
3. SQL and data references are aligned with the live runtime truth or explicitly marked as compatibility holdovers.
4. Stale character-panel planning assumptions are no longer in the active reading path.

## Validation

1. Run the docs integrity checks used by the repo.
2. Search for remaining active QuickSwap references and classify any survivors.
3. Confirm active reading paths point to current docs rather than the stale primary-character-panel plan.

## Phase Risks

1. Declaring cleanup complete while stale active docs still describe the wrong system.
2. Removing SQL or compatibility references too aggressively.
3. Leaving readers on stale planning entrypoints.

## Stop Rule

Stop Phase 5 when the active docs and active indexes match the post-cleanup runtime truth, even if some historical records remain in non-active namespaces.
