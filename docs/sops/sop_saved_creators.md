# SOP: Saved Creators Page

## Purpose
Manage the saved creator list, add new handles with platform context, and launch profile links to Instagram/TikTok/YouTube directly.

## Data flow
- Supabase table `saved_creators`: columns `id`, `handle`, `platform`, `followers`, `avg_views`, `user_id`, `created_at`.
- Client loads rows ordered by `created_at` desc.
- Add flow normalizes handles via `sanitizeHandle` (strips zero-width/nbsp, whitespace, leading `@`) before insert.
- Profile links are built per platform prefix (ig/tiktok/youtube) with the sanitized, URL-encoded handle; TikTok uses `?lang=en` for compatibility.
- Delete removes the row by `id` and prunes local state.

## UX layout (Saved Creators)
- Back link -> trimmed hero with `background-gray.png` (full opacity, no dark overlays).
- Header stat chips (Searches placeholder, Plan chip).
- Intake panel: handle input with `@` prefix, platform dropdown (custom select), add button. Autofill is tamed to keep the dark UI.
- Saved list: table-style rows (creator, platform, followers, avg views, actions).
- Avatar badges: circular, dark fill, teal outline, low-contrast teal outline icon fallback (UserCircle); real avatar image may replace when available.
- Spacing: 24px rhythm between back link, hero, intake, and list panels.
- Table borders: row-level borders to avoid gridline bleed under action buttons.

## Known issues
- TikTok profile link works in Chrome but fails in ChatGPT Atlas webview with TikTok’s “Something went wrong.” Current URL format: `https://www.tiktok.com/@<handle>?lang=en`, sanitized and encoded, `referrerPolicy="no-referrer"`. See `docs/known-issues.md`.

## Update checklist
- When changing link logic or sanitizer, update both `getProfileUrl`, Supabase insert, and mapping when loading.
- Keep `background-gray.png` in `frontend/public/background-gray.png` as the active runtime asset (legacy `Gray.png` remains only for compatibility during sunset window).
- Maintain consistent spacing (24px) between cards and headers.
- Keep avatar styles synced with `workspace-dashboard.css` (circular, dark fill, teal outline, muted teal icon).
