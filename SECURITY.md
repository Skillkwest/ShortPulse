# Security

Security expectations for this repo are documented in `docs/security-checklist.md`.

## Key points
- Never expose Supabase service-role keys to the browser.
- Use RLS policies enforcing `user_id = auth.uid()` for user-owned rows.
- Keep the `media_library` bucket private and path-scoped per user (see `sql/storage_policies.sql`).

