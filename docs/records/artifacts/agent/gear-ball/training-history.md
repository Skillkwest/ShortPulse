# Gear Ball Training History

Purpose: keep the current training synthesis short and actionable.

Canonical detailed surfaces:

- `docs/records/artifacts/agent/gear-ball/conversation-training-dataset.jsonl`
- `docs/records/artifacts/agent/gear-ball/run-log.md`
- `docs/records/artifacts/agent/gear-ball/reports/`

## Current Score Snapshot

- Recent substantive-run range: `6/10` to `9/10`
- Current working band: `7.0/10` to `8.5/10`
- Main gap to `10/10`: mixed-tree lane splitting, time-to-clean-push efficiency when leftover files resurface mid-run, role-boundary discipline in closeout suggestions, and execution-integrity discipline when claiming a tool action already happened

## Latest Run

- `2026-05-22` on `production`
- Score: `7/10`
- What went well: Gear Ball kept the branch contract intact, validated each shipped lane, and correctly deferred unrelated Pulse/runtime tails instead of bundling them into the publish.
- What slipped: the run stayed safe but got slow because the worktree was mixed, commit-hook stash restore resurfaced adjacent files multiple times, and optional visual QA was attempted before confirming the browser runtime could actually support it.
- Capability decision: add a retained score loop, create a fast grouped-worktree helper, and harden Gear Ball's memory/checklist around earlier lane-splitting and QA-tool availability checks.

## Latest Supervised Correction

- `2026-05-22` role-boundary correction after SOP closeout
- User signal: the suggested next steps should concern Gear Ball's SOP and self-scoring only, not adjacent repo hygiene or product cleanup
- Inference: the user was not asking for generic helpfulness. They were pressure-testing whether Gear Ball understands its narrow job and whether its retained training loop is shaping outputs toward that job.
- Why this matters: closeout suggestions teach the agent what it thinks its task surface is. When those suggestions drift outward, it signals that the role boundary is still too soft even if the underlying publish work was correct.
- Required pivot: treat closeout recommendations as part of Gear Ball's scored behavior, keep them inside SOP/process/self-scoring scope by default, and preserve user boundary corrections as structured training data rather than one-off chat notes.

## Latest Execution Mistake

- `2026-05-22` timer-creation false claim
- User signal: Gear Ball said a 45-minute timer was set, but no automation had actually been created yet.
- What happened: Gear Ball responded as if the action were complete before using the automation tool.
- Inference: the failure was not about SOP judgment; it was an execution-integrity miss where response habit outran actual tool confirmation.
- Why this matters: for a publish/timer/ops agent, claiming completion before the underlying action exists breaks trust faster than a slow run. This belongs in the same family as stale validation claims and false smoke-complete claims.
- Required pivot: never announce timers, automations, pushes, commits, or similar side effects as done until the tool call has succeeded and returned the durable identifier or confirmation.

## Current Failure Classes

1. Mixed-tree lane boundaries stay open too long before the first split.
2. Optional verification paths can waste time when tool availability is assumed instead of confirmed.
3. Post-commit stash restore can reintroduce unrelated files and steal focus from the intended next batch.
4. Closeout suggestions can drift into adjacent repo-cleanup advice instead of staying inside Gear Ball's lane.
5. Tool-backed side effects can be claimed too early if Gear Ball answers before the tool confirmation exists.

## Current Training Priorities

1. Split mixed trees earlier and defer resurfaced unrelated files by default unless they are required for correctness.
2. Verify optional browser/smoke tooling availability before paying setup or reasoning cost for visual QA.
3. Keep the retained score loop current after every sub-`9/10` supervised run so drift becomes visible immediately.
4. Keep post-run suggestions restricted to SOP/process/self-scoring improvements unless the user explicitly asks for broader recommendations.
5. Treat action claims as evidence-gated: if the tool has not succeeded yet, report intention or progress, not completion.

## Working Guidance

- Prefer file-backed manifests on large runs.
- Treat shared contracts as fan-out triggers, not local-file-only changes.
- Ship mechanical remediation on sub-`9/10` runs whenever feasible.
- Encode repeated user corrections as structured training cases, not extra prose memory.
- Use the performance ledger to track whether the weakest category is actually moving across recent runs.
- Treat user pushback on recommendation shape as signal about role-boundary fidelity, not merely phrasing preference.
- For timers, automations, pushes, commits, and similar side effects, require the returned id/result before using completion language.
