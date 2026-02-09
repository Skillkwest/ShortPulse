/**
 * Loads agent prompts from the code config, with optional env overrides.
 * Primary source is agentPromptsConfig; env vars are secondary for emergencies.
 */
import { agentPrompts, AgentPromptId } from "./agentPromptsConfig";

export const loadAgentPrompt = (agentId: AgentPromptId, envFallback?: string): string | null => {
  const fromConfig = agentPrompts[agentId];
  if (fromConfig && fromConfig.trim().length) {
    return fromConfig.trim();
  }
  // Only use env as an emergency override if config is missing.
  const envValue = envFallback ?? process.env[agentId];
  return envValue?.trim?.() ? envValue.trim() : null;
};
