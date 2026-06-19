# 2026-06-19 Batch Signing API Authority

- Lane: P3 `Storage, delivery, and variants`.
- Touched: `frontend/lib/mediaSignedUrlCache.ts`, `frontend/lib/__tests__/mediaSignedUrlCache.test.ts`.
- Change: `getSignedMediaUrlsBatch` no longer falls back to direct browser Supabase signing when `/api/media/sign-batch` fails; unresolved paths fail closed to `null` so server-side storage-object verification remains the single batch-signing authority.
- Validation: `npm -C frontend test -- --run lib/__tests__/mediaSignedUrlCache.test.ts` passed `4`; touched-file typecheck passed for current P3 files; `npm -C frontend run test:supabase-transform-guard` passed `3`; targeted `git diff --check` passed.
- Boundary: local source hardening only; no production/authenticated media signing proof.
