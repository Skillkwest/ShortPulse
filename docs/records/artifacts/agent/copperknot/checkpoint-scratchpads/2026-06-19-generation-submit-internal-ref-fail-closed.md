# 2026-06-19 Generation Submit Internal Ref Fail-Closed

Touched:

- `frontend/lib/server/api/falSubmitProxy.ts`
- `frontend/tests/api/fal-submit-proxy.test.ts`

Action:

- Removed the internal media/edit reference signing fallback path from the shared generation submit proxy.
- Internal ref signing failures now return the existing structured `503` before billing/provider dispatch, even if older external URLs are present.

Validation:

- `npm -C frontend test -- --run tests/api/fal-submit-proxy.test.ts` passed (`29` tests).
- `node scripts/typecheck_changed_files.mjs --path frontend/lib/server/api/falSubmitProxy.ts --path frontend/tests/api/fal-submit-proxy.test.ts` passed for touched files; repo-wide type-check still has unrelated diagnostics.
- `git diff --check -- frontend/lib/server/api/falSubmitProxy.ts frontend/tests/api/fal-submit-proxy.test.ts` passed.

Boundary:

- Local source hardening only. No production proof, no billing spend, no dirty Gear Ball files touched.
