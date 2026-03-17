# Foundation Lanes Execution Tracker (2026-03-16)

Last updated: 2026-03-17  
Status: Active  
Roadmap source: `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`

## Status Legend

- `Not Started`
- `In Progress`
- `Blocked`
- `Completed`

## Program Snapshot

| Lane | Status      | Owner       | Current Focus                                                                                                                            | Blockers                                | Next Checkpoint                                                           | Plan Artifact                                                           |
| ---- | ----------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A    | Completed   | Engineering | Lane A closeout complete; debt handed off to downstream lanes                                                                            | none                                    | Lane B execution handoff                                                  | `docs/planning/lane-a-master-plan-2026-03-16.md`                        |
| B    | In Progress | Engineering | `B5-01` checkpointed; `B5-02` active with the first expert neutral-surface migration landed in `ai-studio-edit-expert.css`             | none                                    | Choose the next bounded expert-style cluster after this neutral baseline  | `docs/planning/lane-b-master-plan-2026-03-16.md`                        |
| C    | Not Started | Engineering | Regression armor baseline lock and fragile-path characterization matrix                                                                  | Awaiting C0 baseline evidence packet    | Lane C fragile-path matrix lock                                           | `docs/planning/lane-c-master-plan-2026-03-16.md`                        |
| D    | Not Started | Engineering | Runtime safety and warning/suppression hardening for core hot paths                                                                      | Awaiting D0 baseline evidence packet    | Lane D warning debt baseline lock                                         | `docs/planning/lane-d-master-plan-2026-03-16.md`                        |
| E    | Not Started | Engineering | Docs/SOP/ADR parity and governance contract lock                                                                                         | Awaiting E0 baseline evidence packet    | Lane E governance baseline lock                                           | `docs/planning/lane-e-master-plan-2026-03-16.md`                        |
| F    | Not Started | Engineering | Release and CI discipline baseline lock and policy-inventory parity                                                                      | Awaiting F0 baseline evidence packet    | Lane F CI inventory and required-check contract lock                      | `docs/planning/lane-f-master-plan-2026-03-16.md`                        |
| P1   | Not Started | Engineering | Separate generation pipeline hardening (submit/dispatch contract + queue reliability)                                                    | Must stay isolated from Lane B seam PRs | Contract coverage lock                                                    | `docs/planning/generation-pipeline-hardening-master-plan-2026-03-16.md` |

## Lane A Master Checklist

Canonical plan: `docs/planning/lane-a-master-plan-2026-03-16.md`

### A0: Baseline Lock

- [x] Capture baseline outputs for: `deadcode:check:full`, `lint`, `type-check`, `build`, `test`, `docs:check`.
- [x] Freeze explicit in-scope files and explicit out-of-scope files.
- [x] Record rollback posture for each Lane A phase.

### A1: Policy + Validation Gate Recovery

- [x] Resolve naming guard failures without introducing permanent alias drift.
- [x] Align scripts with Supabase CLI policy (remove Docker-local Supabase workflow references).
- [x] Reconfirm `validate` path expectations and blockers.
- [x] Recover size-budget conformance for `frontend/pages/ai-studio.tsx` seam.

### A2: Docs/Governance Cleanup

- [x] Normalize changelog structure and chronology policy enforcement (deferred contract carried by Lane E E4-E5 with explicit owner/sunset in A5 packet).
- [x] Repair active index parity (`docs/README.md`, `docs/planning/README.md`, scoped section READMEs).
- [x] Remove duplicate/stale API/SOP doc rows and stale references.

### A3: Dead-Code Cleanup (Safe Core)

- [x] Apply isolated dead-file/dependency removals with strict validation gates.
- [x] Update active docs/skills impacted by removals in same phase.
- [x] Confirm no behavior-contract regressions in targeted tests.

### A4: Selective Dead-Code Pruning

- [x] Prune only high-confidence leaf exports/constants.
- [x] Defer ambiguous/core-orchestration candidates to follow-up audit.
- [x] Re-run full suite and compare to baseline.

### A5: Lane A Final Signoff

- [x] Required checks pass.
- [x] No net increase in warnings for touched surfaces.
- [x] Follow-up debt list captured with owners and sunset criteria.

