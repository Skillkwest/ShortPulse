# Troubleshooting

## `next build` / `next lint` prompts to “configure ESLint”
This happens when the repo has `eslint-config-next` installed but no ESLint config file exists.

Fix: ensure `frontend/.eslintrc.json` exists (this repo uses `next/core-web-vitals`).

## Supabase auth redirects not working
Checklist:
- `frontend/.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- You’re signed in and the session is persisted (see `frontend/lib/supabaseClient.ts`).
- Protected routes redirect to `/auth` when session is missing (see `frontend/lib/authGuard.ts`).

## Media Library operations fail (upload/list/delete)
Checklist:
- The `media_library` bucket is private and policies require user-scoped paths.
- RLS is enabled for `media_files` and policies enforce `user_id = auth.uid()`.
- You ran the bootstrap scripts in `sql/` (including `sql/create_media_library_tables.sql`) or `docs/supabase_full_schema.sql`.

## Prompt or AI Generation saves fail
Checklist:
- `media_prompts`, `ai_generations`, and `media_events` tables exist.
- RLS is enabled and policies enforce `user_id = auth.uid()` on those tables.
- The client is using the anon key only (no service-role key in the browser).

## Admin credit adjustments fail with missing ledger columns
Symptoms:
- Errors like `Could not find the 'created_by' column of 'ai_credit_ledger' in the schema cache`.
- Errors like `column "source" of relation "ai_credit_ledger" does not exist`.

Fix:
- Run `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` in the Supabase SQL editor.
- Refresh Supabase table metadata (or reload the dashboard) and retry `/admin` credit adjustments.

## SQL role update fails with `column "app_metadata" does not exist`
Symptom:
- Query against `auth.users.app_metadata` fails with `ERROR: 42703`.

Cause:
- Supabase stores auth metadata in `raw_app_meta_data` and `raw_user_meta_data` columns.

Fix:
- Update `raw_app_meta_data` instead of `app_metadata` for admin roles.
- `raw_user_meta_data` is user-editable and is not used for admin authorization.
- Sign out and sign back in so fresh JWT claims include the new role before checking `/admin`.

## Billing migration fails with `ENABLE ROW SECURITY ... not supported for views`
Symptom:
- `ERROR: 42809: ALTER action ENABLE ROW SECURITY cannot be performed on relation "ai_credit_balance"`.

Cause:
- In some legacy deployments, `ai_credit_balance` is a view, not a table.

Fix:
- Re-run the latest `sql/migrate_ai_credit_ledger_legacy_to_v2.sql` from this repo. The current script detects view vs table and skips incompatible RLS/trigger steps automatically.
- Validate relation type:
  ```sql
  select relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'ai_credit_balance';
  ```

## Signup fails with `Database error saving new user`
Symptom:
- Supabase Auth returns `Database error saving new user` during sign up.

Checklist:
- Run the latest `sql/migrate_new_user_plan_default_to_free.sql` to replace `handle_new_user_billing_setup()` with the hardened, fail-open version.
- Ensure billing bootstrap tables exist (`billing_profiles`, `billing_plans`, `ai_credit_ledger`).
- Ensure `app_error_logs` table exists to capture trigger failures in the Admin Errors page.

Diagnostics:
```sql
select id, source, message, last_seen_at, occurrences_count, metadata
from app_error_logs
where source = 'db.trigger.handle_new_user_billing_setup'
order by last_seen_at desc
limit 20;
```

## AI Studio auto-save fails (CORS or fetch errors)
Checklist:
- The provider URL allows browser fetches (some providers block cross-origin downloads).
- If blocked, consider a Supabase Edge Function proxy (requires an ADR) or store metadata only.

## “It works in dev but not in build”
Checklist:
- Run `npm -C frontend run build` and fix type errors first.
- Watch for accidental Node-only usage in the client (e.g., `fs`, server-only env vars).
