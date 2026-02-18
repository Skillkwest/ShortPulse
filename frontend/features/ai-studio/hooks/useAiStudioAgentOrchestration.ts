import {
  useCallback,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type {
  AgentActions,
  AgentAttachment,
  AgentContext,
  AgentMediaPreview,
  AgentReferenceSummary,
} from "../../../prefabs/agent";
import { postGeneratePrompt } from "../logic/promptGeneration";
import { postDescribeImage, prepareImageUrl } from "../logic/imageDescription";
import { normalizePromptText, type PromptOrigin } from "../logic/agentPromptOwnership";
import { shouldApplyAgentPromptToSharedPrompt } from "../logic/promptTargeting";
import { randomId } from "../logic/ids";
import type { StudioOutput, ToolId } from "../types";

const MAX_AGENT_IMAGE_ATTACHMENTS = 3;

type AgentModeHint = "chat" | "text" | "describe" | "reference";

type AgentSendOptions = {
  captureResult?: boolean;
  selectedOverride?: StudioOutput | null;
  modeHint?: AgentModeHint;
};

type UseAiStudioAgentOrchestrationParams = {
  agentIsSending: boolean;
  agentUiBusyRef: MutableRefObject<boolean>;
  setAgentUiBusy: Dispatch<SetStateAction<boolean>>;
  agentSessionEnabled: boolean;
  setAgentSessionEnabled: Dispatch<SetStateAction<boolean>>;
  agentInput: string;
  setAgentInput: Dispatch<SetStateAction<string>>;
  agentAttachments: AgentAttachment[];
  setAgentAttachments: Dispatch<SetStateAction<AgentAttachment[]>>;
  setAgentAttachmentError: Dispatch<SetStateAction<string | null>>;
  markAttachmentDelivery: (
    ids: string[],
    status: "pending" | "preparing" | "ready" | "failed",
    deliveryError?: string | null | ((attachment: AgentAttachment) => string | null)
  ) => void;
  prompt: string;
  latestAgentPrompt: string | null;
  setLatestAgentPrompt: Dispatch<SetStateAction<string | null>>;
  setAgentActions: Dispatch<SetStateAction<AgentActions | undefined>>;
  selectedTool: ToolId | null;
  setSharedPrompt: (value: string) => void;
  setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>>;
  sendToAgent: (params: {
    text: string;
    payloadText?: string;
    previousPrompt?: string | null;
    context?: AgentContext;
    skipUserEcho?: boolean;
    optimisticUserMessageId?: string | null;
  }) => Promise<{ response: unknown; actions: AgentActions | undefined }>;
  appendUserMessage: (text: string) => string | null;
  getAgentContext: (params: {
    lastAssistantMessage: string | null;
    selectedOverride?: StudioOutput | null;
    modeHint?: AgentModeHint;
  }) => AgentContext;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
  addAgentPromptReference: (promptText: string, title?: string) => void;
  editReferenceText: string;
  setEditReferenceText: (value: string) => void;
  videoReferenceText: string;
  setVideoReferenceText: (value: string) => void;
  getOutputById: (id: string) => StudioOutput | null;
  aspect: string;
  model: string | null;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  lastAssistantMessage: string | null;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
};

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
        const preparedImageUrls = new Map<string, string>();
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
        const imageAttachments = agentAttachments.filter(
          (attachment): attachment is AgentAttachment =>
            attachment.kind === "image" && Boolean(attachment.imageUrl?.trim())
        );
        if (imageAttachments.length > 0) {
          const imageAttachmentIds = imageAttachments.map((attachment) => attachment.id);
          markAttachmentDelivery(imageAttachmentIds, "preparing");

          const preparedResults = await Promise.allSettled(
            imageAttachments.map(async (attachment) => {
              const sourceUrl = attachment.imageUrl?.trim() ?? "";
              const safeUrl = sourceUrl ? await prepareImageUrl(sourceUrl) : null;
              return {
                attachmentId: attachment.id,
                safeUrl,
              };
            })
          );

          const failedAttachmentIds: string[] = [];
          preparedResults.forEach((result, index) => {
            const attachmentId = imageAttachments[index]?.id;
            if (!attachmentId) return;
            if (result.status === "fulfilled" && result.value.safeUrl?.startsWith("https://")) {
              preparedImageUrls.set(attachmentId, result.value.safeUrl);
              return;
            }
            failedAttachmentIds.push(attachmentId);
          });

          if (failedAttachmentIds.length) {
            markAttachmentDelivery(
              failedAttachmentIds,
              "failed",
              "Image upload/preparation failed. Remove this image and try again."
            );
            setAgentAttachmentError(
              "One or more attached images failed to prepare. Remove failed images and try again."
            );
            trackAgentUiEvent("studio_agent_attachment_prepare_failed", {
              failed_image_attachments: failedAttachmentIds.length,
              attempted_image_attachments: imageAttachmentIds.length,
            });
            return;
          }

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
        let mediaPatchedContext = baseContext;

        if (agentAttachments.length) {
          const attachmentRefs: AgentReferenceSummary[] = [];
          const attachmentMedia: AgentMediaPreview[] = [];
          const selectedAttachmentIds: string[] = [];

          agentAttachments.forEach((attachment) => {
            const referenceId = attachment.referenceId ?? attachment.id;
            const attachmentText = attachment.text?.trim() || null;
            if (attachment.referenceId) {
              selectedAttachmentIds.push(attachment.referenceId);
            }
            if (attachment.kind === "image") {
              attachmentRefs.push({
                id: referenceId,
                kind: "image",
                promptSnippet: attachmentText,
                aspect: attachment.aspect ?? null,
                caption: attachmentText,
              });
              const safeImageUrl = preparedImageUrls.get(attachment.id);
              if (safeImageUrl) {
                attachmentMedia.push({
                  id: referenceId,
                  kind: "image",
                  url: safeImageUrl,
                  thumbnailAlt: attachmentText,
                });
              }
              return;
            }
            attachmentRefs.push({
              id: referenceId,
              kind: "prompt",
              promptSnippet: attachmentText,
              aspect: attachment.aspect ?? null,
              caption: null,
            });
          });

          const dedupedRefs = [...attachmentRefs, ...(mediaPatchedContext.references ?? [])].filter(
            (item, index, all) =>
              all.findIndex(
                (candidate) => candidate.id === item.id && candidate.kind === item.kind
              ) === index
          );
          const dedupedMedia = [...attachmentMedia, ...(mediaPatchedContext.media ?? [])].filter(
            (item, index, all) =>
              all.findIndex(
                (candidate) => candidate.id === item.id && candidate.url === item.url
              ) === index
          );
          const mergedSelectedReferenceIds = Array.from(
            new Set([...(mediaPatchedContext.selectedReferenceIds ?? []), ...selectedAttachmentIds])
          ).slice(0, 8);
          const hasImageAttachments = attachmentMedia.length > 0;
          const hasCanonicalPromptContext = Boolean(
            mediaPatchedContext.activePrompt?.trim() ||
            mediaPatchedContext.lastAssistantMessage?.trim()
          );
          const nextFocusedSource = hasImageAttachments
            ? "image"
            : hasCanonicalPromptContext
              ? (mediaPatchedContext.focusedSource ?? "agent-output")
              : "prompt";

          mediaPatchedContext = {
            ...mediaPatchedContext,
            references: dedupedRefs.slice(0, 24),
            media: dedupedMedia.slice(0, MAX_AGENT_IMAGE_ATTACHMENTS),
            selectedReferenceIds: mergedSelectedReferenceIds,
            focusedSource: nextFocusedSource,
            focusedReferenceId:
              mergedSelectedReferenceIds.length === 1 ? mergedSelectedReferenceIds[0] : null,
          };
        }

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
