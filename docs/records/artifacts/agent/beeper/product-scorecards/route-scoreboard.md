# Route Scoreboard

Purpose: track route-level product quality scores over time.

| Route | Current score | Confidence | Last updated | Strongest positive | Strongest issue | Best artifact |
| --- | ---: | --- | --- | --- | --- | --- |
| Auth | 8.2 | `medium` | 2026-05-15 | Sign-out and sign-back-in loop validated cleanly. | Signed-out public home still carries a dashboard-style page title. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-logout-signin-lane.md` |
| Dashboard | 6.8 | `medium` | 2026-05-15 | Dashboard can create and reopen real projects. | `Open the AI Studio` semantics do not match what the user expects. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-real-user-exploratory.md` |
| AI Studio | 6.9 | `medium` | 2026-05-15 | Prompt persistence survives reload and fresh signed-in reopen. | Generate path remains untrustworthy and top-tab mapping is muddy. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-ai-studio-stateful-non-generate.md` |
| Media Library | 7.1 | `medium` | 2026-05-15 | Browse, filter, and single-item selection mostly work. | No-match image search falsely implies the user has no uploads. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-media-library-search-lane.md` |
| Character | 5.8 | `medium` | 2026-05-15 | Existing-character editor can still load and accept a real rename in-session. | Reload continuity can bounce back to auth instead of returning the user to the editor. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-character-reuse-lane.md` |
| Profile | 8.7 | `high` | 2026-05-15 | Display-name edit, save, and reload persistence worked cleanly. | No major active issue from the validated safe path. | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-profile-safe-edit-save-lane.md` |
