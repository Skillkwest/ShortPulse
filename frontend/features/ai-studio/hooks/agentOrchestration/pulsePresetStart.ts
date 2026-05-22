import { buildStudioAgentPulseActivationSeed } from "../../../agent-runtime/studioAgentPulseRuntime";
import type {
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
} from "../../components/create/createPulsePresets";
import { normalizePromptText, type PromptOrigin } from "../../logic/agentPromptOwnership";
import { randomId } from "../../logic/ids";
import { normalizePulseSessionInstanceId } from "../../logic/pulseSessionState";
import { shouldApplyAgentPromptToSharedPrompt } from "../../logic/promptTargeting";
import { buildPendingPulseWorkflowSessionForStart } from "../../logic/pulseWorkflowSession";
import {
  buildImageSatisfiedPulseWorkflowSession,
  hasPulseImageContext,
} from "../../logic/pulseImageIntake";
import type { UseAiStudioAgentOrchestrationParams } from "./types";

type StartPulsePresetParams = {
  preset: CreatePulseResolvedPreset;
  options?: {
    pulseSessionInstanceId?: string | null;
    deferWorkflowSessionCommit?: boolean;
  };
  agentBootstrapReady: boolean;
  agentIsSending: boolean;
  agentSessionEnabled: boolean;
  agentUiBusyRef: React.MutableRefObject<boolean>;
  latestAgentPrompt: string | null;
  lastAssistantMessage: string | null;
  selectedTool: UseAiStudioAgentOrchestrationParams["selectedTool"];
  pulseSessionInstanceId: string | null;
  resolvePulseSessionNamespace: UseAiStudioAgentOrchestrationParams["resolvePulseSessionNamespace"];
  getAgentContext: UseAiStudioAgentOrchestrationParams["getAgentContext"];
  notifyBootstrapPending: () => void;
  sendToAgent: UseAiStudioAgentOrchestrationParams["sendToAgent"];
  trackAgentUiEvent: UseAiStudioAgentOrchestrationParams["trackAgentUiEvent"];
  setAgentSessionEnabled: UseAiStudioAgentOrchestrationParams["setAgentSessionEnabled"];
  setAgentAttachmentError: UseAiStudioAgentOrchestrationParams["setAgentAttachmentError"];
  setAgentUiBusy: UseAiStudioAgentOrchestrationParams["setAgentUiBusy"];
  setPulseWorkflowSession: UseAiStudioAgentOrchestrationParams["setPulseWorkflowSession"];
  setLatestAgentPrompt: UseAiStudioAgentOrchestrationParams["setLatestAgentPrompt"];
  setSharedPrompt: UseAiStudioAgentOrchestrationParams["setSharedPrompt"];
  setPromptOrigin: React.Dispatch<React.SetStateAction<PromptOrigin>>;
};

