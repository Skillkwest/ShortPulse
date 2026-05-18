import type { MutableRefObject } from "react";
import type { AgentContext } from "../../../../prefabs/agent";
import { normalizePromptText } from "../../logic/agentPromptOwnership";
import {
  recordCreateWorkflowEvent,
  summarizeCreateWorkflowUrl,
} from "../../logic/createWorkflowDebug";
import { stripEphemeralLocalImageModelPayload } from "../../logic/ephemeralComposerImage";
import { mergeAttachmentContext } from "./attachmentContext";
import { prepareAgentImageAttachments } from "./attachmentPreparation";
import {
  EPHEMERAL_IMAGE_SEND_MISSING_MESSAGE,
  splitAgentImageAttachmentsForSend,
} from "./ephemeralAttachmentSend";
import type { AgentSendOptions, UseAiStudioAgentOrchestrationParams } from "./types";

const STANDARD_AGENT_PROMPT_REFERENCE_TITLE = "Agent prompt";

type PreparedImageUrlCache = Map<string, { safeUrl: string; expiresAtMs: number }>;

export type RunStandardCreateAgentSendParams = Pick<
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
  | "latestAgentPrompt"
  | "setLatestAgentPrompt"
  | "sendToAgent"
  | "appendUserMessage"
  | "updateMessageById"
  | "getAgentContext"
  | "trackAgentUiEvent"
  | "lastAssistantMessage"
> & {
  notifyBootstrapPending: () => void;
  preparedImageUrlCacheRef: MutableRefObject<PreparedImageUrlCache>;
  textOverride?: string;
  options?: AgentSendOptions;
};

const cloneMessageAttachments = (
  attachments: UseAiStudioAgentOrchestrationParams["agentAttachments"]
) => attachments.map((attachment) => ({ ...attachment }));

const stripModeSpecificContext = (context: AgentContext): AgentContext => {
  const { pulse, ...standardContext } = context;
  void pulse;
  return standardContext;
};

/**
 * Executes the Standard Create chat send path.
 * This function intentionally owns only direct Standard chat behavior.
 */
export const runStandardCreateAgentSend = async ({
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
  latestAgentPrompt,
  setLatestAgentPrompt,
  sendToAgent,
  appendUserMessage,
  updateMessageById,
  getAgentContext,
  trackAgentUiEvent,
  lastAssistantMessage,
  notifyBootstrapPending,
  preparedImageUrlCacheRef,
  textOverride,
  options,
}: RunStandardCreateAgentSendParams): Promise<{
  prompt: string;
  referenceTitle?: string | null;
} | void> => {
  if (!agentBootstrapReady) {
    notifyBootstrapPending();
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
  const selectedOverride =
    options?.selectedOverride === undefined ? null : options.selectedOverride;
  const baseContext = stripModeSpecificContext(
    getAgentContext({
      lastAssistantMessage,
      selectedOverride,
      includeActiveOutput: false,
      modeHint: options?.modeHint ?? (outboundAttachments.length ? "reference" : undefined),
    })
  );

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
  const optimisticMessageAttachments = outboundAttachments.map(
    stripEphemeralLocalImageModelPayload
  );
  const optimisticUserMessageId = appendUserMessage(userMessageText, optimisticMessageAttachments);
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
  try {
    const {
      imageAttachmentIds,
      durableImageAttachments,
      durableImageAttachmentIds,
      ephemeralImageUrls,
      failedEphemeralImageIds,
    } = splitAgentImageAttachmentsForSend(outboundAttachments);
    const preparedImageUrls = new Map<string, string>(ephemeralImageUrls);
    if (imageAttachmentIds.length > 0) {
      if (failedEphemeralImageIds.length > 0) {
        updateOptimisticAttachmentDelivery(
          failedEphemeralImageIds,
          "failed",
          EPHEMERAL_IMAGE_SEND_MISSING_MESSAGE
        );
        setAgentAttachmentError(
          "One or more attached images failed to prepare. Remove failed images and try again."
        );
        trackAgentUiEvent("studio_agent_attachment_prepare_failed", {
          failed_image_attachments: failedEphemeralImageIds.length,
          attempted_image_attachments: imageAttachmentIds.length,
          failure_kind: "ephemeral_missing_model_payload",
        });
        restoreComposerDraft();
        return;
      }

      updateOptimisticAttachmentDelivery(durableImageAttachmentIds, "preparing");

      const preparedImageResult = await prepareAgentImageAttachments({
        attachments: durableImageAttachments,
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
          restoreComposerDraft();
          return;
        }
        updateOptimisticAttachmentDelivery(
          preparedImageResult.failedIds,
          "failed",
          (attachment) =>
            preparedImageResult.failureMessages[attachment.id] ??
            "Image upload/preparation failed. Remove this image and try again."
        );
        setAgentAttachmentError(
          "One or more attached images failed to prepare. Remove failed images and try again."
        );
        trackAgentUiEvent("studio_agent_attachment_prepare_failed", {
          failed_image_attachments: preparedImageResult.failedIds.length,
          attempted_image_attachments: preparedImageResult.attemptedCount,
        });
        restoreComposerDraft();
        return;
      }

      preparedImageResult.preparedImageUrls.forEach((safeUrl, attachmentId) => {
        preparedImageUrls.set(attachmentId, safeUrl);
      });
      updateOptimisticAttachmentDelivery(imageAttachmentIds, "ready", null);
    }

    clearComposerDraft();

    const requestContext = mergeAttachmentContext({
      baseContext,
      attachments: outboundAttachments,
      preparedImageUrls,
    });
    if (imageAttachmentIds.length > 0) {
      recordCreateWorkflowEvent("agent_send_payload_ready", {
        mode: "standard",
        imageAttachmentIds,
        mediaCount: requestContext.media?.filter((media) => media.kind === "image").length ?? 0,
        media: (requestContext.media ?? [])
          .filter((media) => media.kind === "image")
          .map((media) => ({
            id: media.id,
            url: summarizeCreateWorkflowUrl(media.url),
          })),
      });
    }

    const { response, actions, discarded } = await sendToAgent({
      text: outboundText,
      payloadText: outboundText,
      previousPrompt: latestAgentPrompt ?? null,
      context: requestContext,
      skipUserEcho: true,
      optimisticUserMessageId,
    });
    if (discarded) {
      restoreComposerDraft();
      return;
    }

    if (!response) {
      trackAgentUiEvent("studio_agent_response_empty", {
        mode_hint: options?.modeHint ?? "chat",
      });
      restoreComposerDraft();
      if (options?.captureResult) return;
      return;
    }

    const appliedPrompt = normalizePromptText(actions?.applyPrompt);
    trackAgentUiEvent("studio_agent_response_received", {
      mode_hint: options?.modeHint ?? "chat",
      has_apply_prompt: Boolean(appliedPrompt),
    });

    if (appliedPrompt) {
      setLatestAgentPrompt(appliedPrompt);
    }

    if (options?.captureResult && appliedPrompt) {
      return { prompt: appliedPrompt, referenceTitle: STANDARD_AGENT_PROMPT_REFERENCE_TITLE };
    }
  } finally {
    agentUiBusyRef.current = false;
    setAgentUiBusy(false);
  }
};
