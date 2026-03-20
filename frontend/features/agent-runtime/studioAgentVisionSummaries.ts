import type { AgentContext } from "../../prefabs/agent";
import { STUDIO_AGENT_MAX_MEDIA } from "./studioAgentRequestGuards";
import {
  labelUntrustedImageObservation,
  sanitizeImageDerivedTextForPromptCompiler,
} from "./studioAgentUntrustedContent";
import {
  fetchStudioAgentChatCompletion,
  formatStudioAgentErrorMessage,
} from "./studioAgentOpenAiGateway";
import { extractStudioAgentCompletionText } from "./studioAgentResponseNormalization";

export const buildStudioAgentImageSummaryMap = async ({
  openAiUrl,
  context,
  imageDescribePrompt,
  apiKey,
  visionModel,
  timeoutMs,
}: {
  openAiUrl: string;
  context: AgentContext;
  imageDescribePrompt: string;
  apiKey: string;
  visionModel: string;
  timeoutMs: number;
}): Promise<Map<string, string>> => {
  const mediaItems = (context.media ?? [])
    .filter((item) => item.kind === "image")
    .slice(0, STUDIO_AGENT_MAX_MEDIA);
  if (!mediaItems.length) return new Map();

  const summaries = await Promise.allSettled(
    mediaItems.map(async (item) => {
      const imageUrl = item.url ?? "";
      if (!imageUrl) return null;
      const response = await fetchStudioAgentChatCompletion({
        apiKey,
        openAiUrl,
        model: visionModel,
        timeoutMs,
        messages: [
          { role: "system", content: imageDescribePrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Describe the image exactly as you see it." },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      const rawText = extractStudioAgentCompletionText(data?.choices?.[0]?.message?.content);
      const sanitized = sanitizeImageDerivedTextForPromptCompiler(rawText);
      const summary = sanitized.text?.trim() ?? "";
      if (!summary.length) return null;
      return { id: item.id, summary };
    })
  );

  const summaryMap = new Map<string, string>();
  summaries.forEach((result) => {
    if (result.status !== "fulfilled" || !result.value?.id || !result.value.summary) return;
    summaryMap.set(result.value.id, result.value.summary);
  });
  return summaryMap;
};

export const applyStudioAgentVisionSummariesToContext = (
  context: AgentContext,
  summaryByReferenceId: Map<string, string>
): AgentContext => {
  if (!summaryByReferenceId.size) return context;
  const references = (context.references ?? []).map((reference) => {
    if (reference.kind !== "image") return reference;
    const summary = summaryByReferenceId.get(reference.id);
    if (!summary) return reference;
    const labeledSummary = labelUntrustedImageObservation(summary);
    if (!labeledSummary) return reference;
    const mergedCaption = [labeledSummary, reference.caption ?? null]
      .filter(
        (value, index, all): value is string => Boolean(value) && all.indexOf(value) === index
      )
      .join("\n\n");
    return {
      ...reference,
      caption: mergedCaption || labeledSummary,
    };
  });

  const media = (context.media ?? []).map((item) => {
    if (item.kind !== "image") return item;
    const summary = summaryByReferenceId.get(item.id);
    if (!summary) return item;
    const labeledSummary = labelUntrustedImageObservation(summary);
    if (!labeledSummary) return item;
    return {
      ...item,
      thumbnailAlt: labeledSummary,
    };
  });

  return {
    ...context,
    references,
    media,
  };
};

export const describeStudioAgentVisionSummaryError = (error: unknown): string =>
  formatStudioAgentErrorMessage(error);
