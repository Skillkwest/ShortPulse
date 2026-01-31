/**
 * Helpers to build the context payload sent to the agent API.
 * Keeps filtering and size caps in one place so UI code stays lean.
 */
import type { AgentContext, AgentMediaPreview, AgentReferenceSummary } from "../types";

const MAX_MEDIA_ITEMS = 3;

const isValidDataUrl = (value?: string | null) => {
  return typeof value === "string" && value.startsWith("data:") && value.length > 0;
};

const isSafeRemoteUrl = (value?: string | null) => {
  if (!value || typeof value !== "string") return false;
  if (!value.startsWith("https://")) return false;
  const lower = value.toLowerCase();
  if (lower.includes("x-amz-signature") || lower.includes("token=") || lower.includes("signature=")) return false;
  return true;
};

const pickMediaPreviews = (media?: AgentMediaPreview[]): AgentMediaPreview[] => {
  if (!media || !media.length) return [];
  return media
    .filter((item) => item.kind === "image" || item.kind === "video")
    .filter((item) => isValidDataUrl(item.dataUrl) || isSafeRemoteUrl(item.url))
    .slice(0, MAX_MEDIA_ITEMS);
};

export const buildAgentContext = (context: AgentContext): AgentContext => {
  return {
    activePrompt: context.activePrompt ?? null,
    modelId: context.modelId ?? null,
    mode: context.mode,
    creditBalance: context.creditBalance ?? null,
    references: Array.isArray(context.references) ? (context.references as AgentReferenceSummary[]).slice(0, 24) : [],
    media: pickMediaPreviews(context.media),
    selectedReferenceIds: Array.isArray(context.selectedReferenceIds) ? context.selectedReferenceIds.slice(0, 8) : [],
  };
};
