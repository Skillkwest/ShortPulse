# AI Studio Reference Grid Reliability Phase P1 Execution Plan (2026-03-21)

Date: 2026-03-21  
Authority: Working  
Owner: AI Studio Engineering  
Status: draft

## Summary
Phase `P1` establishes a single output-authority contract across assistant bubble previews and Reference Grid rendering while page-output decoupling is enabled.

Primary objective:
1. Remove bubble-vs-grid authority drift in decoupled mode.
2. Lock selector-store publish parity for card presence timing.
3. Preserve pending/running card visibility under microtask-coalesced publication.

Master references:
1. `docs/planning/ai-studio-reference-grid-reliability-master-plan-2026-03-21.md`
2. `docs/planning/ai-studio-reference-grid-reliability-master-roadmap-2026-03-21.md`
3. `docs/planning/ai-studio-reference-grid-reliability-master-tracker-2026-03-21.md`
4. `docs/planning/ai-studio-reference-grid-reliability-tracker-spec-2026-03-21.md`
5. `docs/adr/0046-ai-studio-output-visibility-authority-contract.md`

## Scope Lock
In scope:
1. Output-store publication contract in `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`.
2. Selector-store fallback and lookup parity in `frontend/features/ai-studio/hooks/useAiStudioOutputStoreSelectors.ts`.
3. Decoupled page-output wiring for Reference Grid/bubble surfaces in:
   - `frontend/pages/ai-studio.tsx`
   - `frontend/features/ai-studio/hooks/agentOrchestration/useAgentOutputBubbleLinking.ts`
4. Reference Grid selector-store render parity when `outputs` props are omitted in `frontend/features/ai-studio/components/ReferenceGrid.tsx`.
5. P1 tracker/evidence closeout updates for rows `RGR-M05` and `RGR-M06`.

Out of scope:
1. Recovery timer/retry policy correctness work (`P0`).
2. Hydration/decode timeout fallback work (`P2`).
3. Server/client recovery precedence work (`P3`).
4. Canary rollout/closeout governance work (`P4`).

## Entry Criteria
1. `P0` exit criteria are complete or explicitly waived with risk signoff.
2. `RGR-M05` and `RGR-M06` are approved for execution.
3. ADR `0046` remains the active authority contract for this phase scope.
4. P1 evidence packet paths are reserved in the reliability namespace.

## Hard Blockers
1. Do not force-disable decoupled mode to hide authority drift.
2. Do not preserve dual authority (`local outputs` vs selector store) for completion visibility decisions.
3. Do not close P1 while either `RGR-M05` or `RGR-M06` lacks evidence and rollback notes.

## Slice Backlog
| Slice ID | Goal | Primary Surfaces | Deliverable | Status |
| --- | --- | --- | --- | --- |
| `P1-S1` | Canonicalize output visibility authority across bubble and grid surfaces | `ai-studio.tsx`, `useAgentOutputBubbleLinking.ts`, output-store selectors | One authority contract for presence timing in decoupled mode | Planned |
| `P1-S2` | Lock selector-store publish parity and subscriber behavior | `useAiStudioOutputCollectionState.ts`, `useAiStudioOutputStoreSelectors.ts`, `aiStudioOutputStore.ts` | Deterministic publish/read parity with bounded fallback semantics | Planned |
| `P1-S3` | Preserve pending/running visibility under coalesced publishing | `ReferenceGrid.tsx`, output collection + selector tests | No transient missing-card state for in-flight generations | Planned |
| `P1-S4` | Publish P1 closeout packet and tracker row completion | Planning/evidence namespace docs | `RGR-M05` + `RGR-M06` completion (or waivers) with linked evidence | Planned |

