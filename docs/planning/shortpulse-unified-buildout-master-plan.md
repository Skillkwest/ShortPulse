# ShortPulse Unified Build-Out Master Plan

Last updated: 2026-03-01  
Authority: Working  
Owner: Engineering

## Summary
This plan unifies all active implementation tracks into one sequenced, low-risk, no-bloat delivery program.

Program outcomes:
1. Security hardening first.
2. Runtime correctness and queue/recovery integrity second.
3. Modular decoupling third.
4. Billing/admin correctness fourth.
5. Fal video -> Kie video migration only after hardening baselines are green.
6. Documentation and evidence are required deliverables for every phase.

## Locked Decisions
1. Auth is token-first and fail-closed.
2. Current queue/recovery migrations `036`, `037`, `038` are baseline and are not reimplemented.
3. `/api/fal/queue-status` dispatch side effect is temporary; end state is read-only status resolution.
4. Kie migration begins only after auth/runtime/security/billing phases are stable.
5. No broad rewrites. Only targeted modular extraction in validated hotspots.
6. Forward-only migration policy with explicit rollback guidance where applicable.
7. No phase closes without code + tests + docs + evidence.

## Program Structure
1. Delivery cadence: small PR slices, one objective per PR.
2. Branch policy: short-lived branches from integration branch; merge only on green gates.
3. Human checkpoint required at phase exit.
4. One canary risk surface at a time.
5. Rollback is phase-slice based, not program-wide rollback.

## Pre-Canary Execution Policy
1. Continue implementation work before canary windows complete when sequencing override is active (Decision 008).
2. Keep canary/signoff checkpoint decisions bound to scheduled UTC windows only.
3. Mark deferred windows explicitly as deferred by schedule, not blocked by engineering readiness.
4. Preserve Fal public/API contracts and keep Kie cutover disabled by default until checkpoint gates pass.

## Phase Sequence
| Phase | Title | Status | Priority |
| --- | --- | --- | --- |
| 00 | Baseline Stabilization + Incident Hygiene | In Progress | P0 |
| 01 | Guardrail and CI Accuracy Repair | In Progress | P0 |
| 02 | Auth Boundary Hardening + Admin Access Decoupling | Completed | P0 |
| 03 | Queue/Recovery Transition Integrity Completion | Completed | P0 |
| 04 | Video Runtime Hardening Residuals | Deferred | P1 |
| 05 | Media Library Security-First Hardening | In Progress | P1 |
| 06 | Character Workflow Hardening | In Progress | P1 |
| 07 | AI Studio Foundation Modularization | In Progress | P1 |
| 08 | Billing/Stripe Correctness Hardening | Completed | P1 |
| 09 | Admin Hardening | Completed | P1 |
| 10 | Security Residual Controls | Completed | P1 |
| 11 | Fal Video -> Kie Video Migration | In Progress | P2 |
| 12 | Cleanup + Decommission | In Progress (Prep) | P2 |

## Phase Details
Detailed execution checklists live in:
1. `docs/planning/stages/unified-phase-00-baseline-stabilization-and-incident-hygiene.md`
2. `docs/planning/stages/unified-phase-01-guardrail-and-ci-accuracy-repair.md`
3. `docs/planning/stages/unified-phase-02-auth-boundary-hardening-and-admin-access-decoupling.md`
4. `docs/planning/stages/unified-phase-03-queue-recovery-transition-integrity-completion.md`
5. `docs/planning/stages/unified-phase-04-video-runtime-hardening-residuals.md`
6. `docs/planning/stages/unified-phase-05-media-library-security-first-hardening.md`
7. `docs/planning/stages/unified-phase-06-character-workflow-hardening.md`
8. `docs/planning/stages/unified-phase-07-ai-studio-foundation-modularization.md`
9. `docs/planning/stages/unified-phase-08-billing-stripe-correctness-hardening.md`
10. `docs/planning/stages/unified-phase-09-admin-hardening.md`
11. `docs/planning/stages/unified-phase-10-security-residual-controls.md`
12. `docs/planning/stages/unified-phase-11-fal-to-kie-video-migration.md`
13. `docs/planning/stages/unified-phase-12-cleanup-and-decommission.md`

