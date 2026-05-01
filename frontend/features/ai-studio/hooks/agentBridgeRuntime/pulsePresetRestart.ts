import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type {
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
} from "../../components/create/createPulsePresets";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";

type PulseRestartHandle = {
  presetId: string;
  sessionInstanceId: string;
};

export type RestartCreatePulsePresetParams = {
  preset: CreatePulseResolvedPreset;
  restartPulse?: () => PulseRestartHandle | null;
  resetAgentChat: () => void;
  resetAgentComposer: (options?: {
    preserveInput?: boolean;
    preserveAttachments?: boolean;
  }) => void;
  setLatestAgentPrompt: (value: string | null) => void;
  setPromptOrigin: (value: PromptOrigin) => void;
  setPulseWorkflowSession: (value: AgentPulseWorkflowSession | null) => void;
  setUiNotice: (value: string | null) => void;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
  startPulsePreset: (
    preset: CreatePulseResolvedPreset,
    options?: {
      pulseSessionInstanceId?: string | null;
      deferWorkflowSessionCommit?: boolean;
    }
  ) => Promise<CreatePulsePresetStartResult>;
};

export const restartCreatePulsePreset = async ({
  preset,
  restartPulse,
  resetAgentChat,
  resetAgentComposer,
  setLatestAgentPrompt,
  setPromptOrigin,
  setPulseWorkflowSession,
  setUiNotice,
  trackAgentUiEvent,
  startPulsePreset,
}: RestartCreatePulsePresetParams): Promise<void> => {
  trackAgentUiEvent("studio_agent_pulse_restart_requested", {
    preset_id: preset.presetId,
    runtime_mode: preset.runtimeMode,
    activation_mode: preset.activationMode,
  });
  resetAgentChat();
  resetAgentComposer({ preserveAttachments: false });
  setLatestAgentPrompt(null);
  setPromptOrigin("manual");
  setPulseWorkflowSession(null);
  const restartedPulse = restartPulse?.() ?? null;
  const pulseSessionInstanceId =
    restartedPulse?.presetId === preset.presetId ? restartedPulse.sessionInstanceId : null;
  if (!pulseSessionInstanceId) {
    setUiNotice("Pulse restart could not create a fresh session. Start the Pulse again.");
    trackAgentUiEvent("studio_agent_pulse_restart_blocked_missing_session", {
      preset_id: preset.presetId,
    });
    return;
  }
  await startPulsePreset(preset, {
    pulseSessionInstanceId,
  });
};
