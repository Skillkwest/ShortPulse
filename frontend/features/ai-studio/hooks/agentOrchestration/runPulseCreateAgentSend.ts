import type { MutableRefObject } from "react";
import type { AgentContext } from "../../../../prefabs/agent";
import { normalizePromptText } from "../../logic/agentPromptOwnership";
import { hasComposerImageAttachmentPreview } from "../../logic/composerImageAttachment";
import { shouldApplyAgentPromptToSharedPrompt } from "../../logic/promptTargeting";
import { mergeAttachmentContext } from "./attachmentContext";
import { prepareAgentImageAttachments } from "./attachmentPreparation";
import type { AgentSendOptions, UseAiStudioAgentOrchestrationParams } from "./types";
import type { CreateAgentOrchestrationRuntimePolicy } from "./createAgentOrchestrationRuntimePolicy";
import {
  buildPulseRequestContextForUserInput,
  capturePulseWorkflowSession,
  resolvePulseImageIntakeBlock,
} from "./pulseSendRuntime";

const PULSE_AGENT_PROMPT_REFERENCE_TITLE = "Agent prompt";

type PreparedImageUrlCache = Map<string, { safeUrl: string; expiresAtMs: number }>;

export type RunPulseCreateAgentSendParams = Pick<
  UseAiStudioAgentOrchestrationParams,
  | "agentIsSending"
  | "agentBootstrapReady"
  | "agentUiBusyRef"
  | "setAgentUiBusy"
  | "agentSessionEnabled"
  | "setAgentSessionEnabled"
  | "agentInput"
  | "setAgentInput"
  | "agentAttachments"
  | "setAgentAttachments"
  | "setAgentAttachmentError"
  | "prompt"
  | "setLatestAgentPrompt"
  | "setPulseWorkflowSession"
  | "selectedTool"
  | "setSharedPrompt"
  | "setPromptOrigin"
  | "sendToAgent"
  | "appendUserMessage"
  | "updateMessageById"
  | "removeMessageById"
  | "getAgentContext"
  | "trackAgentUiEvent"
  | "setUiNotice"
> & {
  runtimePolicy: CreateAgentOrchestrationRuntimePolicy;
  notifyBootstrapPending: () => void;
  preparedImageUrlCacheRef: MutableRefObject<PreparedImageUrlCache>;
  textOverride?: string;
  options?: AgentSendOptions;
};

const cloneMessageAttachments = (
  attachments: UseAiStudioAgentOrchestrationParams["agentAttachments"]
) => attachments.map((attachment) => ({ ...attachment }));

const stripGenericPromptContinuity = (context: AgentContext): AgentContext => {
  const {
    activePrompt: _activePrompt,
    lastAssistantMessage: _lastAssistantMessage,
    ...pulseContext
  } = context;
  return pulseContext;
};

/**
 * Executes the Pulse Create send path. Owns Pulse request shaping, guided
 * workflow-session capture when applicable, and Pulse-specific input guards.
 */
