# 2026-06-19 Media Resolve Previews Fail Closed

Touched:

- `frontend/pages/api/media/resolve-previews.ts`
- `frontend/tests/api/media-resolve-previews.test.ts`

Action:

- Changed `/api/media/resolve-previews` so storage metadata verification errors fail closed instead of being silently swallowed before preview signing/repair.
- Added a regression test proving storage metadata failures do not sign, do not run basename repair, and log through the route catch path.

Validation:

- `npm -C frontend test -- --run tests/api/media-resolve-previews.test.ts` passed (`16` tests).
- `npm -C frontend run test:supabase-transform-guard` passed (`3` tests).
- `node scripts/typecheck_changed_files.mjs --path frontend/pages/api/media/resolve-previews.ts --path frontend/tests/api/media-resolve-previews.test.ts` passed for touched files; repo-wide type-check still has unrelated diagnostics.
- `git diff --check -- frontend/pages/api/media/resolve-previews.ts frontend/tests/api/media-resolve-previews.test.ts` passed.

Boundary:

- Local source hardening only. No production proof, no UI/UX change, no Supabase transforms, and no dirty Gear Ball files touched.