## Lane Slice Template (Copy Per PR)

### Slice ID

- `lane`:
- `phase`:
- `owner`:
- `date`:

### Scope

- Files/modules:
- Explicit non-goals:
- Rebuild scope involved (`yes/no`):
- Rebuild entry scorecard link (required when `yes`):

### Validation

- Commands run:
- Results:

### Rollback

- Revert strategy:
- Trigger conditions:

### Follow-Ups

- Debt items:
- Owner:
- Target date:

## Required Gate Bundle (Default)

1. `cd frontend && npm run lint`
2. `cd frontend && npm run type-check`
3. `cd frontend && npm run build`
4. `cd frontend && npm run docs:check`
5. `cd frontend && npm run validate` (for Lane A gate recovery slices)

## Rebuild Method Artifact

Mandatory for any from-scratch replacement scope:

1. `docs/planning/foundation-rebuild-playbook-2026-03-16.md`
2. Tracker row must include explicit do-not-rebuild decision and rebuild-entry criteria evidence.
3. Tracker row must include security-boundary verification evidence and performance-parity thresholds before cutover.

## Lane B Artifacts

1. Master plan: `docs/planning/lane-b-master-plan-2026-03-16.md`
2. Tracker spec: `docs/planning/lane-b-tracker-spec-2026-03-16.md`
3. Execution plan: `docs/planning/lane-b-execution-plan-2026-03-16.md`
4. Evidence index: `docs/planning/evidence/lane-b/README.md`

## Lane A Evidence

1. Evidence index: `docs/planning/evidence/lane-a/README.md`
2. Baseline packet: `docs/planning/evidence/lane-a/2026-03-16-a0-01-baseline-lock.md`
3. A1 naming gate packet: `docs/planning/evidence/lane-a/2026-03-16-a1-01-naming-gate-recovery.md`
4. A1 size-budget recovery packet: `docs/planning/evidence/lane-a/2026-03-16-a1-02-size-budget-gate-recovery.md`
5. A1 validate relock packet: `docs/planning/evidence/lane-a/2026-03-16-a1-03-validate-path-relock.md`
6. A2 policy surface alignment packet: `docs/planning/evidence/lane-a/2026-03-16-a2-01-policy-surface-alignment.md`
7. A3 docs governance cleanup packet: `docs/planning/evidence/lane-a/2026-03-16-a3-01-docs-governance-cleanup.md`
8. A4 conservative dead-code pass packet: `docs/planning/evidence/lane-a/2026-03-16-a4-01-conservative-deadcode-pass.md`
9. A4 selective pruning pass packet: `docs/planning/evidence/lane-a/2026-03-16-a4-02-selective-pruning-pass.md`
10. A5 lane signoff packet: `docs/planning/evidence/lane-a/2026-03-16-a5-01-lane-signoff.md`

## Lane C Artifacts

1. Master plan: `docs/planning/lane-c-master-plan-2026-03-16.md`
2. Tracker spec: `docs/planning/lane-c-tracker-spec-2026-03-16.md`
3. Execution plan: `docs/planning/lane-c-execution-plan-2026-03-16.md`

## Lane D Artifacts

1. Master plan: `docs/planning/lane-d-master-plan-2026-03-16.md`
2. Tracker spec: `docs/planning/lane-d-tracker-spec-2026-03-16.md`
3. Execution plan: `docs/planning/lane-d-execution-plan-2026-03-16.md`
4. Evidence index: `docs/planning/evidence/lane-d/README.md`

## Lane E Artifacts

1. Master plan: `docs/planning/lane-e-master-plan-2026-03-16.md`
2. Tracker spec: `docs/planning/lane-e-tracker-spec-2026-03-16.md`
3. Evidence index: `docs/planning/evidence/lane-e/README.md`

## Lane F Artifacts

1. Master plan: `docs/planning/lane-f-master-plan-2026-03-16.md`
2. Tracker spec: `docs/planning/lane-f-tracker-spec-2026-03-16.md`
3. Contact map: `docs/planning/lane-f-contact-map-2026-03-16.md`
4. Evidence index: `docs/planning/evidence/lane-f/README.md`

