# Copperknot checkpoint scratchpad: storage sign-batch stale-variant hardening

Date: 2026-06-18

Scope: Storage, delivery, and variants.

Touched:

- `frontend/pages/api/media/list.ts`
- `frontend/pages/api/media/sign-batch.ts`
- `frontend/tests/api/media-list.test.ts`
- `frontend/tests/api/media-sign-batch.test.ts`
- Copperknot launch board/queue/scorecard docs.

Change:

- Hardened `/api/media/list` first-page seeded preview signing, audio companion-art signing, and `/api/media/sign-batch` to query `storage.objects` for requested user-scoped paths before calling Supabase `createSignedUrls`.
- Missing/stale variant paths now stay `null` instead of receiving a signed URL that can fail after image load.
- Existing paths still sign normally, allowing the already-canonical candidate fallback order to use original objects when durable variants drift.
- No UI, UX, intended behavior, billing, provider, route-shape, or Supabase image transformation change.

Validation:

- `npm -C frontend run test -- tests/api/media-list.test.ts tests/api/media-sign-batch.test.ts` passed: `50` tests.
- `npm -C frontend run test -- lib/__tests__/supabaseTransformGuard.test.ts features/media-library/logic/__tests__/mediaPreviewRuntimeShared.test.ts features/media-library/hooks/__tests__/useMediaPreviewRecoveryController.test.ts` passed: `15` tests.
- `npm -C frontend run validate:media-rendering-guardrails` passed.
- `git diff --check -- frontend/pages/api/media/list.ts frontend/pages/api/media/sign-batch.ts frontend/tests/api/media-list.test.ts frontend/tests/api/media-sign-batch.test.ts` passed.

Boundary:

- This is source hardening only. Storage/delivery remains below floor until a fresh deployed production run proves authenticated media list/sign/resolve, hosted derivative SQL posture, and signed object delivery.
