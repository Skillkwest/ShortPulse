# Primary Media Upload, List, And Signing Boundary Audit

Date: 2026-06-03

Agent: Dave the Security Guy

Mode: Launch-readiness security lane, primary current runtime routes only.

## Scope

Audited the primary Media Library upload, prepared-upload finalize, list, sign-batch, folder membership, and move boundaries for cross-user media/storage leakage. This pass intentionally excluded legacy, backup, fallback, deprecated, and compatibility-only routes unless the primary runtime depended on them. No UI, UX, product behavior, SQL posture, hosted Supabase state, customer data, Vercel state, or secrets were changed.

Primary surfaces inspected:

- `frontend/pages/api/media/upload.ts`
- `frontend/pages/api/media/prepare-upload.ts`
- `frontend/pages/api/media/finalize-upload.ts`
- `frontend/pages/api/media/sign-batch.ts`
- `frontend/pages/api/media/list.ts`
- `frontend/pages/api/media/folders/membership-batch.ts`
- `frontend/pages/api/media/move.ts`
- `frontend/pages/api/media/move-batch.ts`
- `frontend/lib/server/mediaUploadService.ts`
- `frontend/lib/server/mediaIngest.ts`
- `frontend/lib/mediaStoragePath.ts`
- `frontend/lib/server/mediaFoldersService.ts`

## Finding

No confirmed high-ROI security issue was found in this bounded lane.

Attacker model checked: an authenticated caller tries to submit another user's media id, prompt id, folder id, storage path, variant path, companion-art path, or prepared-upload path and get ShortPulse to list it, sign it, move it, attach it to a folder, or finalize it as caller-owned media.

Severity: No confirmed issue.

Confidence: Medium-high for local source and focused test coverage; hosted Supabase/storage proof was not rerun in this pass.

Affected trust boundary: Media Library private storage signing, media row list hydration, prepared upload finalization, folder membership, and media moves.

Launch impact: The inspected primary routes currently preserve the intended account boundary in local repo evidence: caller-owned `user.id/` storage prefix, caller-owned media/folder/prompt rows, and sanitized variant/companion-art paths are required before signing or returning private media.

ROI: No code fix was warranted. Editing would have been lower ROI than stopping.

## Evidence

- `/api/media/sign-batch` requires bearer auth, pins bucket to `media_library`, normalizes paths, rejects traversal/backslashes/leading slashes, clamps TTL, and returns `403` before service-role signing if any requested path does not start with the authenticated `user.id/` prefix.
- `mediaUploadService` creates prepared and canonical storage paths from the verified `userId`, not from a client-provided account id. Finalization validates the prepared path through `assertUserScopedMediaStoragePath` and the expected caller-owned staging prefix before reading, revalidating, moving, persisting, and signing.
- `mediaIngest.buildScopedMediaStoragePath` and `assertUserScopedMediaStoragePath` enforce caller-prefixed, non-traversing, forward-slash storage keys.
- `/api/media/list` queries `media_files` by `user_id = user.id`, validates requested folders through caller-owned folder access, sanitizes primary/variant/companion-art storage paths against the caller prefix, and drops contaminated rows or out-of-scope paths before signing.
- `mediaFoldersService.applyFolderMembershipBatch` verifies caller-owned source/target folders and caller-owned media/prompt ids before inserting or deleting memberships. Character-scoped media ids are explicitly rejected from Media Library folder membership.
- `move` and `move-batch` delegate to the canonical move service with the verified `user.id`; the inspected route layer does not accept client-provided account authority.

## Validation

Passed:

- `npm -C frontend test -- --run tests/api/media-sign-batch.test.ts tests/api/media-list.test.ts tests/api/media-folders-membership-batch.test.ts tests/api/media-move.test.ts tests/api/media-move-batch.test.ts tests/api/media-prepare-upload-route.test.ts tests/api/media-finalize-upload-route.test.ts`

Result: 7 test files passed, 64 tests passed.

Passed targeted upload-route security slice:

- `npm -C frontend test -- --run tests/api/media-upload.route.test.ts -t "uploads and persists|rejects mismatched|returns 503|returns 409|rate limits"`

Result: 1 test file passed, 5 tests passed, 4 skipped by name filter.

Validation gap intentionally not fixed in this lane:

- The broader `tests/api/media-upload.route.test.ts` file has one unrelated failing expectation in `normalizes oversized image uploads before the canonical image size cap is enforced`. The failure is about image-admission metadata shape (`upload_normalization` expectation vs current `image_admission` metadata). I did not fix it because this Dave lane is not for product metadata/test cleanup and no account, storage, signing, auth, billing, provider, or admin trust boundary was implicated.

## Residual Risk

- Hosted Supabase/storage proof was not rerun here. This audit is based on current local repo code and focused route tests.
- `/api/media/sign-batch` signs arbitrary well-formed paths under the caller's own storage namespace without checking a `media_files` row exists. That is not a cross-user leak in the inspected model because the path must be under `user.id/`, but a future product decision could tighten it if row-backed signing becomes a requirement. This is intentionally deferred because it is not top-ROI launch security work without a proven protected-boundary bypass.

## Stop Condition

Reached. This was a bounded no-fix audit of the primary current media upload/list/signing boundary. The next nearby work would be non-security test cleanup or speculative tightening, so Dave should stop rather than continue by adjacency.

## Next Highest-ROI Step

Move to a different primary current trust boundary with fresh evidence, or rerun hosted Supabase/storage proof if an approved target and credential-safe path are available.