## Lane C Master Checklist

Canonical plan: `docs/planning/lane-c-master-plan-2026-03-16.md`  
Concrete sequencing: `docs/planning/lane-c-execution-plan-2026-03-16.md`

### C0: Baseline Lock

- [ ] Capture baseline outputs for `lint`, `type-check`, `build`, `docs:check`, `test`.
- [ ] Freeze Lane C non-goals and fragile-path inventory scope.

### C1: Characterization Capture

- [ ] Capture one failing and one passing Styles-drop payload packet.
- [ ] Convert capture packets into fixture-backed regression tests before behavior edits.

### C2-C5: Contract Armor

- [ ] Lock generation/recovery/billing fragile-path command bundles.
- [ ] Lock shared-browser isolation and adaptive cross-surface parity bundles.
- [ ] Lock internal operational route/auth contract bundles.

### C6: Convergence

- [ ] Publish required Lane C command bundle for fragile-path PRs.
- [ ] Attach all required evidence packets under `docs/planning/evidence/lane-c/`.

## Lane D Master Checklist

Canonical plan: `docs/planning/lane-d-master-plan-2026-03-16.md`  
Tracker contract: `docs/planning/lane-d-tracker-spec-2026-03-16.md`  
Concrete sequencing: `docs/planning/lane-d-execution-plan-2026-03-16.md`

### D0: Baseline Lock

- [ ] Capture baseline outputs for `lint`, `type-check`, `build`, `docs:check`, and `test`.
- [ ] Capture warning and suppression inventory for Lane D runtime seams.
- [ ] Freeze Lane D non-goals and rollback posture.

### D1-D2: Effect/Suppression Hardening

- [ ] Resolve active `react-hooks/set-state-in-effect` warnings in scoped production seams.
- [ ] Remove scoped suppression debt where equivalent safe behavior can be preserved.
- [ ] Add/extend targeted tests for touched seams.

### D3-D4: Hard-Disable + Logging Hygiene

- [ ] Replace unconditional emergency hard-disable branches with governed controls or retire dead fallback code.
- [ ] Gate runtime debug/audit console logging to explicit audit lanes.
- [ ] Record kill-switch delta and rollback notes for each slice.

### D5: Convergence

- [ ] Publish Lane D runtime safety command bundle and evidence references.
- [ ] Attach all required evidence packets under `docs/planning/evidence/lane-d/`.
- [ ] Confirm warning/suppression targets are closed or deferred with owner/date.

## Lane E Master Checklist

Canonical plan: `docs/planning/lane-e-master-plan-2026-03-16.md`  
Tracker contract: `docs/planning/lane-e-tracker-spec-2026-03-16.md`

### E0: Governance Bootstrap

- [ ] Capture baseline outputs for `docs:check` and scoped validation commands.
- [ ] Wire Lane E artifacts in roadmap/tracker/docs indexes.
- [ ] Freeze Lane E non-goals and rollback posture.

### E1: Index Parity Contract

- [ ] Lock active index parity for scoped root/section indexes.
- [ ] Define explicit allowlist/sunset policy for intentional exclusions only.
- [ ] Record before/after drift counts in tracker evidence.

### E2-E3: ADR + Policy Contract

- [ ] Resolve ADR inventory integrity drift (including duplicate-number handling).
- [ ] Align active policy docs/templates/scripts to one Supabase operations contract.
- [ ] Keep archive/evidence docs excluded from active-surface enforcement unless explicitly promoted.

### E4-E5: Changelog + Convergence

- [ ] Normalize changelog structure so chronology and non-future-date checks are enforceable.
- [ ] Promote Lane E checks to enforce mode after required green cycles.
- [ ] Attach all required evidence packets under `docs/planning/evidence/lane-e/`.
- [ ] Confirm Lane E exit metrics are all `0` drift (or explicit tracked exclusions only).

## Lane F Master Checklist

Canonical plan: `docs/planning/lane-f-master-plan-2026-03-16.md`  
Tracker contract: `docs/planning/lane-f-tracker-spec-2026-03-16.md`

### F0: Baseline Lock

