import { useCallback, type MutableRefObject } from "react";
import { normalizePromptText } from "../../logic/agentPromptOwnership";
import { mergeAttachmentContext } from "./attachmentContext";
import { prepareAgentImageAttachments } from "./attachmentPreparation";
import type { AgentSendOptions, UseAiStudioAgentOrchestrationParams } from "./types";

const STANDARD_AGENT_PROMPT_REFERENCE_TITLE = "Agent prompt";

type PreparedImageUrlCache = Map<string, { safeUrl: string; expiresAtMs: number }>;

type UseStandardCreateAgentSendParams = Pick<
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
  | "selectedTool"
  | "setSharedPrompt"
  | "setPromptOrigin"
  | "sendToAgent"
  | "appendUserMessage"
  | "updateMessageById"
  | "getAgentContext"
  | "trackAgentUiEvent"
  | "lastAssistantMessage"
> & {
  notifyBootstrapPending: () => void;
  preparedImageUrlCacheRef: MutableRefObject<PreparedImageUrlCache>;
};

const cloneMessageAttachments = (
  attachments: UseAiStudioAgentOrchestrationParams["agentAttachments"]
) => attachments.map((attachment) => ({ ...attachment }));

/**
 * Standard Create chat send path.
 * This hook intentionally owns only direct Standard chat behavior.
 */
export const useStandardCreateAgentSend = ({
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
  selectedTool,
  setSharedPrompt,
  setPromptOrigin,
  sendToAgent,
  appendUserMessage,
  updateMessageById,
  getAgentContext,
  trackAgentUiEvent,
  lastAssistantMessage,
  notifyBootstrapPending,
  preparedImageUrlCacheRef,
}: UseStandardCreateAgentSendParams) =>
  useCallback(
    async (
      textOverride?: string,
      options?: AgentSendOptions
    ): Promise<{ prompt: string; referenceTitle?: string | null } | void> => {
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
      const outboundText =
        trimmed || droppedPromptText || (allowImageOnlySend ? "" : prompt.trim());
      if (!outboundText && !allowImageOnlySend) return;
      const outboundAttachments = cloneMessageAttachments(agentAttachments);
      const selectedOverride =
        options?.selectedOverride === undefined ? null : options.selectedOverride;
      const baseContext = getAgentContext({
        lastAssistantMessage,
        selectedOverride,
        includeActiveOutput: false,
        modeHint: options?.modeHint ?? (outboundAttachments.length ? "reference" : undefined),
      });

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
      if (sentFromComposer && trimmed) {
        setAgentInput("");
      }
      if (outboundAttachments.length > 0) {
        setAgentAttachments([]);
      }
      try {
        const imageAttachmentsMissingUrl = outboundAttachments.filter(
          (attachment) => attachment.kind === "image" && !attachment.imageUrl?.trim()
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
          return;
        }

        const imageAttachmentIds = outboundAttachments
          .filter(
            (attachment) => attachment.kind === "image" && Boolean(attachment.imageUrl?.trim())
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
            return;
          }

          preparedImageUrls = preparedImageResult.preparedImageUrls;
          updateOptimisticAttachmentDelivery(imageAttachmentIds, "ready", null);
        }

        const shouldInjectLatestAgentPrompt = Boolean(latestAgentPrompt) && outboundText.length > 0;
        if (shouldInjectLatestAgentPrompt) {
          baseContext.activePrompt = latestAgentPrompt;
        }
        const requestContext = mergeAttachmentContext({
          baseContext,
          attachments: outboundAttachments,
          preparedImageUrls,
        });

        const { response, actions, discarded } = await sendToAgent({
          text: outboundText,
          payloadText: outboundText,
          previousPrompt: latestAgentPrompt ?? null,
          context: requestContext,
          skipUserEcho: true,
          optimisticUserMessageId,
        });
        if (discarded) {
          return;
        }

        if (!response) {
          trackAgentUiEvent("studio_agent_response_empty", {
            mode_hint: options?.modeHint ?? "chat",
          });
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
          if (selectedTool === "create" || selectedTool === "text") {
            setSharedPrompt(appliedPrompt);
            setPromptOrigin("agent");
          }
        }

        if (options?.captureResult && appliedPrompt) {
          return { prompt: appliedPrompt, referenceTitle: STANDARD_AGENT_PROMPT_REFERENCE_TITLE };
        }
      } finally {
        agentUiBusyRef.current = false;
        setAgentUiBusy(false);
      }
    },
    [
      agentAttachments,
      agentBootstrapReady,
      agentInput,
      agentIsSending,
      agentSessionEnabled,
      agentUiBusyRef,
      appendUserMessage,
      getAgentContext,
      lastAssistantMessage,
      latestAgentPrompt,
      notifyBootstrapPending,
      preparedImageUrlCacheRef,
      prompt,
      selectedTool,
      sendToAgent,
      setAgentAttachmentError,
      setAgentAttachments,
      setAgentInput,
      setAgentSessionEnabled,
      setAgentUiBusy,
      setLatestAgentPrompt,
      setPromptOrigin,
      setSharedPrompt,
      trackAgentUiEvent,
      updateMessageById,
    ]
  );
