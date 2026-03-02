# Phase 13 Wave E Pass 9: Session Remote Shadow Write-Through (Client, Flagged)

Date: 2026-03-02  
Owner: Engineering  
Status: Pass (Scoped)

## Scope
1. Added client session API helper for authenticated save calls to `/api/ai/sessions/save`.
2. Added write-shadow transport seam that keeps local persistence authoritative and mirrors to server only when `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED=true`.
3. Updated write-shadow hook flush contract to forward `keepalive` intent for lifecycle-triggered flushes (`visibilitychange(hidden)`, `pagehide`).
4. Wired AI Studio page write-shadow path to use the new transport seam.

## Touched Surfaces
1. Client persistence transport:
   - `frontend/features/ai-studio/logic/sessionApiClient.ts`
   - `frontend/features/ai-studio/logic/sessionShadowPersistence.ts`
2. Hook/page wiring:
   - `frontend/features/ai-studio/hooks/useAiStudioSessionWriteShadow.ts`
   - `frontend/pages/ai-studio.tsx`
3. Tests:
   - `frontend/features/ai-studio/logic/__tests__/sessionApiClient.test.ts`
   - `frontend/features/ai-studio/logic/__tests__/sessionShadowPersistence.test.ts`
   - `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionWriteShadow.test.ts`

## Validation Commands
1. `npm -C frontend run test -- --run features/ai-studio/logic/__tests__/sessionApiClient.test.ts features/ai-studio/logic/__tests__/sessionShadowPersistence.test.ts features/ai-studio/hooks/__tests__/useAiStudioSessionWriteShadow.test.ts`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run test:adaptive-v2-gate`
6. `npm -C frontend run check:architecture-boundary`
7. `npm -C frontend run check:size-budget`
8. `npm -C frontend run docs:check`

## Validation Summary
1. New remote-shadow client tests and existing write-shadow tests passed.
2. Lint, type-check, build, and architecture-boundary checks passed.
3. Size-budget remains warn-only for pre-existing hotspot (`useAiStudioState.ts` 701 > 650), unchanged by this pass.
4. Global adaptive/docs gate commands were run but failed in this workspace due unrelated in-progress dirty-tree changes outside this slice:
   - adaptive gate failures in `ReferenceGrid.curated` spinner assertions,
   - docs parity failure for external migration `045_add_character_quickswap_deck.sql` not yet documented.

## Risk Notes
1. Remote write-through is default-off (`NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED=false`), so rollout is explicitly gated.
2. Local write-shadow remains authoritative in this phase; remote shadow failures are intentionally fail-soft and non-blocking.
3. Restore hydration remains disabled in this pass.

## Rollback Readiness
1. Disable remote write-through by setting `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED=false`.
2. Revert `sessionApiClient`/`sessionShadowPersistence` modules and write-shadow hook/page wiring.
3. Local write-shadow durability remains available after rollback.
