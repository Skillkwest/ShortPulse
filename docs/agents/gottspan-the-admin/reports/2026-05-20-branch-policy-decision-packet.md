# Gottspan Branch Policy Decision Packet - 2026-05-20

Purpose: capture the repo-steward decision packet for the current `production`-branch workflow so the exception is documented and future branch-policy work has a clean starting point.

## Question

Does the current `production`-branch workflow mean the repo's documented branch ladder should change, or should this be treated as a user-directed one-time exception?

## Current Repo Truth

### Governing branch doctrine

- [AGENTS.md](../../../../AGENTS.md) requires branch discipline and `shortpulse.allowedBranch` alignment for active work.
- [docs/dev-ground-rules.md](../../../dev-ground-rules.md) says `working-development` is the only active coding branch and promotions should flow `working-development -> staging-preview -> production`.
- [docs/agent-playbook.md](../../../agent-playbook.md) repeats that branch enforcement is part of safe execution.

### Current runtime posture

- Current branch: `production`
- `shortpulse.allowedBranch`: `production`
- Worktree: clean during the formal Gottspan repo-state audit
- User instruction in this thread: you explicitly said you were testing and committing the worktree to GitHub production

## Decision Options

### Option A. Treat this as a one-time explicit exception

Meaning:

- keep the current branch-ladder doctrine unchanged
- treat this thread's `production`-branch use as a user-directed exception
- do not rewrite repo rules, SOPs, or Gear Ball defaults

Pros:

- preserves the existing documented release ladder
- avoids rewriting branch governance based on one live exception
- keeps the current repo rules internally consistent

Cons:

- requires future humans/agents to remember that this thread was an exception
- repeated exceptions would become governance drift if they are not formalized

### Option B. Change the repo's branch policy to match current reality

Meaning:

- rewrite the branch-ladder doctrine
- update branch-enforcement expectations
- update Gear Ball and related SOPs to reflect the new normal

Pros:

- removes contradiction between real work and documented policy
- reduces future ambiguity if production-branch operation is truly the normal path now

Cons:

- larger governance change
- touches multiple branch, release, and promotion surfaces
- should not be inferred from one thread without explicit owner intent

### Option C. Define a hybrid policy

Meaning:

- keep the ladder as the default
- add a documented exception path for direct `production` work when the user explicitly authorizes it

Pros:

- most realistic if direct production work happens occasionally but is not the default
- preserves safety doctrine while acknowledging real operational behavior

Cons:

- slightly more complex governance
- needs a formal exception rule and likely a Gear Ball execution addendum

## Gottspan Recommendation

The best current decision is **Option A** unless you explicitly want a repo-policy rewrite.

Reason:

- your statement in this thread authorizes the current `production` work as a live operation
- it does **not** yet state that the repo's standing branch policy should be changed permanently
- rewriting branch policy from one live execution would be an unjustified governance leap

So the correct stewardship posture is:

1. preserve the existing branch ladder as the documented default
2. treat this thread's `production` workflow as an explicit exception
3. only open the larger branch-policy rewrite if you want this to become the new normal

## If You Want The Policy Rewritten

The next correct owner is **Gear Ball** for execution planning, with Gottspan preserving the repo-governance frame.

Bounded Gear Ball handoff scope:

1. audit all branch-policy surfaces
2. identify every file/SOP/helper that encodes the current ladder
3. propose the minimal consistent rewrite
4. preserve hook and `shortpulse.allowedBranch` implications explicitly
5. define rollback posture if the new policy is later reversed

Likely touched surfaces:

- `docs/dev-ground-rules.md`
- `AGENTS.md`
- `docs/agent-playbook.md`
- `docs/agents/gear-ball/README.md`
- `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`
- `docs/sops/sop_gear_ball_github_pr_merge_operations.md`
- any current active Gear Ball handoff that assumes `working-development`

## Final Decision

Gottspan records this as:

- **status**: explicit `production`-branch exception
- **default policy**: unchanged
- **repo default remains**: `working-development -> staging-preview -> production`
- **next escalation**: Gear Ball only if a future request explicitly calls for permanent branch-policy rewrite
