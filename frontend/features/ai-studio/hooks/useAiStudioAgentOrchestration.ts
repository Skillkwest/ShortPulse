import { useCallback, useRef, useState } from "react";
import { postGeneratePrompt } from "../logic/promptGeneration";
import { postDescribeImage, prepareImageUrl } from "../logic/imageDescription";
import { normalizePromptText } from "../logic/agentPromptOwnership";
import { shouldApplyAgentPromptToSharedPrompt } from "../logic/promptTargeting";
import { randomId } from "../logic/ids";
import { mergeAttachmentContext } from "./agentOrchestration/attachmentContext";
import { prepareAgentImageAttachments } from "./agentOrchestration/attachmentPreparation";
import type {
  AgentSendOptions,
  UseAiStudioAgentOrchestrationParams,
} from "./agentOrchestration/types";

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
  markAttachmentDelivery,
  prompt,
  latestAgentPrompt,
  setLatestAgentPrompt,
  setAgentActions,
  selectedTool,
  setSharedPrompt,
  setPromptOrigin,
  sendToAgent,
  appendUserMessage,
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
      trackAgentUiEvent("studio_agent_send_requested", {
        mode_hint: options?.modeHint ?? "chat",
        has_attachments: agentAttachments.length > 0,
        image_attachments: agentAttachments.filter((item) => item.kind === "image").length,
        prompt_chars: outboundText.length,
      });
      if (!agentSessionEnabled) setAgentSessionEnabled(true);
      setAgentAttachmentError(null);
      agentUiBusyRef.current = true;
      setAgentUiBusy(true);
      const sentFromComposer = typeof textOverride !== "string";
      const userMessageText = trimmed || outboundText;
      const optimisticUserMessageId = userMessageText ? appendUserMessage(userMessageText) : null;
      if (sentFromComposer && trimmed) {
        setAgentInput("");
      }
      try {
        const imageAttachmentsMissingUrl = agentAttachments.filter(
          (attachment) => attachment.kind === "image" && !attachment.imageUrl?.trim()
        );
        if (imageAttachmentsMissingUrl.length > 0) {
          const failedIds = imageAttachmentsMissingUrl.map((attachment) => attachment.id);
          markAttachmentDelivery(
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

        const imageAttachmentIds = agentAttachments
          .filter(
            (attachment) => attachment.kind === "image" && Boolean(attachment.imageUrl?.trim())
          )
          .map((attachment) => attachment.id);
        let preparedImageUrls = new Map<string, string>();
        if (imageAttachmentIds.length > 0) {
          markAttachmentDelivery(imageAttachmentIds, "preparing");

          const preparedImageResult = await prepareAgentImageAttachments({
            attachments: agentAttachments,
            preparedImageUrlCache: preparedImageUrlCacheRef.current,
          });
          if (!preparedImageResult.ok) {
            if (preparedImageResult.reason === "missing_url") {
              markAttachmentDelivery(
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
            markAttachmentDelivery(
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
          markAttachmentDelivery(imageAttachmentIds, "ready", null);
        }

        const baseContext = getAgentContext({
          lastAssistantMessage,
          selectedOverride: options?.selectedOverride,
          modeHint: options?.modeHint ?? (agentAttachments.length ? "reference" : undefined),
        });
        if (latestAgentPrompt) {
          baseContext.activePrompt = latestAgentPrompt;
          baseContext.lastAssistantMessage = latestAgentPrompt;
        }
        const mediaPatchedContext = mergeAttachmentContext({
          baseContext,
          attachments: agentAttachments,
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
          variation_count: actions?.variations?.length ?? 0,
          describe_target_count: actions?.describeTargets?.length ?? 0,
        });

        if (appliedPrompt) {
          setLatestAgentPrompt(appliedPrompt);
          if (shouldApplyAgentPromptToSharedPrompt(selectedTool)) {
            setSharedPrompt(appliedPrompt);
            setPromptOrigin("agent");
          }
        }

        setAgentActions(actions);
        if (agentAttachments.length) {
          setAgentAttachments([]);
        }

        if (options?.captureResult && appliedPrompt) {
          return { prompt: appliedPrompt, referenceTitle: actions?.referenceCard?.title };
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
      getAgentContext,
      lastAssistantMessage,
      latestAgentPrompt,
      markAttachmentDelivery,
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
      const refined = await postGeneratePrompt(prompt);
      const normalizedRefinedPrompt = normalizePromptText(refined?.prompt);
      if (normalizedRefinedPrompt) {
        setSharedPrompt(normalizedRefinedPrompt);
        setLatestAgentPrompt(normalizedRefinedPrompt);
        addAgentPromptReference(normalizedRefinedPrompt, "Refined prompt");
        setPromptOrigin("agent");
        return;
      }
      const result = await handleAgentSend(prompt, { captureResult: true, modeHint: "text" });
      if (result && typeof result === "object" && "prompt" in result) {
        addAgentPromptReference(result.prompt, result.referenceTitle ?? undefined);
        setPromptOrigin("agent");
      }
    } finally {
      setIsPromptRefining(false);
    }
  }, [
    addAgentPromptReference,
    handleAgentSend,
    prompt,
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
      const refined = await postGeneratePrompt(currentPrompt);
      const nextPrompt = normalizePromptText(refined?.prompt);
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
    isReferencePromptEnhancing,
    selectedTool,
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
        const described = await postDescribeImage(safeUrl);
        resolvePlaceholder(described.description, "Image describe");
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
