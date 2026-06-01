# Next-Agent Handoff: Project / Workspace Persistence Hardening

## Lane Id

`project-workspace-persistence-hardening`

Purpose: harden the current project-owned save/restore authority before final ship evaluation.

## Current Status

This packet is retained as the source handoff for the persistence lane, but it is no longer a dispatch-ready worker packet. The current worktree has a local source fix for the generated-output restore filter: read canonicalization now resolves generated-output authority by `generationId`, `taskId`, and `sourceRef`, and fails closed when runtime identity cannot be ownership-resolved.

Next proof boundary: deploy the local persistence fix through the release lane, then rerun the production persistence audit. Do not dispatch this packet again unless production remeasurement or a fresh code audit reopens a smaller source problem.

## Fix Classification

`root fix` preferred

If a true source-level fix is not practical inside the bounded write surface, a `bounded seam reduction` is acceptable only if the residual risk is named explicitly and the lane does not drift into workaround layering.

## Copy/Paste Use

- Historical packet only while the local source fix is waiting on deployment proof.
- Treat it as a source context packet, not an active worker prompt.
- Do not broaden into a full project-system redesign unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Project / workspace persistence`
- Current score: `6/10`
- Target score: `7/10`
- Ship floor: `7/10`
- Queue status: exact next after the `2026-05-31` approved-panel post-deploy verification
- This system now owns durable workspace behavior for AI Studio and cannot remain only partially trusted near ship.
- Why the score is currently low:
  - restore and association invariants are still not explicit enough across the full project-owned path
  - persistence trust remains broader than the ship bar should allow
  - the earlier bounded ownership hardening on `project_generation_items` was real progress, but it did not clear the broader row to floor

## Current Evidence

- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-approved-panel-post-deploy-verification.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-project-workspace-persistence-root-seam-audit.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-project-workspace-production-verification-failure.md`
- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-16-project-workspace-persistence-hardening-closeout.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-30-production-post-redeploy-baseline-refresh.md`

Current Copperknot judgment:

- the Elements hotspot cooled enough on production that this row returned to exact next
- the prior persistence lane removed one eager association trust gap
- broader trust is still too thin to claim floor-level confidence
- the earlier May 31 ownership-resolution fix was live on production, but the first production persistence verification still reproduced the orphan generated-output class
- the current worktree now addresses the narrower generated-output restore filter in `sanitizeProjectWorkspaceOutputs(...)`
- generated rows that have lost canonical association ids now fail closed unless the read path can resolve durable or runtime-owned generated authority through `generationId`, `taskId`, or `sourceRef`
- current repo truth distinguishes two different ideas:
  - live UI code can still treat `mediaSource === "generated"` rows as generated outputs for preview behavior
  - project workspace persistence should only keep generated rows when they still have durable project-owned authority or ownership-resolvable runtime identity

## Recommended agent profile

Persistence-contract review only if this packet is reopened after production proof.

## Scoped task

Investigate and harden one highest-ROI remaining persistence invariant in the canonical project-owned save/restore path, especially around:

- restore filtering
- association integrity
- excluded runtime state
- historic bad-state tolerance or cleanup needs

Do not just add another local guard if the owning source seam can be fixed directly.

Current fixed source seam:

- `frontend/lib/server/projectWorkspaceStatesService.ts`
- `sanitizeProjectWorkspaceOutputs(...)`
- inner `sanitizeRows(...)`
- previous behavior could preserve shape-valid generated rows after they lost `generationId`, `promptId`, and `savedMediaIds`
- current local behavior fails closed when generated-looking rows lack durable project-owned authority and generation authority was not resolved
- current local behavior also resolves generated ownership through runtime identity:
  - `taskId`
  - `sourceRef`
- source references for that predicate are:
  - `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`
  - `hasProjectDurableOutputAuthority(...)`
  - `hasProjectRecoverableRuntimeIdentity(...)`
  - `isGeneratedOutput(...)`
- production proof is still missing for the current local fix

## Owned write surface

- `frontend/pages/api/projects/[...projectPath].ts`
- `frontend/lib/server/projectsService.ts`
- `frontend/lib/server/projectWorkspaceStatesService.ts`
- `frontend/lib/server/projectGenerationAssociationsService.ts`
- directly related project workspace projection helpers
- directly related project workspace tests

## Avoid surface

- general AI Studio canvas workflow files
- provider runtime and recovery files
- broad Media Library surfaces
- unrelated project dashboard feature files
- UI, UX, or intended behavior changes unless Copperknot explicitly reclassifies the lane first

## In scope

- project identity and ownership checks
- workspace snapshot sanitization
- generated-output association refresh
- generated-output orphan-row fail-closed filtering
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

1. Where is project-owned restore/save trust still too broad or too implicit?
2. Which canonical source seam is still most likely to fail silently or preserve bad state?
3. Is the right move a source fix, a bounded seam reduction, or only a findings packet?
4. Do historical bad rows or stale persisted shapes now need a one-time cleanup or validation pass before ship?
5. Should generated rows without canonical association ids fail closed during read canonicalization instead of surviving as shape-valid outputs?
6. Which row traits should still count as "generated output" for fail-closed read filtering once `generationId` is already gone?
7. Should the restore predicate key off durable authority plus recoverable runtime identity rather than the broader UI-level `mediaSource === "generated"` previewability rule?
8. Can the read path reuse or faithfully mirror `shouldPersistOutputInProjectWorkspaceSnapshot(...)` so project-owned restore authority stays consistent on both write and read?

## Expected output

- one bounded persistence hardening patch with tests and explicit fix classification, or
- one findings packet with a smaller follow-up scope and exact source seam named

## Suggested validation

- targeted project workspace and association tests
- one focused read-path regression test for a shape-valid generated row that has already lost `generationId`, `promptId`, and `savedMediaIds`
- `npm -C frontend run docs:check` if docs change

## Done state

- one project restore/persistence invariant is made more explicit, more tested, or more fail-closed
- the result says clearly whether it is a `root fix` or `bounded seam reduction`
- no UI, UX, or intended behavior change is introduced silently

## Stop rules

- Stop before expanding into a broad project-system rewrite unless the bounded issue cannot be fixed otherwise.
- Stop if the best next move is really a data cleanup or migration lane rather than a bounded code fix, and return that as a findings packet instead of improvising around it.

## Required closeout report

- Path:
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`
- Filename:
  - `YYYY-MM-DD-project-workspace-persistence-hardening-closeout.md`
- Required contents:
  - lane id
  - source handoff path
  - execution status
  - systems touched
  - files changed
  - summary of what changed
  - acceptance criteria reached
  - evidence snapshot
  - validation run
  - validation evidence
  - self-audit findings
  - issues fixed during self-audit
  - issues intentionally left out of scope
  - blockers encountered
  - residual risk
  - recommended next step for Copperknot review

## Send To Catalog

When the user says `send this to the catalog`, do not stop at a chat summary.

Do all of these:

1. Write the closeout report in:
   - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`
2. Use the filename:
   - `YYYY-MM-DD-project-workspace-persistence-hardening-closeout.md`
3. Follow the required closeout contents exactly.
4. Then tell the user:
   - the closeout filename
   - the files changed
   - whether the lane is:
     - `bounded persistence patch complete`
     - `findings packet complete`
     - `blocked with evidence`

## Closeout And Archive

- Return one of:
  - bounded persistence patch complete
  - findings packet complete
  - blocked with evidence
- End with:
  - what changed
  - what was verified
  - what self-audit found
  - what was fixed during self-audit
  - residual risk
  - exact next step if unresolved
- Create the closeout report in the required report path before considering the lane finished.
- After returning the result, this lane should be considered ready to archive unless the user explicitly reopens it.
