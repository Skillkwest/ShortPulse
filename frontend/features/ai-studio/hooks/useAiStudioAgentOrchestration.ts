import { useCallback, useRef, useState } from "react";
import { prepareImageUrl } from "../logic/imageDescription";
import { normalizePromptText } from "../logic/agentPromptOwnership";
import { shouldApplyAgentPromptToSharedPrompt } from "../logic/promptTargeting";
import { randomId } from "../logic/ids";
import type {
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
} from "../components/create/createPulsePresets";
import { mergeAttachmentContext } from "./agentOrchestration/attachmentContext";
import { prepareAgentImageAttachments } from "./agentOrchestration/attachmentPreparation";
import type {
  AgentSendOptions,
  UseAiStudioAgentOrchestrationParams,
} from "./agentOrchestration/types";
import { buildStudioAgentPulseActivationSeed } from "../../agent-runtime/studioAgentPulseRuntime";
import {
  buildPendingPulseWorkflowSessionForStart,
  buildPendingPulseWorkflowSessionForUserInput,
} from "../logic/pulseWorkflowSession";

const DEFAULT_AGENT_PROMPT_REFERENCE_TITLE = "Agent prompt";

const cloneMessageAttachments = (
  attachments: UseAiStudioAgentOrchestrationParams["agentAttachments"]
) => attachments.map((attachment) => ({ ...attachment }));

