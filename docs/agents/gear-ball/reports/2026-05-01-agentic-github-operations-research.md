# Agentic GitHub Operations Research

Purpose: preserve the source-backed findings that shaped Gear Ball's GitHub PR, merge, and agent-coordination workflow.

Date: 2026-05-01

## Summary

Gear Ball should be the accountable coordinator for worktree, commit, push, PR, review-routing, and merge-readiness flow. Gear Ball should not be the sole approval authority for risky GitHub operations. The safest pattern is a producer-reviewer split: Gear Ball prepares and coordinates, then human or specialist review gates approve promotion, merge, deployment, env, or database-affecting actions.

## Source Findings

- GitHub PRs are the collaboration boundary for proposing changes from a source branch into a base branch. Gear Ball should use explicit base/head branches and draft PRs by default for agent-coordinated work.
- GitHub branch protections and rulesets should enforce checks, reviews, signed commits where required, deployment gates, and merge restrictions instead of relying on agent memory alone.
- CODEOWNERS should route review for sensitive paths and domain-owned areas.
- GitHub Actions token and workflow security guidance supports least-privilege tokens, careful workflow-file review, and avoiding automation that can create or approve PRs without oversight.
- GitHub Copilot agent guidance supports custom instructions, custom agents, deterministic setup steps, hooks, and scoped MCP tools.
- GitHub warns that MCP tools can be used autonomously once configured, so write-capable tools should be narrowly scoped.
- GitHub hooks can enforce validation, audit logging, and policy checks at agent workflow boundaries.
- Merge queues and auto-merge can improve throughput only after required checks and reviews are satisfied.

## Gear Ball Decisions

- Keep `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md` focused on local inventory, batching, validation, staging, and commits.
- Add `docs/sops/sop_gear_ball_github_pr_merge_operations.md` for push, PR, review routing, CI monitoring, merge readiness, merge queue, auto-merge, and post-merge audit.
- Default agent-coordinated PRs to draft unless the user explicitly authorizes ready-for-review.
- Require explicit user authorization for push, PR ready state, merge, auto-merge, merge queue, branch promotion, deployment, env mutation, and database mutation.
- Require human or specialist review for SQL, RLS, storage, auth, billing, credits, env, deployment, GitHub Actions, branch rules, and production-affecting changes.

## Source Links

- GitHub pull request creation: `https://docs.github.com/articles/creating-a-pull-request`
- GitHub pull request merge behavior: `https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request`
- GitHub protected branches: `https://docs.github.com/github/administering-a-repository/about-protected-branches`
- GitHub rulesets: `https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets`
- GitHub CODEOWNERS: `https://docs.github.com/articles/about-code-owners`
- GitHub Actions security hardening: `https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions`
- GitHub Copilot task practices: `https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/cloud-agent/get-the-best-results`
- GitHub Copilot custom agents: `https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-custom-agents`
- GitHub Copilot MCP: `https://docs.github.com/en/copilot/using-github-copilot/coding-agent/extending-copilot-coding-agent-with-mcp`
- GitHub Copilot hooks: `https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-hooks`
- GitHub Copilot setup steps: `https://docs.github.com/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment`
- GitHub merge queue: `https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request-with-a-merge-queue`
- GitHub auto-merge: `https://docs.github.com/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request`

## Future Guardrail Ideas

- Add a repo-scoped Gear Ball custom agent profile if this repo begins using GitHub custom agents directly.
- Add hook-based policy checks for blocked commands, secrets, direct pushes, and unsafe broad staging.
- Add or refine CODEOWNERS entries for `.github/workflows`, `sql/`, env/deployment docs, billing, auth, and security-sensitive paths.
- Add a deterministic GitHub agent setup workflow only after deciding which GitHub-hosted agents should run in this repo.
