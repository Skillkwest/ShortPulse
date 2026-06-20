# 2026-06-19 Storage Path Validation Consolidation

- Lane: P3 `Storage, delivery, and variants`.
- Touched: `frontend/pages/api/media/sign-batch.ts`, `frontend/pages/api/media/resolve-previews.ts`, `frontend/pages/api/media/list.ts`, `frontend/tests/api/media-resolve-previews.test.ts`, `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`.
- Change: media list/sign/resolve hot paths now share `isUserScopedMediaStoragePath`; resolve-previews no longer uses malformed storage-path basenames for repair lookup before signing.
- Validation: media sign-batch/resolve-previews/list/storage-path tests passed `78`; Supabase transform guard passed `3`; changed-file type check passed; `docs:check` passed; targeted and repo `git diff --check` passed.
- Boundary: local source hardening only; no authenticated production media sign/list/resolve proof or hosted SQL derivative/storage proof.
