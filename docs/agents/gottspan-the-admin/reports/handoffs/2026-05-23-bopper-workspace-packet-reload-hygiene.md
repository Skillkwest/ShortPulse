# Handoff: Bopper Workspace Packet And Reload Hygiene

Owner: Bopper

## Problem

Bopper is healthier than Beeper and already has explicit segregation from Beeper, but it has a lot of local workspace material: `HANDOFF.md`, `AGENT-INSTRUCTIONS.md`, `MEMORY.md`, run packets, reports, checkpoint summaries, and retained artifacts. The cleanup lane is not urgent, but Bopper should keep the workspace reload layer thin and make packet retention intentional.

## Evidence

- Workspace-local files include:
  - `bopper/HANDOFF.md`
  - `bopper/AGENT-INSTRUCTIONS.md`
  - `bopper/MEMORY.md`
  - `bopper/TRAINING-SYSTEM.md`
  - `bopper/PERSONA.md`
- Run packet JSON files exist under:
  - `bopper/runs/2026-05-15-202334-dashboard-new-project-retest/packet.json`
  - `bopper/runs/2026-05-15-204909-dashboard-new-project-fix-retest/packet.json`
  - `bopper/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/packet.json`
- `bopper/HANDOFF.md` already says not to expand local reload files into a second contract. That is the right direction and should be enforced.

## Requested Cleanup

1. Decide which Bopper local workspace files are default-load versus archive/reference.
2. Make packet JSON retention explicit:
   - keep only if it is still useful as structured training data,
   - otherwise replace with report links or compact manifests.
3. Ensure `AGENT-INSTRUCTIONS.md` and `MEMORY.md` remain thin reload files, not duplicate contracts.
4. Confirm Beeper mentions are historical/comparison-only and not live routing.

## Validation

- Run `npm -C frontend run docs:check`.
- Confirm Bopper's default load path fits on a short checklist and does not require loading run packets by default.
