# Holomony Current Report Entrypoints

Purpose: hold the small set of retained Holomony reports and packets that can still be useful first reads for active lanes.

Freshness rule: this folder is not automatic production truth. Treat every dated report or packet as a retained entrypoint that must be refreshed against current repo code, current production behavior, and newer user-reported incidents before making readiness, health, or performance claims.

Use this folder first when you need:

- the current approved-panel KPI/persistence read
- the latest paired approved-panel runtime check
- the current active density-plan reference
- the current candidate-surface onboarding reference
- the current Reference Grid onboarding plan and stop criteria
- current Reference Grid incident reports, if present
- the latest incident/hotfix retained read
- the latest Holomony self-maintenance/context-load cleanup retained reads, if a fresh one exists

If the answer is not in this folder, only then step into `../archive/`.

Historical Reference Grid baselines live in `../archive/` and must not be treated as current health proof after later production incidents.

Historical self-maintenance reports also live in `../archive/`; current load policy is maintained in `docs/agents/holomony/AGENTS.md` and `docs/agents/holomony/memory.md`.