- [ ] Capture baseline snapshots for CI job inventory, required-check mapping, mode variables, ruleset/branch-protection API state, and environment protection state.
- [ ] Wire Lane F artifacts in roadmap/tracker/docs indexes.
- [ ] Freeze Lane F non-goals and rollback posture.

### F1-F2: CI Inventory + Plan-Limited Enforcement Contract

- [ ] Eliminate CI inventory drift between `.github/workflows/*.yml` and `docs/planning/ci-policy-checks.md`.
- [ ] Add missing `agent_rollback_verification` + mode-variable policy coverage in CI policy docs.
- [ ] Lock required-check/job-ID mapping contract and change-control procedure.
- [ ] Publish explicit compensating controls for plan-limited branch/ruleset enforceability.

### F3-F5: Reliability + Supply Chain + Environment Protection

- [ ] Define and apply workflow reliability policy (including concurrency posture and merge-queue readiness policy).
- [ ] Implement phased workflow action pinning policy and exception tracking.
- [ ] Align environment protection and deployment-gate policy state across release/deployment docs.
- [ ] Define canonical environment namespace policy (`staging`/`production`) and resolve naming-variant drift.

### F6: Ownership + Convergence

- [ ] Normalize ownership identity across operator map/contact map/CODEOWNERS surfaces.
- [ ] Attach all required evidence packets under `docs/planning/evidence/lane-f/`.
- [ ] Confirm Lane F exit criteria with two post-change green cycles.

## Parallel Track Artifacts

1. Master plan: `docs/planning/generation-pipeline-hardening-master-plan-2026-03-16.md`
2. Tracker spec: `docs/planning/generation-pipeline-hardening-tracker-spec-2026-03-16.md`
3. Contact map: `docs/planning/generation-pipeline-hardening-contact-map-2026-03-16.md`

## Notes Log

### 2026-03-16

- Tracker initialized to coordinate foundational lanes across governance, modularization, and regression-armor workstreams.
- Added separate Track P1 (generation pipeline hardening) with dedicated plan/tracker/contact artifacts and lane-boundary isolation from Lane B modularization.
- Added Lane C plan/tracker artifacts and updated program snapshot with a concrete Lane C checkpoint path.
- Added Lane C concrete execution plan artifact and lane-specific evidence packet index.
- Added Lane D master plan/tracker artifacts, connected roadmap/tracker references, and seeded a Lane D evidence namespace.
- Added Lane D concrete execution plan artifact and linked it across roadmap/tracker/index surfaces.
- Added Lane E master plan/tracker artifacts, connected roadmap/tracker/index surfaces, and seeded a Lane E evidence namespace.
- Added Lane F contact map artifact to seed owner/escalation routing for release and CI discipline planning.
- Added Lane F master plan/tracker artifacts and seeded a Lane F evidence namespace for CI/release governance execution.
- Added foundation rebuild playbook artifact and made it mandatory for from-scratch replacement scopes across lanes/tracks.
- Started Lane A A0 baseline lock and captured baseline evidence packet:
  - `docs/planning/evidence/lane-a/2026-03-16-a0-01-baseline-lock.md`
- Completed Lane A A1 naming gate recovery slice and validated green `validate` path:
  - `docs/planning/evidence/lane-a/2026-03-16-a1-01-naming-gate-recovery.md`
- Completed Lane A A1 size-budget recovery seam by extracting AI Studio perf runtime registration from page orchestration:
  - `docs/planning/evidence/lane-a/2026-03-16-a1-02-size-budget-gate-recovery.md`
- Completed Lane A A1 validate relock packet to capture fresh post-governance gate state:
  - `docs/planning/evidence/lane-a/2026-03-16-a1-03-validate-path-relock.md`
- Completed Lane A A2 policy-surface alignment packet and confirmed scoped Supabase policy contract parity:
  - `docs/planning/evidence/lane-a/2026-03-16-a2-01-policy-surface-alignment.md`
- Continued Lane B B2-01 seam extraction by moving Expert Edit viewport/zoom/pan utilities into a dedicated helper module:
  - `docs/planning/evidence/lane-b/2026-03-16-b2-01-expert-edit-seam-2.md`
