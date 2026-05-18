/**
 * Standard Create context builder.
 * Rejects Pulse context before a Standard request can be serialized.
 */
import type {
  AgentApiContext,
  AgentApiMediaPreview,
  AgentContext,
  AgentReferenceSummary,
} from "../../../prefabs/agent";
import { pickSafeAgentImageMediaUrls } from "../../../prefabs/agent/mediaUrlPolicy";

const pickMediaPreviews = (media?: AgentContext["media"]): AgentApiMediaPreview[] => {
  if (!media || !media.length) return [];
  return pickSafeAgentImageMediaUrls(
    media
      .filter((item) => item.kind === "image" && typeof item.url === "string")
      .map((item) => ({
        id: item.id,
        url: item.url as string,
        thumbnailAlt: item.thumbnailAlt ?? undefined,
      }))
  ).map((item) => ({
    id: item.id,
    kind: "image" as const,
    url: item.url,
    thumbnailAlt: item.thumbnailAlt ?? undefined,
  }));
};

export const buildStandardCreateAgentContext = (context: AgentContext): AgentApiContext => {
  if (context.pulse) {
    throw new Error("Standard Create agent context cannot include Pulse context.");
  }
  return {
    activePrompt: context.activePrompt ?? null,
    modelId: context.modelId ?? null,
    mode: context.mode,
    creditBalance: context.creditBalance ?? null,
    references: Array.isArray(context.references)
      ? (context.references as AgentReferenceSummary[]).slice(0, 24)
      : [],
    media: pickMediaPreviews(context.media),
    selectedReferenceIds: Array.isArray(context.selectedReferenceIds)
      ? context.selectedReferenceIds.slice(0, 8)
      : [],
    focusedSource: context.focusedSource ?? undefined,
    focusedReferenceId: context.focusedReferenceId ?? null,
    lastAssistantMessage: context.lastAssistantMessage ?? null,
    modeHint: context.modeHint ?? undefined,
  };
};
