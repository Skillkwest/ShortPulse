# 2026-06-19 Copy From URL Source Authority Hardening

- Lane: P3 `Storage, delivery, and variants`.
- Touched: `frontend/pages/api/media/copy-from-url.ts`, `frontend/tests/api/media-copy-from-url.test.ts`.
- Change: caller-provided `previewStoragePathHint` / `fullStoragePathHint` no longer authorize an `ai_studio` source URL; hints remain available after canonical generation/output URL authority is established.
- Validation: `npm -C frontend test -- --run tests/api/media-copy-from-url.test.ts` passed `27`; `node scripts/typecheck_changed_files.mjs --path frontend/pages/api/media/copy-from-url.ts --path frontend/tests/api/media-copy-from-url.test.ts --path frontend/pages/api/media/list.ts --path frontend/tests/api/media-list.test.ts` passed; `npm -C frontend run test:supabase-transform-guard` passed `3`; targeted `git diff --check` passed.
- Boundary: local source hardening only; no production/authenticated media copy proof.
