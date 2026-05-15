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
- `overall-training-log.md`: long-lived rollup of performance drift, recurring weaknesses, improvements, and operating changes over time.
- `performance-scorecard.md`: weighted scoring system for checkpoint reviews and long-term D-Bug performance tracking.
- `../../../../../scripts/d_bug_scorecard.mjs`: score helper that computes weighted overall checkpoint scores from the canonical rubric.
- `handoffs/`: retained inbound debugging packets when a handoff should persist in repo-visible artifacts.
- `reports/`: dated debug reports, closeouts, and evidence summaries.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, SOPs, ADRs, user instructions, current code, or direct validation evidence.

## Recordkeeping Rule

Every substantive D-Bug run should produce retained evidence:

- append the run to `run-log.md`
- retain a handoff in `handoffs/` when intake structure matters for future reuse
- create a dated report in `reports/` when the run produces a real debug plan, bounded fix, or blocker packet

Every retained D-Bug report should include:

- current status: `open`, `blocked`, `handed_off`, or `done`
- explicit stop condition
- next checkpoint action when status is `open`
- checkpoint review entries that record:
  - what was done
  - how it was done
  - self-rating
  - weak score categories
  - improvement action

Use `training-history.md` for supervised-run snapshots and workflow changes.
Use `overall-training-log.md` for cumulative patterns across many checkpoints or runs.
Use `performance-scorecard.md` for the stable categories, weights, thresholds, and critical failure overrides.

When a D-Bug lane ends in an operational handoff:

- route commit/push/branch-hygiene execution to `Gear Ball`
- route hosted environment, Supabase/Vercel, GitHub Environment, or staged/production SQL remediation to `Nuclo`
- record the downstream owner explicitly in the retained handoff or report

## Canonical Entry Points

- Agent contract: `docs/agents/d-bug/README.md`
- Repo-visible memory: `docs/agents/d-bug/memory.md`
- Handoff template: `docs/agents/d-bug/handoff-template.md`
- Troubleshooting index: `docs/troubleshooting.md`
