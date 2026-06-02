/**
 * Standard Create composer state policy.
 * Centralizes visible-composer ownership and chat-mode transition rules for
 * the Standard Create lane.
 */

export type StandardCreateComposerState = {
  prompt: string;
  agentInput: string;
  chatModeEnabled: boolean;
};

/**
 * Returns the text currently visible to the user in the Standard composer.
 */
export const resolveVisibleStandardComposerPrompt = ({
  prompt,
  agentInput,
  chatModeEnabled,
}: StandardCreateComposerState): string => (chatModeEnabled ? agentInput : prompt) ?? "";

/**
 * Returns whether the Standard visible composer currently has usable text.
 */
export const hasVisibleStandardComposerPrompt = (state: StandardCreateComposerState): boolean =>
  resolveVisibleStandardComposerPrompt(state).trim().length > 0;

export type StandardCreateChatModeTransition = {
  nextPrompt: string;
  nextAgentInput: string;
};

/**
 * Resolves the Standard composer state handoff when chat mode changes.
 */
export const resolveStandardChatModeTransition = ({
  currentChatModeEnabled,
  nextChatModeEnabled,
  prompt,
  agentInput,
}: {
  currentChatModeEnabled: boolean;
  nextChatModeEnabled: boolean;
  prompt: string;
  agentInput: string;
}): StandardCreateChatModeTransition | null => {
  if (currentChatModeEnabled === nextChatModeEnabled) {
    return null;
  }

  if (nextChatModeEnabled) {
    return {
      nextPrompt: prompt,
      nextAgentInput: prompt,
    };
  }

  return {
    nextPrompt: agentInput,
    nextAgentInput: agentInput,
  };
};

/**
 * Resolves the Standard visible composer state during session restore.
 */
export const resolveRestoredStandardComposerState = ({
  workspacePrompt,
  runtimeInput,
  chatModeEnabled,
}: {
  workspacePrompt: string;
  runtimeInput: string;
  chatModeEnabled: boolean;
}): { prompt: string; agentInput: string; promptOriginFallback: boolean } => {
  if (!chatModeEnabled) {
    return {
      prompt: workspacePrompt,
      agentInput: runtimeInput,
      promptOriginFallback: false,
    };
  }

  if (runtimeInput.trim().length > 0) {
    return {
      prompt: runtimeInput,
      agentInput: runtimeInput,
      promptOriginFallback: false,
    };
  }

  return {
    prompt: workspacePrompt,
    agentInput: workspacePrompt,
    promptOriginFallback: workspacePrompt.trim().length > 0,
  };
};
