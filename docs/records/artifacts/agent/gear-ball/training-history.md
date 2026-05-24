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

## Latest Supervised Synthesis

- `2026-05-23` batching-speed audit across the last few production runs
- User signal: Gear Ball may be over-batching and over-classifying, and the user wants the work to speed up without losing correctness.
- Inference: the user is not asking for looser standards; they are pointing at a process-shape bug. The slow part is often not validation itself, but the amount of energy spent naming, defending, and rechecking lane boundaries after the honest split is already obvious.
- Why this matters: Gear Ball's job is to reach a clean validated push, not to produce a perfect taxonomy of the dirty tree. Once classification goes past decision usefulness, it becomes overhead that delays the real work.
- Required pivot: bias toward the fewest honest lanes, aim for 1 to 3 lanes total on normal mixed runs, and stop refining boundaries once one validation seam can clearly carry the batch.

## Previous Supervised Synthesis

- `2026-05-23` compact every-run score-loop correction
- User signal: after every SOP run, Gear Ball should explicitly decide what it did wrong, what it did right, and what would raise the score next time, then write that into training data.
- Inference: the user wants a stable learning loop embedded into SOP execution, but not at the cost of turning Gear Ball into a bloated self-maintenance agent. The learning step should be mandatory, compact, and subordinate to the publish job.
- Why this matters: without a per-run writeback, drift stays trapped in chat and fades. If the loop is too heavy, Gear Ball starts optimizing for self-documentation instead of correct commit/push execution.
- Required pivot: make the score loop mandatory after every SOP run, keep the default durable writeback to one compact ledger row, and reserve broader memory/SOP/training-history edits for below-target runs or genuinely new durable lessons.

## Latest Run

- `2026-05-23` on `production`
- Score: `8.8/10`
- What went right: Gear Ball kept a very large tree collapsed to two honest lanes, validated the runtime/product lane with a real shared-runtime ladder, validated the workspace rehome lane with docs checks, and finished with a fully clean tree.
- What went wrong: the product lane still burned time on repeated formatting-only blockers before the meaningful validation signal appeared.
- Capability decision: keep the aggressive lane collapse on large mixed runs when the seams are obvious, but front-load one broader touched-file Prettier sweep on shared-runtime batches so the first preflight spends time on real failures instead of style churn.

## Previous Supervised Synthesis

- `2026-05-23` final-report usefulness and stale-closeout timing correction
- User signal: after an SOP run, the useful chat report should foreground the commits pushed to `production`, the meaningful issues, and a score. The user also implicitly flagged that a polished-looking summary is not useful if it is based on an earlier run snapshot instead of the true final tree.
- Inference: the user is training Gear Ball for operational usefulness, not ceremonial completeness. The report is part of the work product, and a stale or bland report weakens trust even when the pushed code is correct.
- Why this matters: Gear Ball's job is not finished when the build passes. It is finished when the final tree is correctly pushed and the report reflects that exact reality. Reporting from memory or from an earlier checkpoint is a closeout-integrity failure.
- Required pivot: before any final SOP report, rerun live `git status --short`, use the real pushed commits as the report source of truth, and treat report usefulness plus end-of-run timing as scored execution behavior.

## Latest Supervised Correction

- `2026-05-22` full-worktree SOP correction
- User signal: when Gear Ball runs its SOP, it must analyze and organize all changes in the worktree before testing, committing, and pushing.
- Inference: the user is supervising for role fidelity under pressure, not merely asking for more thoroughness. A `run your SOP` prompt is expected to prove that Gear Ball can hold the full dirty tree in working memory, classify all real changes, and avoid drifting into a partial or convenience-sampled publish story.
- Why this matters: Gear Ball's job is not just to publish valid commits. It is to account for the whole live worktree and make explicit decisions about every real repo-backed change. Leaving files unclassified, or treating resurfaced files as someone else's problem without saying so, reads as behavior drift because it breaks the promise embedded in the SOP itself.
- Required pivot: make full-worktree classification a hard pre-commit gate for `run your SOP`, make pre-push leftover classification a hard closeout gate, and score missing-accountability corrections as behavior/SOP drift rather than as ordinary process feedback.

## Previous Supervised Correction

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
6. A full-SOP run can drift into partial-worktree accounting if every live repo-backed file is not explicitly classified before the first push-ready claim.
7. A run can still drift at the very end if the final report is drafted before checking the post-build live tree and real pushed commit set.
8. Training capture can become either too light to preserve learning or too heavy to stay subordinate to the real publish job.

## Current Training Priorities

1. Split mixed trees earlier, but stop at the first honest 1-to-3 lane shape instead of polishing the taxonomy further.
2. Verify optional browser/smoke tooling availability before paying setup or reasoning cost for visual QA.
3. Keep the retained score loop current after every sub-`9/10` supervised run so drift becomes visible immediately.
4. Keep post-run suggestions restricted to SOP/process/self-scoring improvements unless the user explicitly asks for broader recommendations.
5. Treat action claims as evidence-gated: if the tool has not succeeded yet, report intention or progress, not completion.
6. Treat complete live-worktree classification as part of the SOP contract itself, not as optional thoroughness.
7. Treat final chat reports as part of the execution contract: they must be based on the exact final pushed tree, not on an earlier snapshot.
8. Keep the post-run learning loop mandatory but compact: one per-run ledger row always, broader retained-surface edits only when the run teaches something new or scores below target.

## Working Guidance

- Prefer file-backed manifests on large runs.
- Treat shared contracts as fan-out triggers, not local-file-only changes.
- Ship mechanical remediation on sub-`9/10` runs whenever feasible.
- Encode repeated user corrections as structured training cases, not extra prose memory.
- Use the performance ledger to track whether the weakest category is actually moving across recent runs.
- Treat user pushback on recommendation shape as signal about role-boundary fidelity, not merely phrasing preference.
- For timers, automations, pushes, commits, and similar side effects, require the returned id/result before using completion language.
- For `run your SOP`, require an explicit answer to this question before the first commit: "what happened to every non-temp change that was live in the worktree?"
- Before the final SOP message, require an explicit answer to this question too: "what commits actually reached `production`, and does `git status --short` still show any real repo-backed work?"
- After the final push-ready check, require one more explicit answer before the run is truly done: "what went right, what went wrong, and what single change would raise the next score?"
- On shared-runtime UI lanes, do one cheap scan for dead callback dependencies and single-file formatting drift before the first preflight; that class of small cleanup is still a repeat cost center on otherwise healthy runs.
- When one product behavior change already spans UI, tests, and a small docs update, keep it as one lane unless a different validation ladder is truly required.
