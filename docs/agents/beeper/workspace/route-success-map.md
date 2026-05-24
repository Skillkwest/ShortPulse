# Beeper Route Success Map

Purpose: define one believable normal-user success path for each major route so coverage claims are tied to real outcomes rather than generic activity.

## Rule

- A route should not be treated as broadly `validated` unless Beeper can point to at least one success target below that a normal user would recognize as meaningful progress.
- Use this map before a run, together with `docs/agents/beeper/workspace/action-coverage/master-coverage-log.md` and `docs/agents/beeper/workspace/next-run-queue.md`, to choose the highest-ROI lane.

## Success Targets

| Route | Normal-user success target | Current state | Best current artifact |
| --- | --- | --- | --- |
| Auth | Sign in from a public entry point and reach the intended signed-in destination. | `validated` | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-logout-signin-lane-summary.md` |
| Dashboard | Reach the signed-in dashboard and use a primary entry control that leads to meaningful next action. | `partial` | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-project-create-lane-summary.md` |
| AI Studio | Open an existing or new project and complete one meaningful creation or editing workflow with visible result or persisted state. | `validated` | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-ai-studio-stateful-non-generate-summary.md` |
| Media Library | Browse owned assets, find a specific asset, and complete one believable asset-management action without confusion. | `partial` | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-media-library-search-lane-summary.md` |
| Character | Open Character, create or meaningfully edit a character/look, save it, and confirm the saved state is reusable. | `partial` | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-character-reuse-lane-summary.md` |
| Profile | Open settings, edit one safe field, save it, and confirm persistence after reload. | `validated` | `docs/agents/beeper/workspace/checkpoint-summaries/2026-05-15-prod-profile-safe-edit-save-lane-summary.md` |

## Highest-ROI Gaps

1. `Character` now has meaningful edit coverage, but continuity is still not trustworthy after reload/re-entry.
2. `Media Library` has browse/search coverage, but still needs a stronger believable management action.
3. `Dashboard` has strong entry validation, but still lacks a broader believable success target outside the launch-card path.

## Update Rule

- Update this file when a major route gains or loses a believable success path.
- Keep status labels honest:
  - `not-started`
  - `partial`
  - `validated`
