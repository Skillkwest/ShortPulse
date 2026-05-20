# Copperknot May 19 Production Baseline Refresh

Purpose: preserve the original May 6 baseline, compare it against current `production` repo truth plus the active worktree on May 19, and set a new dated launch-control snapshot without rewriting history.

## Baseline Rule

- Keep the original `2026-05-06` baseline intact.
- Treat this report as a new dated operational snapshot.
- Do not silently rewrite older score decisions or queue decisions.

## What Was Audited

- full `production` repo plus current worktree
- AI Studio workflow cluster
- shared runtime/platform cluster
- Copperknot control surfaces and metrics

## Main Outcome

- The May 16 rerating package remains historically correct.
- The repo moved enough by May 19 to justify a new dated baseline refresh.
- The new evidence supports:
  - freshness and review-basis updates
  - a few confidence increases
  - queue and operator-brief changes
- The new evidence does **not** support broad score lifts today.

## Score Decisions

- `Create workflow`
  - keep `6/10`
  - confidence `4 -> 5`
  - reason: the current worktree now includes the attachment staging/refresh hardening and the focused Create validation reran clean, but the workflow still lacks enough broader runtime evidence to reach floor
- `Edit workflow`
  - keep `6/10`
  - reason: no new repo evidence strong enough to move it
- `Project / workspace persistence`
  - keep `6/10`
  - confidence `4 -> 5`
  - reason: unsent Create/Edit/Video/Sound draft boundaries are now more explicit and targeted persistence tests passed
- `Video workflow`
  - keep `6/10`
  - reason: project snapshot semantics improved, but no score-lift evidence
- `Sound workflow`
  - keep `6/10`
  - reason: page-owned draft wiring improved, but no score-lift evidence
- `Media delivery / signing / preview resolution`
  - keep `6/10`
  - confidence `4 -> 5`
  - reason: focused media/API validation passed on May 19 after real delivery/list/signing work landed
- `Billing / credits`
  - keep `7/10`
  - reason: new diagnostics work improves visibility, not core authority enough for another lift
- `Security boundaries`
  - keep `7/10`
- `Generation submission / polling`
  - keep `7/10`
- `Generation recovery / settlement`
  - keep `4/10`

## New Exact Next-Work Decision

The exact next lane is now:

- `Characters workflow`
  - lane: `characters-workflow-hardening`

Reason:

- the earlier Create attachment seam found during the first audit pass no longer reproduces in the current worktree
- the rerun focused validation now passes `193/193` tests
- `Characters workflow` still carries direct production continuity-trust evidence and remains below floor

After that:

1. `Elements workflow`
2. re-assess whether `Project / workspace persistence` needs another fresh external lane or remains internal-only

## Validation Evidence

### Passed

- docs/governance checks:
  - `scripts/check_docs_links.js`
  - `scripts/check_docs_semantic_drift.js`
  - `scripts/check_migration_doc_parity.js`
  - `scripts/check_archive_manifest.js`
  - `scripts/check_model_catalog_parity.js`
  - `scripts/check_naming_canonical_drift.js`
  - `scripts/check_operator_map_drift.js`
- focused AI Studio + persistence suite:
  - `193/193` tests passed
- focused platform/media/API suite:
  - `78/78` tests passed

## Control-Surface Corrections Made

- supersede the May 16 operator brief and launch checklist with May 19 versions
- clear the stale Reference Grid blocker from the operating package
- refresh queue order so `Characters workflow` is back on top of the open dispatch set
- refresh the scoreboard snapshot date/freshness
- repair the stale lane-cycle metrics
- refresh the catalog review basis for the systems touched by May 19 repo truth
- keep the narrow Create regression handoff as historical reserve only instead of treating it as the exact next lane

## July 2 Target

- `2026-07-02` still holds as the active target
- this audit does **not** justify moving the date
- but the target remains credible only if the below-floor workflow and persistence lanes continue to close

## Recommended Next Step

Paste:

- `docs/agents/copperknot/handoffs/2026-05-06-characters-workflow.md`
