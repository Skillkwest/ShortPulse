# Handoff: Gear Ball Pre-Launch Branch Instruction Reconciliation

Owner: Gear Ball

## Problem

Gear Ball owns commit/push execution, so its active branch language needs to match the current top-level pre-launch policy. Gear Ball has learned about production-only override behavior in retained training data, but some active surfaces still say `current user-approved branch`, which is weaker and easier to misread than the current repo rule: local and GitHub work target `production` during pre-launch.

## Evidence

- Root `AGENTS.md` now says all pre-launch work must be on local `production` and GitHub `production`.
- `docs/agents/gear-ball/memory.md` says:
  - `Branch rule: work only on the current user-approved branch...`
  - `Allowed-branch rule: keep ... aligned with the current user-approved branch...`
- `docs/agents/gear-ball/github-operations.md` says:
  - `Work only on the current user-approved branch.`
- `docs/records/artifacts/agent/gear-ball/conversation-training-dataset.jsonl` already contains a useful pre-launch override lesson, but this is retained training data, not the active branch rule.

## Requested Cleanup

1. Update Gear Ball's active memory and GitHub operations guidance to lead with the pre-launch `production` branch rule.
2. Preserve historical report references to `working-development`; those are past-run evidence, not active instructions.
3. Keep `current user-approved branch` only as a fallback concept for a future explicit policy rewrite, not as the active pre-launch rule.
4. Confirm Gear Ball's hot path still requires checking branch and `shortpulse.allowedBranch`.

## Validation

- Run `npm -C frontend run docs:check`.
- Search Gear Ball active surfaces for `current user-approved branch` and confirm remaining uses are historical, not active execution policy.
