import { useCallback, useRef, useState } from "react";
import { prepareImageUrl } from "../logic/imageDescription";
import { normalizePromptText } from "../logic/agentPromptOwnership";
import { shouldApplyAgentPromptToSharedPrompt } from "../logic/promptTargeting";
import { randomId } from "../logic/ids";
import { mergeAttachmentContext } from "./agentOrchestration/attachmentContext";
import { prepareAgentImageAttachments } from "./agentOrchestration/attachmentPreparation";
import type {
  AgentSendOptions,
  UseAiStudioAgentOrchestrationParams,
} from "./agentOrchestration/types";

const DEFAULT_AGENT_PROMPT_REFERENCE_TITLE = "Agent prompt";

const cloneMessageAttachments = (
  attachments: UseAiStudioAgentOrchestrationParams["agentAttachments"]
) => attachments.map((attachment) => ({ ...attachment }));

export const useAiStudioAgentOrchestration = ({
  agentIsSending,
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
  setAgentActions,
  selectedTool,
  setSharedPrompt,
  setPromptOrigin,
  sendToAgent,
  appendUserMessage,
  updateMessageById,
  getAgentContext,
  trackAgentUiEvent,
  addAgentPromptReference,
  editReferenceText,
  setEditReferenceText,
  videoReferenceText,
  setVideoReferenceText,
  getOutputById,
  aspect,
  model,
  setOutputs,
  setActiveOutputId,
  lastAssistantMessage,
  setUiNotice,
}: UseAiStudioAgentOrchestrationParams) => {
  const [isPromptRefining, setIsPromptRefining] = useState(false);
  const [isReferencePromptEnhancing, setIsReferencePromptEnhancing] = useState(false);
  const [describeInFlightCount, setDescribeInFlightCount] = useState(0);
  const preparedImageUrlCacheRef = useRef(
    new Map<string, { safeUrl: string; expiresAtMs: number }>()
  );

  const handleAgentSend = useCallback(
    async (
      textOverride?: string,
      options?: AgentSendOptions
    ): Promise<{ prompt: string; referenceTitle?: string | null } | void> => {
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

        const baseContext = getAgentContext({
          lastAssistantMessage,
          selectedOverride: options?.selectedOverride,
          modeHint: options?.modeHint ?? (outboundAttachments.length ? "reference" : undefined),
        });
        const shouldInjectLatestAgentPrompt = Boolean(latestAgentPrompt) && outboundText.length > 0;
        if (shouldInjectLatestAgentPrompt) {
          baseContext.activePrompt = latestAgentPrompt;
          baseContext.lastAssistantMessage = latestAgentPrompt;
        }
        const mediaPatchedContext = mergeAttachmentContext({
          baseContext,
          attachments: outboundAttachments,
          preparedImageUrls,
        });

        const { response, actions } = await sendToAgent({
          text: outboundText,
          payloadText: outboundText,
          previousPrompt: latestAgentPrompt ?? null,
          context: mediaPatchedContext,
          skipUserEcho: true,
          optimisticUserMessageId,
        });

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
          if (shouldApplyAgentPromptToSharedPrompt(selectedTool)) {
            setSharedPrompt(appliedPrompt);
            setPromptOrigin("agent");
          }
        }

        setAgentActions(actions);

        if (options?.captureResult && appliedPrompt) {
          return { prompt: appliedPrompt, referenceTitle: DEFAULT_AGENT_PROMPT_REFERENCE_TITLE };
        }
      } finally {
        agentUiBusyRef.current = false;
        setAgentUiBusy(false);
      }
    },
    [
      agentAttachments,
      agentInput,
      agentIsSending,
      agentSessionEnabled,
      agentUiBusyRef,
      appendUserMessage,
      updateMessageById,
      getAgentContext,
      lastAssistantMessage,
      latestAgentPrompt,
      prompt,
      selectedTool,
      sendToAgent,
      setAgentAttachmentError,
      setAgentInput,
      setAgentSessionEnabled,
      setAgentUiBusy,
      setLatestAgentPrompt,
      setPromptOrigin,
      setSharedPrompt,
      setAgentAttachments,
      setAgentActions,
      trackAgentUiEvent,
    ]
  );

  const handleAgentEnhanceSend = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsPromptRefining(true);
    try {
      const context = getAgentContext({
        lastAssistantMessage,
        modeHint: "text",
      });
      const { response, actions } = await sendToAgent({
        text: prompt,
        payloadText: prompt,
        previousPrompt: latestAgentPrompt ?? null,
        context,
        isolateHistory: true,
        skipUserEcho: true,
      });
      const refinedPrompt = normalizePromptText(actions?.applyPrompt ?? response?.message ?? null);
      if (refinedPrompt) {
        setSharedPrompt(refinedPrompt);
        setLatestAgentPrompt(refinedPrompt);
        addAgentPromptReference(refinedPrompt, "Refined prompt");
        setPromptOrigin("agent");
      }
    } finally {
      setIsPromptRefining(false);
    }
  }, [
    addAgentPromptReference,
    getAgentContext,
    lastAssistantMessage,
    latestAgentPrompt,
    prompt,
    sendToAgent,
    setLatestAgentPrompt,
    setPromptOrigin,
    setSharedPrompt,
  ]);

  const handleReferencePromptEnhance = useCallback(async () => {
    const isVideoPromptTool = selectedTool === "video" || selectedTool === "kling";
    const currentPrompt =
      (isVideoPromptTool ? videoReferenceText : editReferenceText)?.trim() ?? "";
    if (!currentPrompt || isReferencePromptEnhancing) return;
    setIsReferencePromptEnhancing(true);
    try {
      const context = getAgentContext({
        lastAssistantMessage,
        modeHint: "text",
      });
      const { response, actions } = await sendToAgent({
        text: currentPrompt,
        payloadText: currentPrompt,
        previousPrompt: latestAgentPrompt ?? null,
        context,
        isolateHistory: true,
        skipUserEcho: true,
      });
      const nextPrompt = normalizePromptText(actions?.applyPrompt ?? response?.message ?? null);
      if (nextPrompt) {
        if (isVideoPromptTool) {
          setVideoReferenceText(nextPrompt);
        } else {
          setEditReferenceText(nextPrompt);
        }
        setPromptOrigin("manual");
      }
    } finally {
      setIsReferencePromptEnhancing(false);
    }
  }, [
    editReferenceText,
    getAgentContext,
    isReferencePromptEnhancing,
    lastAssistantMessage,
    latestAgentPrompt,
    selectedTool,
    sendToAgent,
    setEditReferenceText,
    setPromptOrigin,
    setVideoReferenceText,
    videoReferenceText,
  ]);

  const handleDescribeReference = useCallback(
    async (outputId: string) => {
      if (!outputId) return;
      const target = getOutputById(outputId);
      if (!target?.previewUrl) return;

      const placeholderId = `describe-${randomId()}`;
      const placeholderModelLabel = "OpenAI vision describe";
      setOutputs((prev) => [
        {
          id: placeholderId,
          prompt: "Describing image…",
          mode: "text",
          aspect,
          model: placeholderModelLabel,
          modelId: model ?? undefined,
          status: "ready",
          timestamp: "Describing…",
          taskState: "running",
          saveState: "idle",
          saveError: null,
        },
        ...prev,
      ]);
      setActiveOutputId(placeholderId);
      setDescribeInFlightCount((count) => count + 1);

      const resolvePlaceholder = (text: string, title?: string) => {
        const cleaned = text.trim();
        if (!cleaned) return;
        setOutputs((prev) =>
          prev.map((item) =>
            item.id === placeholderId
              ? {
                  ...item,
                  prompt: cleaned,
                  previewText: cleaned,
                  status: "ready",
                  timestamp: title ?? "Image describe",
                  taskState: "success",
                  saveState: "idle",
                  saveError: null,
                  errorMessage: null,
                }
              : item
          )
        );
        setSharedPrompt(cleaned);
        setLatestAgentPrompt(cleaned);
        setPromptOrigin("agent");
      };

      const failPlaceholder = (message: string) => {
        setOutputs((prev) =>
          prev.map((item) =>
            item.id === placeholderId
              ? {
                  ...item,
                  taskState: "fail",
                  timestamp: "Failed",
                  errorMessage: message,
                }
              : item
          )
        );
      };

      try {
        const safeUrl = await prepareImageUrl(target.previewUrl);
        if (!safeUrl) {
          failPlaceholder(
            "Unable to prepare this image for OpenAI vision. Please remove and re-add the reference."
          );
          return;
        }
        const imageAttachment = {
          id: `describe-reference-${outputId}`,
          kind: "image" as const,
          referenceId: target.id,
          imageUrl: safeUrl,
          text: target.prompt?.trim() || target.previewText?.trim() || null,
          aspect: target.aspect ?? null,
        };
        const context = mergeAttachmentContext({
          baseContext: getAgentContext({
            lastAssistantMessage,
            selectedOverride: target,
            modeHint: "describe",
          }),
          attachments: [imageAttachment],
          preparedImageUrls: new Map([[imageAttachment.id, safeUrl]]),
        });
        const { response, actions } = await sendToAgent({
          text: "",
          payloadText: "",
          previousPrompt: latestAgentPrompt ?? null,
          context,
          isolateHistory: true,
          skipUserEcho: true,
        });
        const describedPrompt = normalizePromptText(
          actions?.applyPrompt ?? response?.message ?? null
        );
        if (!describedPrompt) {
          failPlaceholder("Describe response did not include a usable prompt.");
          return;
        }
        resolvePlaceholder(describedPrompt, "Image describe");
      } catch (error: unknown) {
        failPlaceholder(
          error instanceof Error
            ? error.message
            : "Unable to describe this image with OpenAI vision."
        );
      } finally {
        setDescribeInFlightCount((count) => Math.max(0, count - 1));
      }
    },
    [
      aspect,
      getOutputById,
      model,
      getAgentContext,
      lastAssistantMessage,
      latestAgentPrompt,
      sendToAgent,
      setActiveOutputId,
      setLatestAgentPrompt,
      setOutputs,
      setPromptOrigin,
      setSharedPrompt,
    ]
  );

  const handleAgentDescribeTargets = useCallback(
    (targets: string[]) => {
      const validTargets = targets.filter((targetId) => Boolean(getOutputById(targetId)));
      trackAgentUiEvent("studio_agent_describe_targets", {
        requested_count: targets.length,
        valid_count: validTargets.length,
      });
      if (!validTargets.length) {
        setUiNotice("No valid reference targets were available to describe.");
        return;
      }
      void Promise.all(validTargets.map((targetId) => handleDescribeReference(targetId)));
    },
    [getOutputById, handleDescribeReference, setUiNotice, trackAgentUiEvent]
  );

  return {
    isPromptRefining,
    isReferencePromptEnhancing,
    describeInFlightCount,
    handleAgentSend,
    handleAgentEnhanceSend,
    handleReferencePromptEnhance,
    handleDescribeReference,
    handleAgentDescribeTargets,
  };
};
