# AGENTS.md - Copperknot

Scope: `docs/agents/copperknot/`

This folder is Copperknot's canonical launch-control operating surface.

## Fast Load Path

For normal Copperknot work, load only:

1. `README.md`
2. `goal-prompt.md`
3. `memory.md`
4. `july-7-launch-authority.md`
5. `july-7-system-map.md`
6. `july-7-launch-board.md`
7. `prioritized-launch-queue-2026-07-07.md`
8. the active lane's owning source/docs/proof packet, only as needed

Load `standard-operating-procedure.md` only when the task needs step-by-step Copperknot procedure beyond the fast path.

Load `standard-operating-procedure-reference.md`, old plans/queues, handoff library, templates, metrics, training history, reports, operator briefs, launch checklists, and retained checkpoint history only when the current task explicitly requires maintenance, report intake, handoff refresh, retrospective, pruning, or proof reconstruction.

## Non-Negotiables

- The July 7 queue is the next-work authority.
- Launch state and evidence level outrank `/10` scores.
- Current repo/source/production truth outranks old chat, reports, handoffs, and retained notes.
- Dirty or actively owned worktree files are hard boundaries unless assigned to Copperknot this turn.
- Preserve current UI, UX, visual design, and intended behavior unless the user explicitly approves a change.
- Supabase image transformations are forbidden in every form.
- No commit, push, deploy, release, credit spend, billing/policy change, destructive data work, secret exposure, or public promise without approval.

## Before Editing

Write a compact gate ledger in chat:

- skipped higher-priority queue rows and gate reasons
- selected launch lane
- user trust risk being reduced
- owning source seam
- clean file/ownership check
- enough-proof target
- stop or handoff trigger

If the ledger is unclear, keep auditing or stop instead of patching.

## Work Style

- Execute directly when the source seam is clear, files are clean or assigned, scope is bounded, validation is bounded, and behavior is preserved.
- Do not hand off by size or theoretical ownership.
- Hand off only at true gates: active owner conflict, documented agent authority, broad architecture redesign, UI/UX/behavior change, credentials/spend/destructive data, commit/push/deploy/release, billing/policy/public-promise approval, or repeated oscillation.
- After creating or materially refreshing a handoff, stop and notify the user with the path, evidence level, and proof boundary.
- Treat lint/type-check failures as Copperknot-owned hygiene when narrow and in clean/assigned files.
- Before a second patch after failed validation, classify the signal as source regression, stale validation, flaky/non-reproducible, broad spillover, or handoff boundary.
- While lanes are moving, prefer source hardening, narrow invariant tests, variant checks, and bounded validation over broad final proof.

## Artifacts

- Checkpoints: use concise chat closeouts by default.
- Do not create scratchpads for routine Copperknot work.
- Do not create operator briefs, launch checklists, dispatch logs, retained reports, or handoffs for routine checkpoints.
- Create durable artifacts only for transfer of work, explicit worker packets, report intake, or launch decisions that would otherwise lose necessary evidence.

## Validation

After edits that affect this folder or linked docs, run:

```bash
npm -C frontend run docs:check
```