- Continued Lane B B2-01 seam extraction by moving Expert Edit layer-transform/history/geometry primitives into a dedicated helper module:
  - `docs/planning/evidence/lane-b/2026-03-16-b2-01-expert-edit-seam-3.md`

### 2026-03-17

- Continued Lane B B2-01 seam extraction by moving Expert Edit cursor-reticle builders into a dedicated helper module:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-4.md`
- Continued Lane B B2-01 seam extraction by moving Expert Edit layer/session initialization and layer-stack normalization helpers into a dedicated helper module:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-5.md`
- Continued Lane B B2-01 seam extraction by moving Expert Edit interaction helpers (transform pointer session, keyboard editable-target guard, stage context-menu position resolver) into a dedicated helper module:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-6.md`
- Continued Lane B B2-01 seam extraction by moving Expert Edit transform gesture mode/session/update math into a dedicated helper module:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-7.md`
- Continued Lane B B2-01 seam extraction by moving layer reorder/delete transition logic into layer-session helper utilities:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-8.md`
- Continued Lane B B2-01 seam extraction by moving stage context-menu remove-image layer reset mapping into layer-session helper utilities:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-9.md`
- Continued Lane B B2-01 seam extraction by moving generation-mode rail mapping and inpaint-collapse decision logic into interaction helper utilities:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-10.md`
- Continued Lane B B2-01 seam extraction by moving repeated timeout clear/null-reset logic into interaction helper utilities:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-11.md`
- Continued Lane B B2-01 seam extraction by moving transient object-URL revoke timer scheduling/cleanup into interaction helper utilities:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-12.md`
- Continued Lane B B2-01 seam extraction by moving global document cursor lock/unlock behavior into interaction helper utilities:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-13.md`
- Continued Lane B B2-01 seam extraction by moving session dispatch RAF schedule/cancel behavior into interaction helper utilities:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-14.md`
- Continued Lane B B2-01 seam extraction by moving owned-layer image URL collection and stale diff behavior into layer-session helper utilities:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-15.md`
- Continued Lane B B2-01 seam extraction by moving selected-layer index bounds/normalization behavior into layer-session helper utilities:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-16.md`
- Continued Lane B B2-01 seam extraction by moving prompt textarea mirror-scroll/auto-resize/caret-clamp behavior into interaction helper utilities:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-17.md`
- Continued Lane B B2-01 seam extraction by moving repeated event-target containment checks into interaction helper utilities:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-18.md`
- Continued Lane B B2-01 seam extraction by moving repeated inpaint-stage terminal pointer sequencing into interaction helper utilities and locking the Lane B seam-selection rubric:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-19.md`
- Continued Lane B B2-01 seam extraction by removing pass-through move-stage closures and collapsing duplicated markup middle-click suppression handlers:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-20.md`
- Continued Lane B B2-01 seam extraction by removing duplicated transform terminal callbacks and collapsing markup terminal stage routing:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-21.md`
- Continued Lane B B2-01 seam extraction by centralizing pointer-capture release/check logic used by markup pan/draw and transform terminal flows:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-22.md`
- Continued Lane B B2-01 seam extraction by consolidating local markup pan reset behavior across recenter, terminal, leave, and tool-exit paths:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-23.md`
- Captured Lane B B2-01 hotspot map to shift from low-yield micro-seams toward boundary-driven extraction planning inside `ExpertEditPanelView.tsx`:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-hotspot-map.md`
- Continued Lane B B2-01 with the first hotspot-map-driven boundary extraction by moving markup draw lifecycle control into a dedicated hook and bringing `ExpertEditPanelView.tsx` below the warn-mode size budget:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-24.md`
- Continued Lane B B2-01 with the paired hotspot-map-driven boundary extraction by moving markup viewport/pan lifecycle control into a dedicated hook and further reducing `ExpertEditPanelView.tsx`:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-25.md`
- Continued Lane B B2-01 with a third hotspot-map-driven boundary extraction by moving move-stage transform lifecycle control into a dedicated hook and further reducing `ExpertEditPanelView.tsx`:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-01-expert-edit-seam-26.md`
- Completed B2-01 stop-condition review and moved Lane B focus to `useInpaintMaskController.ts` with a characterization-first hotspot map:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-02-inpaint-controller-hotspot-map.md`
- Opened B2-02 with a characterization-lock slice covering inpaint snapshot/export/clear hook behavior:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-02-inpaint-characterization-lock.md`
- Continued B2-02 with the first production extraction by moving inpaint geometry and mask-space math into a dedicated helper module:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-02-inpaint-geometry-split.md`
- Continued B2-02 with the second production extraction by moving contour derivation and overlay rendering into a dedicated helper module and bringing `useInpaintMaskController.ts` below warn budget:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-02-inpaint-overlay-split.md`
- Completed the `B2-02` checkpoint review and moved Lane B focus to `MediaLibraryPanel.tsx` with a hotspot-map-first handoff:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-02-inpaint-checkpoint-review.md`
  - `docs/planning/evidence/lane-b/2026-03-17-b2-03-media-library-hotspot-map.md`
- Continued `B2-03` with the first production extraction by moving media/prompt query loading and infinite-scroll refresh orchestration into a dedicated controller hook:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-03-media-library-loader-controller-split.md`
- Continued `B2-03` with the second production extraction by moving folder assignment, upload, and delete-confirm mutation workflows into a dedicated controller hook and bringing `MediaLibraryPanel.tsx` below warn budget:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-03-media-library-mutation-controller-split.md`
- Continued `B2-03` with the third production extraction by moving preview-modal and selection orchestration into a dedicated controller hook and further reducing `MediaLibraryPanel.tsx`:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-03-media-library-selection-controller-split.md`
- Completed the `B2-03` checkpoint review and moved Lane B focus to `CharacterManagerShell.tsx` with a hotspot-map-first handoff:
  - `docs/planning/evidence/lane-b/2026-03-17-b2-03-media-library-checkpoint-review.md`
  - `docs/planning/evidence/lane-b/2026-03-17-b3-01-character-shell-hotspot-map.md`
