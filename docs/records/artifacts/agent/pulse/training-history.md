# Pulse Training History

Purpose: record supervised Pulse training runs, prompt patterns, lessons, SOP/template updates, tool changes, and next training focus.

## 2026-05-01: Agent Setup

Task: establish Pulse as the Create panel and AI Studio agent-runtime steward.

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
