# Gear Ball Worktree Batch Commit Operations SOP

Purpose: define Gear Ball's repeatable workflow for organizing a dirty worktree into logical, reviewable batches and committing those batches safely.

## Scope

Use this SOP when the user asks Gear Ball to organize current repo changes, prepare commit batches, commit worktree changes, or coordinate commit readiness.

This SOP covers:

- Dirty worktree inventory.
- Logical batch planning.
- Per-batch review and validation.
- Staging and committing approved batches.
- Commit evidence recording.
- Post-run self-audit and exception-triggered retained training updates for full commit/push runs.

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
- `docs/agents/gear-ball/shared-file-risk-map.md`
- `docs/sops/sop_gear_ball_github_pr_merge_operations.md`
- Current Git state and direct diff evidence.

## Run Profiles

Choose the cheapest valid profile first.

### `docs-only`

Use when only docs, indexes, SOPs, agent surfaces, or retained artifacts changed.

Minimum ladder:

- inventory
- docs validation
- one intended commit by default
- push only if asked

### `product-targeted`

Use when feature/test changes have limited blast radius.

Minimum ladder:

- inventory
- targeted validation
- `build` only when escalation triggers fire
- one intended commit by default
- push only if asked

### `shared-runtime`

Use when shared routes, pages, runtime helpers, auth, billing, env, or API contracts changed.

Minimum ladder:

- inventory
- `gear-ball:preflight`
- targeted validation
- `build`
- full suite only when escalation triggers or instability demand it

### `production-critical`

Use for `production` work or changes with direct production-risk posture.

Minimum ladder:

- inventory
- `gear-ball:preflight`
- targeted validation
- `build`
- usually full suite
- stricter leftover audits
- stronger stop/go discipline

### Separate Lane: `process/meta`

Use for Gear Ball/Gottspan/SOP/tooling/training maintenance.

Rules:

- do not mix into normal product runs unless the process/tooling itself blocked the run
- or the user explicitly asked for process work
- or the run scored below threshold and needs one concrete remediation

## Required Preconditions

- Confirm the current prompt rung/mode: analyze/no-edit, organize/validate, fix, commit, or push.
- Run the workspace artifact safety check before broad commands.
- Verify the current branch and allowed branch:
  ```bash
  git branch --show-current
  git config --local --get shortpulse.allowedBranch
  ```
- The current branch must match `shortpulse.allowedBranch` before any Git write.
- If the user has already established a standing approved branch for the repo and the local checkout has drifted elsewhere, realign `shortpulse.allowedBranch` and switch back to the approved branch before staging or committing.
- Do not run concurrent Git commands that contend for the index or working tree metadata. Serialize `git add`, `git commit`, `git status`, `git diff --cached`, and similar index-touching commands.
- For large or mixed worktrees, create the batch manifest before the first staging step. Do not let the first commit become the place where batch boundaries are discovered.
- If validation steps before the first Git write generate new retained/support artifacts (for example KPI packets, route-smoke captures, or agent evidence files), rebuild the active manifest from live `git status --short` before staging.
- Do not switch branches unless the user explicitly authorizes that branch action in the current thread.
- Do not push directly to `main`.
- Do not expose secrets, env values, tokens, customer-private data, or temporary env copies.
- Default to one intended commit. Split only when a concrete risk boundary, ownership boundary, or review boundary exists.

## Prompt Cadence Contract

Treat the user's prompt sequence as an authorization ladder. Do not move to a later rung until the user explicitly asks for that operation in the current thread.

| User prompt intent            | Gear Ball may do                                                                                                                                 | Gear Ball must not do yet                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Analyze worktree              | Inspect branch, status, diffs, staged state, and risk areas.                                                                                     | Edit, stage, commit, push, or open a PR.                                               |
| Organize/group changes        | Produce logical batches, test plan, risk map, and mixed-file warnings; run requested or safe validation.                                         | Stage, commit, or push.                                                                |
| Double-check tests            | Run targeted or full validation and report exact failures.                                                                                       | Change product behavior or commit.                                                     |
| Fix failures with constraints | Default to test-only or otherwise non-behavioral fixes. Only make UI/UX/behavior changes when the user explicitly authorizes that broader scope. | Broaden scope by adjacency or alter user-visible behavior without explicit permission. |
| Commit changes                | Stage reviewed batch paths, verify staged diff, and commit logical batches.                                                                      | Push or open a PR.                                                                     |
| Push changes                  | Push only the current approved branch after push-readiness checks.                                                                               | Open a PR, merge, deploy, or promote branches unless asked.                            |

