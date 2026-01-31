# Routes Map

Reference for pages, auth expectations, and ownership.

| Route | Auth required | Purpose | Notes |
| --- | --- | --- | --- |
| `/landing` | No | Marketing landing page | Root redirects here. |
| `/auth` | No | Email/password auth via Supabase | Redirects to `/dashboard` on session. |
| `/dashboard` | Yes | Workspace hub with plan/status chips and tool cards | Uses `useProtectedRoute`. |
| `/performance` | Yes | Demo performance analytics with filters, scoring, and detail modal | Data refresh/rescore runs client-side. |
| `/saved-creators` | Yes | CRUD for per-user creator list | Writes to `saved_creators` table (RLS). |
| `/media-library` | Yes | Private bucket file manager | Uses `media_library` bucket + `media_files` table (RLS). |
| `/ai-studio` | Yes | Creative canvas (prompt/image/video) | `/creator-studio` forwards here. |
| `/character` | Yes | Character tool (identity ingest + consistent image gen) | Frontend-triggered; Fal proxy by default. |
| `/profile` | Yes | Profile/account/billing UI | Logout modal; plan badges. |
| `/onboarding` | No | Lightweight onboarding shell | Links to dashboard/features. |
| `/creator-studio` | Yes | Legacy alias to AI Studio | Re-export of `/ai-studio`. |
| `/index` | No | Redirect helper to `/landing` | Keeps `/` from 404 in dev. |

Keep this table updated when adding routes and reflect protection rules in `frontend/lib/authGuard.ts`.
