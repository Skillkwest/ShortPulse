# Evidence Manifest: Reference Grid Understanding

Run: `2026-07-06-reference-grid-understanding`
Date: `2026-07-06`
Scenario: Understand Reference Grid
Asset folder: `docs/agents/testers/maya-chen/reports/assets/2026-07-06-reference-grid-understanding/`

| Artifact                                          | Moment Captured                                                                                                                        | Maya Meaning                                                                                                                                      | Used In                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `01-reference-grid-starting-state.png`            | AI Studio Create surface with Quick Slot Inventory, Reference Grid, `Media: 2/500`, two reference thumbnails, and `Generate 4`.        | Shows that saved images are present, but the grid does not explain whether they are saved media, active references, or temporary workspace items. | Maya report and engineering handoff |
| `02-reference-grid-hidden-after-toggle.png`       | Media panel with one selected item, `Delete from library`, and Reference Grid hidden after the top `Reference Grid` label was clicked. | Shows the top label behaves like a show/hide toggle and that selecting media exposes destructive library actions before explaining reuse.         | Maya report and engineering handoff |
| `03-quick-slot-hidden-reference-grid-visible.png` | AI Studio Create surface after clicking `Quick Slot Inventory`, leaving Reference Grid visible and Quick Slot hidden.                  | Shows the related top controls behave consistently as toggles, but their labels do not make that clear to a new user.                             | Maya report and engineering handoff |

## Evidence Quality Notes

- Screenshots were kept because they show the UI confusion and visible saved-work/reference state.
- No screenshots with account email, billing details, credentials, tokens, cookies, or private auth state were kept.
- No destructive action, generation, credit spend, deletion, account change, or billing change occurred.
