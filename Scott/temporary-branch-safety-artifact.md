# Temporary Branch Safety Artifact

Recorded: 2026-06-14

Owner rule in force until Scott explicitly says otherwise:

- Production is off-limits in all capacities.
- Never touch production.
- Never apply changes to production.
- Never switch to production.
- Only work on branch `codex/brother-dashboard-aesthetics`.
- Never leave branch `codex/brother-dashboard-aesthetics`.
- Save Scott-agent memories, artifacts, and instructions under `Scott/`.

Current branch at time of record:

- `codex/brother-dashboard-aesthetics`

Latest verification:

- 2026-06-15: verified from `C:\CODEX Agents\Home page CODEX\ShortPulse` that the active branch is `codex/brother-dashboard-aesthetics`.
- 2026-06-16: verified from `C:\CODEX Agents\Home page CODEX\ShortPulse` that the active branch is `codex/brother-dashboard-aesthetics`; no branch switch was performed.
- 2026-06-16: Scott reaffirmed the branch lock and production ban for mobile optimization work; active branch remained `codex/brother-dashboard-aesthetics`.
- 2026-06-16: re-verified before homepage performance fixes that the active branch is `codex/brother-dashboard-aesthetics`; production was not touched, no production branch/env was used.
- 2026-06-16: re-verified before final public-home motion fixes that the active branch is `codex/brother-dashboard-aesthetics`; production remained fully off-limits and untouched.
- 2026-06-16: Scott reaffirmed the branch lock and production ban for the logged-in home page build; active branch remained `codex/brother-dashboard-aesthetics`.
- 2026-06-16: re-verified before thumbnail video quality/performance tuning that the active branch is `codex/brother-dashboard-aesthetics`; production remained fully off-limits and untouched.

Current performance mandate:

- Scott's current job request is the logged-in version of the home page, meaning the signed-in `/dashboard` experience.
- Scott's current scope constraint: do not edit the logged-out home page, signed-out `/dashboard`, or their components/data/copy/media/public-home CSS rules.
- Logged-in `/dashboard` should keep the general public-home aesthetic but avoid unnecessary sales elements such as public hero video, scrolling model strip, and acquisition header behavior.
- Logged-in `/dashboard` must keep tutorial thumbnails and preserve their existing click/modal/launch behavior.
- Scott's current job request is mobile optimization.
- Scott's current job request is speed, lag, and latency work.
- Prioritize responsive layout, touch ergonomics, mobile visual polish, and mobile performance while staying in the dashboard/homepage lane.
- Continue to treat production as fully off-limits while doing performance work.
- Keep Scott-agent memories, artifacts, and instructions under `Scott/`.

SOP trigger phrase:

- `run SOP`

SOP default push target:

- `https://github.com/Skillkwest/ShortPulse.git`
- preferred remote name: `skillkwest`
