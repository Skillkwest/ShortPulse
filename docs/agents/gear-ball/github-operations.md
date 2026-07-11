# Gear Ball GitHub Operations

Purpose: keep Gear Ball's local agent-facing summary for GitHub push, pull request, review, merge queue, auto-merge, and merge coordination.

## Operating Model

Gear Ball owns coordination from local commits to GitHub readiness:

```text
worktree inventory -> logical batches -> commits -> push proposal -> draft PR -> review routing -> merge-readiness report
```

Gear Ball does not own unilateral promotion. Push, ready-for-review, merge queue, auto-merge, merge, branch promotion, deployment, environment mutation, and database mutation require explicit user authorization in the current thread.

## Canonical SOPs

- `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`: local dirty worktree organization, batch planning, validation, staging, and commits.
- `docs/sops/sop_gear_ball_github_pr_merge_operations.md`: push, draft PR, review routing, checks, merge readiness, merge queue, auto-merge, merge, and post-merge audit.

## Historical Research Note

The GitHub coordination model documented here has already been synthesized into this summary and the canonical GitHub SOP. Historical one-off research reports do not need to stay in the active Gear Ball surface.

## Standing GitHub Rules

- During the current ShortPulse launch-week production operations, work only on the local `production` branch and target GitHub `production` for branch operations unless the user explicitly rewrites the repo launch-week policy in the current thread.
- Keep `git config --local shortpulse.allowedBranch` set to `production` before commit or push activity during the launch-week production operations.
- If the user explicitly rewrites the launch-week policy in a later thread, work only on that current user-approved branch and align `shortpulse.allowedBranch` to it before commit or push activity.
- Never push directly to `main` unless the user explicitly changes that repo rule in the current thread.
- Use draft PRs by default for agent-coordinated work.
- Use explicit base/head branches for PRs.
- Do not self-approve agent-authored or agent-coordinated work.
- Do not bypass branch protection, rulesets, required checks, CODEOWNERS, or review requirements.
- Do not force push, rewrite shared history, or change branch topology without explicit user authorization.
- Do not expose secrets, raw env values, tokens, customer-private data, or temporary env copies.

## Review Gate Defaults

Require human or specialist review before merge when a PR touches:

- SQL migrations, rollback SQL, RLS, storage, or database diagnostics.
- Auth, billing, credits, entitlements, provider dispatch, or security-sensitive API behavior.
- Local environment files, Vercel environment configuration, deployment settings, or scheduler/cron targets.
- GitHub Actions workflows, branch rules, CODEOWNERS, agent hooks, custom agent profiles, or MCP/tool access.
- Production-affecting routes, release gates, or branch-promotion paths.

## PR Body Checklist

Every Gear Ball-coordinated PR should include:

- Purpose.
- Commit/batch summary.
- Validation commands and outcomes.
- Risk areas.
- Reviewers or CODEOWNERS requested.
- Deferred work or known gaps.
- Deployment, environment, database, or release follow-up if applicable.

## Merge-Readiness Checklist

Before recommending merge, verify:

- PR is not draft unless the requested action is only to keep it in draft.
- Base branch and head branch are correct.
- Required checks pass or are explicitly documented as non-blocking under repo policy.
- Required reviews are approved and not stale.
- CODEOWNERS or domain-owner review is satisfied for sensitive paths.
- Merge state is clean or the conflict plan is explicit.
- User explicitly authorized merge, merge queue, or auto-merge action.

## Future Guardrails

Consider adding these only after the current SOPs have been exercised on real work:

- Hook-based checks for blocked commands, unsafe staging, secret exposure, direct pushes, and branch-rule bypasses.
- CODEOWNERS refinements for `.github/workflows`, `sql/`, deployment docs, env docs, auth, billing, and security-sensitive paths.
- A repo-scoped Gear Ball custom agent profile if ShortPulse begins using GitHub custom agents directly.
- Deterministic GitHub agent setup steps if GitHub-hosted agents become part of the normal workflow.
