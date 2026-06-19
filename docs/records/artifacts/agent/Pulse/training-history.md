# Pulse Training History

Purpose: record supervised Pulse training runs, prompt patterns, lessons, SOP/template updates, tool changes, and next training focus.

## 2026-05-01: Agent Setup

Task: establish Pulse as the Standard-mode and Pulse-mode agent behavior owner.

Prompt summary:

```text
Create a new agent named Pulse. Pulse manages the Create panel and all agent inner workings for Standard mode and Pulse mode. Pulse is also the mascot and brand avatar. Create a folder for Pulse and memory. Run the new agent SOPs.
```

Actions taken:

- Loaded the repo startup contract and core docs.
- Loaded the generic agent training SOP and post-run audit SOP.
- Loaded AI Studio Create panel, agent collaboration, Pulse mode, and Standard/Pulse runtime isolation docs.
- Created Pulse's durable agent contract and repo-visible memory.
- Created Pulse's retained training/artifact area with memory, SOP notes, tools, training history, and reports.
- Indexed Pulse in the agent docs and retained artifact docs.

Training result:

- Pulse is initialized at `Level 1: Supervised`.
- Pulse has not yet completed a real Create panel or agent-runtime implementation run.

Next training focus:

- Run Pulse on one real Create panel or Standard/Pulse runtime task.
- Require direct validation of mode isolation, prompt ownership, and artifact routing before marking the run complete.

## 2026-05-01: Create Agent Route Cleanup Implementation

Task: remove fallback, legacy, alternative, and backup agent routes from the AI Studio Create panel for Standard and Pulse modes.

Actions taken:

- Removed Standard direct-bypass request fields, env flags, panel props, and route handling from the active Create agent contract.
- Forced Standard Create into the route-owned chat-first runtime and removed the persisted chat-off runtime hook from active Create.
- Converted Standard upstream/provider/contract failures into explicit error payloads instead of success-shaped assistant recovery responses.
- Collapsed Pulse runtime execution onto the single-stage guided route path and removed legacy V2, text fast-path, and generic route switches from active Create.
- Removed the generic `/api/ai/studio-agent` route file and updated route/docs references to the Standard/Pulse route pair.
- Updated Pulse memory and SOP references to preserve the route contract for future work.

Validation:

- `cd frontend && npx tsc --noEmit --pretty false`
- `cd frontend && npm test -- --run tests/api/studio-agent.runtime.test.ts tests/api/studio-agent.runtime.workflow-bypass.test.ts features/ai-agent/__tests__/createAgentBoundary.test.ts`

Training result:

- Pulse completed its first supervised Create panel / agent-runtime implementation run.
- Durable lesson added: active Create agent traffic has exactly two valid routes, Standard and Pulse.

## 2026-06-01: Ownership And Naming Realignment

Task: make Pulse the explicit owner of both Standard-mode and Pulse-mode agent behaviors, add a Pulse workspace surface, and rename Pulse's repo folders from the generic lowercase slug to the proper Pulse identity.

Actions taken:

- Renamed the contract folder from `docs/agents/pulse/` to `docs/agents/Pulse/`.
- Renamed the retained artifact folder from `docs/records/artifacts/agent/pulse/` to `docs/records/artifacts/agent/Pulse/`.
- Added `docs/agents/Pulse/workspace/` as Pulse's owned temporary workspace surface with `dropbox/` and `drafts/` lanes.
- Updated Pulse's contract, memory, artifact docs, and index references to state that Pulse owns Standard-mode and Pulse-mode agent behaviors entirely, not just the visible Create panel.

Training result:

- Pulse now has an explicit local workspace surface in addition to the contract and retained artifact surfaces.
- Pulse's repo identity now reads as `Pulse` across the active contract and artifact paths.

## 2026-06-01: Admin Agent Instructions Scope Narrowing

Task: extend Pulse's ownership to the `/admin/agent-instructions` page only for the Standard runtime instructions surface and the Standard/Pulse control-plane boundary, while forbidding broader admin ownership and default edits to built-in Pulse catalog entries.

Actions taken:

- Updated Pulse's contract to include `/admin/agent-instructions` as an owned surface only within a narrow Standard/Pulse agent-instructions lane.
- Added explicit prohibitions against touching other admin pages, editing Style Extraction or Expert Edit controls there, and editing built-in Pulse catalog entries without explicit one-off authorization.
- Updated Pulse memory and SOP notes to preserve the narrower admin boundary for future runs.

Training result:

- Pulse now has a documented admin scope boundary that is narrow, explicit, and resistant to accidental admin-panel sprawl.

## 2026-06-01: Solo-Owner Onboarding Pass

Task: onboard Pulse into the shared solo-owner/pre-launch agent operating package.

Actions taken:

- Added `docs/agents/Pulse/AGENTS.md` as Pulse's scoped startup overlay.
- Added `docs/agents/Pulse/standard-operating-procedure.md` as Pulse's active standing SOP.
- Added `docs/agents/Pulse/ownership-manifest.md` to define owned, adjacent, and non-owned surfaces.
- Updated Pulse's contract, memory, workspace, artifact README, and retained SOP notes so active operating truth lives in `docs/agents/Pulse/` while retained artifacts remain non-authoritative.
- Updated indexes so Pulse's new operating surfaces are discoverable.

Training result:

- Pulse now has the same core solo-owner, pre-launch production-only, launch-trust, canonical-path, and no-workaround guardrails as the newer high-ROI agents.

## 2026-06-19: Operating Space Prune

Task: run the current-agent audit/prune prompt against Pulse's own workspace, not Gottspan's prompt library.

Actions taken:

- Treated conversational context older than 10 minutes as training-only unless current repo files or current user instructions reactivate it.
- Audited Pulse's active contract, memory, SOP, ownership manifest, workspace, retained training history, and retained reports.
- Kept the active contract files intact because they are already small and non-duplicative.
- Compressed retained report discovery into `docs/records/artifacts/agent/Pulse/reports/README.md` so future runs can avoid loading long historical plans by default.
- Marked workspace drafts as load-on-demand only, with the Standard Create human-experience model kept as a useful draft rather than active runtime authority.

Training result:

- Pulse's default-load path is leaner: active contract files first, retained artifacts only by indexed need, and long reports/drafts no longer carried forward mentally by default.
