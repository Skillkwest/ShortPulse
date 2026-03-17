# Lane A Execution Plan (2026-03-16)

Last updated: 2026-03-16  
Status: Active  
Owner: Engineering  
Master plan: `docs/planning/lane-a-master-plan-2026-03-16.md`  
Tracker spec: `docs/planning/lane-a-tracker-spec-2026-03-16.md`  
Evidence root: `docs/planning/evidence/lane-a/`

## Purpose
Translate Lane A strategy into concrete, low-risk slices that restore baseline gates and governance parity without behavior changes.

## Scope Lock
In scope:
1. Baseline lock and validation-gate recovery (`validate`, naming guard, size budget seam).
2. Policy/governance alignment for active script/workflow/template/doc surfaces.
3. Docs index parity and changelog governance cleanup.
4. Conservative dead-code cleanup with explicit rollback notes.

Out of scope:
1. Lane B modularization extraction work.
2. Track P1 generation payload/dispatch contract hardening.
3. Lane D runtime warning/suppression cleanup execution.
4. Product/UX behavior changes unrelated to gate/governance recovery.

## Slice Backlog
| Slice ID | Phase | Surface | Primary Goal | Primary Evidence Artifact | Status |
| --- | --- | --- | --- | --- | --- |
| `A0-01` | A0 | Baseline lock | Capture baseline command outputs and freeze non-goals | `docs/planning/evidence/lane-a/2026-03-16-a0-01-baseline-lock.md` | Completed |
| `A1-01` | A1 | naming guard bridge usage | Recover `check:naming-legacy-usage` without behavioral refactor | `docs/planning/evidence/lane-a/2026-03-16-a1-01-naming-gate-recovery.md` | Completed |
| `A1-02` | A1 | `frontend/pages/ai-studio.tsx` budget seam | Restore `check:size-budget` compliance for baseline gate health | `docs/planning/evidence/lane-a/2026-03-16-a1-02-size-budget-gate-recovery.md` | Completed |
| `A1-03` | A1 | validate path | Reconfirm `validate` end-to-end baseline green | `docs/planning/evidence/lane-a/2026-03-16-a1-03-validate-path-relock.md` | Completed |
| `A2-01` | A2 | policy/governance surfaces | Align Supabase operations policy across active scripts/workflows/templates/docs | `docs/planning/evidence/lane-a/2026-03-16-a2-01-policy-surface-alignment.md` | Completed |
| `A3-01` | A3 | docs indexes + changelog | Resolve active index parity drift and enforceable changelog chronology contract | `docs/planning/evidence/lane-a/2026-03-16-a3-01-docs-governance-cleanup.md` | Completed |
| `A4-01` | A4 | dead-code high-confidence leaves | Remove isolated dead files/dependencies with strict targeted validation | `docs/planning/evidence/lane-a/2026-03-16-a4-01-conservative-deadcode-pass.md` | Completed |
| `A4-02` | A4 | selective dead-code pruning | Prune additional high-confidence leaves and defer ambiguous core seams | `docs/planning/evidence/lane-a/2026-03-16-a4-02-selective-pruning-pass.md` | Not Started |
| `A5-01` | A5 | lane signoff | Publish closeout bundle and follow-up debt ledger with owner/sunset | `docs/planning/evidence/lane-a/2026-03-16-a5-01-lane-signoff.md` | Not Started |

Policy:
1. One seam per PR.
2. Lane A is gate/governance recovery only; no opportunistic feature work.
3. Any uncertain parity seam must be split and characterized before merge.

## Task Contract (Per Slice)
Every slice must satisfy all items before moving to `Completed`:
1. Behavior/API unchanged, or intentional delta explicitly documented.
2. Required gates pass for the touched scope.
3. Docs/tracker/evidence parity is complete in the same slice.
4. Micro-audit completed with findings classified as `blocking`, `non-blocking`, and `deferred`.
5. Audit budget honored: if non-blocking findings exceed 2, create a follow-up slice and stop current-slice scope expansion.
6. Implementation and audit-fix changes remain separable in commit history when both exist.

### Slice Closeout Parity Check (Required)
1. Evidence packet exists at the path declared in the slice backlog row.
2. Slice status is updated in lane tracker and global tracker.
3. Changelog decision is explicit: either updated in-slice or deferred with owner/date in evidence.

## Execution Detail
### A0-01 Baseline Lock
Commands:
1. `npm -C frontend run deadcode:check:full`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run test`
6. `npm -C frontend run docs:check`
7. `npm -C frontend run validate`

Acceptance:
1. Baseline outputs captured and evidence linked.
2. In-scope/out-of-scope and rollback posture frozen.
3. Baseline blockers are explicit and phase-mapped.

### A1-01 / A1-02 / A1-03 Gate Recovery
Required checks:
1. `npm -C frontend run check:naming-legacy-usage`
2. `npm -C frontend run check:size-budget`
3. `npm -C frontend run validate`

Acceptance:
1. Targeted gate failures are resolved or explicitly deferred with owner/date.
2. No broad allowlist/suppression expansion without sunset notes.
3. `validate` path is green for baseline gates.

### A2-01 Policy Alignment
Primary surfaces:
1. `scripts/run_repo_sweep.sh`
2. `.github/workflows/ci.yml`
3. `.github/pull_request_template.md`
4. `docs/planning/ci-policy-checks.md`

Acceptance:
1. Active policy surfaces are internally consistent.
2. Contradictory Docker-local Supabase flow instructions are removed from active governance surfaces.

### A3-01 Docs Governance Cleanup
Acceptance:
1. Active index parity is resolved for touched indexes.
2. Changelog structure/chronology policy is enforceable.
3. Duplicate/stale route or SOP references are corrected.

### A4-01 / A4-02 Conservative Dead-Code Cleanup
Required checks:
1. `npm -C frontend run deadcode:check`
2. `npm -C frontend run deadcode:check:full`
3. targeted tests for touched seams

Acceptance:
1. Only high-confidence leaf removals are merged.
2. Any ambiguous/core candidate is deferred and logged.
3. No behavior/API regressions in targeted tests.

### A5-01 Lane Signoff
Acceptance:
1. Required lane gates pass.
2. Warning count is non-increasing for touched surfaces.
3. Follow-up debt list includes owner and sunset criterion.

## Merge Gates (Per Slice)
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run validate` (for gate-recovery slices)
6. targeted tests for touched seam

Lane-level closeout:
1. `npm -C frontend run test`
2. `npm -C frontend run deadcode:check:full`
3. complete evidence packet set under `docs/planning/evidence/lane-a/`
