# Lane C Execution Plan (2026-03-16)

Last updated: 2026-03-17  
Status: active  
Owner: Engineering  
Master plan: `docs/planning/lane-c-master-plan-2026-03-16.md`  
Tracker spec: `docs/planning/lane-c-tracker-spec-2026-03-16.md`  
Evidence root: `docs/planning/evidence/lane-c/`

## Purpose
Convert Lane C from strategy into concrete, execution-ready slices with explicit commands, evidence packets, and merge gates.

## Scope Lock
In scope:
1. Characterization captures and fixture-backed regression tests for fragile paths.
2. Contract/no-regression assertions for generation, recovery, billing, and session-isolation seams.
3. Cross-surface parity and internal-route contract guard strengthening.

Out of scope:
1. Product behavior changes.
2. Large rendering architecture rebuilds (`media-optimization-*` tracks).
3. Modularization refactors that belong to Lane B.
4. Generation payload/queue behavior changes owned by Track P1 (`generation-pipeline-hardening-*`).

## Slice Backlog
| Slice ID | Phase | Fragile Surface | Primary Goal | Primary Evidence Artifact | Status |
| --- | --- | --- | --- | --- | --- |
| `C0-01` | C0 | Baseline lock | Capture baseline command outputs and lock non-goals | `docs/planning/evidence/lane-c/2026-03-17-c0-01-baseline-lock.md` | Completed |
| `C1-01` | C1 | Reference Grid -> Styles drop | Capture one failing and one passing real payload packet | `docs/planning/evidence/lane-c/2026-03-17-c1-01-style-drop-characterization.md` | Blocked |
| `C1-02` | C1 | Reference Grid -> Styles drop | Convert captured packets into deterministic fixture tests | `docs/planning/evidence/lane-c/2026-03-16-c1-02-style-drop-fixture-lock.md` | Not Started |
| `C2-01` | C2 | Generation lifecycle | Consolidate no-regression contract suite for submit/queue/status/recovery | `docs/planning/evidence/lane-c/2026-03-16-c2-01-generation-contract-bundle.md` | Not Started |
| `C2-02` | C2 | Billing settlement | Assert reserve/attach/capture-release invariants under failure paths | `docs/planning/evidence/lane-c/2026-03-16-c2-02-billing-settlement-assertions.md` | Not Started |
| `C3-01` | C3 | Shared-browser isolation | Add same-browser account-switch isolation matrix and assertions | `docs/planning/evidence/lane-c/2026-03-16-c3-01-shared-browser-isolation-matrix.md` | Not Started |
| `C4-01` | C4 | Adaptive cross-surface parity | Re-lock cross-surface parity assertions and gate results | `docs/planning/evidence/lane-c/2026-03-16-c4-01-adaptive-cross-surface-parity.md` | Not Started |
| `C5-01` | C5 | Internal operational routes | Lock internal route/auth envelope and operator-path assertions | `docs/planning/evidence/lane-c/2026-03-16-c5-01-internal-operational-contracts.md` | Not Started |
| `C6-01` | C6 | Lane gate convergence | Publish required Lane C command bundle and promotion decision | `docs/planning/evidence/lane-c/2026-03-16-c6-01-lane-gate-convergence.md` | Not Started |

Policy:
1. Lane C slices remain test/fixture/governance-only unless a slice explicitly declares approved behavior changes.
2. If behavior changes are required for a fragile path, that work must be routed to the owning lane/track and referenced from Lane C evidence.

