# AI Studio Reference Grid Reliability Phase P2 Execution Plan (2026-03-21)

Date: 2026-03-21  
Authority: Working  
Owner: AI Studio Engineering  
Status: Planned (implementation gated on P1 closeout)

## Summary
Phase `P2` hardens Reference Grid hydration/media convergence so generated cards do not remain in persistent blank/spinner states when decode/hydration paths stall.

Primary objective:
1. Add bounded timeout/fallback behavior for stalled hydration paths.
2. Prevent no-`src`/no-preview indefinite loading states.
3. Keep generation-loading and hydration-loading semantics explicit in visuals and telemetry.

Master references:
1. `docs/planning/ai-studio-reference-grid-reliability-master-plan-2026-03-21.md`
2. `docs/planning/ai-studio-reference-grid-reliability-master-roadmap-2026-03-21.md`
3. `docs/planning/ai-studio-reference-grid-reliability-master-tracker-2026-03-21.md`
4. `docs/planning/ai-studio-reference-grid-reliability-tracker-spec-2026-03-21.md`
5. `docs/adr/0046-ai-studio-output-visibility-authority-contract.md`

## Scope Lock
In scope:
1. Hydration/decode queue behavior and fallback handling in:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts`
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridHydrationQueueController.ts`
2. Loading-visual and classification semantics in:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridLoadingVisualController.ts`
   - `frontend/features/ai-studio/reference-grid/logic/referenceGridCardVisualState.ts`
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`
3. Hydration/generation telemetry split and guardrails in:
   - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridTelemetryController.ts`
4. P2 tracker/evidence closeout updates for rows `RGR-M07` and `RGR-M08`.

Out of scope:
1. P0 recovery scheduling and queue `not_found` policy fixes.
2. P1 output-authority and selector-store parity changes.
3. P3 recovery semantics precedence and overdue-running policy.
4. P4 rollout/canary/closeout governance.

## Entry Criteria
1. `P1` exit criteria are complete or explicitly waived with risk signoff.
2. `RGR-M07` and `RGR-M08` are approved for execution.
3. P2 evidence packet paths are reserved in the reliability evidence namespace.
4. P2 implementation retains P0/P1 no-regression constraints.

## Hard Blockers
1. Do not treat indefinite spinner states as acceptable "eventual consistency."
2. Do not collapse generation-loading and hydration-loading into a single ambiguous visual state.
3. Do not close P2 while either `RGR-M07` or `RGR-M08` lacks evidence and rollback notes.

## Slice Backlog
| Slice ID | Goal | Primary Surfaces | Deliverable | Status |
| --- | --- | --- | --- | --- |
| `P2-S1` | Add bounded hydration timeout/fallback convergence | `useReferenceGridImageHydrationController.ts`; `useReferenceGridHydrationQueueController.ts` | Deterministic fallback path for stalled hydration/decode candidates | Planned |
| `P2-S2` | Eliminate no-`src` indefinite loading states | `referenceGridCardVisualState.ts`; `useReferenceGridLoadingVisualController.ts`; render controller | Explicit non-terminal timeout handling for blank/stalled cards | Planned |
| `P2-S3` | Lock loading semantic split in telemetry + UI | `useReferenceGridTelemetryController.ts`; loading visual + card render surfaces | Generation vs hydration states are independently observable and testable | Planned |
| `P2-S4` | Publish P2 closeout packet and tracker row completion | Planning/evidence namespace docs | `RGR-M07` + `RGR-M08` completion (or waivers) with linked evidence | Planned |

## P2 Execution Tracker Rows
| Slice ID | Phase | Workstream | Surface | Goal | Entry Gate | Exit Gate | Before And After | Targeted Validation | Full Gates | Risk Class | Rollback Note | Runbooks/Docs Updated | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P2-S1` | `P2` | `WG-3` | `useReferenceGridImageHydrationController.ts`; `useReferenceGridHydrationQueueController.ts` | Add bounded timeout/fallback behavior for stalled hydration/decode paths | P1 closeout approved; `RGR-M07` planned for kickoff | Hydration stalls converge via deterministic fallback within bounded timeout policy | Before: stalled decode/hydration can leave cards unresolved. After: fallback path converges cards to renderable state or explicit terminal diagnostics. | `useReferenceGridImageHydrationController.test.ts`; `useReferenceGridHydrationQueueController.test.ts` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert hydration-timeout/fallback policy changes and restore prior queue behavior while retaining evidence | Master tracker + risk register + phase plan | `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p2-s1-hydration-timeout-fallback.md` (planned) | Planned |
| `P2-S2` | `P2` | `WG-3` | `referenceGridCardVisualState.ts`; `useReferenceGridLoadingVisualController.ts`; `useReferenceGridCardRenderController.tsx` | Prevent no-`src` indefinite spinner states and preserve deterministic loading transitions | `P2-S1` policy contract approved | Cards transition out of indefinite loading when no renderable media can be resolved within bounds | Before: no-`src`/blank cards can remain in ambiguous loading state. After: explicit timeout/fallback semantics prevent infinite spinner behavior. | `referenceGridCardVisualState.test.ts`; `ReferenceGrid.curated.test.tsx` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert visual-state transition changes and restore previous loading classifier behavior | Phase plan + tracker + readiness notes | `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p2-s2-no-src-loading-convergence.md` (planned) | Planned |
| `P2-S3` | `P2` | `WG-3` | `useReferenceGridTelemetryController.ts`; loading visual surfaces | Distinguish generation-loading vs hydration-loading in telemetry and UI semantics | `P2-S2` merged with targeted tests | Telemetry and UI expose separate generation/hydration loading counts without ambiguity | Before: loading diagnosis can conflate generation and hydration stages. After: independent observability supports accurate triage. | `ReferenceGrid.selectorStore.test.tsx`; telemetry controller coverage via affected suites | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Medium | Revert telemetry split changes and restore prior combined loading signals if regressions occur | Decision log + tracker + phase plan | `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p2-s3-loading-telemetry-split.md` (planned) | Planned |
| `P2-S4` | `P2` | `WG-3` | Planning/evidence governance surfaces | Publish P2 closeout packet and mark `RGR-M07`/`RGR-M08` complete (or waived) with risk signoff | `P2-S1`..`P2-S3` evidence drafted | Tracker rows complete/waived and dependencies for P3 handoff are explicit | Before: P2 readiness inferred. After: P2 closeout is explicit and auditable. | Evidence completeness review against tracker-spec row schema and checklist | `npm -C frontend run docs:check` | Medium | Revert premature completion status and return rows to `In Progress` pending evidence | Tracker + decision log + readiness state + risk register | `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p2-s4-phase-closeout-packet.md` (planned) | Planned |

