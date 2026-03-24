# AI Studio Right-Rail Performance Tracker (2026-03-23)

Last updated: 2026-03-24  
Status: Completed (`scope done`)
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
| `RR-4` | Measurement-gated follow-up only | Completed | Scope closed without entering this lane because no measured bottleneck remained. |

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
| `RRP-08` | Targeted tests cover the main right-rail contracts | Completed | Reference Grid, hydration queue, image hydration surface parity, shared resolver, shell drop, quick-slot bypass, and canvas drop suites |
| `RRP-09` | No remaining obvious duplicated right-rail policy seam exists | Completed | Closeout audit passed after propagating media-surface ownership through hydration metadata and locking the final page-level bypass regression |

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
| `59a8c012` | Add AI Studio right-rail performance scope docs |
| `33554d4f` | Close AI Studio right-rail scope |
| `8c261d92` | Share cached drag transfer hints across right rail |

## Open decisions
1. No additional implementation is justified inside this scope unless profiling or a concrete defect reopens `RR-4`.
2. Any further right-rail work requires either a measured bottleneck or explicit user-directed scope expansion.

## Immediate next action
1. Stop this scope.
2. Reopen only if a measured bottleneck or a new concrete defect appears.
3. Treat `RR-4` as a separate evidence-gated lane, not a continuation by momentum.

## Notes log
### 2026-03-23
1. Created a bounded scope contract for the right-rail effort to prevent open-ended optimization drift.
2. Locked four execution lanes, with `RR-4` explicitly measurement-gated.
3. Marked `RRP-01` through `RRP-08` complete based on repo state, targeted tests, and recent implementation checkpoints.
4. Closed `RRP-09` after the final closeout audit confirmed no remaining obvious cross-controller right-rail policy seam.
5. Added image-hydration surface propagation so Quick Slot and All Refs no longer diverge inside adaptive hydration runtime decisions.
6. Added the missing page-level Quick Slot shell-bypass regression test so the right-rail routing contract is locked at the page boundary.

### 2026-03-24
1. Closed the scope formally in the planning package and kept `RR-4` closed until a measured bottleneck or concrete defect reopens it.
2. Synced the planning and SOP docs so Quick Slot and rail Canvas drop behavior match the shipped right-rail contract.
3. Captured a clean local AI Studio perf baseline after audit-runtime cleanup and shell rerender stabilization:
   - `reference-grid-audit`: `ok=true`
   - `studio-shell-audit`: `ok=true`
   - `non_grid_properties_rerenders_per_output_status_tick=2` (`<= 3`)
4. Verified that the prior audit contamination path is gone:
   - unsupported durability uploads no longer spam `/api/upload-image`
   - shell audit synthetic drops now use a valid PNG payload
5. Closure commits tied to the final clean baseline:
   - `7743e44e` `Skip unsupported reference durability uploads`
   - `0584cc98` `Use valid audit PNG drop payload`
   - `89328121` `Decouple properties panel rerender churn`
6. No remaining right-rail or shell perf gate failure remains in the current local evidence set; further work requires a new measured bottleneck or concrete user-facing defect.
