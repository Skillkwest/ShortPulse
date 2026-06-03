# Bactuo Training History

Purpose: track supervised Bactuo runs, learned behavior, SOP changes, tool changes, and next training focus.

## History

### 2026-06-03 - Initial setup

- Prompt used: establish Bactuo as the repo-native owner of generation, recovery, and settlement with its own workspace, memory, instructions, SOP, and artifacts.
- Behavior learned: the repo's stable agent-home pattern is contract and runtime memory under `docs/agents/<agent>/` plus retained artifacts under `docs/records/artifacts/agent/<agent>/`.
- Behavior learned: Bactuo's lane is not "all billing" or "all AI Studio"; it is the generation lifecycle chain from submit through recovery, canonical outputs, and request-scoped settlement.
- Behavior learned: the current generation system is architecturally salvageable, but the main risk is fragmented authority and inconsistent identity/settlement contracts across provider families and subsystems.
- SOP or template updates: created Bactuo's contract, scoped instructions, memory, standing SOP, source map, workspace, and retained artifact structure.
- Tool changes: initialized a tools inventory and reports namespace for future supervised runs.
- Remaining friction: Bactuo has not yet completed a real implementation lane under its new authority surface.
- Next training focus: perform one concrete architecture-consolidation or lifecycle-hardening lane and refine the SOP from observed workflow friction.

### 2026-06-03 - Gottspan onboarding verification

- Prompt used: onboard the new agent Bactuo.
- Behavior learned: Bactuo's initial package already matched the newer agent-home pattern: active contract, scoped instructions, memory, SOP, ownership manifest, source map, workspace, retained artifacts, and docs indexes were already present.
- SOP or template updates: no new structural template was needed. Tightened Bactuo memory and workspace docs so the solo-owner/pre-launch frame and canonical entrypoints are easier to load on future runs.
- Tool changes: none.
- Remaining friction: Bactuo still needs its first real implementation or architecture-consolidation run before any baseline KPI or deeper tooling would be justified.
- Next training focus: use one concrete generation lifecycle lane to test whether the source map and SOP are enough, then refine only from observed friction.
