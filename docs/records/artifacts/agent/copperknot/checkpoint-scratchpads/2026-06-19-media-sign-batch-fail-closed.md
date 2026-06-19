# 2026-06-19 Media Sign Batch Fail Closed

Touched:

- `frontend/pages/api/media/sign-batch.ts`
- `frontend/tests/api/media-sign-batch.test.ts`

Action:

- Changed the storage metadata error path so `/api/media/sign-batch` fails closed instead of signing unverified paths when storage-object existence verification returns an error.
- Added a regression test proving storage metadata failures do not call `createSignedUrls` and are logged through the route catch path.

Validation:

- `npm -C frontend test -- --run tests/api/media-sign-batch.test.ts` passed (`15` tests).
- `npm -C frontend run test:supabase-transform-guard` passed (`3` tests).
- `node scripts/typecheck_changed_files.mjs --path frontend/pages/api/media/sign-batch.ts --path frontend/tests/api/media-sign-batch.test.ts` passed for touched files; repo-wide type-check still has unrelated diagnostics.
- `git diff --check -- frontend/pages/api/media/sign-batch.ts frontend/tests/api/media-sign-batch.test.ts` passed.

Boundary:

- Local source hardening only. No production proof, no UI/UX change, no Supabase transforms, and no dirty Gear Ball files touched.