export const startPulsePreset = async ({
  preset,
  options,
  agentBootstrapReady,
  agentIsSending,
  agentSessionEnabled,
  agentUiBusyRef,
  latestAgentPrompt,
  lastAssistantMessage,
  selectedTool,
  pulseSessionInstanceId,
  resolvePulseSessionNamespace,
  getAgentContext,
  notifyBootstrapPending,
  sendToAgent,
  trackAgentUiEvent,
  setAgentSessionEnabled,
  setAgentAttachmentError,
  setAgentUiBusy,
  setPulseWorkflowSession,
  setLatestAgentPrompt,
  setSharedPrompt,
  setPromptOrigin,
}: StartPulsePresetParams): Promise<CreatePulsePresetStartResult> => {
  if (!agentBootstrapReady) {
    notifyBootstrapPending();
    trackAgentUiEvent("studio_agent_pulse_start_failed", {
      preset_id: preset.presetId,
      reason: "bootstrap_pending",
    });
    return {
      status: "failed",
      reason: "bootstrap_pending",
      message: "Preparing Pulse runtime. Try again in a moment.",
    };
  }
  if (agentIsSending || agentUiBusyRef.current) {
    trackAgentUiEvent("studio_agent_pulse_start_blocked_busy", {
      preset_id: preset.presetId,
    });
    return {
      status: "blocked_busy",
      message: "Wait for the current Pulse step to finish before switching.",
    };
  }

  const targetPulseSessionInstanceId =
    normalizePulseSessionInstanceId(options?.pulseSessionInstanceId) ||
    normalizePulseSessionInstanceId(pulseSessionInstanceId) ||
    randomId();
  const baseContext = getAgentContext({
    lastAssistantMessage,
    includeActiveOutput: false,
    modeHint: "chat",
  });
  const pulseRuntimeContext = {
    presetId: preset.presetId,
    label: preset.label,
    description: preset.description,
    instructions: preset.systemInstructions,
    pulseKind: preset.pulseKind,
    source: preset.isBuiltIn ? ("builtin" as const) : ("custom" as const),
    schemaVersion: preset.schemaVersion,
    ...(preset.pulseKind === "guided_workflow"
      ? {
          runtimeMode: preset.runtimeMode,
          activationMode: preset.activationMode,
          starterAssistantMessage: preset.starterAssistantMessage,
          workflowStageHints: preset.workflowStageHints,
          outputMode: preset.outputMode,
          artifactTarget: preset.artifactTarget,
          memoryPolicy: preset.memoryPolicy,
        }
      : {}),
  };
  const imageSatisfiedWorkflowSession = hasPulseImageContext(baseContext)
    ? buildImageSatisfiedPulseWorkflowSession(pulseRuntimeContext)
    : null;
  const pulseContext = {
    ...baseContext,
    pulse: {
      ...pulseRuntimeContext,
      ...(imageSatisfiedWorkflowSession ? { workflowSession: imageSatisfiedWorkflowSession } : {}),
    },
  };
  const activationSeed = buildStudioAgentPulseActivationSeed(pulseContext.pulse);
  if (!activationSeed) {
    trackAgentUiEvent("studio_agent_pulse_start_failed", {
      preset_id: preset.presetId,
      reason: "activation_seed_missing",
    });
    return {
      status: "failed",
      reason: "activation_seed_missing",
      message: `Unable to start ${preset.label}. Pulse setup is incomplete.`,
    };
  }

  trackAgentUiEvent("studio_agent_pulse_start_requested", {
    preset_id: preset.presetId,
    runtime_mode: preset.runtimeMode,
    activation_mode: preset.activationMode,
  });

  if (!agentSessionEnabled) setAgentSessionEnabled(true);
  setAgentAttachmentError(null);
  agentUiBusyRef.current = true;
  setAgentUiBusy(true);
  const pendingWorkflowSession =
    imageSatisfiedWorkflowSession ??
    buildPendingPulseWorkflowSessionForStart({
      preset: pulseContext.pulse,
    });
  if (pendingWorkflowSession && !options?.deferWorkflowSessionCommit) {
    setPulseWorkflowSession(pendingWorkflowSession);
  }

  try {
    const { response, actions, workflowSession, discarded, errorText, failureKind } =
      await sendToAgent({
        text: "",
        payloadText: activationSeed,
        previousPrompt: latestAgentPrompt ?? null,
        context: pulseContext,
        sessionNamespaceOverride: resolvePulseSessionNamespace?.(
          preset.presetId,
          targetPulseSessionInstanceId
        ),
        isolateHistory: true,
        skipUserEcho: true,
      });
    if (discarded) {
      if (!options?.deferWorkflowSessionCommit) {
        setPulseWorkflowSession(null);
      }
      trackAgentUiEvent("studio_agent_pulse_start_failed", {
        preset_id: preset.presetId,
        reason: "scope_discarded",
      });
      return {
        status: "failed",
        reason: "scope_discarded",
        message: "Pulse session changed before kickoff completed. Try again.",
      };
    }

    if (!response) {
      if (!options?.deferWorkflowSessionCommit) {
        setPulseWorkflowSession(null);
      }
      const resolvedReason =
        failureKind === "transport_error" ? "transport_error" : "empty_response";
      trackAgentUiEvent("studio_agent_pulse_start_failed", {
        preset_id: preset.presetId,
        reason: resolvedReason,
      });
      return {
        status: "failed",
        reason: resolvedReason,
        message:
          failureKind === "transport_error"
            ? errorText?.trim() || `Unable to start ${preset.label}. Please try again.`
            : `Unable to start ${preset.label}. Pulse returned no kickoff response.`,
      };
    }

    const appliedPrompt = normalizePromptText(actions?.applyPrompt);
    if (appliedPrompt) {
      setLatestAgentPrompt(appliedPrompt);
      if (shouldApplyAgentPromptToSharedPrompt(selectedTool, { hasActivePulse: true })) {
        setSharedPrompt(appliedPrompt);
        setPromptOrigin("agent");
      }
    }

    const nextWorkflowSession = workflowSession ?? pendingWorkflowSession ?? null;
    if (nextWorkflowSession) {
      setPulseWorkflowSession(nextWorkflowSession);
    }
    trackAgentUiEvent("studio_agent_pulse_start_succeeded", {
      preset_id: preset.presetId,
      workflow_status: workflowSession?.status ?? null,
      has_apply_prompt: Boolean(appliedPrompt),
    });
    return { status: "started", latestAgentPrompt: appliedPrompt || null };
  } finally {
    agentUiBusyRef.current = false;
    setAgentUiBusy(false);
  }
};
