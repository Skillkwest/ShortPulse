# Prelaunch Production Branch Exception

Purpose: record the temporary user-approved exception that allows work on the `production` branch during the prelaunch sprint without changing the repo's permanent branch safety policy.

## Status

- Date recorded: `2026-05-15`
- Applies only while the current prelaunch sprint exception is active.
- This note is retained evidence, not the source of truth for permanent branch policy.

## Exception

- The user granted temporary permission to work on the `production` branch during the prelaunch sprint.
- This exception is limited to the current approved work window and does not replace the normal branch ladder or default branch rules.

## Constraints That Still Apply

- Permanent branch safety instructions still stand unless the user explicitly overrides them again in-thread.
- Do not switch branches by assumption.
- Do not push to `staging-preview`, `production`, or any other branch without explicit user approval in the current thread.
- Do not push directly to `main`.
- Keep `git config --local shortpulse.allowedBranch` aligned to `production` for the duration of this exception so local hooks keep enforcing the active branch contract.

## Stop Condition

- This exception ends when the prelaunch sprint window closes or the user explicitly revokes the permission.
- After that point, branch handling should revert to the normal repo policy and the then-current user-approved branch.

## Operational Note

- Treat this as a scoped execution exception for the current sprint, not a general instruction to use `production` for normal development.
