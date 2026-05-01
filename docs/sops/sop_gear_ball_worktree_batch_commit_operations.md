# Gear Ball Worktree Batch Commit Operations SOP

Purpose: define Gear Ball's repeatable workflow for organizing a dirty worktree into logical, reviewable batches and committing those batches safely.

## Scope

Use this SOP when the user asks Gear Ball to organize current repo changes, prepare commit batches, commit worktree changes, or coordinate commit readiness.

This SOP covers:

- Dirty worktree inventory.
- Logical batch planning.
- Per-batch review and validation.
- Staging and committing approved batches.
- Commit evidence reporting.

This SOP does not cover:

- Pushing, opening PRs, merging, branch promotion, deployment, Vercel env mutation, or database mutation. Those actions require explicit user instruction in the current thread.
- Rewriting history, rebasing shared work, force pushing, or destructive cleanup.
- Deciding product intent for ambiguous mixed changes without user review.

For push, pull request, review-routing, merge queue, auto-merge, merge, and post-merge coordination, use `docs/sops/sop_gear_ball_github_pr_merge_operations.md` after this SOP has produced reviewed commits.

## Sources Of Truth

- `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `docs/release-checklist.md`
- `docs/agents/gear-ball/README.md`
- `docs/agents/gear-ball/memory.md`
- `docs/sops/sop_gear_ball_github_pr_merge_operations.md`
- Current Git state and direct diff evidence.

## Required Preconditions

- Confirm implementation mode and that the user has explicitly asked for worktree organization and/or commits.
- Run the workspace artifact safety check before broad commands.
- Verify the current branch and allowed branch:
  ```bash
  git branch --show-current
  git config --local --get shortpulse.allowedBranch
  ```
- The current branch must match `shortpulse.allowedBranch` before commit activity.
- Do not switch branches unless the user explicitly authorizes that branch action in the current thread.
- Do not push directly to `main`.
- Do not expose secrets, env values, tokens, customer-private data, or temporary env copies.

## Batch Principles

A commit batch should have one coherent reason to exist. Prefer batches that are independently reviewable, independently explainable, and reasonably reversible.

Good batch boundaries:

- One feature or behavior change plus its direct tests and docs.
- One database migration plus rollback, data dictionary, security checklist, and validation SQL.
- One admin/operator workflow change plus scripts, SOPs, and tests.
- One docs/governance update.
- One mechanical cleanup with no behavior change.
- One dependency/config change with its lockfile and validation.

Avoid these batch shapes:

- Mixed unrelated product changes.
- SQL/security changes bundled with unrelated UI polish.
- Generated artifacts or dependency directories.
- Secret or env-value changes.
- Partial commits that leave tests or type contracts knowingly broken unless the commit message and final report call out an intentional checkpoint.

## Default Batch Taxonomy

Use this taxonomy as a first-pass sorting aid:

- `governance-docs`: repo rules, SOPs, agent contracts, indexes, release docs.
- `sql-database`: migrations, rollback SQL, data dictionary, security checklist, SQL diagnostics.
- `api-server`: API routes, server services, provider dispatch, auth, billing, storage.
- `frontend-ui`: pages, feature components, hooks, styles, UI tests.
- `frontend-runtime`: shared runtime logic, model registry, pricing logic, agent runtime.
- `admin-ops`: admin pages, admin scripts, Ophestivus/Gottspan/Gear Ball workflows.
- `tests-validation`: test-only or validation-script-only changes.
- `config-deps`: package manifests, lockfiles, Next/Vitest/ESLint config.

The taxonomy is a starting point, not a substitute for reading the diffs.

## Workflow

### 1. Preflight

1. Load the session startup contract and scoped docs.
2. Run the artifact safety check.
3. Verify branch and allowed-branch config.
4. Confirm whether the user authorized commits in this thread. If the user only asked for a plan or SOP, do not stage or commit.
5. Check whether there is already staged work:
   ```bash
   git diff --cached --name-status
   ```
6. If staged work exists and the user did not identify it as part of Gear Ball's task, stop and ask before changing the index.

### 2. Inventory The Worktree

Collect a file-level inventory without mutating state:

```bash
git status --short
git diff --name-status
git diff --cached --name-status
```

For large dirty worktrees, avoid reading every full diff first. Build an initial map from path names, then inspect each candidate batch with targeted diffs.

Do not include:

- `node_modules/`
- `.next/`
- `dist/`
- `build/`
- generated backups inside the repo
- `.env*` files, except documented examples such as `.env.example`
- scratch files under `/tmp`, `.tmp/`, or ad-hoc text exports unless explicitly requested

### 3. Build A Batch Plan

Create a short plan before staging:

```text
Batch 1: <name>
- Files: <paths or path groups>
- Reason: <single coherent change>
- Validation: <targeted checks>
- Risk: <main review concern>

