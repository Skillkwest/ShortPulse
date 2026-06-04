# Media Folder Membership And Signed Delivery Boundary Audit

Date: 2026-06-03
Agent: Dave the Security Guy
Mode: launch-readiness security audit, no code edit

## Scope

Audited the global Media Library folder membership and signed media delivery boundary after the Nuclo Supabase remediation handoff and earlier signed-url isolation audit. This pass focused on whether an authenticated user can use folder IDs, media IDs, prompt IDs, storage paths, preview fallback paths, or signed-url APIs to read, sign, assign, move, or remove another user's media, prompts, folders, or storage objects.

Out of scope: UI behavior, Media Library UX cleanup, broad route hardening, Supabase hosted mutations, and Mini Ecosystem files.

## Ranked Findings

### 1. Cross-user folder membership mutation or read leakage

- Severity: Critical if present; not confirmed
- Confidence: High
- Trust boundary: authenticated user -> service-role folder/media/prompt mutation helpers and list routes
- Launch impact: direct user data isolation risk if broken
- ROI: highest if confirmed
- Current result: no exploit found in the audited canonical path

Evidence:

- `frontend/lib/server/mediaFoldersService.ts` validates custom folder IDs, rejects the virtual root for membership mutation, checks source/target folder ownership with `media_folders.id + user_id`, reduces requested media/prompt IDs to caller-owned rows before mutation, rejects non-owned IDs, rejects character-scoped media in global folders, writes membership rows with `user_id`, and deletes membership rows with `user_id + folder_id + item ids`.
- `frontend/pages/api/media/folders/membership-batch.ts` requires an authenticated API user, rejects root/non-UUID folder IDs before service invocation, and maps non-owned item IDs to 403.
- `frontend/pages/api/media/list.ts` asserts folder ownership before folder-scoped list reads, queries `media_files.eq("user_id", user.id)`, filters joined folder membership by `folder_membership.folder_id` and `folder_membership.user_id`, strips membership join rows, then drops rows whose storage paths are not under `user.id/`.
- `frontend/pages/api/media/prompts/list.ts` uses the same owner check and joined membership user filter for prompt rows.
- `sql/migrations/060_add_media_folders_and_membership.sql` enables RLS on `media_folders`, `media_folder_media_items`, and `media_folder_prompt_items`; all policies bind `auth.uid() = user_id`. The membership tables also have composite foreign keys tying `(folder_id, user_id)` and `(media_file_id/prompt_id, user_id)` to the owned parent rows.
- `sql/migrations/073_add_media_folder_hierarchy.sql` scopes parent folder relationships by `(parent_folder_id, user_id)`.
- `sql/migrations/135_add_media_folder_count_rpcs.sql` counts only rows where membership `user_id = p_user_id` and grants the function only to `service_role`.

Root cause status: no broken root cause confirmed. The app-level service-role path and SQL/RLS posture currently agree on user ownership.

### 2. Cross-user signed media URL issuance

- Severity: Critical if present; not confirmed
- Confidence: High
- Trust boundary: authenticated user -> private storage signing
- Launch impact: direct private media leak if broken
- ROI: highest if confirmed
- Current result: no exploit found in audited direct signing paths

Evidence:

- `frontend/pages/api/media/sign-batch.ts` requires auth, only signs the `media_library` bucket, rejects path traversal, limits batch size, and returns 403 if any requested path does not start with the authenticated `user.id/` prefix before calling `createSignedUrls`.
- `frontend/pages/api/media/resolve-previews.ts` loads only `media_files` rows where `user_id = user.id`, filters every signing candidate through caller-scoped path validation, narrows storage object lookup to caller-prefixed paths, and returns only trusted direct previews that resolve to the caller namespace.
- `frontend/pages/api/media/list.ts` sanitizes primary and variant storage paths to caller scope before response hydration and before initial signed URL generation.

Root cause status: no broken root cause confirmed. The direct path-signing APIs fail closed on user namespace.

### 3. Raw database/internal error detail on authenticated media list/folder routes

- Severity: Low to Medium
- Confidence: Medium
- Trust boundary: authenticated user -> internal route error details
- Launch impact: could reveal schema/table/constraint details during failures, but no cross-user data, secret, token, signed URL, or customer-private-data leak was proven in this pass
- ROI: defer
- Current result: real hygiene/security-hardening candidate, not the best launch-readiness fix now

Evidence:

- Some authenticated media list/folder routes return `details: error.message` on database or service failures, including `frontend/pages/api/media/list.ts`, `frontend/pages/api/media/prompts/list.ts`, and folder CRUD routes.
- The higher-risk signing endpoints already sanitize generic failures (`sign-batch` and `resolve-previews` return fixed error strings).

Decision: defer to backlog unless a concrete sensitive error payload is observed. Fixing this now would be broad response-shape hardening, not a proven account-isolation blocker.

## Pre-Edit ROI Gate

Selected fix: none.

Why no code edit: the highest-ROI candidate issues for this lane were cross-user folder membership mutation/read leakage and cross-user signed URL issuance. Both were re-proven from current app code, SQL constraints, RLS posture, and regression tests as fail-closed. The remaining raw-error-detail candidate is real enough to retain, but weak as the next best launch-readiness edit because no sensitive payload or protected-boundary bypass was confirmed.

Stop condition reached: yes. Continuing from this lane would mostly become generic hardening or cleanup drift.

## Validation

First validation attempt used repo-root test paths while Vitest was running from `frontend/`, so Vitest found no tests. Reran with frontend-relative paths.

Passed:

```bash
npm -C frontend test -- --run lib/server/__tests__/mediaFoldersService.test.ts tests/api/media-folders-crud.test.ts tests/api/media-folders-membership-batch.test.ts tests/api/media-list.test.ts tests/api/media-prompts-list.test.ts tests/api/media-sign-batch.test.ts tests/api/media-resolve-previews.test.ts
```

Result: 7 test files passed, 96 tests passed.

## Residual Risk And Unknowns

- This was a local repo/code/test audit, not hosted Supabase validation. Hosted posture for this exact folder/signed-delivery lane was not mutated or re-queried.
- The raw error detail candidate remains deferred.
- Existing dirty frontend changes were present before this report work; this audit did not attribute or modify them.

## Next Highest-ROI Step

Move to the next account-isolation boundary that can actually leak user assets or money if broken: admin/provider/internal service-role routes that accept user, generation, media, or billing identifiers and then hydrate rows or issue provider/storage actions. Keep the same stop rule: only edit after a confirmed attacker path crosses a protected boundary.