## P1 Execution Tracker Rows
| Slice ID | Phase | Workstream | Surface | Goal | Entry Gate | Exit Gate | Before And After | Targeted Validation | Full Gates | Risk Class | Rollback Note | Runbooks/Docs Updated | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P1-S1` | `P1` | `WG-2` | `frontend/pages/ai-studio.tsx`; `useAgentOutputBubbleLinking.ts` | Canonicalize output authority for bubble/grid presence timing in decoupled mode | P0 closeout approved; `RGR-M05` planned for kickoff | Bubble and grid presence timing contract uses the same authoritative output surface | Before: bubble linkage can resolve from local arrays while grid resolves from selector snapshot. After: shared authority contract controls both surfaces. | `useAgentOutputBubbleLinking.test.ts`; `ReferenceGrid.selectorStore.test.tsx` parity assertions | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert authority-routing changes and restore prior lane while keeping diagnostics evidence | Master tracker + decision log + phase plan | `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p1-s1-output-authority-parity.md` (planned) | Planned |
| `P1-S2` | `P1` | `WG-2` | `useAiStudioOutputCollectionState.ts`; `useAiStudioOutputStoreSelectors.ts`; `aiStudioOutputStore.ts` | Lock selector-store publish parity and fallback semantics under coalesced updates | `P1-S1` contract draft approved; `RGR-M06` planned for kickoff | Publish/read behavior is deterministic with no stale fallback dominance over authoritative snapshots | Before: fallback behavior can mask publish timing drift. After: coalesced publishes preserve parity and bounded fallback rules. | `useAiStudioState.outputStoreBridge.test.tsx`; `useAiStudioOutputStoreSelectors.test.ts`; `aiStudioOutputStore.test.ts` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert publish/fallback semantic changes to prior behavior and document residual drift risk | Master tracker + risk register + phase plan | `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p1-s2-selector-store-publish-parity.md` (planned) | Planned |
| `P1-S3` | `P1` | `WG-2` | `ReferenceGrid.tsx` + decoupled page wiring | Preserve pending/running card visibility during microtask-coalesced publish windows | `P1-S2` implementation merged with targeted tests | In-flight cards remain visible (pending/running) without transient disappearance in decoupled mode | Before: cards can appear in bubble preview before authoritative grid presence converges. After: in-flight card visibility remains consistent across surfaces. | `ReferenceGrid.selectorStore.test.tsx`; `useAiStudioTaskSubmission.test.ts`; `useAiStudioReferenceGridProps.test.ts` | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | High | Revert in-flight visibility timing changes and restore previous projection behavior | Master tracker + readiness notes + phase plan | `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p1-s3-inflight-visibility-coalescing.md` (planned) | Planned |
| `P1-S4` | `P1` | `WG-2` | Planning/evidence governance surfaces | Publish P1 closeout packet and mark `RGR-M05`/`RGR-M06` complete (or waived) with risk signoff | `P1-S1`..`P1-S3` evidence drafted | Tracker rows complete/waived and dependencies for P2 handoff are explicit | Before: P1 readiness inferred. After: P1 closeout is explicit and auditable. | Evidence completeness review against tracker-spec row schema and checklist | `npm -C frontend run docs:check` | Medium | Revert premature completion status and return rows to `In Progress` pending evidence | Tracker + decision log + readiness state + risk register | `docs/planning/evidence/ai-studio-reference-grid-reliability/2026-03-21-p1-s4-phase-closeout-packet.md` (planned) | Planned |

## Operating Cadence
1. Daily P1 checkpoint: authority parity status, blockers, and test evidence progress.
2. Mid-phase gate: `P1-S1` and `P1-S2` lock before `P1-S3` closeout begins.
3. Phase closeout gate: `RGR-M05` and `RGR-M06` complete (or waived) before any P2 behavior-change start.

## Required Validation
1. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioState.outputStoreBridge.test.tsx`
2. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioOutputStoreSelectors.test.ts features/ai-studio/hooks/__tests__/aiStudioOutputStore.test.ts`
3. `npm -C frontend run test -- features/ai-studio/components/__tests__/ReferenceGrid.selectorStore.test.tsx`
4. `npm -C frontend run test -- features/ai-studio/hooks/agentOrchestration/__tests__/useAgentOutputBubbleLinking.test.ts`
5. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioReferenceGridProps.test.ts`
6. `npm -C frontend run lint`
7. `npm -C frontend run build`
8. `npm -C frontend run docs:check`

## Exit Criteria
1. Bubble/grid output presence timing follows one canonical authority contract.
2. Selector-store publish/read parity is deterministic in decoupled mode.
3. Pending/running card visibility stays stable under coalesced publish behavior.
4. `RGR-M05` and `RGR-M06` are complete or waived with owner/risk signoff and linked evidence.

## Rollback Posture
1. Revert order:
   - `P1-S3` in-flight visibility timing changes,
   - `P1-S2` publish/fallback semantic changes,
   - `P1-S1` authority routing changes.
2. If rollback is partial, block P1 closeout until residual risk is documented.

## Risks
1. Authority unification can regress existing bubble-link UX assumptions.
Mitigation: keep machine-verifiable parity tests and transition-safe compatibility guards.

2. Coalesced publication changes can introduce stale selector snapshots under load.
Mitigation: preserve deterministic snapshot semantics and bounded fallback behavior.

3. Pending/running visibility stabilization can increase temporary card counts.
Mitigation: use explicit retention windows and non-terminal state hygiene from P0 contracts.
