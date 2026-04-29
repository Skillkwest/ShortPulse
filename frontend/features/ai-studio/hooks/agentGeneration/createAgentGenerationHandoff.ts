/**
 * Resolves Create-agent generation handoff behavior for Standard and Pulse runtimes.
 */

type CreateAgentGenerationHandoffParams = {
  expertCreateMode: "standard" | "pulse";
  chatModeEnabled: boolean;
  onStandardAgentCaptureResult: (promptText: string, title?: string | null) => void;
};

export const resolveCreateAgentGenerationHandoff = ({
  expertCreateMode,
  chatModeEnabled,
  onStandardAgentCaptureResult,
}: CreateAgentGenerationHandoffParams): {
  usesAgentLane: boolean;
  onAgentCaptureResult?: (promptText: string, title?: string | null) => void;
} => {
  if (expertCreateMode === "pulse") {
    return {
      usesAgentLane: true,
      onAgentCaptureResult: undefined,
    };
  }

  return {
    usesAgentLane: chatModeEnabled,
    onAgentCaptureResult: onStandardAgentCaptureResult,
  };
};
