# Media Storage Signed URL Isolation Audit

Owner: Dave the Security Guy
Date: 2026-06-02
Scope: launch-readiness security audit focused on user-owned media rows, private storage paths, signed URL generation, upload staging, and media-list companion art enrichment.

## Decision

No runtime behavior change was needed in this slice. The inspected media signing and upload paths already fail closed on caller-owned storage scope: routes authenticate first, query user-owned rows with the verified `user.id`, reject or null out paths outside the caller namespace, and sign only paths that remain user-scoped.

I added one focused regression test to make a concrete account-isolation boundary durable: if a caller-owned audio generation projection contains a foreign user's companion-art storage path, `/api/media/list` must not sign it and must not return the raw foreign storage path in the response.

## Why This Was Worth Doing Now

- Security question: can one account receive another account's media/storage path or signed URL through media-list hydration?
- Boundary: authenticated user-owned media rows and private Supabase `media_library` storage.
- Impact if broken: cross-user media metadata exposure and possible signed URL issuance for another user's storage object.
- ROI: high enough for a test-only change because the route is a user-facing media inventory surface and the regression is narrow, behavior-preserving, and directly tied to launch account isolation.

## Evidence Checked

- `frontend/pages/api/media/list.ts`
- `frontend/pages/api/media/sign-batch.ts`
- `frontend/pages/api/media/resolve-previews.ts`
- `frontend/pages/api/media/prepare-upload.ts`
- `frontend/pages/api/media/finalize-upload.ts`
- `frontend/lib/mediaStoragePath.ts`
- `frontend/lib/server/mediaUploadService.ts`
- `frontend/lib/server/mediaIngest.ts`
- `frontend/lib/server/api/mediaDeliveryPaths.ts`
- `frontend/lib/mediaPreviewTrustPolicy.ts`
- `sql/storage_policies.sql`
- `docs/security-checklist.md`

## Confirmed Controls

- `media_library` is private in SQL bootstrap/policy source.
- `storage.objects` policies require `media_library` and either service role or a first path segment equal to `auth.uid()`.
- Server-side media path validation rejects empty paths, leading slashes, backslashes, traversal segments, and paths not prefixed with `<user_id>/`.
- `sign-batch` authenticates with `requireApiUser`, rejects out-of-scope request paths, and does not use Supabase image transformations.
- `resolve-previews` queries `media_files` by `user_id`, filters storage candidates to the caller namespace, constrains basename fallback lookups to `${userId}/%/<basename>`, and signs only scoped paths.
- `media/list` queries `media_files` by `user_id`, drops contaminated primary storage paths, sanitizes variant paths before seeded signing, and now has a regression proving out-of-scope companion-art paths are neither signed nor returned.
- Upload prepare/finalize service code stages uploads under the caller namespace and requires finalize source paths to match the caller's staging folder before reading or persisting media.

## Change Made

Added a focused regression in `frontend/tests/api/media-list.test.ts`:

- sets up an authenticated `user-1` audio media row,
- attaches a `generation_projection` companion-art path under `user-2/...`,
- verifies no signing helper is called,
- verifies the API response preserves status but returns `companion_art_storage_path: null` and `companion_art_url: null`.

## Validation

Targeted single-file validation:

```bash
npm run test -- --run tests/api/media-list.test.ts
```

Result: 1 file passed, 28 tests passed.

Targeted media/storage boundary validation:

```bash
npm run test -- --run tests/api/media-list.test.ts tests/api/media-sign-batch.test.ts tests/api/media-resolve-previews.test.ts tests/api/media-finalize-upload-route.test.ts tests/api/media-prepare-upload-route.test.ts tests/lib/media-storage-path.test.ts lib/__tests__/mediaStoragePath.test.ts
```

Result: 7 files passed, 68 tests passed.

The test run emitted the existing native-library duplicate class warning from `canvas`/`sharp`. I did not pursue it because it is not a launch-readiness account-isolation issue.

## Residual Risk

- The previously confirmed hosted Supabase RPC grant drift remains the top security launch blocker until Production applies migration `141` or equivalent corrective grant SQL and reruns `sql/check_runtime_sql_security_audit.sql` with `failing_checks = 0`.
- This slice did not mutate hosted Supabase, Vercel, GitHub secrets, or production data.
- Next highest-ROI media/security step is not broad cleanup; it is either hosted SQL grant remediation with explicit approval, or a similarly narrow proof-backed audit of another account-isolation surface such as project/workspace state ownership or provider result persistence.
