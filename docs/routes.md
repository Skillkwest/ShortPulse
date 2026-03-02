# Routes Map

Reference for pages, auth expectations, and ownership.

| Route | Auth required | Purpose | Notes |
| --- | --- | --- | --- |
| `/landing` | No | Marketing landing page | Root redirects here. |
| `/auth` | No | Email/password auth via Supabase | Redirects to `/dashboard` on session. |
| `/dashboard` | Yes | Workspace hub with plan/status chips and tool cards | Uses `useProtectedRoute`. |
| `/performance` | Yes | Performance analytics | Authenticated demo analytics route; dashboard entry remains staged through `/performance-soon`. |
| `/performance-soon` | Yes | Temporary placeholder for the analytics workspace | Explains that the Performance surface is still under construction. |
| `/saved-creators` | Yes | Saved creators list | Post‑MVP (Coming Soon). |
| `/media-library` | Yes | Private bucket file manager | Uses `media_library` bucket + `media_files` table (RLS), including Private tab uploads under `<auth.uid()>/private/images/...`. |
| `/ai-studio` | Yes | Creative canvas (prompt/image/video) | `/creator-studio` forwards here. Session identity contract uses `?sid=<uuid>`; plain `/ai-studio` starts a new session id via shallow replace. Beginner mode is temporarily force-disabled and toggle controls are hidden by runtime policy flags. Video model modal surfaces Fal and Kie image-to-video chips together; Kie submit/status routes remain runtime-gated. |
| `/character` | Yes | Character Manager (reference intake + character management) | Upload and persist unlimited QuickSwap references per character (500 active, overflow archived), then arrange and persist character-sheet assignments for downstream generation wiring. Character Sheet preset tabs are dynamic (`1..10`): default one visible tab (`1`), `+` adds tabs, double-click rename autosaves per user/character, and tabs after `1` can be deleted via `X` with confirmation (removing that tab's saved preset references); this behavior is shared with the AI Studio Character Properties panel. Beginner toggle controls are temporarily hidden by runtime policy flags. |
| `/character-soon` | Yes | Legacy placeholder route for Character | Kept as fallback while Character Manager rollout stabilizes. |
| `/profile` | Yes | Profile/account/billing UI | Logout modal; plan badges; account-level AI Studio media autosave toggle. |
| `/admin` | Yes | Internal admin dashboard | Operator-only surface (`app_metadata` role or admin allowlist); not part of MVP. |
| `/admin/generation-trace` | Yes | Admin generation trace page | Operator-only debugging route for stitched generation timelines. |
| `/onboarding` | No | Lightweight onboarding shell | Links to dashboard/features. |
| `/creator-studio` | Yes | Legacy alias to AI Studio | Re-export of `/ai-studio`. |
| `/index` | No | Redirect helper to `/landing` | Keeps `/` from 404 in dev. |

Keep this table updated when adding routes and reflect protection rules in `frontend/lib/authGuard.ts`.
