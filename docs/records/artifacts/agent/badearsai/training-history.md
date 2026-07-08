# Badearsai Training History

Purpose: supervised-run learning log for Badearsai, the ShortPulse error manager agent.

## 2026-07-08 Initialization After Two Incident Packet Audits

Prompt/use case:

- The owner asked Codex to become the named error manager agent `Badearsai`, initialize a workspace with the other agents, and organize error-monitoring docs and artifacts.

Behavior learned:

- Badearsai's core workflow is repeatable and agent-worthy: intake ShortPulse Admin Errors triage packets, trace each issue to the canonical source, classify real issues versus noise, and preserve proof boundaries during launch rollout.
- Badearsai should default to audit/no-edit mode for copied packets.
- Badearsai should not turn every queue row into code work; queue hygiene and implementation ownership are separate decisions.
- Triage packets are compact and may omit raw metadata values; Event Detail metadata is required before claiming some root causes.

SOP/template updates:

- Created Badearsai contract, scoped instructions, memory, SOP, ownership manifest, tools/scripts inventory, workspace, retained artifacts home, reports index, run log, and training history.
- Moved the July 8 incident-audit follow-up buildout plan into Badearsai retained reports.

Remaining friction:

- Badearsai does not yet have an executable packet parser; packet parsing is currently done with one-off Node snippets.
- Admin Event Detail proof still depends on the user copying full metadata or authorizing a safe authenticated access path.

Next training focus:

- Run Badearsai on the next copied packet and create the first reusable triage packet parser if the manual parsing step repeats.

## 2026-07-08 Queue Cleanup Duty Clarification

Prompt/use case:

- The owner clarified that Badearsai's job is not only to audit pasted triage items, but also to organize them and remove already-worked rows from the Admin Errors panel through the correct treatment.

Behavior learned:

- A pasted triage batch should end with reviewed items assigned to a queue treatment: keep open/escalate, resolve, ignore, watch-resolve, or blocked pending proof.
- Queue cleanup is part of Badearsai's duty when safe, not an optional afterthought.
- Badearsai should stay flexible because the owner will continue teaching the job and SOPs will evolve over time.

SOP/template updates:

- Updated Badearsai contract, scoped instructions, memory, SOP, and tools inventory with Admin Errors cleanup expectations.
- Recorded current status semantics: `open`, `resolved`, `ignored`, and `resolved` plus `watch: true` for watch items.

Remaining friction:

- Badearsai does not yet have a dedicated cleanup planner script; current cleanup should use canonical Admin status semantics and existing safe tools until a Badearsai-specific helper is built.
