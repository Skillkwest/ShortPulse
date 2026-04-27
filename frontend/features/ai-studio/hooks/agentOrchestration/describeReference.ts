import { prepareImageUrl } from "../../logic/imageDescription";
import { normalizePromptText, type PromptOrigin } from "../../logic/agentPromptOwnership";
import { randomId } from "../../logic/ids";
import { mergeAttachmentContext } from "./attachmentContext";
import type { UseAiStudioAgentOrchestrationParams } from "./types";

const extractAgentResponseMessage = (response: unknown): string | null => {
  if (!response || typeof response !== "object") return null;
  const message = (response as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
};

type DescribeReferenceParams = {
  outputId: string;
  agentBootstrapReady: boolean;
  aspect: string;
  model: string | null;
  latestAgentPrompt: string | null;
  lastAssistantMessage: string | null;
  notifyBootstrapPending: () => void;
  ensurePulseSessionReady: () => boolean;
  getOutputById: UseAiStudioAgentOrchestrationParams["getOutputById"];
  getAgentContext: UseAiStudioAgentOrchestrationParams["getAgentContext"];
  sendToAgent: UseAiStudioAgentOrchestrationParams["sendToAgent"];
  setOutputs: UseAiStudioAgentOrchestrationParams["setOutputs"];
  setActiveOutputId: UseAiStudioAgentOrchestrationParams["setActiveOutputId"];
  setLatestAgentPrompt: UseAiStudioAgentOrchestrationParams["setLatestAgentPrompt"];
  setSharedPrompt: UseAiStudioAgentOrchestrationParams["setSharedPrompt"];
  setPromptOrigin: React.Dispatch<React.SetStateAction<PromptOrigin>>;
  setDescribeInFlightCount: React.Dispatch<React.SetStateAction<number>>;
};

export const describeReferenceOutput = async ({
  outputId,
  agentBootstrapReady,
  aspect,
  model,
  latestAgentPrompt,
  lastAssistantMessage,
  notifyBootstrapPending,
  ensurePulseSessionReady,
  getOutputById,
  getAgentContext,
  sendToAgent,
  setOutputs,
  setActiveOutputId,
  setLatestAgentPrompt,
  setSharedPrompt,
  setPromptOrigin,
  setDescribeInFlightCount,
}: DescribeReferenceParams): Promise<void> => {
  if (!agentBootstrapReady) {
    notifyBootstrapPending();
    return;
  }
  if (!ensurePulseSessionReady()) {
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
      error instanceof Error ? error.message : "Unable to describe this image with OpenAI vision."
    );
  } finally {
    setDescribeInFlightCount((count) => Math.max(0, count - 1));
  }
};
