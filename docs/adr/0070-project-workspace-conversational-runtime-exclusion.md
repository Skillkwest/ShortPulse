# ADR 0070: Project Workspace Conversational Runtime Exclusion

## Status

Accepted

## Date

2026-04-25

## Context

ADR 0063 moved project routes onto project-owned workspace authority, but the temporary snapshot envelope still carried full session-era conversational runtime. That caused project reopen to restore agent transcripts, draft agent input, chat-mode state, Pulse workflow progress, and split standard/pulse runtime lanes from `project_workspace_states.snapshot`.

That behavior made project reopen feel like session replay instead of project restore. It also kept hidden runtime state inside the project model and allowed older project rows to keep rehydrating conversation history even after the desired product contract had changed.

## Decision

1. Projects persist authored workspace state and project-owned restore content, not full conversational runtime replay state.
2. Project workspace save/load continues to reuse the shared AI Studio snapshot envelope as a compatibility parser boundary, but project persistence must sanitize that envelope before write and fail closed on restore.
3. Project workspace snapshots must not persist:
   - `agent.messages`
   - `agent.input`
   - `latestAgentPrompt`
   - `promptOrigin`
   - `chatModeEnabled`
   - `pulseWorkflowSession`
   - the Standard lane inside `agentRuntimes`
   - Pulse runtime transcript/message history
4. Project workspace snapshots may preserve the parked Pulse lane only when all of the following are true:
   - `workspace.activePulsePresetId` is authoritative
   - `workspace.pulseSessionInstanceId` is authoritative
   - `agentRuntimes.pulsePresetId` and `agentRuntimes.pulseSessionInstanceId` match that workspace authority
5. Project workspace snapshots may also persist a project-owned Pulse `Chats` library for explicit reopen, but that library must stay Pulse-only and must not hydrate visible chat automatically on project open.
6. Opening or switching a project must reset project-visible agent conversation continuity instead of hydrating it from project workspace state.
7. Plain non-project `/ai-studio` session persistence may continue using the legacy session snapshot path until later migration work retires or narrows it.

## Consequences

- Positive:
  - Project reopen now restores workspace content without replaying prior chat history or Pulse step progress.
  - Project-visible conversation state is still reset on project open even when an authorized hidden Pulse lane is preserved.
  - Project-owned Pulse chat history can now be saved and reopened explicitly without weakening the fail-closed project bootstrap contract.
  - Existing project rows fail closed because restore ignores legacy conversational fields after sanitization.
  - The project persistence contract becomes easier to reason about: persist outputs of conversation plus authorized hidden Pulse parking, not full conversation replay.
- Negative:
  - Project reopen still does not restore the visible Standard conversation lane or transcript history.
  - The hidden Pulse lane now has a narrower but non-zero persistence contract when preset/session authority is valid.
  - Project persistence now also carries a Pulse-only thread library that must stay isolated from Standard and from automatic project-open hydration.
  - Project persistence now depends on an explicit sanitized projection of the shared session snapshot envelope.
  - Legacy non-project session persistence still carries the broader conversational runtime until a later cleanup lane addresses it.

## Follow-ups

1. Decide whether legacy `sid` session persistence should also narrow its conversational restore surface later.
2. Clean or rewrite older `project_workspace_states.snapshot` rows opportunistically on future project saves.
3. Keep project SOPs and planning inventory aligned with the sanitized project workspace contract.