If a prompt is ambiguous, use the safest lower rung and ask before mutating Git state or product behavior.

Special case:

- If the user explicitly says `run your SOP`, treat that phrase as combined authorization for the full default Gear Ball ladder on the current approved branch:
  - analyze
  - organize/group
  - validate
  - fix within existing user constraints
  - commit logical batches
  - push committed changes
- If the user says `we have new changes`, treat that phrase the same way by default on the current approved branch:
  - analyze
  - organize/group
  - validate
  - fix within existing user constraints
  - commit logical batches
  - push committed changes
- This combined authorization does not grant permission to:
  - switch branches
  - open a PR
  - merge a PR
  - deploy
  - mutate Vercel env
  - mutate databases
  - make UI/UX/behavior changes unless the user already authorized that broader scope
- If the user adds narrower constraints such as `explore only`, `do not push`, or `do not commit yet`, the narrower instruction overrides the default `run your SOP` / `we have new changes` ladder.
- If the user asks Gear Ball to run a task at a future time such as `in 30 minutes` or `in 2 hours`, treat that as authorization to create a wake-up that executes the requested task at that time by default. Do not downgrade that request into a reminder-only wake-up unless the user explicitly asks for a reminder instead of execution.

## Output Discipline

Default to minimal user-facing output.

- Keep the full batch manifest, validation notes, and risk map as internal working state unless the user asks for detail.
- Do not proactively summarize every batch.
- For analyze/organize prompts, report only blockers, mixed-file risks, and the next safe action unless the user explicitly asks for the batch list.
- For commit/push prompts, report only the action taken, validation result, and any intentionally deferred work.
- Create or update a durable report only when the run is substantial or the SOP already requires one.
- During active execution, do not narrate routine progress. Keep polling, command-by-command status, and successful intermediate steps internal.
- Only emit an in-flight update when:
  - progress is blocked and user action may be needed
  - credentials/auth/path/branch state prevents progress
  - the plan materially changed
  - a risk requires explicit approval
  - the user explicitly asked for status
- Otherwise, finish the run and report once at the end.

## Batch Principles

A commit batch should have one coherent reason to exist. Prefer batches that are independently reviewable, independently explainable, and reasonably reversible.

Default bias:

- start from one intended commit
- split only when the diff proves the boundary is real

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
4. If the repo is not already on the standing user-approved branch, fix that before the first Git write.
5. Confirm whether the user authorized commits in this thread. If the user only asked for a plan or SOP, do not stage or commit.
6. Check whether there is already staged work:
   ```bash
   git diff --cached --name-status
   ```
7. If staged work exists and the user did not identify it as part of Gear Ball's task, stop and ask before changing the index.
8. If pre-commit validation already generated new retained/support artifacts, rebuild the live batch manifest before the first `git add`.

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

Create a short internal plan before staging:

```text
Batch 1: <name>
- Files: <paths or path groups>
- Reason: <single coherent change>
- Validation: <targeted checks>
- Risk: <main review concern>
- Mixed files: <none | file paths and handling plan>
- Commit hash: <fill after commit>

Batch 2: ...
```

Rules:

- Keep docs/index updates with the docs they index.
- Keep tests with the behavior they validate unless the test-only change is itself the work.
- Keep migration rollback files with their migration.
- Keep package lockfile changes with the manifest change that caused them.
- If a single file contains unrelated changes from multiple logical batches, mark it as `mixed-file`.
- Do not split a mixed file blindly. Prefer a single coherent combined batch, or stop for user review if combining would hide risk.
- For shared docs indexes, shared CSS, app shells, or route files that span multiple batches, either stage by hunk with immediate staged-diff verification or defer them to a final reconciliation batch.
- If a file's dominant owner is clear but it contains supporting references for another batch, document the dominant-owner decision in the batch plan.
- If the batch changes a shared contract, write the dependency fan-out into the batch plan before the first preflight. Shared-contract triggers include:
  - preview transform profiles or signed-preview policy
  - KPI/report packet fields
  - shared route/request/response payload shapes
  - shared runtime helpers/config constants used across routes or scripts
  - cross-surface CSS/layout contracts consumed by contract tests
- For shared-contract batches, include at least one downstream dependent test family in the initial manifest, not only the closest component/hook tests.

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
- Shared-contract fan-out: inspect the dependent routes, scripts, or contract tests that consume the changed constant/helper/payload field before preflight.

Before staging a high-risk, mixed-lane, or shared-file batch, run the reusable preflight helper on the candidate file list:

```bash
npm -C frontend run gear-ball:preflight -- --files <paths...> --tests <targeted-tests...> --include-suite-hot --print-test-manifest
```

