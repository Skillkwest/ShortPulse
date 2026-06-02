/**
 * Standard session memory helpers.
 * Builds the explicit Standard session-memory contract for runtime sends and persistence.
 */
import type { AgentApiMessage, AgentAttachment, AgentMessage } from "../../../../prefabs/agent";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";
import type { AiStudioSessionAgentV1 } from "../../logic/sessionSnapshot";
import { serializeAgentMessageForSnapshot } from "../agentRuntimeShared";
export { resolveRestoredStandardComposerState } from "../standardPanel/standardCreateComposerState";
import {
  buildStandardMemorySummary,
  buildStandardSessionWorkingState,
  type StandardSessionMemorySummary,
  type StandardSessionWorkingState,
} from "./standardMemorySummary";
import { resolveStandardTranscriptWindow } from "./standardTranscriptWindow";

export type StandardSessionMemory = {
  transcriptWindow: AgentMessage[];
  summary: StandardSessionMemorySummary;
  workingState: StandardSessionWorkingState;
};

export const buildStandardSessionMemory = ({
  messages,
  latestPromptArtifact,
  promptOrigin,
  attachments = [],
}: {
  messages: AgentMessage[];
  latestPromptArtifact: string | null;
  promptOrigin: PromptOrigin;
  attachments?: AgentAttachment[];
}): StandardSessionMemory => {
  const transcriptWindow = resolveStandardTranscriptWindow(messages);
  const workingState = buildStandardSessionWorkingState({
    transcriptWindow,
    latestPromptArtifact,
    promptOrigin,
    attachments,
  });
  return {
    transcriptWindow,
    summary: buildStandardMemorySummary({ workingState }),
    workingState,
  };
};

export const createPersistedStandardAgentRuntime = ({
  messages,
  input,
  latestPromptArtifact,
  promptOrigin,
  chatModeEnabled,
}: {
  messages: AgentMessage[];
  input: string;
  latestPromptArtifact: string | null;
  promptOrigin: PromptOrigin;
  chatModeEnabled: boolean;
}): AiStudioSessionAgentV1 => {
  const sessionMemory = buildStandardSessionMemory({
    messages,
    latestPromptArtifact,
    promptOrigin,
  });
  return {
    messages: sessionMemory.transcriptWindow.map(serializeAgentMessageForSnapshot),
    input,
    latestAgentPrompt: latestPromptArtifact,
    promptOrigin,
    chatModeEnabled,
  };
};

export const resolveStandardPreviousPromptFromMemory = (
  memory: StandardSessionMemory
): string | null => memory.workingState.latestPromptArtifact;

/**
 * Builds the synthetic Standard memory message prepended to outbound Standard turns.
 */
export const buildStandardSessionMemoryMessages = (
  memory: StandardSessionMemory
): AgentApiMessage[] => {
  if (!memory.summary.text) {
    return [];
  }
  return [{ role: "assistant", content: memory.summary.text }];
};
