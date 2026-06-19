# Pulse Run Reports

Purpose: index retained Pulse run reports for Create panel and agent-runtime work.

## Default Load Policy

These reports are retained evidence, not active operating authority.

For normal Pulse work, do not load the full reports directory. Start from the active contract in `docs/agents/Pulse/`, then use this index to decide whether a specific report is worth opening.

Open a full report only when the current task needs that exact historical plan, decision packet, or evidence trail. Otherwise use the compressed notes below and re-check current repo source before acting.

## Current Reports

| Report                                                                                                      | Load When                                                                          | Compressed Value                                                                                                                                 | Caveat                                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| [2026-06-01 Standard Mode Modularization Blueprint](./2026-06-01-standard-mode-modularization-blueprint.md) | Planning or auditing Standard agent module boundaries.                             | Maps a Standard-only modularization path and no-touch surfaces for early refactor slices.                                                        | Historical blueprint; verify current file ownership before using it as an implementation plan.                     |
| [2026-06-02 Standard Mode Capability Plan V1](./2026-06-02-standard-mode-capability-plan-v1.md)             | Planning Standard capability upgrades, session memory, context assembly, or evals. | Defines a phased Standard capability path while preserving Standard/Pulse isolation and avoiding broad UI changes.                               | Long planning artifact; do not load by default or treat all phases as still open.                                  |
| [2026-06-02 Standard Mode Assistant Parity Plan V1](./2026-06-02-standard-mode-assistant-parity-plan-v1.md) | Auditing Standard against ChatGPT-like assistant behavior.                         | Captures the conversation-first Standard direction, model upgrade rationale, memory quality goals, image understanding, and artifact boundaries. | Some implementation notes may already be absorbed into current code/tests; re-check current runtime before acting. |
| [2026-06-02 Standard Model Decision Packet V1](./2026-06-02-standard-model-decision-packet-v1.md)           | Reviewing why Standard defaulted toward `gpt-5.5`.                                 | Short model-policy decision packet; recommends `gpt-5.5` over moving aliases and records verification gates.                                     | Model availability and pricing can drift; verify current OpenAI/provider truth before relying on it.               |

## Pruned Context Policy

- Do not carry report details forward mentally between runs unless they are re-read for the current task.
- Treat old report prose as hypothesis or history, not source of truth.
- Prefer current code, ADRs, SOPs, and targeted validation over retained report claims.
- If a report becomes actively relevant again, summarize only the current decision and proof boundary in the active closeout instead of reloading the whole report on future runs.
