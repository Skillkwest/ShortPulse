# 2026-06-19 Direct Upload Path Authority

- Scope: P3 storage/delivery hardening in clean files only; dirty Gear Ball worktree files were not edited.
- Change: `prepareMediaUploadForUser` now fails closed if Supabase signed-upload preparation returns a path different from the server-requested scoped path.
- Proof: direct service regression plus prepare/motion route coverage passed; touched-file typecheck passed; Supabase transform guard passed; targeted diff check passed.
- Boundary: local proof only. No authenticated production upload proof was run.
