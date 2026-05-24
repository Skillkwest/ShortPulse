# Bopper Evidence Manifest

Purpose: keep the run packet self-contained by naming what evidence exists and what each artifact proves.

## Run

- Date: 2026-05-15
- Task: dashboard new project fix retest

## Expected Artifacts

- UI screenshots: Chrome Computer Use snapshots were captured for the signed-in dashboard, Projects modal, name dialog, and both healthy AI Studio destinations. No separate local image files were exported during this run.
- Runtime/network captures: none captured directly.
- Console captures: none.
- Any copied API payloads or IDs:
  - project-library create path project id: `85be657f-d4fb-4dcd-addb-d702caa5f6af`
  - direct dashboard create path project id: `abb5b861-d670-4f47-8c87-b099119383fc`

## Artifact Notes

- What each artifact proves:
  - signed-in dashboard snapshot proves the obvious signed-in create CTA was visible and usable
  - Projects modal snapshot proves the saved-project path is readable and contains a clear `New Project` escape hatch
  - name-dialog snapshot proves both create variants still use the same low-friction naming step
  - final AI Studio snapshots prove both create variants now land in a usable workspace instead of the old `Project unavailable` dead end
- Missing evidence to capture before closeout:
  - stable local screenshot files would make the packet more portable outside the chat thread
