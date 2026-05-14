# D-Bug Agent Artifacts

Purpose: store non-authoritative retained artifacts for D-Bug's debugging handoffs, debug plans, reports, and training history.

## Status

D-Bug is currently at `Level 0: New`.

The agent has an initial operating contract, repo-visible memory, a structured handoff template, and a retained artifact area ready for the first real debugging lanes.

## Artifact Layout

- `memory.md`: retained working memory that supports the repo-visible memory surface.
- `run-log.md`: append-only ledger of substantive D-Bug runs.
- `sops.md`: D-Bug workflow references and future SOP needs.
- `tools.md`: helper command inventory and debugging aids.
- `training-history.md`: supervised runs, learned behavior, and next training focus.
- `handoffs/`: retained inbound debugging packets when a handoff should persist in repo-visible artifacts.
- `reports/`: dated debug reports, closeouts, and evidence summaries.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, SOPs, ADRs, user instructions, current code, or direct validation evidence.

## Recordkeeping Rule

Every substantive D-Bug run should produce retained evidence:

- append the run to `run-log.md`
- retain a handoff in `handoffs/` when intake structure matters for future reuse
- create a dated report in `reports/` when the run produces a real debug plan, bounded fix, or blocker packet

## Canonical Entry Points

- Agent contract: `docs/agents/d-bug/README.md`
- Repo-visible memory: `docs/agents/d-bug/memory.md`
- Handoff template: `docs/agents/d-bug/handoff-template.md`
- Troubleshooting index: `docs/troubleshooting.md`
