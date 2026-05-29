# Gear Ball Agent Artifacts

Purpose: store non-authoritative retained artifacts for Gear Ball's worktree coordination, batch commit/push operations, branch hygiene, and operational self-training.

## Artifact Layout

- `performance-ledger.md`: primary compact scored ledger
- `training-history.md`: compressed synthesis only
- `performance-scorecard.md`: stable scoring rubric
- `run-log.md`: cold historical trace
- `reports/`: dated exceptional or high-signal run reports
- `baseline-kpi.md`, `tools.md`, `conversation-training-dataset.jsonl`: cold support surfaces only

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, SOPs, ADRs, user instructions, current code, or direct validation evidence.

## Recordkeeping Default

Always:

- keep the self-audit and score in chat
- append one compact row to `performance-ledger.md`

Only update heavier retained surfaces when the run:

- scored below `9/10`
- exposed a genuinely new recurring lesson
- changed Gear Ball process/tooling
- or explicitly required retained process records

## Canonical Entry Points

- Agent contract: `docs/agents/gear-ball/README.md`
- Repo-visible memory: `docs/agents/gear-ball/memory.md`
- Hot-path execution checklist: `docs/agents/gear-ball/hot-path-checklist.md`
- Worktree batch SOP: `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`
- GitHub operations SOP: `docs/sops/sop_gear_ball_github_pr_merge_operations.md`
- Shared-risk map: `docs/agents/gear-ball/shared-file-risk-map.md`
