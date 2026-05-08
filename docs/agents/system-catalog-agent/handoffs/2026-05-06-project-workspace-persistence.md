# Next-Agent Handoff: Project / Workspace Persistence Hardening

## Lane Id

`project-workspace-persistence-hardening`

Purpose: harden the current project-owned save/restore authority before final ship evaluation.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Do not broaden into a full project-system redesign unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Project / workspace persistence`
- Current score: `6/10`
- Target score: `7/10`
- Ship floor: `7/10`
- This system now owns durable workspace behavior for AI Studio and cannot remain only partially trusted near ship.
- Why the score is currently low:
  - restore and association invariants are still not explicit enough
  - persistence trust remains broader than the ship bar should allow

## Recommended agent profile

Persistence-contract agent with strong ownership, restore, and data-sanitization discipline.

## Scoped task

Investigate and harden one high-ROI persistence invariant in project workspace save/restore, especially around association backfill, restore filtering, or excluded runtime state.

## Owned write surface

- `frontend/pages/api/projects/[...projectPath].ts`
- `frontend/lib/server/projectsService.ts`
- `frontend/lib/server/projectWorkspaceStatesService.ts`
- `frontend/lib/server/projectGenerationAssociationsService.ts`
- directly related project workspace tests

## Avoid surface

- general AI Studio canvas workflow files
- provider runtime and recovery files
- broad Media Library surfaces
- unrelated project dashboard feature files

## In scope

- project identity and ownership checks
- workspace snapshot sanitization
- generated-output association refresh
- restore exclusions and fail-closed behavior
- targeted persistence tests

## Out of scope

- general AI Studio workflow redesign
- Media Library UX redesign
- unrelated project dashboard feature work

## Required context

Read first:

- `docs/systems/catalog.md`
- `docs/sops/sop_ai_studio_projects_foundation.md`
- `docs/adr/0062-project-identity-foundation.md`
- `docs/adr/0063-project-workspace-authority.md`
- `docs/adr/0070-project-workspace-conversational-runtime-exclusion.md`

Inspect first:

- `frontend/pages/api/projects/[...projectPath].ts`
- `frontend/lib/server/projectsService.ts`
- `frontend/lib/server/projectWorkspaceStatesService.ts`
- `frontend/lib/server/projectGenerationAssociationsService.ts`
- related project workspace tests

## Questions to answer

1. Where is restore trust still too broad or too implicit?
2. Which snapshot or association invariant is most likely to fail silently?
3. What is the smallest fix that increases trust in project-owned restore behavior?

## Expected output

- one bounded persistence hardening patch with tests, or
- one findings packet with a smaller follow-up scope

## Suggested validation

- targeted project workspace and association tests
- `npm -C frontend run docs:check` if docs change

## Done state

- one project restore/persistence invariant is made more explicit, more tested, or more fail-closed

## Stop rules

- Stop before expanding into a broad project-system rewrite unless the bounded issue cannot be fixed otherwise.

## Required closeout report

- Path:
  - `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`
- Filename:
  - `YYYY-MM-DD-project-workspace-persistence-hardening-closeout.md`

## Closeout And Archive

- Return one of:
  - bounded persistence patch complete
  - findings packet complete
  - blocked with evidence
- End with:
  - what changed
  - what was verified
  - residual risk
  - exact next step if unresolved
- Create the closeout report in the required report path before considering the lane finished.
- After returning the result, this lane should be considered ready to archive unless the user explicitly reopens it.
