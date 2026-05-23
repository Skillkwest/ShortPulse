# Gear Ball Runtime Load Policy

Purpose: keep Gear Ball's active startup context lean so normal runs load only the surfaces needed for correct publish work.

## Always Load

- `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `docs/agents/gear-ball/README.md`
- `docs/agents/gear-ball/memory.md`
- `docs/agents/gear-ball/hot-path-checklist.md`

## Load Conditionally

- `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`
  - load when the run is unusual, mixed, corrected recently, or the next step is unclear
- `docs/agents/gear-ball/shared-file-risk-map.md`
  - load when the worktree touches shared runtime, agent surfaces, or mixed-risk files
- `docs/agents/gear-ball/prompts/README.md`
  - load when prompt work is the task
- individual files under `docs/agents/gear-ball/prompts/`
  - load only when the user calls or updates a saved prompt by name
- `docs/records/artifacts/agent/gear-ball/performance-scorecard.md`
  - load when explicitly scoring a run or recalibrating the scoring contract
- `docs/records/artifacts/agent/gear-ball/performance-ledger.md`
  - load for the latest row when recording the compact post-run score loop
- `docs/records/artifacts/agent/gear-ball/training-history.md`
  - load when the run scored below target or exposed a new durable lesson
- `docs/records/artifacts/agent/gear-ball/run-log.md`
  - load only when a historical run comparison is needed
- `docs/records/artifacts/agent/gear-ball/reports/README.md`
  - load when writing, reviewing, or locating a retained report
- dated reports under `docs/records/artifacts/agent/gear-ball/reports/`
  - load only when a specific prior run is directly relevant

## Do Not Load By Default

- the full retained report history
- older score-loop rows beyond what the current run needs
- prompt-library files unrelated to the current task
- training artifacts that do not affect the current operational decision

## Trim Rule

If a Gear Ball run starts to feel context-heavy, trim by dropping retained history first, not by dropping the active contract, memory, or hot-path checklist.
