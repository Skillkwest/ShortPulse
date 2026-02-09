# Release Checklist

Use this checklist before merging to `main` (and before any deploy/release process you adopt).

## Engineering checks
- `npm -C frontend run lint`
- `npm -C frontend run build`
- No secrets added/changed (`.env*` stays uncommitted; only `.env.example` changes are acceptable)

## Manual product smoke
- Auth: sign in/out works; protected routes redirect to `/auth` when unauthenticated
- Media Library: upload/list/download/delete/rename; storage paths are user-scoped
- AI Studio: core workflow renders; drag/drop surfaces behave as expected (per current UI)
- Dashboard + Profile: core layout, settings/billing sections, and logout flow behave as expected
- Credits & pricing: model cost display matches selected model, and debits are recorded for generation runs
- Credits & admin ops: `/admin` can apply one positive and one negative adjustment, and a failed provider submit path records an auto-refund ledger row

## Supabase safety (when schema/policies change)
- RLS enabled and policies enforce `user_id = auth.uid()` for user-owned tables
- Storage bucket private; policies require `auth.uid()` path prefixes
- Verify with two test users (cross-user isolation)

## Documentation (when behavior changes)
- Update `README.md` and relevant `docs/sop_*.md`
- If it’s a durable architectural decision, write an ADR in `docs/adr/`

## Post‑MVP checks (run when these surfaces are enabled)
- Saved Creators: add/edit/remove a handle; data is user-scoped
- Performance: data actions rail works; charts/cards render; no console errors
