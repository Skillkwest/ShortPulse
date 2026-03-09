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
| `/ai-studio` | Yes | Creative canvas (prompt/image/video) | `/creator-studio` forwards here. Session identity contract uses `?sid=<uuid>`; plain `/ai-studio` starts a new session id via shallow replace. Beginner mode is temporarily force-disabled and toggle controls are hidden by runtime policy flags. Expert Edit properties panel is default for Edit workflow; set `NEXT_PUBLIC_ENABLE_EXPERT_EDIT_UI=false` for legacy Edit fallback. On refresh/new session for non-canvas workflows, the right-rail Canvas panel defaults hidden. `Shortcuts -> Styles` opens a primary left-panel Styles Library of currently loaded styles that shares style selection state with expert Create/Edit style controls; while Styles is active, the right rail stays visible in reference-grid-only mode (Canvas/Quick Slot/Styles subpanels hidden). The primary Styles Library supports drag/drop reordering of style-card positions, drag/drop image intake from your computer/Reference Grid/Quick Slot to auto-create custom styles, and an `Add Style` tile that opens a create-style modal. `Shortcuts -> Presets` opens a primary left-panel Presets Library sourced from the Expert Edit preset catalog with `Custom 1`, `Custom 2`, and `Custom 3` placeholder tiles plus a full-size `Create New Preset` tile while keeping the right rail visible; clicking a preset tile opens an edit modal for preset name + prompt text, clicking `Create New Preset` opens create mode for the next custom slot (`Custom 4+`), and saves persist via per-user preset overrides. Hovering a real style tile reveals a destructive `X` delete action with yes/no confirmation; confirmed deletes persist per-user via Supabase-backed preferences. Clicking a real style tile opens an edit modal for `Style`, `Reference Image`, and `Style Prompt`; saves persist via Supabase-backed per-user style detail overrides. Video model modal surfaces Fal and Kie image-to-video chips together; Kie submit/status routes remain runtime-gated. |
| `/character` | Yes | Character Manager (reference intake + character management) | Upload and persist unlimited QuickSwap references per character (500 active, overflow archived), then arrange and persist character-sheet assignments for downstream generation wiring. Character Sheet preset tabs are dynamic (`1..10`): default one visible tab (`1`), `+` adds tabs, double-click rename autosaves per user/character, and tabs after `1` can be deleted via `X` with confirmation (removing that tab's saved preset references). Character Profile description is preset-scoped to the active tab and persists per preset; AI Studio Character Mode uses active-tab description first with legacy description fallback. This behavior is shared with the AI Studio Character Properties panel. Beginner toggle controls are temporarily hidden by runtime policy flags. |
| `/character-soon` | Yes | Legacy placeholder route for Character | Kept as fallback while Character Manager rollout stabilizes. |
| `/profile` | Yes | Profile/account/billing UI | Logout modal; plan badges; account-level AI Studio media autosave toggle. |
| `/admin` | Yes | Internal admin dashboard | Operator-only surface (`app_metadata` role or admin allowlist); not part of MVP. |
| `/admin/generation-trace` | Yes | Admin generation trace page | Operator-only debugging route for stitched generation timelines. |
| `/onboarding` | No | Lightweight onboarding shell | Links to dashboard/features. |
| `/creator-studio` | Yes | Legacy alias to AI Studio | Re-export of `/ai-studio`. |
| `/index` | No | Redirect helper to `/landing` | Keeps `/` from 404 in dev. |

Keep this table updated when adding routes and reflect protection rules in `frontend/lib/authGuard.ts`.
