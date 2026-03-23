# AI Studio Right-Rail Performance Tracker (2026-03-23)

Last updated: 2026-03-23  
Status: Active (`closeout-audit pending`)  
Owner: AI Studio Engineering  
Program doc: `docs/planning/ai-studio-right-rail-performance-scope-contract-2026-03-23.md`

## Status legend
- `Planned`
- `In Progress`
- `Blocked`
- `Completed`

## Tracker purpose
Track only the current right-rail scope. This tracker is intentionally smaller than the larger Reference Grid and media-rendering programs. It exists to keep this effort bounded and to make stop conditions explicit.

## Lane snapshot
| Lane | Scope | Status | Notes |
| --- | --- | --- | --- |
| `RR-1` | Surface routing and drop ownership | Completed | Shell bypass and direct right-rail drop handling are in place. |
| `RR-2` | Duplicate-surface ownership | Completed | Quick Slot ownership is centralized and used downstream. |
| `RR-3` | Shared media resolution and first paint | Completed | Shared media resolution is now reused across visible-card and hydration paths. |
| `RR-4` | Measurement-gated follow-up only | Planned | No entry without profiling or a concrete remaining defect. |

## Required done-state tracker
| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| `RRP-01` | Right-rail drop routing is correct for Reference Grid, Quick Slot, and rail Canvas | Completed | Right-rail routing work plus targeted shell/canvas/reference tests |
| `RRP-02` | Quick Slot accepts internal references and Media Library payloads as first-class drops | Completed | `useReferenceGridCuratedDndController.ts`, `ReferenceGrid.curated.test.tsx` |
| `RRP-03` | rail Canvas accepts internal references, library payloads, text, and files without shell interference | Completed | `AiStudioPageContent.drop.test.tsx`, `canvas.drop.test.tsx` |
| `RRP-04` | Duplicate-surface ownership is centralized and consistent | Completed | Checkpoint `bad386cf`, `useReferenceGridSurfaceOwnershipController.ts` |
| `RRP-05` | Duplicate All Refs copies do not do redundant visible work when Quick Slot already owns the same output | Completed | `useReferenceGridCardItemsController.ts`, `useReferenceGridLoadingVisualController.ts`, `useReferenceGridCardRenderController.tsx` |
| `RRP-06` | Newly inserted image media can paint without waiting for hydration completion | Completed | Right-rail image-source fallback path and curated regression coverage |
| `RRP-07` | Hydration scheduling uses shared preferred-surface and media-resolution policy | Completed | Checkpoint `3f484597`, `useReferenceGridResolvedMediaController.ts`, `useReferenceGridHydrationQueueController.ts` |
| `RRP-08` | Targeted tests cover the main right-rail contracts | Completed | Reference Grid, hydration queue, shared resolver, shell drop, and canvas drop suites |
| `RRP-09` | No remaining obvious duplicated right-rail policy seam exists | In Progress | Closeout audit still required before calling the scope done |

## Optional backlog
| ID | Item | Status | Entry rule |
| --- | --- | --- | --- |
| `RRO-01` | Additional drag-hover optimization | Planned | Requires measured drag-path hotspot |
| `RRO-02` | Additional video/autoplay tuning | Planned | Requires visible user-facing lag or profiling evidence |
| `RRO-03` | Image hydration internal consolidation | Planned | Requires profiling evidence inside `useReferenceGridImageHydrationController.ts` |
| `RRO-04` | Extra telemetry counters | Planned | Requires a specific unresolved decision that telemetry would close |

## Checkpoint ledger
| Commit | Summary |
| --- | --- |
| `a9bea956` | Improve AI Studio right-rail drop routing |
| `08eede23` | Tune right-rail video loading hot path |
| `2a2555bc` | Prefer quick-slot video warmup over duplicate refs |
| `974b8378` | Prioritize quick-slot image hydration over duplicates |
| `da0e8a3e` | Deprioritize duplicate all-refs image work |
| `bad386cf` | Consolidate reference-grid duplicate surface ownership |
| `3f484597` | Share reference-grid media resolution across hot paths |
| `8c261d92` | Share cached drag transfer hints across right rail |

## Open decisions
1. Is `RRP-09` already satisfied, or does `useReferenceGridImageHydrationController.ts` still contain a policy seam large enough to justify another structural pass?
2. Do we stop at closeout once `RRP-09` is audited, or does user-directed scope expansion create a new program?

## Immediate next action
1. Perform one explicit closeout audit against `RRP-09`.
2. If `RRP-09` passes, declare the current right-rail scope done and stop.
3. If `RRP-09` fails, only reopen implementation in the smallest structural seam that resolves the failed requirement.

## Notes log
### 2026-03-23
1. Created a bounded scope contract for the right-rail effort to prevent open-ended optimization drift.
2. Locked four execution lanes, with `RR-4` explicitly measurement-gated.
3. Marked `RRP-01` through `RRP-08` complete based on repo state, targeted tests, and recent implementation checkpoints.
4. Left `RRP-09` in progress to force one closeout audit before more implementation.