## Execution Detail
### C0-01 Baseline Lock
Commands:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run test`

Acceptance:
1. All baseline commands pass.
2. Lane C non-goals are frozen for this run.
3. Evidence packet records command outputs and repo SHA.

### C1-01 Styles-Drop Characterization Capture
Capture both pass and fail packets with:
1. drag transfer payload keys (`text/reference-origin`, `text/reference-output-id`, `text/reference-media-id`, URL candidates),
2. resolver metadata (`classifier_reason`, `resolution_stage`, `resolution_reason`, `candidate_count`, `server_copy_attempted`),
3. fallback route behavior (`POST /api/media/copy-from-url` request/response summary),
4. UI outcome and telemetry message (`style_extraction.*`).
Preferred capture command:
1. `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:style-drop`

Acceptance:
1. One failing packet and one passing packet are recorded.
2. Packet includes timestamps and environment/flag context.
3. No code behavior change is merged in this slice.
4. If either packet is missing, `C1-02` is blocked.
5. If runtime packet capture cannot be completed from repo-local evidence alone, the slice must move to `Blocked` with explicit owner and unblock criterion rather than be marked complete by inference.

### C1-02 Fixture Lock
Implementation target:
1. add fixture-backed tests in existing style-creator suites.

Acceptance:
1. Captured pass/fail packets are represented by deterministic tests.
2. Failing packet asserts expected blocked/fail-closed path.
3. Passing packet asserts expected successful path.

### C2-01 Generation Contract Bundle
Targeted command bundle:
1. `npm -C frontend run test -- tests/api/fal-queue-status.test.ts tests/api/internal-generation-recovery-run.test.ts tests/api/admin-generation-recovery-replay.test.ts tests/api/generation-submit-persistence.test.ts`

Acceptance:
1. Contract assertions remain deterministic.
2. Route ownership/auth and status/recovery envelope behavior remain unchanged.

### C2-02 Billing Settlement Assertions
Targeted command bundle:
1. `npm -C frontend run test -- tests/api/generation-billing.reservations.test.ts tests/api/credits-snapshot.test.ts tests/api/admin-user-health.test.ts tests/api/admin-user-health-fleet.test.ts`

Acceptance:
1. Reserve/attach/capture-release invariants remain locked.
2. Drift checks are documented in evidence packet.

### C3-01 Shared-Browser Isolation Matrix
Targeted command bundle:
1. `npm -C frontend run test -- features/ai-studio/logic/__tests__/sessionPersistencePolicy.test.ts features/ai-studio/logic/__tests__/sessionShadowPersistence.test.ts features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts features/character-manager/hooks/__tests__/useCharacterQuickSwapTipPreference.test.ts`

Acceptance:
1. Same-browser account-switch isolation matrix is documented.
2. Owner/scope mismatch restore behavior is asserted.

### C4-01 Adaptive Cross-Surface Parity
Command:
1. `npm -C frontend run test:adaptive-v2-gate`

Acceptance:
1. Cross-surface parity bundle passes.
2. Any residual non-blockers are documented with owner/date.

### C5-01 Internal Operational Contract Lock
Targeted command bundle:
1. `npm -C frontend run test -- tests/api/internal-route-inventory-regression.test.ts tests/api/internal-generation-recovery-run.test.ts tests/api/internal-admin-user-health-fleet-run.test.ts`

Acceptance:
1. Internal route inventory/auth contracts are stable.
2. Evidence packet maps results to relevant `docs/operator-map.md` systems.

### C6-01 Lane Gate Convergence
Output:
1. Promote Lane C command bundle into required reviewer checklist for fragile-path PRs.
2. Update `.github/pull_request_template.md` with Lane C fragile-path checklist section.
3. Update `docs/planning/ci-policy-checks.md` with Lane C gate policy mapping.
4. Record promotion decision and fallback policy.

Acceptance:
1. Command bundle is explicitly documented and linked in tracker notes.
2. Lane C status can move from `Not Started` to `In Progress` with C0-C1 complete evidence.

## Merge Gates (Per Slice)
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. Targeted test bundle for the slice

## Lane-Level Exit Gates
1. `npm -C frontend run test`
2. `npm -C frontend run test:adaptive-v2-gate` (when protected adaptive/reference-grid surfaces are touched)
3. All slice evidence packets present under `docs/planning/evidence/lane-c/`
4. Tracker rows complete per `lane-c-tracker-spec-2026-03-16.md`
