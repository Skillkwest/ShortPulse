# Gear Ball GitHub PR And Merge Operations SOP

Purpose: define Gear Ball's repeatable workflow for pushing approved commits, opening GitHub pull requests, coordinating review, and reporting merge readiness without bypassing repo or human gates.

## Scope

Use this SOP after worktree changes have been organized and committed through `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`, or when the user explicitly asks Gear Ball to coordinate a push, pull request, merge queue, auto-merge, merge, branch promotion, or GitHub review handoff.

This SOP covers:

- Push readiness checks.
- Draft pull request creation.
- Pull request body and evidence standards.
- Review routing and CODEOWNERS awareness.
- CI/status-check monitoring.
- Merge-readiness reports.
- Merge, merge queue, or auto-merge coordination when explicitly authorized.

This SOP does not cover:

- Writing product code or schema changes.
- Mutating Vercel, Supabase, database, or production configuration.
- Bypassing branch protections, required checks, CODEOWNERS, or review requirements.
- Force pushes, history rewrites, or direct pushes to protected integration/release branches.

## Sources Of Truth

- `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/agent-playbook.md`
- `docs/release-checklist.md`
- `docs/agents/gear-ball/README.md`
- `docs/agents/gear-ball/memory.md`
- `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`
- GitHub branch protection, repository rulesets, CODEOWNERS, checks, PR review state, and direct Git evidence.

## External Reference Baseline

These sources informed this SOP and should be rechecked when GitHub agent behavior changes:

- GitHub pull request creation: `https://docs.github.com/articles/creating-a-pull-request`
- GitHub pull request merge behavior: `https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request`
- GitHub protected branches: `https://docs.github.com/github/administering-a-repository/about-protected-branches`
- GitHub rulesets: `https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets`
- GitHub CODEOWNERS: `https://docs.github.com/articles/about-code-owners`
- GitHub Actions security hardening: `https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions`
- GitHub Copilot agent task practices: `https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/cloud-agent/get-the-best-results`
- GitHub Copilot custom agents: `https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-custom-agents`
- GitHub Copilot MCP warning: `https://docs.github.com/en/copilot/using-github-copilot/coding-agent/extending-copilot-coding-agent-with-mcp`
- GitHub Copilot hooks: `https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-hooks`

## Required Preconditions

- The user explicitly authorized the requested GitHub action in the current thread.
- Current branch matches the current user-approved branch.
- `git config --local shortpulse.allowedBranch` matches the current user-approved branch before push or merge work.
- Local commits were reviewed and validated, or any validation gaps are documented.
- No secrets, raw env values, tokens, customer-private data, generated build artifacts, dependency folders, or scratch exports are included.
- No staged changes remain unintentionally.
- The target base branch is explicit.
- Direct push to `main` remains forbidden unless the user explicitly changes that repo rule in the current thread.

## Agentic Coordination Model

Gear Ball owns GitHub flow coordination, not unilateral promotion.

Gear Ball may prepare and coordinate:

- Push proposals.
- Draft pull requests.
- PR descriptions and evidence summaries.
- Reviewer routing.
- Check monitoring.
- Merge-readiness reports.
- Merge queue or auto-merge recommendations.

Gear Ball must not self-approve or silently merge agent-authored work. For high-risk surfaces, require a producer-reviewer split before merge:

- SQL, RLS, storage, database, billing, credits, auth, environment, deployment, GitHub Actions, branch rules, security, and production-affecting changes need explicit human approval even when automated checks pass.
- Specialist review lanes may inspect bounded risk areas, but Gear Ball remains responsible for the final coordination summary.

## Workflow

### 1. Push Readiness

Before pushing:

```bash
git branch --show-current
git config --local --get shortpulse.allowedBranch
git status --short
git log --oneline --decorate --max-count=8
```

Confirm:

- Current branch equals `shortpulse.allowedBranch`.
- Branch is not `main`.
- Commits to push are intended for this branch.
- Any remaining dirty files are intentionally deferred and are not staged.
- Validation results for the pushed commits are known.

If the target remote branch is unclear, stop and ask.

### 2. Push

Push only after explicit authorization:

```bash
git push origin <branch>
```

After pushing, capture:

- Branch name.
- Remote tracking target.
- Commit range pushed.
- Any push hook output or rejection reason.

If push is rejected, do not force push. Diagnose the rejection and report the next safe options.

### 3. Pull Request Creation

Default to a draft pull request for agent-coordinated work unless the user explicitly asks for a ready PR:

```bash
gh pr create \
  --base <base-branch> \
  --head <current-branch> \
  --draft \
  --title "<area>: <outcome>" \
  --body-file <prepared-body-file>
```

The PR body must include:

- Purpose.
- Batch/commit summary.
- Validation commands and outcomes.
- Risk areas.
- Reviewer or CODEOWNERS routing.
- Deferred work or known gaps.
- Any required deployment, env, database, or release follow-up.

Never create a PR with an inferred base branch when branch ladder intent is unclear.

### 4. Review Routing

After PR creation:

```bash
gh pr view --json number,title,url,baseRefName,headRefName,isDraft,reviewRequests,reviewDecision,statusCheckRollup,mergeStateStatus
```

Route review based on risk:

- CODEOWNERS or sensitive-path owners for owned files.
- SQL/security reviewer for migrations, RLS, storage, auth, billing, credits, and secrets-adjacent work.
- Frontend reviewer for UI/UX changes.
- API/runtime reviewer for server routes and provider dispatch.
- Gear Ball or human release owner for branch promotion, merge queue, auto-merge, and release sequencing.

Batch review feedback into one structured packet when asking an agent to revise a PR. Avoid sending many single comments that trigger fragmented agent sessions.

### 5. CI And Status Checks

Monitor checks with GitHub evidence:

```bash
gh pr checks <pr-number>
gh pr view <pr-number> --json statusCheckRollup,mergeStateStatus,reviewDecision,isDraft
```

Required checks must pass before merge readiness. If checks fail:

- Identify failing workflow/job names.
- Link failure to the touched batch or confirm it is unrelated.
- Recommend a focused fix lane.
- Do not merge, enable auto-merge, or enter the merge queue until the failure is resolved or explicitly accepted under repo policy.

Workflow-file changes require extra scrutiny because GitHub Actions can access privileged tokens and secrets.

### 6. Ready-For-Review Gate

Before converting a draft PR to ready:

- The PR body is current.
- The branch has no unintended follow-up commits.
- Required validation has run or gaps are documented.
- Reviewers are assigned.
- No high-risk stop rule remains open.
- The user explicitly authorizes marking the PR ready, or the user previously authorized a ready PR instead of draft.

### 7. Merge Readiness

Before recommending merge:

```bash
gh pr view <pr-number> --json number,title,url,isDraft,baseRefName,headRefName,reviewDecision,mergeStateStatus,statusCheckRollup,latestReviews
```

Report:

- PR URL and target base.
- Review state.
- Required status checks.
- Mergeability and conflict state.
- Validation summary.
- High-risk file classes.
- Whether merge queue or auto-merge is available and appropriate.
- Explicit residual risks.

Gear Ball should recommend `not ready` when evidence is incomplete.

### 8. Merge, Merge Queue, Or Auto-Merge

Merge action requires explicit user authorization in the current thread.

Use the repository's required path:

- If merge queue is required, add the PR to the queue only after required approvals/checks are satisfied or after the user explicitly authorizes enabling queue/auto-merge behavior.
- If auto-merge is appropriate, enable only after user authorization and only when required reviews/checks are configured to gate it.
- If direct merge is allowed, use the repo-approved merge method and do not bypass branch protections.

Example command shape:

```bash
gh pr merge <pr-number> --squash --delete-branch
```

Only use a concrete merge method after confirming the repository's allowed merge policy and the user's intent.

### 9. Post-Merge Audit

After merge:

```bash
gh pr view <pr-number> --json mergedAt,mergedBy,mergeCommit,url
git fetch --prune
```

Report:

- Merge result.
- Merge commit or squash commit.
- Deleted branch state if applicable.
- Follow-up branch ladder step, if any.
- Deployment, env, database, or release coordination still required.

Do not switch local branches, delete local branches, promote to another branch, deploy, or mutate databases unless explicitly authorized.

## Stop Rules

Stop and ask for human review when:

- The requested GitHub action is not explicitly authorized in the current thread.
- Current branch does not match `shortpulse.allowedBranch`.
- The base branch, head branch, target ladder step, or merge method is unclear.
- The PR touches SQL, RLS, auth, billing, env, deployment, GitHub Actions, branch rules, or production-affecting code without explicit reviewer/owner approval.
- Required checks fail, are missing, or have ambiguous status.
- Review state is pending, changes-requested, stale, or unclear.
- The only path forward is force push, history rewrite, branch protection bypass, direct push to `main`, or destructive cleanup.
- MCP/tool access, GitHub token permissions, or workflow secret exposure risk is unclear.

## Maintenance

- Keep this SOP aligned with GitHub docs as agent features, hooks, custom agents, MCP behavior, merge queue behavior, and Actions security guidance evolve.
- Prefer adding guardrails through repo policy, CODEOWNERS, checks, hooks, and branch rules over relying on agent memory alone.
- Add a Gear Ball report for substantial push/PR/merge coordination tasks.