For large runs, prefer manifest files over long shell arg lists:

```bash
npm -C frontend run gear-ball:preflight -- --files-from <file-manifest.txt> --tests-from <test-manifest.txt> --include-suite-hot --print-test-manifest
```

Use `docs/agents/gear-ball/shared-file-risk-map.md` to decide when a file must be adapted manually, deferred to a reconciliation batch, or re-run as a suite-hot test before the full suite.
If invoking from repo root, prefer repo-relative frontend test paths or rely on preflight normalization so the emitted Vitest targets are frontend-relative.
`gear-ball:preflight` also auto-adds known downstream contract tests for preview-delivery, media-KPI, and character-layout fan-out. Do not treat that as exhaustive; it is a floor, not a substitute for manual dependency review.

### 5. Validate Before Commit

Run the smallest validation that proves the batch, then escalate only when a trigger fires.

- Docs-only: `npm -C frontend run docs:check`.
- Frontend logic or UI: targeted tests first, then `npm -C frontend run lint` or `npm -C frontend run build` when risk warrants.
- API/server logic: targeted API/server tests plus type/build checks when contracts changed.
- SQL/schema: migration parity, security checklist, SQL diagnostics, and Supabase CLI hosted-target validation when authorized.
- Release-sized batch: use `docs/release-checklist.md`.

Escalation triggers:

- If a batch touches shared editor/runtime hooks, shared page shells, `frontend/pages/`, `frontend/pages/api/`, or `frontend/package.json`, run `npm -C frontend run build` before the final full suite.
- If a batch includes generated or agent-produced docs/packets under `beeper/`, `bopper/`, `docs/records/artifacts/agent/`, or `docs/records/evidence/`, run `npm -C frontend run docs:check` before staging or before the first commit for that lane.
- If repo-local `node_modules/.bin/*` wrappers fail because they resolve the wrong runtime or a broken native module, rerun `build` and the full suite through the approved Node 22 binary plus direct package entrypoints instead of retrying the wrapper path.
- If a blocking validation failure is fixed while a long-running build or full-suite session is still running, treat that older session as stale. Rerun the required build/test gates against the final post-fix tree before staging or pushing.
- If a batch materially changes an interaction-heavy admin or frontend route, route-level browser smoke is required only when:
  - the selected profile is `production-critical`
  - the user explicitly asks for smoke coverage
  - or the run has already shown route-level instability that targeted tests did not cover
    If required smoke truly cannot run, classify the run as `smoke-incomplete` in the report/final audit and treat that as a scoring slip rather than a neutral skip.
- If both triggers fire in the same run, treat `build` and `docs:check` as early gates before the first Git write.

Full suite trigger:

Run the full suite only when one of these is true:

1. the profile is `production-critical`
2. the run is `shared-runtime` and cross-cutting enough that targeted validation is not a credible boundary
3. targeted validation failed in a way that widened risk
4. the user explicitly asked for full-suite confidence

If tests fail, do not commit. Report exact failing files, tests, expected/actual values, and whether the failures are deterministic.
Default to test-only or otherwise non-behavioral fixes. If green tests appear to require a UI/UX/behavior change, stop and ask unless the user already authorized that broader scope.

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
- Test status is green for the validation level required by the batch plan.

For substantial batches, generate a compact manifest from the staged index before or immediately after commit:

```bash
npm -C frontend run gear-ball:manifest -- --batch-name "<name>" --reason "<reason>" --risk "<risk>" --validation "<checks>"
```

Append it to a durable report when the run is large enough to warrant repo-visible evidence.

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

Immediately after each batch commit:

```bash
git status --short
```

Rules:

- Run this inter-batch leftover audit before staging the next batch, not only before the final push.
- Any unexpected leftover path must be folded into the just-finished batch with an amend, intentionally assigned to a later batch, or explicitly deferred as unrelated pre-existing work.
- Do not continue to the next batch by assumption when the leftover audit reveals adjacent drift.

After each commit, account for hooks such as Husky and lint-staged that may inspect or rewrite staged files:

```bash
git status --short
git diff --name-status
git diff --cached --name-status
git show --stat --oneline --decorate --no-renames HEAD
```

Confirm:

- The commit contains only the intended batch.
- Remaining dirty files belong to later batches or known pre-existing work.
- No staged changes remain unless intentionally prepared for the next batch.
- Validation results are recorded.
- Any hook-made formatting or lint changes are included in the intended commit, or are left as explicit follow-up work.

