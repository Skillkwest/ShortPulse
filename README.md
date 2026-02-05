# ShortPulse v1

Client-only short-form analytics and workspace surfaces. Everything runs in the browser with Supabase for auth/storage and a demo dataset you can refresh and rescore from the UI—no backend services to start or maintain.

## Tech
- Frontend: Next.js (pages router), Phosphor icons, modular CSS.
- Auth/storage: Supabase client with persisted sessions, `saved_creators` table, and a private `media_library` bucket.
- Analytics: In-browser scoring of a demo cohort with user-triggered refresh/rescore controls.
- AI Studio providers: Next.js API routes under `/api/fal/*` proxy Fal queue requests (server-side `FAL_KEY` required).

## Setup
1) Copy `frontend/.env.example` to `frontend/.env.local` (or export the values in your shell) and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2) Install and run the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The app runs entirely client-side; there is no backend server to start.

## Optional Supabase bootstrap
- Saved creators: run `sql/create_saved_creators_table.sql` to add the `saved_creators` table with RLS.
- Media library: run `sql/storage_policies.sql` to create the private `media_library` bucket and folder-scoped storage policies. The UI also expects a `media_files` table (see `docs/supabase_full_schema.sql` for a combined script).

## Manual data actions
- Performance Analytics includes a “Data actions” rail for demo dataset refresh/rescore, but the entire Performance surface is post‑MVP (Coming Soon).
- Saved Creators and Media Library actions write/read directly through the Supabase client from the frontend (Saved Creators is post‑MVP).

## Frontend surfaces
- **Dashboard (`/dashboard`)**: Launchpad with plan/status chips and tool cards.
- **Performance Analytics (`/performance`)**: Post‑MVP (Coming Soon); demo analytics surface with filters and scoring.
- **Saved Creators (`/saved-creators`)**: Post‑MVP (Coming Soon); per-user handle list.
- **Media Library (`/media-library`)**: Upload/download/delete/rename files in a private Supabase bucket.
- **Profile (`/profile`)**: Profile/account/billing UI with plan badges and logout modal.
- **AI Studio (`/ai-studio`)**: Creative canvas for prompt systems, model/aspect selection, previewing, and saving image/video outputs.
- **Admin (`/admin`)**: Internal operator dashboard (not part of MVP).

## Security
- Only the Supabase anon key is used on the client; never share the service role key.
- Enable RLS on `saved_creators` and `media_files` (per-user isolation) and keep the `media_library` bucket private with paths prefixed by `auth.uid()`.
- Route protection: `/dashboard`, `/performance`, `/saved-creators`, `/media-library`, and `/profile` expect an authenticated session and redirect to `/auth` when missing.

## Testing
- No automated tests are wired yet; manually verify auth redirects, Saved Creators CRUD, Media Library uploads/deletes/renames, and the Performance data actions rail.

## Docs
- Start at `docs/README.md`.

## Repo layout
- `frontend/`: Next.js app
- `docs/`: documentation
- `sql/`: Supabase bootstrap scripts

## Roadmap / changelog
- Roadmap: `ROADMAP.md`
- Changelog: `docs/change_log.md`
