# 2026-06-19 Media List Storage Verification Fail-Closed

- Lane: P3 `Storage, delivery, and variants`.
- Touched: `frontend/pages/api/media/list.ts`, `frontend/tests/api/media-list.test.ts`.
- Change: `POST /api/media/list` now fails closed when storage-object metadata verification errors instead of signing unverified companion-art or initial panel preview paths.
- Validation: `npm -C frontend test -- --run tests/api/media-list.test.ts` passed `38`; `npm -C frontend run test:supabase-transform-guard` passed `3`; `node scripts/typecheck_changed_files.mjs --path frontend/pages/api/media/list.ts --path frontend/tests/api/media-list.test.ts` passed; targeted `git diff --check` passed.
- Boundary: local source hardening only; no production/authenticated media-list proof.
