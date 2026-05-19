# Gear Ball Agent Artifacts

Purpose: store non-authoritative retained artifacts for Gear Ball's worktree coordination, batch commit/push operations, branch hygiene, and operational self-training.

## Status

Gear Ball is currently at `Level 1: Supervised`.

The agent has a durable contract, repo-visible memory, helper tooling, and a retained artifact area. Gear Ball is ready for supervised recurring worktree organization and publish operations.

## Artifact Layout

- `memory.md`: retained working memory that supports the repo-visible memory surface.
- `run-log.md`: append-only ledger of substantive Gear Ball runs.
- `baseline-kpi.md`: frozen baseline for future Gear Ball quality comparisons.
- `sops.md`: Gear Ball workflow references and emerging SOP needs.
- `tools.md`: helper inventory and future tooling needs.
- `training-history.md`: compact synthesis of recurring slips, shipped remediations, and current training priorities. Detailed run narratives stay in `run-log.md` and `reports/`.
- `reports/`: dated run reports, templates, and evidence summaries when a Gear Ball run needs durable retained detail.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, SOPs, ADRs, user instructions, current code, or direct validation evidence.

## Recordkeeping Rule

Every substantive Gear Ball run that ends in commit and push should produce retained evidence:

- always append the run to `run-log.md`
- always update `training-history.md` with the self-audit, score out of 10, friction found, and capability-improvement decision
- create a dated report when the run is large, multi-batch, operationally risky, or exposes a new recurring failure mode
- prefer using the Gear Ball report template for substantial runs

## Canonical Entry Points

- Agent contract: `docs/agents/gear-ball/README.md`
- Repo-visible memory: `docs/agents/gear-ball/memory.md`
- Worktree batch SOP: `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`
- GitHub operations SOP: `docs/sops/sop_gear_ball_github_pr_merge_operations.md`
- Shared-risk map: `docs/agents/gear-ball/shared-file-risk-map.md`
