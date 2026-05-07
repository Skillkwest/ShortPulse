# ADR 0074: Pulse Custom Vs Guided Workflow Terminology

## Status
Accepted

## Context
The repo now implements two different Create Pulse contracts:

1. per-user custom Pulses that behave like saved instruction presets,
2. admin-owned built-in presets that still run through a guided workflow compatibility path.

For a long time, the repo described both of those contracts as if they were the same product object. That created repeated drift across:

- preset persistence docs,
- Pulse library and rail copy,
- route and runtime descriptions,
- migration and compatibility notes,
- review and audit conversations.

The implementation split is already real:

- custom Pulse persistence is now minimal and user-owned,
- custom Pulse runtime resolves to `custom_gpt`,
- built-ins are server-resolved from the admin control plane,
- built-ins may still use `workflow_gpt` orchestration and workflow session state.

What remained ambiguous was the naming contract.

## Decision
1. Use `custom Pulse` to mean a per-user saved instruction preset.
2. Use `built-in guided workflow` to mean an admin-owned preset that runs on the guided compatibility path.
3. Treat `workflow_gpt` and `custom_gpt` as implementation/runtime identifiers, not primary product terminology.
4. New user-facing docs and copy must not describe built-in guided workflows and custom Pulses as the same behavioral contract.
5. Persistence and security docs must treat `user_preferences.ai_studio_saved_pulses` as custom-Pulse-only storage.
6. Control-plane docs must describe built-ins as guided workflows owned by `/admin/agent-instructions`.
7. Short-term compatibility:
   - the surface may still be labeled `Pulses`,
   - built-ins may still appear inside that surface,
   - but the copy must explicitly distinguish the two contracts.
8. Future rename option:
   - the product may later move built-ins out of the `Pulse` label entirely,
   - this ADR does not require that rename now,
   - it only requires that the distinction remain explicit everywhere current-state docs describe the feature.

## Consequences
- Positive:
  - The repo now has one canonical language rule for Pulse-related docs and UX copy.
  - Custom Pulse persistence, runtime, and audit expectations become easier to reason about.
  - Built-in workflow behavior can remain richer without misleading people about custom Pulse behavior.
- Negative:
  - Some code and runtime identifiers still use legacy names such as `workflow_gpt`.
  - The live product still groups both contracts under the `Pulses` surface, so some ambiguity remains until a future surface rename happens.
- Follow-ups:
  - Keep updating remaining live docs and comments to follow this terminology contract.
  - If product decides to rename built-ins out of `Pulse`, record that as a separate ADR and migration plan.

## Alternatives considered
- Option A: Keep one generic `Pulse` term for both contracts.
  - Rejected because it is the source of the current semantic drift.
- Option B: Rename the entire feature immediately in code and UI.
  - Rejected for now because the repo still depends on existing route names, runtime ids, and shipped surfaces.