### Phase 00: Baseline Stabilization and Incident Hygiene
Scope:
1. Fix active baseline blockers (`type-check`, broken fixtures, failing test contracts).
2. Confirm runtime baseline health after queue/recovery hardening commits.
3. Execute incident-response secret hygiene (rotate/revoke exposed keys in environments).
Deliverables:
1. Green baseline validation packet.
2. Secret rotation incident note and runbook updates.
Exit gate:
1. `lint`, `type-check`, targeted runtime tests, `build`, and `docs:check` are all green.
2. Operational secret rotation completed by environment owners.

### Phase 01: Guardrail and CI Accuracy Repair
Scope:
1. Remove stale CI path filters and stale size-budget/naming references.
2. Ensure `type_check` and secret-scan lanes are present, accurate, and policy mapped.
Deliverables:
1. Updated `docs/planning/ci-policy-checks.md`.
2. Guardrail drift evidence in phase folder.
Exit gate:
1. No false pass/fail behavior from stale file targeting.
2. Branch protection names and CI job IDs map exactly.

### Phase 02: Auth Boundary Hardening and Admin Access Decoupling
Scope:
1. Enforce strict bearer verification for protected routes.
2. Remove header-only trust path from `requireApiUser`.
3. Add admin access contract decoupled from heavy admin endpoints.
Deliverables:
1. Updated auth/admin route tests (spoof/mismatch/no-token/happy path).
2. API docs and security checklist updates.
Exit gate:
1. Proxy header spoofing cannot authorize requests.
2. Admin role/allowlist flows remain functional.

### Phase 03: Queue/Recovery Transition Integrity Completion
Scope:
1. Enforce checked mutation outcomes for queue transitions.
2. Require reservation and generation updates before queue removal.
3. Add deterministic compensation on partial transition failure.
Deliverables:
1. Transition guard helper/module.
2. Failure-mode matrix tests.
3. SOP updates with queue blocker diagnostics usage.
Exit gate:
1. No silent queue item loss or duplicate claim behavior under fault injection.

### Phase 04: Video Runtime Hardening Residuals
Scope:
1. Trusted URL policy for provider probing and ingestion routes.
2. Restrict auth headers to trusted provider domains.
3. Move `/api/fal/queue-status` to read-only end state after staged canary.
Deliverables:
1. Trusted URL policy module + tests.
2. Queue-status rollout and rollback runbook.
Exit gate:
1. Read-only queue-status validated in staging/canary with no threshold regression.

### Phase 05: Media Library Security-First Hardening
Scope:
1. Server-authoritative media upload route/service.
2. Client upload migration behind feature flag.
3. Centralized preview trust policy and host restrictions.
4. Modal/page query model unification and scope drift fixes.
Deliverables:
1. Media security phase docs and SOP updates.
2. Upload/resolve preview security regression tests.
Exit gate:
1. Hardened upload path no longer trusts client classification for persistence.

### Phase 06: Character Workflow Hardening
Scope:
1. Cross-surface selection synchronization and reconciliation.
2. Fail-block validation enforcement.
3. DnD trust hardening while preserving local/internal drop flows.
Deliverables:
1. Character workflow tests for drag-drop, stale bundle safety, and signed URL chunking.
2. Character SOP update.
Exit gate:
1. No stale/deleted character injection path.
2. External arbitrary URL drops blocked.

### Phase 07: AI Studio Foundation Modularization
Scope:
1. Move pricing/model contracts to runtime-owned modules.
2. Remove server imports from `features/ai-studio/*`.
3. Invert hook contracts and extract hotspot task policy modules.
Deliverables:
1. Architecture boundary evidence.
2. Size/complexity reduction evidence.
Exit gate:
1. Server-to-feature boundary violations are zero.
2. Hook/page behavior parity is maintained.

### Phase 08: Billing and Stripe Correctness Hardening
Scope:
1. Durable event claim lifecycle and strict idempotency.
2. Replay-safe processing for failed-first webhook events.
3. Customer bootstrap-safe profile portal/subscription entry.
Deliverables:
1. Stripe domain module docs and recovery runbook.
2. Webhook conflict/replay/idempotency tests.
Exit gate:
1. Duplicate deliveries cannot produce duplicate side effects.

