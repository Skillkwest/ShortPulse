# Beeper Master Coverage Log

Purpose: track which real-user surfaces and actions have already been exercised, how deeply they were tested, and what should be targeted next.

## Status Key

- `not-started`: no meaningful test yet
- `opened`: route or surface reached only
- `clicked`: visible controls exercised
- `partial`: deeper behavior tested, but not full create/edit/save style validation
- `validated`: end-to-end user behavior completed with confidence

## Coverage Matrix

| Surface / Workflow             | Current status | What has been tried already                                                                                                                                                        | What still needs testing                                                                                                      | Best artifact                                                                                |
| ------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Auth sign-in                   | `partial`      | Production sign-in completed; fallback to standalone browser session when in-app typing stalled                                                                                    | Repeat in smoother path, sign-out, sign-back-in, failed-login states, password reset or recovery if in scope                  | `beeper/checkpoint-summaries/2026-05-15-prod-sign-in-summary.md`                             |
| Dashboard landing              | `clicked`      | Landed signed-in, reviewed summary, read announcement, used visible hero entry cards                                                                                               | Deeper use of additional dashboard controls, announcement behavior, edge states, loading/empty variants                       | `beeper/checkpoint-summaries/2026-05-15-prod-real-user-exploratory-summary.md`               |
| Dashboard -> New Project CTA   | `validated`    | Clicked `New Project`; confirmed the modal opens, accepted a real custom title, landed in AI Studio, and confirmed project persistence afterward                                   | Error states, repeated create behavior, and whether the first-click semantics should still change                             | `beeper/checkpoint-summaries/2026-05-15-prod-project-create-lane-summary.md`                 |
| Dashboard -> Open Projects CTA | `partial`      | Clicked `Open Projects`; opened the overlay both in zero-state and post-create state; confirmed the newly created project is visible there                                         | Open an existing saved project from the overlay, close/reopen behavior over multiple sessions, delete/archive states if safe  | `beeper/checkpoint-summaries/2026-05-15-prod-project-create-lane-summary.md`                 |
| Projects overlay zero state    | `clicked`      | Opened zero state and clicked `New Project` from inside overlay                                                                                                                    | Create a project from this path, persistence after reload, switching once projects exist                                      | `beeper/checkpoint-summaries/2026-05-15-prod-real-user-exploratory-summary.md`               |
| Project creation modal         | `validated`    | Opened the modal, replaced the default title, submitted create, and confirmed the created project persisted                                                                        | Validation edge states, rename behavior, repeated create quality                                                              | `beeper/checkpoint-summaries/2026-05-15-prod-project-create-lane-summary.md`                 |
| AI Studio route/shell          | `partial`      | Reached AI Studio during the core sweep, landed there after a real project create, reopened a saved project directly, used prompt entry, and tested the in-studio projects control | Real generation success path, deeper library flows, non-generate editing tools, clearer mode-specific behavior                | `beeper/checkpoint-summaries/2026-05-15-prod-ai-studio-working-lane-summary.md`              |
| AI Studio -> Generate          | `partial`      | Entered a real prompt and clicked both visible generate controls; prompt saved to workspace but no visible generation request/progress/result appeared                             | Confirm true root cause, validate fixed generate path, then verify reference-grid result handling                             | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-ai-studio-generate-noop.md`          |
| AI Studio -> Projects overlay  | `clicked`      | Opened the in-studio projects control and confirmed the current Beeper project is visible there                                                                                    | Open/switch among saved projects from inside AI Studio, repeated reopen behavior, zero-state handling if project list changes | `beeper/checkpoint-summaries/2026-05-15-prod-ai-studio-working-lane-summary.md`              |
| AI Studio -> Top layout tabs   | `partial`      | Clicked `Quick Slot Inventory`, `Reference Grid`, and `Canvas`; the visible panel state did not line up cleanly with the labels even after wide recapture                          | Confirm fixed tab-to-panel mapping, understand hidden-panel rules, retest with generate bug still open                        | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-ai-studio-top-tab-panel-mismatch.md` |
| AI Studio -> Left libraries    | `partial`      | Opened Media, Characters, Elements, Presets, Styles, and Templates; all exposed real content or honest `COMING SOON` state                                                         | Deeper per-library interaction, selection, save/edit flows, drag/drop behavior where safe                                     | `beeper/checkpoint-summaries/2026-05-15-prod-ai-studio-non-generate-lane-summary.md`         |
| Media Library route            | `partial`      | Route opened, initial asset grid loaded, failing preview path investigated                                                                                                         | Upload path, asset selection, search/filter, detail behavior, save/edit states, repeated preview quality checks               | `beeper/checkpoint-summaries/2026-05-15-prod-core-audit-summary.md`                          |
| Character route                | `opened`       | Route reached during core sweep                                                                                                                                                    | Real create/edit/use path, save behavior, error handling, empty/loading states                                                | `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-core-audit.md`                  |
| Profile/account settings       | `clicked`      | Opened avatar menu, navigated to settings, reviewed Subscription/Credits/Storage/Transactions sections                                                                             | Edit profile fields if allowed, save behavior, section transitions, billing edge states                                       | `beeper/checkpoint-summaries/2026-05-15-prod-real-user-exploratory-summary.md`               |
| Logout flow                    | `not-started`  | Not tested yet                                                                                                                                                                     | Open logout confirmation, cancel, confirm, sign-back-in result                                                                | No artifact yet                                                                              |

## Priority Gaps

- verify or debug a successful AI Studio generation path after the current no-op finding
- test logout and re-entry as a normal user path
- cover at least one editable profile/account action if it is safe in production
- exercise deeper non-generate studio tools such as media/library selection or edit workflows

## Next Suggested Lanes

1. AI Studio non-generate workflow coverage while the generate bug is open.
2. Logout -> sign-back-in loop.
3. Existing-project open path from the dashboard projects overlay.
4. Media Library non-bug workflow coverage such as browse/select/search if safe.
