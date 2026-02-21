/**
 * Helpers to build the context payload sent to the agent API.
 * Keeps filtering and size caps in one place so UI code stays lean.
 */
import type {
  AgentApiContext,
  AgentApiMediaPreview,
  AgentContext,
  AgentReferenceSummary,
} from "../../../prefabs/agent";

const MAX_MEDIA_ITEMS = 3;

const isSafeRemoteUrl = (value?: string | null) => {
  if (!value || typeof value !== "string") return false;
  if (!value.startsWith("https://")) return false;
  return true;
};

const pickMediaPreviews = (media?: AgentContext["media"]): AgentApiMediaPreview[] => {
  if (!media || !media.length) return [];
  return (
    media
      .filter((item) => item.kind === "image") // videos are not processed by the agent; exclude them from vision payload
      // Use signed/public HTTPS URLs only to avoid oversized chat payloads from base64 data URLs.
      .filter((item) => isSafeRemoteUrl(item.url))
      .map((item) => ({
        id: item.id,
        kind: "image" as const,
        url: item.url as string,
        thumbnailAlt: item.thumbnailAlt ?? undefined,
      }))
      .slice(0, MAX_MEDIA_ITEMS)
  );
};

export const buildAgentContext = (context: AgentContext): AgentApiContext => {
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