## Operating Cadence
1. Daily P2 checkpoint: hydration queue health, fallback convergence, and loading-state evidence progress.
2. Mid-phase gate: `P2-S1` must lock before `P2-S2` closeout begins.
3. Phase closeout gate: `RGR-M07` and `RGR-M08` complete (or waived) before any P3 behavior-change start.

## Required Validation
1. `npm -C frontend run test -- features/ai-studio/reference-grid/controllers/__tests__/useReferenceGridImageHydrationController.test.ts`
2. `npm -C frontend run test -- features/ai-studio/reference-grid/controllers/__tests__/useReferenceGridHydrationQueueController.test.ts`
3. `npm -C frontend run test -- features/ai-studio/reference-grid/logic/__tests__/referenceGridCardVisualState.test.ts`
4. `npm -C frontend run test -- features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx features/ai-studio/components/__tests__/ReferenceGrid.selectorStore.test.tsx`
5. `npm -C frontend run lint`
6. `npm -C frontend run build`
7. `npm -C frontend run docs:check`

## Exit Criteria
1. Hydration timeout/fallback policy converges stalled cards deterministically.
2. No-`src` and blank-card loading paths cannot remain indefinitely unresolved.
3. Generation-loading and hydration-loading states are independently visible in UI and telemetry.
4. `RGR-M07` and `RGR-M08` are complete or waived with owner/risk signoff and linked evidence.

## Rollback Posture
1. Revert order:
   - `P2-S3` loading telemetry/visual split changes,
   - `P2-S2` loading-classification and render transition changes,
   - `P2-S1` hydration timeout/fallback policy changes.
2. If rollback is partial, block P2 closeout until residual risk is documented.

## Risks
1. Fallback timeout tuning can over-trigger and degrade preview quality.
Mitigation: use bounded thresholds and preserve adaptive-quality policy contracts.

2. Stronger convergence policy can increase temporary bandwidth and decode churn.
Mitigation: keep decode budgets and queue priority ordering intact.

3. Additional loading-state distinctions can increase UI complexity.
Mitigation: keep state mapping deterministic and covered by focused classification tests.
