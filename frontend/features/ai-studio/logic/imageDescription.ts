/**
 * Client-side helper to request an image description from our AI agent.
 * Uses the image describer system prompt (Agent 2) defined in `frontend/lib/agentPromptsConfig.ts`.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { prepareImageUrlForSubmission } from "../utils/imageUpload";

export type ImageDescriptionResult = {
  description: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export const prepareImageUrl = async (imageUrl: string): Promise<string | null> => {
  if (!imageUrl?.trim()) return null;
  try {
    const prepared = await prepareImageUrlForSubmission(imageUrl);
    return prepared?.startsWith("https://") ? prepared : null;
  } catch {
    return null;
  }
};

export const postDescribeImage = async (
  imageUrl: string
): Promise<ImageDescriptionResult | null> => {
  if (!imageUrl?.trim()) return null;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetchWithAuth("/api/ai/describe-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
      signal: controller.signal,
      shortpulseLogScope: "generation",
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const description = typeof data?.description === "string" ? data.description.trim() : null;
    if (!description || !description.length) return null;
    return {
      description,
      usage: data?.usage,
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
