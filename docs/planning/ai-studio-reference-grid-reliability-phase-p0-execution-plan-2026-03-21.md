# AI Studio Reference Grid Reliability Phase P0 Execution Plan (2026-03-21)

Date: 2026-03-21  
Authority: Working  
Owner: AI Studio Engineering  
Status: draft

## Summary
Phase `P0` establishes correctness for recovery dispatch so recoverable generations are not prematurely failed or removed from the Reference Grid lifecycle.

Primary objective:
1. Ensure background recovery actually executes when scheduled.
2. Align queued `not_found` handling between resume watchdog and status-recovery claim paths.
3. Prevent premature terminal removal for rows that are still recoverable.

Master references:
1. `docs/planning/ai-studio-reference-grid-reliability-master-plan-2026-03-21.md`
2. `docs/planning/ai-studio-reference-grid-reliability-master-roadmap-2026-03-21.md`
3. `docs/planning/ai-studio-reference-grid-reliability-master-tracker-2026-03-21.md`
4. `docs/planning/ai-studio-reference-grid-reliability-tracker-spec-2026-03-21.md`
5. `docs/adr/0046-ai-studio-output-visibility-authority-contract.md`
6. `docs/adr/0047-ai-studio-generation-recovery-timing-and-failure-threshold-contract.md`

## Scope Lock
In scope:
1. Recovery timer scheduling and cleanup order in `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`.
2. Queue resume `not_found` aging/retry behavior in `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`.
3. Queue-status recovery-claim policy parity in:
   - `frontend/pages/api/fal/queue-status.ts`
   - `frontend/lib/server/api/generationQueue/statusRecoveryKick.ts`
4. Recovery-eligible output lifecycle retention semantics across submission/orchestration seams.
5. P0 evidence + tracker closeout updates for rows `RGR-M02` through `RGR-M04`.

Out of scope:
1. Bubble-vs-grid authority unification work (`P1`).
2. Hydration/decode fallback convergence work (`P2`).
3. Broad recovery semantics precedence tuning (`P3`) beyond P0 gate fixes.
4. Rollout/canary closeout work (`P4`).

## Entry Criteria
1. `RGR-M01` audit inventory is complete with linked evidence packet.
2. Master plan/roadmap/tracker/spec are indexed in `docs/README.md` and `docs/planning/README.md`.
3. ADR `0046` and `0047` remain non-conflicting with this phase scope.
4. P0 phase tracker rows are approved for execution sequencing.

## Hard Blockers
1. Do not implement hydration-visual polish as a substitute for recovery correctness defects.
2. Do not merge P0 behavior changes without explicit rollback notes per slice.
3. Do not close P0 while `RGR-M02`, `RGR-M03`, or `RGR-M04` lacks evidence links.

## Slice Backlog
| Slice ID | Goal | Primary Surfaces | Deliverable | Status |
| --- | --- | --- | --- | --- |
| `P0-S1` | Remove post-schedule cancellation of recovery timers | `useAiStudioTasks` recovery scheduling + hard-stop handler | Deterministic timer lifecycle contract with no immediate self-cancel path | Planned |
| `P0-S2` | Align `not_found` retry/age policy across client resume and status claim | `useAiStudioTaskOrchestration`, queue-status route, status recovery claim helper | Shared age/retry policy contract with bounded fail eligibility | Planned |
| `P0-S3` | Keep recoverable rows visible long enough for recovery to converge | Submission/orchestration lifecycle seams and output retention policy | Explicit retention criteria before terminal fail/remove eligibility | Planned |
| `P0-S4` | Close P0 with evidence and tracker/decision/risk updates | Planning + evidence namespace docs | P0 closeout packet, tracker row completion, and gate signoff | Planned |

