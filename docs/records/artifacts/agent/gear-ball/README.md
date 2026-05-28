# Gear Ball Agent Artifacts

Purpose: store non-authoritative retained artifacts for Gear Ball's worktree coordination, batch commit/push operations, branch hygiene, and operational self-training.

## Status

Gear Ball is currently at `Level 1: Supervised`.

The agent has a durable contract, repo-visible memory, helper tooling, and a retained artifact area. Gear Ball is ready for supervised recurring worktree organization and publish operations.

## Artifact Layout

- `run-log.md`: legacy append-only ledger of notable older runs. Use only when direct historical comparison is needed.
- `baseline-kpi.md`: frozen baseline for future Gear Ball quality comparisons.
- `performance-scorecard.md`: stable scoring rubric for substantive supervised runs.
- `performance-ledger.md`: primary compact scored ledger for substantive runs.
- `tools.md`: helper inventory and future tooling needs.
- `training-history.md`: compressed active synthesis only. Detailed narratives stay in `performance-ledger.md` and `reports/`.
- `conversation-training-dataset.jsonl`: training-only structured examples. Not part of normal startup load.
- `reports/`: dated run reports, templates, and evidence summaries for exceptional or historically relevant runs.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, SOPs, ADRs, user instructions, current code, or direct validation evidence.

## Recordkeeping Rule

Retained evidence is exception-triggered, not mandatory on every ordinary run.

Always:

- keep the final response self-audit and score in chat
- append the compact run row to `performance-ledger.md`

Update heavier retained surfaces when one of these is true:

- the run was `production-critical`
- the run scored below `9/10`
- a new recurring failure mode appeared
- the process/tooling itself changed
- the user explicitly asked for process hardening or retained records

- update `training-history.md` with the current synthesized lesson set
- append the run to `run-log.md` only when long-form historical traceability is useful
- when a recurring user correction or instruction pattern appears, encode it into `conversation-training-dataset.jsonl`
- create a dated report when the run is large, multi-batch, operationally risky, or exposes a new recurring failure mode
- prefer using the Gear Ball report template for substantial runs

## Canonical Entry Points

- Agent contract: `docs/agents/gear-ball/README.md`
- Repo-visible memory: `docs/agents/gear-ball/memory.md`
- Hot-path execution checklist: `docs/agents/gear-ball/hot-path-checklist.md`
- Worktree batch SOP: `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`
- GitHub operations SOP: `docs/sops/sop_gear_ball_github_pr_merge_operations.md`
- Shared-risk map: `docs/agents/gear-ball/shared-file-risk-map.md`
