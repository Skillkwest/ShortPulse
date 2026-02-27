# Phase 06 Slice A Evidence (2026-02-27)

## Scope
Implemented a bounded Phase 06 Slice A focused on character workflow hardening foundations:
1. DnD trust policy enforcement for dropped reference URLs.
2. Cross-surface selected-character synchronization.
3. Signed URL batch chunking safety for large reference sets.

## Code Changes
1. `frontend/features/character-manager/components/CharacterManagerShell.tsx`
- blocked untrusted external dropped URLs for Character Sheet and QuickSwap pathways,
- kept trusted local/internal/supabase-hosted URL drops allowed,
- replaced silent drop-processing catch paths with explicit low-severity telemetry events.
2. `frontend/features/ai-studio/hooks/useAiStudioCharacterModeLifecycle.ts`
- subscribed to shared selected-character persistence events to sync selection changes across surfaces/tabs.
3. `frontend/lib/mediaSignedUrlCache.ts`
- removed 60-path truncation behavior in batch signing,
- chunked unresolved paths into fixed-size API-sign batches until all paths are processed.

## Docs Changes
1. `docs/planning/stages/unified-phase-06-character-workflow-hardening.md`
- moved Phase 06 to in-progress and recorded Slice A implementation scope.
2. `docs/planning/shortpulse-unified-buildout-tracker.md`
- recorded Phase 06 Slice A progress and remaining phase-close work.
3. `docs/sops/sop_character_manager_operations.md`
- documented dropped-reference trust boundary (trusted local/internal/supabase-hosted only; arbitrary external hosts blocked).

## Tests Added/Updated
1. `frontend/features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx`
- updated trusted dropped URL fixtures to internal/supabase-hosted URLs,
- added untrusted external URL rejection assertion for QuickSwap.
2. `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterModeLifecycle.test.ts`
- added cross-surface selected-character sync test.
3. `frontend/lib/__tests__/mediaSignedUrlCache.test.ts`
- added regression test verifying >60 paths are chunked and fully resolved.

## Validation Runs
1. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioCharacterModeLifecycle.test.ts features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx lib/__tests__/mediaSignedUrlCache.test.ts`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`

All commands passed.

## Rollback Notes
1. Revert this slice commit to restore previous Character drop behavior (including permissive external URL intake), pre-subscription lifecycle behavior, and pre-chunked signed URL batch behavior.
2. No schema migrations were introduced in this slice.
