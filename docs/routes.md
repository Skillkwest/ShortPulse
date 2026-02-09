# Routes Map

Reference for pages, auth expectations, and ownership.

| Route | Auth required | Purpose | Notes |
| --- | --- | --- | --- |
| `/landing` | No | Marketing landing page | Root redirects here. |
| `/auth` | No | Email/password auth via Supabase | Redirects to `/dashboard` on session. |
| `/dashboard` | Yes | Workspace hub with plan/status chips and tool cards | Uses `useProtectedRoute`. |
| `/performance` | Yes | Performance analytics | Post‑MVP (Coming Soon). |
| `/performance-soon` | Yes | Temporary placeholder for the analytics workspace | Explains that the Performance surface is still under construction. |
| `/saved-creators` | Yes | Saved creators list | Post‑MVP (Coming Soon). |
| `/media-library` | Yes | Private bucket file manager | Uses `media_library` bucket + `media_files` table (RLS). |
| `/ai-studio` | Yes | Creative canvas (prompt/image/video) | `/creator-studio` forwards here. |
| `/character` | Yes | Character tool (identity ingest + consistent image gen) | Frontend-triggered; Fal proxy by default. |
| `/profile` | Yes | Profile/account/billing UI | Logout modal; plan badges. |
| `/admin` | Yes | Internal admin dashboard | Operator-only surface (app/user metadata role or admin allowlist); not part of MVP. |
| `/onboarding` | No | Lightweight onboarding shell | Links to dashboard/features. |
| `/creator-studio` | Yes | Legacy alias to AI Studio | Re-export of `/ai-studio`. |
| `/index` | No | Redirect helper to `/landing` | Keeps `/` from 404 in dev. |

Keep this table updated when adding routes and reflect protection rules in `frontend/lib/authGuard.ts`.
