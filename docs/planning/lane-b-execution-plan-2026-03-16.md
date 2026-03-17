# Lane B Execution Plan (2026-03-16)

Last updated: 2026-03-17  
Status: Active  
Owner: Engineering  
Master plan: `docs/planning/lane-b-master-plan-2026-03-16.md`  
Tracker spec: `docs/planning/lane-b-tracker-spec-2026-03-16.md`  
Evidence root: `docs/planning/evidence/lane-b/`

## Purpose
Convert Lane B modularization strategy into concrete extraction slices with strict parity and anti-bloat controls.

## Scope Lock
In scope:
1. `B-Core` modularization of oversized hotspots with stable public contracts.
2. `B-Style` token/class standardization under visual parity controls.
3. Lane-specific boundary/size guardrail convergence.

Out of scope:
1. Lane A baseline gate/governance recovery work.
2. Track P1 generation payload/dispatch hardening.
3. Lane D runtime warning/suppression execution slices.
4. Product behavior/API contract changes.

## Slice Backlog
| Slice ID | Track | Hotspot | Primary Goal | Primary Evidence Artifact | Status |
| --- | --- | --- | --- | --- | --- |
| `B0-01` | B-Core | Governance bootstrap | Publish Lane B ADR/SOP/checklist alignment and freeze extraction policy | `docs/planning/evidence/lane-b/2026-03-16-b0-01-governance-bootstrap.md` | Completed |
| `B1-01` | B-Core | Guardrail controls | Add Lane B size-budget/boundary/cycle guardrail modes | `docs/planning/evidence/lane-b/2026-03-16-b1-01-guardrail-bootstrap.md` | Completed |
| `B2-01` | B-Core | `ExpertEditPanelView.tsx` | Extract orchestration/presenter seams while preserving prop contract | `docs/planning/evidence/lane-b/README.md` | Checkpoint Complete |
| `B2-02` | B-Core | `useInpaintMaskController.ts` | Split math/state helpers from orchestration hook | `docs/planning/evidence/lane-b/README.md` | Checkpoint Complete |
| `B2-03` | B-Core | `MediaLibraryPanel.tsx` | Split panel controller/presentation seams with parity tests | `docs/planning/evidence/lane-b/README.md` | Checkpoint Complete |
| `B3-01` | B-Core | `CharacterManagerShell.tsx` | Extract domain hooks + shell presentation seams | `docs/planning/evidence/lane-b/2026-03-17-b3-01-character-shell-checkpoint-review.md` | Checkpoint Complete |
| `B3-02` | B-Core | `useCharacterManagerDraft.ts` | Split draft-state orchestration into feature slices while preserving caller contract | `docs/planning/evidence/lane-b/2026-03-17-b3-02-character-draft-checkpoint-review.md` | Checkpoint Complete |
| `B4-01` | B-Core | `/pages/admin/index.tsx` | Split tab-specific controllers and reduce page coupling | `docs/planning/evidence/lane-b/2026-03-17-b4-01-admin-shell-hotspot-map.md` | In Progress |
| `B4-02` | B-Core | admin health server modules | Split user-health and fleet lifecycle services | `docs/planning/evidence/lane-b/2026-03-16-b4-02-admin-health-service-split.md` | Not Started |
| `B5-01` | B-Style | style token authority | Lock canonical panel/token values and alias policy | `docs/planning/evidence/lane-b/2026-03-16-b5-01-style-token-authority.md` | Not Started |
| `B5-02` | B-Style | AI Studio style migration | Migrate scoped literal styles to canonical tokens/classes | `docs/planning/evidence/lane-b/2026-03-16-b5-02-style-migration-slice.md` | Not Started |
| `B6-01` | B-Core/B-Style | convergence | Promote guardrails to enforce after two green cycles | `docs/planning/evidence/lane-b/2026-03-16-b6-01-convergence-and-enforcement.md` | Not Started |

