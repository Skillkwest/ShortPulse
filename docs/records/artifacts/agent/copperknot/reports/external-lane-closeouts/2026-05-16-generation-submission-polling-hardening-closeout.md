# External Lane Closeout: `generation-submission-polling-hardening`

## Lane id

`generation-submission-polling-hardening`

## Source handoff path

- In-thread user handoff packet: `Next-Agent Handoff: Generation Submission / Polling Hardening` (2026-05-16)

## Execution status

- `bounded patch complete`

## Systems touched

- `generation-submission-polling` (`Generation submission / polling`)

## Files changed

- `frontend/features/ai-studio/hooks/taskPolling/providerStatusPolicy.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/outputBootstrap.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/submissionLifecycle.ts`
- `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
- `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts`
- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-16-generation-submission-polling-hardening-closeout.md`

## Summary of what changed

- Added an explicit one-shot submission lifecycle claim so a handler can only choose one delivery path per output: queued polling or direct completion.
- Converted mixed or duplicate lifecycle callback attempts into a high-severity internal contract violation instead of letting the submission seam silently drift.
- Preserved the already-started user-visible flow when a contract violation happens after the first valid lifecycle claim, and added a guarded queued-handoff recovery path for post-start client exceptions so the UI does not falsely fail a live provider task.
- Marked direct-response `gpt-image-2` runs as `submissionMode: "direct-request"` at placeholder/bootstrap time so stale-output cleanup uses the correct timeout budget.
- Fixed polled success convergence so outputs that settle with `saveState: "saved"` also converge to `status: "saved"`.
- Hardened raw terminal provider failures without `shortpulseLifecycle` so they fail immediately using fallback provider error extraction instead of looping back into recovery polling.
- Expanded regression coverage for the highest-risk drift cases:
  - direct-complete handler that also attempts queued polling
  - queued handler that attempts to start polling twice
  - queued handoff followed by a local post-start exception
  - raw terminal failure without a lifecycle envelope
  - direct-request placeholder classification for immediate image runs
  - saved-state/status convergence on polling success

## Acceptance criteria reached

- Reduced the major submission ambiguity: direct-vs-queued routing is now explicit and one-shot.
- Reduced one major polling ambiguity: raw terminal failures and polled saved-state convergence now fail and settle explicitly instead of relying on implicit recovery behavior.
- Added targeted regression tests around the chosen submission/polling seam.
- Kept the patch bounded to the shared generation submission lifecycle and hook-level error handling.
- Did not expand into provider rewrites, recovery redesign, or billing changes outside submit-call invariants.

## Evidence snapshot

- branch: `production`
- commit(s) reviewed or created: none created in this lane
- worktree checkpoint: uncommitted patch on top of a dirty repo; lane-specific changes are limited to the files listed above

## Validation run

- `npm -C frontend run test -- --run features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts`
- `npm -C frontend run test -- --run features/ai-studio/hooks/__tests__/useAiStudioOutputLifecycle.test.ts features/ai-studio/logic/__tests__/staleOutputCleanup.test.ts`

## Validation evidence

- Focused controller + submission + polling suites passed: `features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`, `features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`, and `features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts` with `126` tests passing total.
- Focused timeout/cleanup suites passed: `features/ai-studio/hooks/__tests__/useAiStudioOutputLifecycle.test.ts` and `features/ai-studio/logic/__tests__/staleOutputCleanup.test.ts` with `30` tests passing total.
- No additional validation blockers were hit inside the touched seam during this closeout pass.

## Blockers encountered

- `none`

## Residual risk

- This hardening covers the client submission lifecycle and polling convergence contract, not provider-specific payload correctness.
- The patch still assumes providers either emit `shortpulseLifecycle` or enough raw error shape for fallback extraction to be meaningful.
- Recovery convergence after polling remains a separate seam and still needs its own evidence before moving the whole shared runtime row higher with confidence.

## Recommended score effect

- `consider +1`

## Recommended next step for Copperknot review

- The score bump is justified if the Copperknot agrees the most drift-prone direct-vs-queued ingress ambiguity is now explicit, fail-closed, and regression-tested.
- Follow-up scope is still needed, but it should stay bounded: inspect polling-to-recovery convergence next rather than reopening provider adapters.
- Queue guidance: treat this lane as complete and move the next shared-runtime validation pass to recovery handoff or server-visible convergence evidence.