### Phase 09: Admin Hardening
Scope:
1. Atomic incident status transitions.
2. Shared admin client logic extraction and access consistency.
Deliverables:
1. Admin API docs and route tests.
2. ADR only if trust-boundary contract materially changes.
Exit gate:
1. No partial incident status state in failure paths.

### Phase 10: Security Residual Controls
Scope:
1. Webhook body-size caps (`413`).
2. Safe API error surface with no internal transport leaks.
3. Describe-image non-local allowlist fail-closed behavior.
4. Runtime SQL security audit integration.
Deliverables:
1. Security and deployment checklist updates.
2. Residual security hardening tests.
Exit gate:
1. Security tests and staging audits are clean.

### Phase 11: Fal to Kie Video Migration
Scope:
1. Provider-neutral adapter contract implementation.
2. Kie dark adapter and canonical request-id mapping.
3. Shadow parity, canary ramps, cutover, and retirement window.
Deliverables:
1. Provider parity scoreboards and migration evidence.
2. Provider-generic incident SOP updates.
Exit gate:
1. Success-rate and reliability thresholds pass.
2. Billing mismatch remains zero.

### Phase 12: Cleanup and Decommission
Scope:
1. Remove temporary compatibility shims and obsolete rollout flags.
2. Retire expired rollback branches and stale docs.
Deliverables:
1. Final validation summary and decommission checklist.
2. Completed unified tracker status.
Exit gate:
1. No stale compatibility paths remain.
2. Two consecutive green release cycles post-cleanup.

## Important Public API and Interface Changes
1. Existing `/api/fal/*` and `/api/ai/*` contracts remain stable until Phase 11 cutover.
2. Planned additive surfaces:
   1. `GET /api/admin/access`.
   2. `POST /api/media/upload`.
3. Internal contracts:
   1. Strict verified principal in auth helpers.
   2. Checked queue/recovery transition result shapes.
   3. Provider-neutral runtime submit/status/recovery contracts.
   4. Runtime-owned pricing/model exports replacing feature-owned server imports.

## Core Test Matrix
1. Auth/security:
   1. spoofed header rejection.
   2. bearer mismatch precedence.
2. Queue/recovery:
   1. transition compensation and claim safety.
   2. exhaustion/cleanup integrity.
3. Runtime status and trust:
   1. queue-status read-only behavior.
   2. trusted URL policy enforcement.
4. Media:
   1. MIME/signature mismatch rejection.
   2. modal/route parity and preview host trust.
5. Billing/admin:
   1. webhook idempotency and replay recovery.
   2. atomic incident transition tests.
6. Migration:
   1. callback-first/poll-first convergence.
   2. mixed Fal+Kie workloads with zero billing mismatch.

## Required Research Protocol
Targeted research is mandatory only when external contracts are authoritative:
1. Stripe webhook/idempotency phases: official Stripe docs.
2. Kie adapter phases: official Kie API and callback signature docs.
3. Scheduler/auth posture phases: Vercel cron + Supabase scheduler/auth docs.
4. CI policy phases: GitHub protected branch/merge queue docs.

Research note requirements:
1. Add a short note under `docs/planning/evidence/unified-buildout/phase-XX/`.
2. Include source links, implementation decision, and impact on code/tests.
3. Prefer primary vendor docs over tertiary blog/forum guidance.

## Global Regression and Rollback Gates
1. Success-rate regression <= 0.5 percentage points vs baseline.
2. Billing mismatch tolerance = 0.
3. Callback verification failures < 1% sustained.
4. Recovery backlog p95 age <= baseline + 10%.
5. Any threshold failing two consecutive windows triggers rollback for the active phase slice.

## Baseline Operations Blockers
1. Type-check must stay green.
2. Exposed credentials must be rotated and old credentials revoked.
3. No stale compatibility path may remain after Phase 12.

## Assumptions
1. Current queue/recovery commits and migrations are accepted baseline.
2. Security-first ordering is mandatory.
3. No broad UI redesign is part of this program.
4. No mega-PRs; all execution is batch-based and validated.

## Evidence Index
Phase evidence lives under `docs/planning/evidence/unified-buildout/`.