export const runPulseCreateAgentSend = async ({
  agentIsSending,
  agentBootstrapReady,
  agentUiBusyRef,
  setAgentUiBusy,
  agentSessionEnabled,
  setAgentSessionEnabled,
  agentInput,
  setAgentInput,
  agentAttachments,
  setAgentAttachments,
  setAgentAttachmentError,
  prompt,
  setLatestAgentPrompt,
  setPulseWorkflowSession,
  selectedTool,
  setSharedPrompt,
  setPromptOrigin,
  sendToAgent,
  appendUserMessage,
  updateMessageById,
  removeMessageById,
  getAgentContext,
  trackAgentUiEvent,
  setUiNotice,
  runtimePolicy,
  notifyBootstrapPending,
  preparedImageUrlCacheRef,
  textOverride,
  options,
}: RunPulseCreateAgentSendParams): Promise<{
  prompt: string;
  referenceTitle?: string | null;
} | void> => {
  if (!agentBootstrapReady) {
    notifyBootstrapPending();
    return;
  }
  if (!runtimePolicy.hasActivePulseSession) {
    setUiNotice("Select a Pulse to start.");
    trackAgentUiEvent("studio_agent_send_blocked_no_active_pulse_session");
    return;
  }
  if (agentIsSending || agentUiBusyRef.current) return;
  const rawInput = typeof textOverride === "string" ? textOverride : agentInput;
  const trimmed = rawInput.trim();
  const hasImageAttachment = agentAttachments.some((attachment) => attachment.kind === "image");
  const allowImageOnlySend = !trimmed && hasImageAttachment;
  const droppedPromptText =
    [...agentAttachments]
      .reverse()
      .find((attachment) => attachment.kind === "prompt" && attachment.text?.trim())
      ?.text?.trim() ?? "";
  const outboundText = trimmed || droppedPromptText || (allowImageOnlySend ? "" : prompt.trim());
  if (!outboundText && !allowImageOnlySend) return;
  const outboundAttachments = cloneMessageAttachments(agentAttachments);
  const selectedOverride = runtimePolicy.resolveSelectedOverride(options?.selectedOverride);
  const baseContext = stripGenericPromptContinuity(
    getAgentContext({
      lastAssistantMessage: null,
      selectedOverride,
      includeActiveOutput: runtimePolicy.includeActiveOutput,
      modeHint: options?.modeHint ?? (outboundAttachments.length ? "reference" : undefined),
    })
  );
  if (!baseContext.pulse) {
    setUiNotice("Pulse context is unavailable. Start the Pulse again.");
    trackAgentUiEvent("studio_agent_send_blocked_missing_pulse_context");
    return;
  }
  const pulseImageIntakeBlock = resolvePulseImageIntakeBlock({
    context: baseContext,
    hasImageAttachment,
  });
  if (pulseImageIntakeBlock) {
    setUiNotice(pulseImageIntakeBlock);
    setAgentAttachmentError(pulseImageIntakeBlock);
    trackAgentUiEvent("studio_agent_send_blocked_pulse_image_required");
    return;
  }
  trackAgentUiEvent("studio_agent_send_requested", {
    mode_hint: options?.modeHint ?? "chat",
    has_attachments: outboundAttachments.length > 0,
    image_attachments: outboundAttachments.filter((item) => item.kind === "image").length,
    prompt_chars: outboundText.length,
  });
  if (!agentSessionEnabled) setAgentSessionEnabled(true);
  setAgentAttachmentError(null);
  agentUiBusyRef.current = true;
  setAgentUiBusy(true);
  const sentFromComposer = typeof textOverride !== "string";
  const userMessageText = trimmed || outboundText;
  const optimisticUserMessageId = appendUserMessage(userMessageText, outboundAttachments);
  const originalAgentInput = agentInput;
  const originalAgentAttachments = cloneMessageAttachments(agentAttachments);
  let composerCleared = false;
  const patchOptimisticMessageAttachments = (
    updater: (
      attachments: UseAiStudioAgentOrchestrationParams["agentAttachments"]
    ) => UseAiStudioAgentOrchestrationParams["agentAttachments"]
  ) => {
    if (!optimisticUserMessageId) return;
    updateMessageById(optimisticUserMessageId, (message) => {
      if (message.role !== "user") return message;
      const currentAttachments = cloneMessageAttachments(message.attachments ?? []);
      return {
        ...message,
        attachments: updater(currentAttachments),
      };
    });
  };
  const updateOptimisticAttachmentDelivery = (
    ids: string[],
    status: "pending" | "preparing" | "ready" | "failed",
    deliveryError?:
      | string
      | null
      | ((attachment: (typeof outboundAttachments)[number]) => string | null)
  ) => {
    if (!ids.length) return;
    patchOptimisticMessageAttachments((attachments) =>
      attachments.map((attachment) => {
        if (!ids.includes(attachment.id)) return attachment;
        const resolvedError =
          typeof deliveryError === "function" ? deliveryError(attachment) : deliveryError;
        return {
          ...attachment,
          deliveryStatus: attachment.kind === "prompt" ? "ready" : status,
          deliveryError: attachment.kind === "prompt" ? null : (resolvedError ?? null),
        };
      })
    );
  };
  const clearComposerDraft = () => {
    if (composerCleared) return;
    composerCleared = true;
    if (sentFromComposer && trimmed) {
      setAgentInput("");
    }
    if (outboundAttachments.length > 0) {
      setAgentAttachments([]);
    }
  };
  const restoreComposerDraft = () => {
    if (!composerCleared) return;
    composerCleared = false;
    if (sentFromComposer) {
      setAgentInput(originalAgentInput);
    }
    if (outboundAttachments.length > 0) {
      setAgentAttachments(originalAgentAttachments);
    }
  };
  const discardOptimisticUserMessage = () => {
    if (!optimisticUserMessageId) return;
    removeMessageById(optimisticUserMessageId);
  };
  try {
    const imageAttachmentsMissingUrl = outboundAttachments.filter(
      (attachment) => attachment.kind === "image" && !hasComposerImageAttachmentPreview(attachment)
    );
    if (imageAttachmentsMissingUrl.length > 0) {
      const failedIds = imageAttachmentsMissingUrl.map((attachment) => attachment.id);
      updateOptimisticAttachmentDelivery(
        failedIds,
        "failed",
        "Image URL missing. Remove this image and attach it again."
      );
      setAgentAttachmentError(
        "One or more attached images are missing a valid URL. Remove failed images and try again."
      );
      trackAgentUiEvent("studio_agent_attachment_missing_url", {
        failed_image_attachments: failedIds.length,
      });
      discardOptimisticUserMessage();
      return;
    }

    const imageAttachmentIds = outboundAttachments
      .filter(
        (attachment) => attachment.kind === "image" && hasComposerImageAttachmentPreview(attachment)
      )
      .map((attachment) => attachment.id);
    let preparedImageUrls = new Map<string, string>();
    if (imageAttachmentIds.length > 0) {
      updateOptimisticAttachmentDelivery(imageAttachmentIds, "preparing");

      const preparedImageResult = await prepareAgentImageAttachments({
        attachments: outboundAttachments,
        preparedImageUrlCache: preparedImageUrlCacheRef.current,
      });
      if (!preparedImageResult.ok) {
        if (preparedImageResult.reason === "missing_url") {
          updateOptimisticAttachmentDelivery(
            preparedImageResult.failedIds,
            "failed",
            "Image URL missing. Remove this image and attach it again."
          );
          setAgentAttachmentError(
            "One or more attached images are missing a valid URL. Remove failed images and try again."
          );
          trackAgentUiEvent("studio_agent_attachment_missing_url", {
            failed_image_attachments: preparedImageResult.failedIds.length,
          });
          discardOptimisticUserMessage();
          return;
        }
        updateOptimisticAttachmentDelivery(
          preparedImageResult.failedIds,
          "failed",
          "Image upload/preparation failed. Remove this image and try again."
        );
        setAgentAttachmentError(
          "One or more attached images failed to prepare. Remove failed images and try again."
        );
        trackAgentUiEvent("studio_agent_attachment_prepare_failed", {
          failed_image_attachments: preparedImageResult.failedIds.length,
          attempted_image_attachments: preparedImageResult.attemptedCount,
        });
        discardOptimisticUserMessage();
        return;
      }

      preparedImageUrls = preparedImageResult.preparedImageUrls;
      updateOptimisticAttachmentDelivery(imageAttachmentIds, "ready", null);
    }

    clearComposerDraft();

    const mediaPatchedContext = mergeAttachmentContext({
      baseContext,
      attachments: outboundAttachments,
      preparedImageUrls,
    });
    const pulseRequest = buildPulseRequestContextForUserInput({
      context: mediaPatchedContext,
      workflowPulse: runtimePolicy.resolveWorkflowPulse(mediaPatchedContext),
      userInput: userMessageText,
    });
    capturePulseWorkflowSession({
      workflowSession: pulseRequest.pendingWorkflowSession,
      setPulseWorkflowSession,
    });
    const requestContext = pulseRequest.requestContext;

    const { response, actions, workflowSession, discarded } = await sendToAgent({
      text: outboundText,
      payloadText: outboundText,
      previousPrompt: null,
      context: requestContext,
      skipUserEcho: true,
      optimisticUserMessageId,
    });
    if (discarded) {
      restoreComposerDraft();
      discardOptimisticUserMessage();
      setUiNotice("This Pulse turn was interrupted. Your draft was restored.");
      return;
    }

    if (!response) {
      trackAgentUiEvent("studio_agent_response_empty", {
        mode_hint: options?.modeHint ?? "chat",
      });
      restoreComposerDraft();
      discardOptimisticUserMessage();
      setUiNotice("This Pulse turn did not complete. Your draft was restored.");
      if (options?.captureResult) return;
      return;
    }

    const appliedPrompt = normalizePromptText(actions?.applyPrompt ?? response.canonicalPrompt);
    trackAgentUiEvent("studio_agent_response_received", {
      mode_hint: options?.modeHint ?? "chat",
      has_apply_prompt: Boolean(appliedPrompt),
    });

    const hasActivePulse = runtimePolicy.hasPromptApplyPulseContext(requestContext);
    if (appliedPrompt) {
      setLatestAgentPrompt(appliedPrompt);
      if (shouldApplyAgentPromptToSharedPrompt(selectedTool, { hasActivePulse })) {
        setSharedPrompt(appliedPrompt);
        setPromptOrigin("agent");
      }
    }

    capturePulseWorkflowSession({ workflowSession, setPulseWorkflowSession });

    if (options?.captureResult && appliedPrompt) {
      return { prompt: appliedPrompt, referenceTitle: PULSE_AGENT_PROMPT_REFERENCE_TITLE };
    }
  } finally {
    agentUiBusyRef.current = false;
    setAgentUiBusy(false);
  }
};