If a commit is wrong, stop and ask before rewriting history unless the user explicitly authorized correction in the current thread.

### 10. Post-Series Validation

After the final requested commit batch:

1. Run docs/index validation when docs, routes, migrations, APIs, SOPs, or agent records changed:
   ```bash
   npm -C frontend run docs:check
   ```
2. Rerun the full test suite only when the selected profile or the escalation triggers required it:
   ```bash
   npm -C frontend run test
   ```
3. If route-level browser smoke was required by the profile or escalation triggers, run it after build/full-suite success and record either `passed`, `blocked`, or `skipped with reason`.
   - `skipped with reason` is allowed only when there is a concrete blocker or no feasible local target path in the current run.
   - A qualifying run with no smoke should be classified as `smoke-incomplete` and should not receive a self-score above `8.5/10`.
4. Verify a clean or intentionally deferred tree:
   ```bash
   git status --short
   ```
   Before push-readiness, classify every remaining path. Do not carry unexplained leftovers past this step. If a new adjacent lane is still dirty and belongs to the same user-approved run, commit it before the first push.
5. Verify branch guard alignment:
   ```bash
   git branch --show-current
   git config --local --get shortpulse.allowedBranch
   ```

Do not proceed to push-readiness if post-series validation is failing, incomplete, or inconsistent with the commit report.

### 11. Post-Push Self Audit And Retained Updates

After a full SOP run that ends in commit and push:

1. Audit the run, not just the code.
2. Rate Gear Ball's performance out of 10.
3. Answer:
   - what evidence proves this run was complete
   - what repeated friction showed up
   - what was assumed but not verified
   - what smallest improvement would make the next run cleaner
   - whether current helper tooling is enough
   - whether an existing helper needs enhancement
   - whether a new helper is justified
4. If a small, low-risk, clearly useful helper or doc change is warranted, implement at most one meaningful process improvement in the same run.
5. If the run scores below `9/10`, ship or explicitly reject one concrete mechanical remediation before the run is considered closed. Valid remediation types:
   - SOP hardening
   - helper-tool behavior change
   - manifest/checklist rule change
   - retained memory/risk-map rule that changes future execution behavior
     A memory-only note is not enough unless the report explains why no stronger mechanical change was possible.
6. Retained artifacts are exception-triggered, not mandatory on every ordinary run. Update them when one of these is true:
   - the profile was `production-critical`
   - the run scored below `9/10`
   - a new recurring failure mode appeared
   - the process/tooling itself changed
   - the user explicitly asked for process hardening or retained records
7. When retained updates are triggered:
   - append `docs/records/artifacts/agent/gear-ball/run-log.md`
   - update `docs/records/artifacts/agent/gear-ball/training-history.md`
   - create or update a retained report only when the run is substantial, risky, or produced a new durable lesson
8. Update repo-visible memory only when the lesson is durable and broadly useful.
9. Treat the retained closeout as valid only for the exact clean worktree that passed the final validation ladder. If any product, docs, or test file changes after the closeout draft or closeout commit, invalidate that closeout, finish the new lane, rerun the required validation gates, and publish a rewritten closeout at the real end of the run.

### 12. Repeat Or Stop

Repeat batch planning, inspection, validation, staging, and commit steps until:

- All requested worktree changes are committed.
- Remaining changes are intentionally deferred.
- A blocker requires user review.
- The next batch is no longer clearly related to the user's requested scope.

## Final Report

After the workflow, report only the minimum needed for the current rung:

- Analyze/organize: blockers, mixed-file risks, and next safe action.
- Commit: commit hashes/subjects, validation result, and deferred work.
- Push: pushed branch, validation result if rerun, and deferred work.
- Include skipped validation or residual risk only when it changes the stop/go decision.

For substantial multi-batch, production-critical, sub-threshold, or process-changing worktree operations, create or update a retained Gear Ball report using the template in `docs/records/artifacts/agent/gear-ball/reports/run-report-template.md`. Include:

- Prompt cadence followed.
- Batch manifest with file groups, risks, validation, and commit hashes.
- Failure signals found during validation.
- Self-audit and score out of 10.
- Tooling or SOP decisions made after the run.
- Fix constraints and what was deliberately not changed.
- Post-commit and post-push state, when applicable.
- Unverified assumptions and human-review requirements.

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
- The apparent path to green tests requires a UI/UX/behavior change that the user has not explicitly authorized.
- Required tests are failing. Continue iterating inside the authorized scope until tests are green, or stop for user approval of a known-failing checkpoint.
- The only way forward appears to require destructive Git commands, history rewrite, branch switching, force push, or direct push to `main`.