- Continued `B3-01` with the first production extraction by moving shell-local view state and responsive layout control into a dedicated controller hook:
  - `docs/planning/evidence/lane-b/2026-03-17-b3-01-character-shell-view-state-split.md`
- Continued `B3-01` with the second production extraction by moving dropped-reference resolution, ingestion, and pending-drop ownership into a dedicated controller hook and bringing `CharacterManagerShell.tsx` below warn budget:
  - `docs/planning/evidence/lane-b/2026-03-17-b3-01-character-shell-drop-reference-controller-split.md`
- Completed Lane A A3 docs-governance cleanup packet (API route-table dedupe, index parity repair, migration-reference drift correction):
  - `docs/planning/evidence/lane-a/2026-03-16-a3-01-docs-governance-cleanup.md`
- Completed Lane A A4-01 conservative dead-code pass (safe wrapper/dependency removals + active docs/skill sync):
  - `docs/planning/evidence/lane-a/2026-03-16-a4-01-conservative-deadcode-pass.md`
- Completed Lane A A4-02 selective dead-code pruning (remaining high-confidence dead modules removed; production deadcode gate green):
  - `docs/planning/evidence/lane-a/2026-03-16-a4-02-selective-pruning-pass.md`
- Completed Lane A A5 signoff and handed deferred debt to downstream lanes:
  - `docs/planning/evidence/lane-a/2026-03-16-a5-01-lane-signoff.md`
- Completed Lane B B0-01 governance bootstrap (ADR + SOP extraction checklist + roadmap/tracker/evidence alignment):
  - `docs/planning/evidence/lane-b/2026-03-16-b0-01-governance-bootstrap.md`
- Completed Lane B B1-01 guardrail bootstrap (Lane B size-budget modes + boundary/cycle mode wiring in check scripts):
  - `docs/planning/evidence/lane-b/2026-03-16-b1-01-guardrail-bootstrap.md`
- Started Lane B B2-01 Expert Edit seam extraction; moved Character Picker modal plus preset/blob/canvas/color helpers into dedicated edit modules with parity checks green:
  - `docs/planning/evidence/lane-b/2026-03-16-b2-01-expert-edit-seam-1.md`
