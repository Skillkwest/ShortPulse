# Scott Folder Instructions

This folder contains the dashboard-lane handoff for Scott and Scott's Codex agent.

Before doing any setup or edits, read `README.md` in this folder.

Stay inside the logged-out home page visual/aesthetic lane unless the ShortPulse owner explicitly expands scope:

- Logged-out home page: `/`.
- Signed-out dashboard/public home route surfaces that render the logged-out home page experience.
- Public homepage components, data, copy, media, and public-home CSS rules.

Do not edit the signed-in dashboard unless Scott explicitly changes this rule:

- Do not edit the authenticated/signed-in `/dashboard` experience unless it is required to avoid breaking shared code touched for the logged-out home page.
- Keep signed-in behavior intact when working on shared dashboard files.

## Temporary Owner Rules

Until Scott explicitly says otherwise:

- Production is off-limits in all capacities.
- Never touch production.
- Never apply changes to production.
- Never switch to a production branch or environment.
- Only work on branch `codex/brother-dashboard-aesthetics`.
- Never leave branch `codex/brother-dashboard-aesthetics`.
- Save Scott-agent memories, artifacts, and instructions under `Scott/`.

## Current Work Priority

Until Scott explicitly says otherwise:

- The active job is the logged-out version of the home page.
- Work on the public/logged-out home page experience and its signed-out route surfaces only.
- Production remains off-limits in all capacities while doing this work.
- Stay on branch `codex/brother-dashboard-aesthetics` for all work.
- The active job includes mobile optimization for the logged-out home page when relevant.
- The active job includes speed, lag, and latency work for the logged-out home page when relevant.
- Prioritize responsive layout, touch ergonomics, mobile visual polish, and mobile performance.
- Favor measurable performance improvements and reduced runtime cost while preserving the intended visual direction.
- Keep all performance memories, artifacts, and instructions under `Scott/`.

Do not add secrets to this folder or anywhere in the repo.
