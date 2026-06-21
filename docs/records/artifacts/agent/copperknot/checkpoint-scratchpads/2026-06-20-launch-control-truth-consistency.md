# 2026-06-20 Launch Control Truth Consistency

Touched:

- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- `docs/agents/copperknot/july-7-launch-board.md`

Change:

- Clarified that the June 20 production route-parity proof predates local `/onboarding` retirement and does not prove deployed `/onboarding` absence.
- Removed stale prose that still called `Public entry and account trust` `Launchable With Watch`.
- Added the public legal/policy footer gate to the current blocker summary.

Validation:

- `npm -C frontend run docs:check`
- `git diff --check`
- targeted stale-claim search

Boundary:

- Docs truth aligned only. Production route proof and legal/policy content remain separate gates.
