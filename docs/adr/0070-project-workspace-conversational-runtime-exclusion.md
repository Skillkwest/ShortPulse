# ADR 0070: Project Workspace Conversational Runtime Exclusion

## Status
Accepted

## Date
2026-04-25

## Context
ADR 0063 moved project routes onto project-owned workspace authority, but the temporary snapshot envelope still carried full session-era conversational runtime. That caused project reopen to restore agent transcripts, draft agent input, chat-mode state, Pulse workflow progress, and split standard/pulse runtime lanes from `project_workspace_states.snapshot`.

That behavior made project reopen feel like session replay instead of project restore. It also kept hidden runtime state inside the project model and allowed older project rows to keep rehydrating conversation history even after the desired product contract had changed.

## Decision
1. Projects persist authored workspace state and project-owned restore content, not conversational runtime state.
2. Project workspace save/load continues to reuse the shared AI Studio snapshot envelope as a compatibility parser boundary, but project persistence must sanitize that envelope before write and fail closed on restore.
3. Project workspace snapshots must not persist:
   - `agent.messages`
   - `agent.input`
   - `latestAgentPrompt`
   - `promptOrigin`
   - `chatModeEnabled`
   - `pulseWorkflowSession`
   - split `agentRuntimes`
4. Project workspace snapshots may still persist Pulse selection state that is part of workspace composition:
   - `workspace.expertCreateMode`
   - `workspace.activePulsePresetId`
5. Opening or switching a project must reset project-visible agent conversation continuity instead of hydrating it from project workspace state.
6. Plain non-project `/ai-studio` session persistence may continue using the legacy session snapshot path until later migration work retires or narrows it.

## Consequences
- Positive:
  - Project reopen now restores workspace content without replaying prior chat history or Pulse step progress.
  - Existing project rows fail closed because restore ignores legacy conversational fields after sanitization.
  - The project persistence contract becomes easier to reason about: persist outputs of conversation, not the conversation itself.
- Negative:
  - Project reopen no longer resumes in-progress Pulse workflows or draft chat input.
  - Project persistence now depends on an explicit sanitized projection of the shared session snapshot envelope.
  - Legacy non-project session persistence still carries the broader conversational runtime until a later cleanup lane addresses it.

## Follow-ups
1. Decide whether legacy `sid` session persistence should also narrow its conversational restore surface later.
2. Clean or rewrite older `project_workspace_states.snapshot` rows opportunistically on future project saves.
3. Keep project SOPs and planning inventory aligned with the sanitized project workspace contract.
