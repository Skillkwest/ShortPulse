# Gear Ball Current Handoff - 2026-05-14

Purpose: hand off the current `working-development` stabilization lane commit/push execution contract on the approved branch.

## Current State

- Branch: `working-development`
- Allowed branch: `working-development`
- Repo-side quality gates are green on the local branch for the current worktree lane:
  - `cd frontend && ./node_modules/.bin/eslint . --quiet`
  - `cd frontend && ./node_modules/.bin/tsc --noEmit --pretty false`
  - `cd frontend && npm run test:adaptive-v2-gate`
  - `cd frontend && npm run deadcode:check`
  - `cd frontend && npm run build`
  - `cd frontend && npm audit --omit=dev --audit-level=moderate`
  - `cd frontend && npm run test`
  - Result: `702` files passed, `4626` tests passed, `44` skipped
- Docs/contracts are green for the current branch state:
  - `cd frontend && npm run docs:check`

## Scope Boundary

- Gear Ball owns the local worktree, staging discipline, commit readiness, commit, and push sequence on `working-development`.
- The hosted SQL remediation packet now belongs to Nuclo:
  - `docs/agents/nuclo/CURRENT-HANDOFF.md`

## Commit And Push Instructions

Follow this sequence exactly. Do not improvise around branch rules.

1. Verify branch guard before staging:
   - `git branch --show-current`
   - `git config --local shortpulse.allowedBranch`
   - both must equal `working-development`

2. Inspect the worktree before staging:
   - `git status --short`
   - confirm which files belong to the intended batch
   - do not accidentally absorb unrelated operator or user edits

3. Run preflight on the intended batch before staging if the batch is substantial:
   - `npm -C frontend run gear-ball:preflight -- --files <paths...> --tests <tests...>`

4. Stage only the intended batch.

5. Re-run the minimum validation needed for the staged batch.
   For this stabilization lane, the expected baseline is:
   - `cd frontend && npm run docs:check`
   - `cd frontend && ./node_modules/.bin/tsc --noEmit --pretty false`
   - `cd frontend && ./node_modules/.bin/eslint . --quiet`
   - `cd frontend && npm run test`

6. Inspect staged diff before commit:
   - `git diff --cached --stat`
   - `git diff --cached`

7. Commit on `working-development` only.
   - Do not amend unrelated history.
   - Do not commit on another branch.
   - Do not bypass hooks.

8. Push only the current approved branch:
   - `git push origin working-development`

9. Do not push to `main`.

10. After push:
   - confirm the branch push succeeded on `working-development`
   - hand the hosted staging SQL remediation lane to Nuclo
   - link resulting workflow and CI evidence into a Gear Ball report if this becomes a durable promotion packet

## Files Most Relevant To This Handoff

- `docs/agents/gear-ball/README.md`
- `docs/agents/gear-ball/github-operations.md`
- `docs/api/api-internal-routes.md`

## Residual Risks

- The worktree still contains unrelated existing edits outside Gear Ball scope, including Nuclo docs and other active branch work. Those must be consciously batched, not swept in by accident.
- Hosted SQL state is not Gear Ball's execution lane; once pushed, that environment-targeted remediation belongs to Nuclo.