## P0 Execution Tracker Rows
| Slice ID | Phase | Workstream | Surface | Goal | Entry Gate | Exit Gate | Before And After | Targeted Validation | Full Gates | Risk Class | Rollback Note | Runbooks/Docs Updated | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P0-S1` | `P0` | `WG-1` | `frontend/features/ai-studio/hooks/useAiStudioTasks.ts` | Ensure scheduled background recovery timers are not immediately canceled by local cleanup order | `RGR-M02` planned for kickoff; P0 plan accepted | Recovery timer is present until success/exhaust/final cleanup path; no immediate cancel after scheduling | Before: hard-stop path schedules recovery and clears recovery timer in same pass. After: timer lifecycle is deterministic and recoveries run. | Targeted hook test updates in `useAiStudioTasks.test.ts` and breadcrumb assertions for scheduling/success/exhausted paths | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert recovery-timer ordering changes and restore prior scheduling path | Master tracker + phase plan + evidence packet | `docs/records/evidence/ai-studio-reference-grid-reliability/2026-03-21-p0-s1-recovery-timer-lifecycle.md` (planned) | Planned |
| `P0-S2` | `P0` | `WG-1` | `useAiStudioTaskOrchestration.ts`; queued-status polling policy | Align queued `not_found` policy with bounded retry + age gates across active and resume recovery entry points | `RGR-M03` planned for kickoff; `P0-S1` design locked | Shared thresholds and fail conditions are explicitly consistent across active queued polling and resume watchdog paths | Before: path-specific `not_found` behavior diverged by context. After: one bounded client handoff policy governs recovery-pending eligibility and timing. | Tests in `useAiStudioTaskOrchestration.test.ts`, `queueStatusPolling.test.ts` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert threshold harmonization and restore previous watchdog/queued-polling behavior while retaining diagnostics evidence | Master tracker + evidence packet | `docs/records/evidence/ai-studio-reference-grid-reliability/2026-04-03-p0-s2-not-found-policy-parity.md` | Completed |
| `P0-S3` | `P0` | `WG-1` | Submission/orchestration output lifecycle retention seams | Prevent premature terminal removal for rows still eligible for recovery convergence | `RGR-M04` planned for kickoff; `P0-S1` and `P0-S2` contracts drafted | Recoverable rows remain visible through bounded retention window; terminal removal only after explicit criteria | Before: recoverable rows can be removed/failed early under unresolved task lookup paths. After: retention window protects recovery-eligible rows until thresholds are met. | Tests in `useAiStudioTaskSubmission.test.ts`, `outputLifecyclePatches.test.ts`, `ReferenceGrid.selectorStore.test.tsx` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Medium | Revert retention-window rule changes and restore prior fail/remove handling | Phase plan + tracker + decision/risk docs | `docs/records/evidence/ai-studio-reference-grid-reliability/2026-03-21-p0-s3-recoverable-retention-window.md` (planned) | Planned |
| `P0-S4` | `P0` | `WG-1` | Planning/evidence governance surfaces | Publish P0 closeout packet and mark `RGR-M02`..`RGR-M04` complete (or waived) with explicit risk signoff | `P0-S1`..`P0-S3` evidence drafted | Tracker rows complete/waived with evidence links and readiness-gate decision recorded | Before: P0 readiness inferred. After: P0 closeout is explicit and auditable. | Evidence completeness review against tracker-spec required fields | `npm -C frontend run docs:check` | Medium | Revert premature row completions and return rows to `In Progress` pending evidence | Tracker + readiness state + decision log + risk register | `docs/records/evidence/ai-studio-reference-grid-reliability/2026-03-21-p0-s4-phase-closeout-packet.md` (planned) | Planned |

## Operating Cadence
1. Daily P0 checkpoint: slice status, blockers, and evidence readiness.
2. Mid-phase gate: `P0-S1` must lock before `P0-S2` implementation merges.
3. Phase closeout gate: `RGR-M02` through `RGR-M04` complete (or waived) before any P1 behavior-change start.

## Required Validation
1. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts`
2. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts`
3. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts features/ai-studio/hooks/taskSubmission/__tests__/outputLifecyclePatches.test.ts`
4. `npm -C frontend run test -- tests/api/fal-queue-status.test.ts lib/server/api/__tests__/statusRecoveryKick.test.ts`
5. `npm -C frontend run test -- features/ai-studio/components/__tests__/ReferenceGrid.selectorStore.test.tsx`
6. `npm -C frontend run lint`
7. `npm -C frontend run build`
8. `npm -C frontend run docs:check`

## Exit Criteria
1. Recovery timer scheduling/cancellation contract is deterministic and covered by targeted tests.
2. Queue resume + status claim `not_found` policy is aligned with explicit bounded thresholds.
3. Recoverable output retention policy is explicit and test-covered.
4. `RGR-M02`, `RGR-M03`, and `RGR-M04` are complete or waived with owner/risk signoff and linked evidence.

## Rollback Posture
1. Revert order:
   - `P0-S3` retention-window changes,
   - `P0-S2` policy-threshold alignment,
   - `P0-S1` timer lifecycle ordering.
2. If rollback is partial, document residual risk and block phase closeout.

## Risks
1. Recovery retries may increase short-lived in-flight load.
Mitigation: enforce bounded attempts and retain diagnostics breadcrumbs.

2. Harmonized `not_found` policy may delay terminal failure for truly dead rows.
Mitigation: keep explicit age/retry caps with alertable thresholds.

3. Retention-window changes may temporarily increase visible pending/running cards.
Mitigation: keep bounded retention and explicit terminal criteria.
