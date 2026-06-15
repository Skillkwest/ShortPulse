# Worktree Test Commit Push SOP

Purpose: define the standard operating procedure for Scott's Codex agent when asked to test, commit, and push worktree changes.

## Trigger

Run this SOP when Scott says: `run SOP`

## Role

The agent's job in this workflow is to:

- test the current worktree changes
- commit approved changes on the current branch
- push the current branch upstream

## Hard Boundaries

These rules remain in force until Scott explicitly says otherwise:

- Production is off-limits in all capacities.
- Never touch production.
- Never apply changes to production.
- Never switch to production.
- Only work on branch `codex/brother-dashboard-aesthetics`.
- Never leave branch `codex/brother-dashboard-aesthetics`.
- Keep memories, artifacts, and instructions under `Scott/`.
- Never commit secrets, `.env` files, or credentials.

## Preflight

Before any test, commit, or push:

1. Confirm the repo root is `ShortPulse`.
2. Confirm the current branch is `codex/brother-dashboard-aesthetics`.
3. Check `git status --short` to see tracked and untracked changes.
4. Review the changed files before committing so nothing unrelated or sensitive is included.
5. If branch, scope, or file state conflicts with the rules above, stop and report the conflict.

## Test Procedure

Use the smallest responsible validation that matches the touched files, then expand if needed.

1. Inspect the changed files to understand what needs validation.
2. Run targeted checks first when they exist for the affected area.
3. For frontend dashboard or homepage work, prefer:
   - `npm run lint`
   - `npm run type-check`
4. If there is an obvious local runtime check for the changed surface, run it.
5. If a command fails, capture the exact command and the exact failure text.
6. Do not guess about test outcomes. Report what passed, what failed, and what was not run.

## Commit Procedure

Only commit after reviewing the diff and confirming the set of files is intentional.

1. Review the diff for each file being included.
2. Make sure no production config, secret, or unrelated file is being staged accidentally.
3. Stage only the intended files.
4. Write a clear commit message that describes the actual change.
5. Create the commit on `codex/brother-dashboard-aesthetics`.

## Push Procedure

1. Push only branch `codex/brother-dashboard-aesthetics`.
2. Use the current branch upstream when configured.
3. If upstream is missing, push with explicit branch mapping for `codex/brother-dashboard-aesthetics`.
4. Report the resulting commit hash and remote branch status.

## Reporting Format

After the workflow, report:

- active branch
- files included in the commit
- tests run
- pass or fail status
- commit hash
- push result
- any remaining risk or follow-up

## Stop Conditions

Stop and ask Scott before proceeding if:

- the current branch is not `codex/brother-dashboard-aesthetics`
- production would be touched in any way
- secrets or env files appear in the change set
- the worktree contains ambiguous unrelated changes that should not be bundled together
- a failing test creates uncertainty about whether the change is safe to commit