Policy:
1. One seam per PR.
2. No behavior/UI/API contract changes in modularization slices.
3. If parity confidence is low, reduce slice size and add characterization first.
4. Baseline-dependent merges remain blocked until Lane A baseline-green signoff.

### B2-B4 Seam Selection Rubric
Use this rubric before opening a new modularization seam in active hotspots:
1. A seam is worth taking only when it does at least one of:
   - removes duplicated logic across multiple callsites,
   - creates a coherent sub-context with a stable name,
   - improves testability/observability,
   - makes the next planned extraction easier,
   - reduces the hotspot file with explicit LOC or coupling gain.
2. A seam must also reduce net complexity across touched files, not just move lines out of the hotspot.
3. Distinguish local consolidation from shared extraction:
   - local consolidation is acceptable when it removes obvious duplication inside the hotspot without adding a new shared dependency surface,
   - shared extraction is acceptable only when the code has durable domain meaning, improves reuse, or materially improves testability/observability.
4. Shared utility extraction should usually meet at least one of:
   - three or more callsites,
   - a clear domain boundary with a stable name,
   - a concrete testing or observability gain that would be awkward to achieve in-place.
5. Do not take seams that only move tiny one-off fragments into generic helpers without a stronger module boundary.
6. Prefer cohesive clusters over isolated fragments:
   - pointer/gesture termination,
   - overlay dismissal and escape handling,
   - modal interaction guards,
   - transform session lifecycle.
7. Reject the seam if any of the following are true:
   - the hotspot grows without an exceptional coupling reduction,
   - utility or helper surface grows while boundary clarity stays flat,
   - helper names become generic or vague,
   - the extraction only moves syntax around without making follow-up seams easier.
8. Every evidence packet must state why the seam cleared this rubric, including net-complexity outcome and follow-up leverage, not just that code moved.

## Execution Detail
### B0-01 Governance Bootstrap
Acceptance:
1. Lane B governance references are linked in roadmap/tracker/docs indexes.
2. SOP/ADR references are explicit for extraction policy.
3. Evidence schema is published and linked.

### B1-01 Guardrails Before Extraction
Required checks:
1. `npm -C frontend run check:size-budget`
2. `npm -C frontend run check:architecture-boundary`

Acceptance:
1. Lane B guardrails exist for hotspot domains.
2. Warn/enforce promotion policy is documented with sunset checkpoints.

### B2-B4 Core Modularization Slices
Required checks:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run check:architecture-boundary`
4. `npm -C frontend run check:size-budget`
5. `npm -C frontend run build`
6. targeted seam tests for touched modules

Acceptance:
1. Public contracts are unchanged.
2. LOC or coupling reduction is explicit per slice.
3. Boundary and size checks pass.
4. The seam clears the selection rubric with explicit rationale in the evidence packet.
5. If hotspot tests only cover helpers, the next slice must add characterization before opening higher-risk controller extraction.

Hotspot escalation rule:
1. If two consecutive accepted seams produce only marginal hotspot reduction or only local cleanup value, pause new micro-seams and capture a hotspot map before continuing.
2. The hotspot map must identify remaining domain clusters, state ownership boundaries, render-vs-orchestration boundaries, and the next extraction sequence.
3. Resume modularization only with seams that clearly unlock a larger boundary or materially simplify a planned extraction.

### B5 Style Standardization
Acceptance:
1. Canonical token/class map is locked and documented.
2. No-new-literals guard is added for scoped surfaces with allowlist policy.
3. Visual parity packet is attached per style slice.

### B6 Convergence
Acceptance:
1. Guardrails promoted from warn to enforce after required green cycles.
2. Outstanding deferred seams are owner/date tracked.
3. Complete evidence packet set is present.

## Merge Gates (Per Slice)
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run check:architecture-boundary`
4. `npm -C frontend run check:size-budget`
5. `npm -C frontend run build`
6. targeted seam tests

Lane-level closeout:
1. `npm -C frontend run test`
2. `npm -C frontend run docs:check`
3. complete evidence packet set under `docs/planning/evidence/lane-b/`
