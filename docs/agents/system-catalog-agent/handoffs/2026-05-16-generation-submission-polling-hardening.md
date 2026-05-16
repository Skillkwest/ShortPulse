# Next-Agent Handoff: Generation Submission / Polling Hardening

## Lane Id

`generation-submission-polling-hardening`

Purpose: tighten the accepted-job ingress and client polling seam so the shared generation runtime can move closer to ship floor after recovery hardening.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Do not expand into downstream recovery settlement or provider-implementation rewrites unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Generation submission / polling`
- Current score: `6/10`
- Target score: `7/10`
- Ship floor: `7/10`
- This system is still below ship floor in the shared generation hot path.
- Why the score is currently low:
  - submit invariants, optimistic lifecycle state, direct-vs-queued routing, and client polling behavior all converge here before recovery can compensate
  - recent production changes touched the generation-controller seam, which makes this a timely boundary to harden while the runtime is already in motion

## Recommended agent profile

Shared runtime hardening agent with good ingress-contract and async-state discipline.

## Scoped task

Find the highest-ROI bounded hardening change in submission/polling that improves correctness or confidence without reopening the whole provider stack or downstream recovery system.

## Owned write surface

- `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
- `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/`
- directly related generation-controller or polling tests

## Avoid surface

- downstream recovery/settlement internals
- billing ledger implementation outside direct submit-call invariants
- broad provider adapter rewrites
- unrelated AI Studio panel or styling work

## In scope

- submit invariant enforcement
- direct-vs-queued routing clarity
- optimistic output/generation-record handoff correctness
- client polling state transitions
- targeted regression or characterization tests for the chosen seam

## Out of scope

- provider pricing policy
- reference-grid UI behavior
- broad recovery or billing redesign

## Required context

Read first:

- `docs/systems/catalog.md`
- `docs/sops/sop_image_generation.md`
- `docs/sops/sop_video_generation.md`
- `docs/routes.md`

Inspect first:

- generation controller and task-submission hooks
- polling runtime files
- existing tests around submission and queued status handling

## Questions to answer

1. Which ingress or polling invariant is still too implicit?
2. Which path is most likely to drift first: submit routing, optimistic state, or polling convergence?
3. What single bounded hardening change would move confidence fastest?

## Expected output

- one bounded hardening patch with tests, or
- one findings packet that identifies the best next scoped seam

## Suggested validation

- targeted generation-controller and submission/polling tests
- `npm -C frontend run docs:check` if docs change

## Done state

- one major submission/polling ambiguity or weak invariant is reduced
- the closeout makes it clearer whether this runtime row can move toward floor

## Stop rules

- Stop before opening a broad provider-adapter rewrite with no sharply bounded win.
- Stop if the work requires simultaneous redesign across Create, Edit, Video, and recovery to claim progress.

## Required closeout report

- Path:
  - `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`
- Filename:
  - `YYYY-MM-DD-generation-submission-polling-hardening-closeout.md`
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
  - blockers encountered
  - residual risk
  - recommended score effect
  - recommended next step for Catalog Agent review

## Closeout And Archive

- Return one of:
  - bounded hardening patch complete
  - findings packet complete
  - blocked with evidence
- End with:
  - what changed
  - what was verified
  - residual risk
  - exact next step if unresolved
- Create the closeout report in the required report path before considering the lane finished.
- After returning the result, this lane should be considered ready to archive unless the user explicitly reopens it.
