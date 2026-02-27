# Phase 05 Slice A Evidence: Media Preview Trust Policy

Date: 2026-02-27  
Owner: Engineering  
Status: Completed (pre-entry prep slice)

## Scope
Centralize media preview trust decisions so direct URL fallback and Next image optimizer wrapping are fail-closed by default and only allow trusted hosts.

Implemented components:
1. Added `frontend/lib/mediaPreviewTrustPolicy.ts` with shared helpers for:
   - trusted direct preview URL checks,
   - trusted URL filtering,
   - Next optimizer eligibility checks,
   - trusted host list resolution.
2. Integrated trust policy into:
   - `frontend/lib/mediaPreviewPath.ts` direct fallback filtering,
   - `frontend/lib/adaptive-media/resolver.ts` optimizer guard,
   - `frontend/features/ai-studio/logic/referenceGridMedia.ts` optimizer guard.
3. Tightened `frontend/next.config.js` image `remotePatterns` from wildcards to trusted hosts only.
4. Added trust policy tests and updated affected runtime tests for new default-block behavior.

## Runtime Contract
1. External direct previews are blocked by default.
2. External direct previews require both:
   - explicit enable flag, and
   - host allowlisting.
3. Unknown external hosts are not wrapped by Next optimizer transforms.

New/used env controls:
1. `SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS`
2. `SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS`
3. `NEXT_PUBLIC_MEDIA_DIRECT_URL_ALLOWED_HOSTS`
4. `NEXT_PUBLIC_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS`

## Validation Log
Executed and passing:
1. `npm -C frontend run test -- mediaPreviewTrustPolicy resolver referenceGridMedia media-resolve-previews`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run build`

## Regression Notes
1. Test expectations that assumed broad external-host optimizer wrapping were updated to explicit allowlist-enabled cases.
2. Existing Supabase-host preview/signing behavior remains unchanged.

## Rollback
If needed, revert this slice commit to restore prior fallback/optimizer behavior while keeping completed Phase 04 hardening intact.

## Follow-ups
1. Phase 05 Slice B: server-authoritative `/api/media/upload` service + route.
2. Keep full Phase 05 exit gating blocked on Phase 04 canary signoff.