Batch 2: ...
```

Rules:

- Keep docs/index updates with the docs they index.
- Keep tests with the behavior they validate unless the test-only change is itself the work.
- Keep migration rollback files with their migration.
- Keep package lockfile changes with the manifest change that caused them.
- If a single file contains unrelated changes from multiple logical batches, mark it as `mixed-file`.
- Do not split a mixed file blindly. Prefer a single coherent combined batch, or stop for user review if combining would hide risk.

### 4. Inspect A Batch

Before staging any batch, inspect its targeted diff:

```bash
git diff -- <path> ...
```

Check:

- The diff matches the batch reason.
- No unrelated file slipped in.
- No generated artifact is included.
- No secret, token, customer-private data, or raw env value is present.
- SQL and RLS changes preserve user isolation.
- Docs and indexes are updated when behavior, routes, SOPs, schema, or governance changed.

If the batch touches high-risk areas, run or schedule the relevant specialist check:

- SQL/RLS/storage: SQL migration SOP, security checklist, and targeted SQL validation.
- Pricing/credits: pricing audit skill.
- Vercel/deployment/env: Vercel env contract and deployment parity checks.
- Routes/UI behavior: route docs and relevant SOPs.
- Adaptive media/reference grid: adaptive change gate.

### 5. Validate Before Commit

Run the smallest validation that proves the batch:

- Docs-only: `npm -C frontend run docs:check`.
- Frontend logic or UI: targeted tests first, then `npm -C frontend run lint` or `npm -C frontend run build` when risk warrants.
- API/server logic: targeted API/server tests plus type/build checks when contracts changed.
- SQL/schema: migration parity, security checklist, SQL diagnostics, and Supabase CLI hosted-target validation when authorized.
- Release-sized batch: use `docs/release-checklist.md`.

If validation is skipped or unavailable, record the reason in the final report and, when committing, in the commit body if the risk is material.

### 6. Stage Only The Batch

Stage only reviewed paths:

```bash
git add -- <path> ...
```

Do not use `git add .` in a dirty worktree with unrelated changes.

If accidental staging happens, unstage without changing the worktree:

```bash
git restore --staged -- <path> ...
```

For mixed files, prefer not to use interactive staging unless there is no safer option. If partial staging is necessary, immediately verify the staged diff and unstaged remainder.

### 7. Verify The Staged Batch

Before every commit:

```bash
git diff --cached --name-status
git diff --cached --check
git diff --cached
```

Confirm:

- Staged files match the planned batch.
- Staged diff contains no unrelated changes.
- Whitespace check passes.
- No secrets/env values are staged.
- The unstaged worktree still contains only intentionally deferred changes.

### 8. Commit

Use a concise commit subject that names the behavior or operational outcome:

```bash
git commit -m "<area>: <outcome>"
```

Commit message guidelines:

- Use the narrowest accurate area, such as `docs`, `admin`, `ai-studio`, `pricing`, `sql`, `api`, or `gear-ball`.
- Name the outcome, not the activity. Prefer `gear-ball: add worktree batch commit SOP` over `docs: update files`.
- Add a commit body when validation is partial, the batch is a checkpoint, or the operational risk needs context.

### 9. Post-Commit Audit

After each commit:

```bash
git status --short
git show --stat --oneline --decorate --no-renames HEAD
```

Confirm:

- The commit contains only the intended batch.
- Remaining dirty files belong to later batches or known pre-existing work.
- No staged changes remain unless intentionally prepared for the next batch.
- Validation results are recorded.

If a commit is wrong, stop and ask before rewriting history unless the user explicitly authorized correction in the current thread.

### 10. Repeat Or Stop

Repeat batch planning, inspection, validation, staging, and commit steps until:

- All requested worktree changes are committed.
- Remaining changes are intentionally deferred.
- A blocker requires user review.
- The next batch is no longer clearly related to the user's requested scope.

## Final Report

After the workflow, report:

- Current branch and allowed branch.
- Commit hashes and subjects created.
- Batch names and file groups.
- Validation commands and outcomes.
- Deferred or uncommitted changes.
- Any skipped validation and why.
- Any residual risks or required follow-up.

If files were staged successfully, final response must include the app git-stage directive. If commits were created successfully, final response must include the app git-commit directive.

## Stop Rules

Stop and ask for human review when:

- Current branch does not match `shortpulse.allowedBranch`.
- The user has not explicitly authorized commits in the current thread.
- Existing staged work may belong to someone else or another task.
- A file contains unrelated mixed changes that cannot be safely grouped.
- A batch includes secrets, raw env values, customer-private data, or unclear credential material.
- A database, Vercel, deployment, or production-target action is implied but not explicitly authorized.
- Validation fails in a way that changes batch risk or product intent.
- The only way forward appears to require destructive Git commands, history rewrite, branch switching, force push, or direct push to `main`.
