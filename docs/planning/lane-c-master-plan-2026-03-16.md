# Lane C Master Plan (2026-03-16)

Last updated: 2026-03-17  
Status: Active  
Owner: Engineering  
Roadmap anchor: `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`  
Tracker anchor: `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`  
Tracker spec: `docs/planning/lane-c-tracker-spec-2026-03-16.md`
Execution plan: `docs/planning/lane-c-execution-plan-2026-03-16.md`
Evidence index: `docs/planning/evidence/lane-c/README.md`

## Summary
Lane C builds regression armor for known fragile paths before behavior-changing work in downstream lanes/tracks.

Locked intent:
1. Characterization-first for unstable or incident-prone paths.
2. Contract tests for route/runtime boundaries that must not drift.
3. Explicit shared-browser/user-scope isolation checks.
4. No behavior changes by default; this lane adds tests, fixtures, and gate wiring.

Concrete slice sequencing, command bundles, and evidence packet requirements live in:
- `docs/planning/lane-c-execution-plan-2026-03-16.md`

## Baseline Findings (Audit Snapshot)
As of 2026-03-17:
1. `C0-01` is complete and the baseline command bundle is locked at a known-green repo SHA.
2. Lane C is currently blocked at `C1-01`, not because of missing repo context, but because one failing and one passing real style-drop packet still need to be captured from runtime.
3. Test depth is high (`415` test files / `2622` tests in the `C0-01` baseline run), but fragile-path execution bundles are fragmented.
4. Only two credentialed Playwright audit scripts exist (`tests/e2e/ai-studio-perf.audit.js`, `tests/e2e/character-pipeline.audit.js`); they are not a complete fragile-path matrix.
5. Known P0 deferred incident remains open and explicitly requires characterization-first captured payload fixtures before further fixes:
   - `docs/known-issues.md` (Reference Grid -> Styles internal drop reliability).
6. Multiple high-risk operational systems exist in `docs/operator-map.md` (generation queue/recovery, credits settlement, webhook path, admin user-health fleet) and need a locked no-regression assertion bundle.

## Current Execution State
1. `C0-01` baseline evidence is recorded in `docs/planning/evidence/lane-c/2026-03-17-c0-01-baseline-lock.md`.
2. `C1-01` capture prep and blocker state are recorded in `docs/planning/evidence/lane-c/2026-03-17-c1-01-style-drop-characterization.md`.
3. `C1-01` capture harness bootstrap is recorded in `docs/planning/evidence/lane-c/2026-03-17-c1-01-style-drop-capture-harness-bootstrap.md`.
4. `C1-02` remains blocked until the real pass/fail packet captures are attached.

## Fragile Path Inventory (Lane C Scope)
1. AI Studio internal reference -> Styles drop intake/resolution chain.
2. Generation lifecycle contract chain:
   - submit -> queue-status -> status/webhook -> recovery -> settlement.
3. Credits reservation/capture/release invariants and generation billing surfaces.
4. Session persistence and shared-browser user isolation.
5. Adaptive media/reference-grid cross-surface parity behavior.
6. Internal operational route/auth contracts (recovery run, fleet run, route inventory).

## Execution Phases
### C0: Governance Bootstrap
1. Publish Lane C master plan + tracker spec (this artifact pair).
2. Lock fragile-path inventory and non-goals.
3. Capture baseline runs for `lint`, `type-check`, `build`, `docs:check`, `test`.

### C1: Characterization Packet Foundation
1. Create characterization packet standard for fragile-path captures (request payload, transfer payload, resolver trace, outcome).
2. For deferred P0 Styles-drop incident, capture at least one failing and one passing real payload packet.
3. Convert captured packets to deterministic fixture-backed tests before any behavior edits in that path.

### C2: Generation + Settlement Contract Armor
1. Lock contract tests for submit/queue/status/webhook/recovery surfaces.
2. Assert deterministic failure-code behavior and ownership/auth guard behavior on fragile endpoints.
3. Lock reservation lifecycle invariants (reserve -> attach provider request id -> capture/release) with targeted tests.

### C3: Shared-Browser Isolation Armor
1. Add characterization tests for account-switch and owner-scope persistence boundaries in AI Studio session paths.
2. Add matrix tests for local/session scoped key behavior and restore rejection on owner mismatch.
3. Add at least one browser-driven isolation smoke workflow for same-browser logout/login account switch.

### C4: Cross-Surface Parity Armor
1. Strengthen parity tests across Reference Grid, Media Library modal, and Character Manager surfaces for shared reference/runtime behavior.
2. Keep adaptive gate suite (`test:adaptive-v2-gate`) as a required lane command for protected paths.
3. Add regression assertions for route/modal behavior parity where prior incidents occurred.

### C5: Operational Contract Armor
1. Lock internal operational route inventory/auth assertions (`/api/internal/*` + guarded admin diagnostics).
2. Add no-regression tests for recovery/fleet operational route behavior and deterministic response envelopes.
3. Tie lane evidence to `docs/operator-map.md` system rows for triage ownership clarity.

### C6: Convergence And Merge Discipline
1. Publish a curated Lane C regression command bundle (script or documented command group) with no new dependencies.
2. Promote lane commands from ad hoc to required for PRs touching fragile-path inventory.
3. Keep lane closeout blocked until tracker evidence is complete for all in-scope slices.

## Merge Gates
Per slice:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. Targeted fragile-path tests for touched scope

Lane-level required suites (minimum):
1. Styles/drop intake suites:
   - `features/ai-studio/components/style-creator/__tests__/intake.test.ts`
   - `features/ai-studio/components/style-creator/__tests__/internalDropResolver.test.ts`
2. Generation/recovery/billing suites:
   - `tests/api/fal-queue-status.test.ts`
   - `tests/api/internal-generation-recovery-run.test.ts`
   - `tests/api/admin-generation-recovery-replay.test.ts`
   - `tests/api/generation-billing.reservations.test.ts`
   - `tests/api/generation-submit-persistence.test.ts`
3. Session/isolation suites:
   - `features/ai-studio/logic/__tests__/sessionPersistencePolicy.test.ts`
   - `features/ai-studio/logic/__tests__/sessionShadowPersistence.test.ts`
   - `features/character-manager/hooks/__tests__/useCharacterQuickSwapTipPreference.test.ts`
4. Cross-surface parity gate:
   - `npm -C frontend run test:adaptive-v2-gate`

Final gate:
1. `npm -C frontend run test`

## Assumptions And Defaults
1. Lane C is test/governance heavy and should avoid runtime behavior edits unless explicitly approved.
2. No new runtime dependencies are added for this lane.
3. Credentialed browser audits remain opt-in until deterministic non-secret harness coverage is established.
4. Lane C is a prerequisite lane for high-risk behavior changes in Lane D and for fragile-path edits in other active tracks.