const extractAgentResponseMessage = (response: unknown): string | null => {
  if (!response || typeof response !== "object") return null;
  const message = (response as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
};

export const useAiStudioAgentOrchestration = ({
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
  setAgentActions,
  setPulseWorkflowSession,
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
  resolvePulseSessionNamespace,
}: UseAiStudioAgentOrchestrationParams) => {
  const [isPromptRefining, setIsPromptRefining] = useState(false);
  const [isReferencePromptEnhancing, setIsReferencePromptEnhancing] = useState(false);
  const [describeInFlightCount, setDescribeInFlightCount] = useState(0);
  const preparedImageUrlCacheRef = useRef(
    new Map<string, { safeUrl: string; expiresAtMs: number }>()
  );
  const notifyBootstrapPending = useCallback(() => {
    setUiNotice("Preparing chat. Try again in a moment.");
    trackAgentUiEvent("studio_agent_send_blocked_bootstrap_pending");
  }, [setUiNotice, trackAgentUiEvent]);

  const handleAgentSend = useCallback(
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
        const pendingWorkflowSession = buildPendingPulseWorkflowSessionForUserInput({
          preset: mediaPatchedContext.pulse,
          existingSession: mediaPatchedContext.pulse?.workflowSession ?? null,
          userInput: userMessageText,
        });
        const requestContext =
          pendingWorkflowSession && mediaPatchedContext.pulse
            ? {
                ...mediaPatchedContext,
                pulse: {
                  ...mediaPatchedContext.pulse,
                  workflowSession: pendingWorkflowSession,
                },
              }
            : mediaPatchedContext;
        if (pendingWorkflowSession) {
          setPulseWorkflowSession(pendingWorkflowSession);
        }

        const { response, actions, workflowSession, discarded } = await sendToAgent({
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

        const hasActivePulse = Boolean(requestContext.pulse);
        if (appliedPrompt) {
          setLatestAgentPrompt(appliedPrompt);
          if (shouldApplyAgentPromptToSharedPrompt(selectedTool, { hasActivePulse })) {
            setSharedPrompt(appliedPrompt);
            setPromptOrigin("agent");
          }
        }

        setAgentActions(actions);
        if (workflowSession) {
          setPulseWorkflowSession(workflowSession);
        }

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
      agentBootstrapReady,
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
      setPulseWorkflowSession,
      notifyBootstrapPending,
      trackAgentUiEvent,
    ]
  );

  const handleAgentEnhanceSend = useCallback(async () => {
    if (!agentBootstrapReady) {
      notifyBootstrapPending();
      return;
    }
    if (!prompt.trim()) return;
    setIsPromptRefining(true);
    try {
      const context = getAgentContext({
        lastAssistantMessage,
        modeHint: "text",
      });
      const { response, actions, workflowSession, discarded } = await sendToAgent({
        text: prompt,
        payloadText: prompt,
        previousPrompt: latestAgentPrompt ?? null,
        context,
        isolateHistory: true,
        skipUserEcho: true,
      });
      if (discarded) {
        return;
      }
      const refinedPrompt = normalizePromptText(
        actions?.applyPrompt ?? extractAgentResponseMessage(response)
      );
      if (refinedPrompt) {
        setSharedPrompt(refinedPrompt);
        setLatestAgentPrompt(refinedPrompt);
        addAgentPromptReference(refinedPrompt, "Refined prompt");
        setPromptOrigin("agent");
      }
      if (workflowSession) {
        setPulseWorkflowSession(workflowSession);
      }
    } finally {
      setIsPromptRefining(false);
    }
  }, [
    addAgentPromptReference,
    agentBootstrapReady,
    getAgentContext,
    lastAssistantMessage,
    latestAgentPrompt,
    prompt,
    sendToAgent,
    setLatestAgentPrompt,
    setPulseWorkflowSession,
    setPromptOrigin,
    setSharedPrompt,
    notifyBootstrapPending,
  ]);

  const handlePulsePresetStart = useCallback(
    async (preset: CreatePulseResolvedPreset): Promise<CreatePulsePresetStartResult> => {
      if (!agentBootstrapReady) {
        notifyBootstrapPending();
        return "failed";
      }
      if (agentIsSending || agentUiBusyRef.current) return "blocked_busy";
      const pulseContext = {
        ...getAgentContext({
          lastAssistantMessage,
          modeHint: "chat",
        }),
        pulse: {
          presetId: preset.presetId,
          label: preset.label,
          description: preset.description,
          instructions: preset.systemInstructions,
          runtimeMode: preset.runtimeMode,
          activationMode: preset.activationMode,
          starterAssistantMessage: preset.starterAssistantMessage,
          workflowStageHints: preset.workflowStageHints,
          outputMode: preset.outputMode,
          memoryPolicy: preset.memoryPolicy,
          source: preset.isBuiltIn ? ("builtin" as const) : ("custom" as const),
        },
      };
      const activationSeed = buildStudioAgentPulseActivationSeed(pulseContext.pulse);
      if (!activationSeed) return "failed";

      trackAgentUiEvent("studio_agent_pulse_start_requested", {
        preset_id: preset.presetId,
        runtime_mode: preset.runtimeMode,
        activation_mode: preset.activationMode,
      });

      if (!agentSessionEnabled) setAgentSessionEnabled(true);
      setAgentAttachmentError(null);
      agentUiBusyRef.current = true;
      setAgentUiBusy(true);
      const pendingWorkflowSession = buildPendingPulseWorkflowSessionForStart({
        preset: pulseContext.pulse,
      });
      if (pendingWorkflowSession) {
        setPulseWorkflowSession(pendingWorkflowSession);
      }

      try {
        const { response, actions, workflowSession, discarded } = await sendToAgent({
          text: "",
          payloadText: activationSeed,
          previousPrompt: latestAgentPrompt ?? null,
          context: pulseContext,
          sessionNamespaceOverride: resolvePulseSessionNamespace?.(preset.presetId),
          skipUserEcho: true,
        });
        if (discarded) {
          return "failed";
        }

        if (!response) return "failed";

        const appliedPrompt = normalizePromptText(actions?.applyPrompt);
        if (appliedPrompt) {
          setLatestAgentPrompt(appliedPrompt);
          if (shouldApplyAgentPromptToSharedPrompt(selectedTool, { hasActivePulse: true })) {
            setSharedPrompt(appliedPrompt);
            setPromptOrigin("agent");
          }
        }

        setAgentActions(actions);
        if (workflowSession) {
          setPulseWorkflowSession(workflowSession);
        }
        return "started";
      } finally {
        agentUiBusyRef.current = false;
        setAgentUiBusy(false);
      }
    },
    [
      agentBootstrapReady,
      agentIsSending,
      agentSessionEnabled,
      agentUiBusyRef,
      getAgentContext,
      lastAssistantMessage,
      latestAgentPrompt,
      selectedTool,
      sendToAgent,
      setAgentActions,
      setAgentAttachmentError,
      setAgentSessionEnabled,
      setAgentUiBusy,
      setLatestAgentPrompt,
      setPulseWorkflowSession,
      setPromptOrigin,
      setSharedPrompt,
      notifyBootstrapPending,
      resolvePulseSessionNamespace,
      trackAgentUiEvent,
    ]
  );

  const handleReferencePromptEnhance = useCallback(async () => {
    if (!agentBootstrapReady) {
      notifyBootstrapPending();
      return;
    }
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
      const { response, actions, workflowSession, discarded } = await sendToAgent({
        text: currentPrompt,
        payloadText: currentPrompt,
        previousPrompt: latestAgentPrompt ?? null,
        context,
        isolateHistory: true,
        skipUserEcho: true,
      });
      if (discarded) {
        return;
      }
      const nextPrompt = normalizePromptText(
        actions?.applyPrompt ?? extractAgentResponseMessage(response)
      );
      if (nextPrompt) {
        if (isVideoPromptTool) {
          setVideoReferenceText(nextPrompt);
        } else {
          setEditReferenceText(nextPrompt);
        }
        setPromptOrigin("manual");
      }
      if (workflowSession) {
        setPulseWorkflowSession(workflowSession);
      }
    } finally {
      setIsReferencePromptEnhancing(false);
    }
  }, [
    agentBootstrapReady,
    editReferenceText,
    getAgentContext,
    isReferencePromptEnhancing,
    lastAssistantMessage,
    latestAgentPrompt,
    selectedTool,
    sendToAgent,
    setEditReferenceText,
    setPulseWorkflowSession,
    setPromptOrigin,
    setVideoReferenceText,
    videoReferenceText,
    notifyBootstrapPending,
  ]);

  const handleDescribeReference = useCallback(
    async (outputId: string) => {
      if (!agentBootstrapReady) {
        notifyBootstrapPending();
        return;
      }
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
        const { response, actions, discarded } = await sendToAgent({
          text: "",
          payloadText: "",
          previousPrompt: latestAgentPrompt ?? null,
          context,
          isolateHistory: true,
          skipUserEcho: true,
        });
        if (discarded) {
          return;
        }
        const describedPrompt = normalizePromptText(
          actions?.applyPrompt ?? extractAgentResponseMessage(response)
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
      agentBootstrapReady,
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
      notifyBootstrapPending,
    ]
  );

  return {
    isPromptRefining,
    isReferencePromptEnhancing,
    describeInFlightCount,
    handleAgentSend,
    handlePulsePresetStart,
    handleAgentEnhanceSend,
    handleReferencePromptEnhance,
    handleDescribeReference,
  };
};
