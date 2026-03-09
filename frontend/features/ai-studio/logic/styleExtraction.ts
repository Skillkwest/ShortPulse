/**
 * Client-side helper to extract reusable style descriptors from an image.
 * Uses the style extraction system prompt defined in `frontend/lib/agentPromptsConfig.ts`.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { prepareImageUrlForSubmission } from "../utils/imageUpload";

export type StyleExtractionResult = {
  stylePrompt: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export const prepareStyleImageUrl = async (imageUrl: string): Promise<string | null> => {
  if (!imageUrl?.trim()) return null;
  try {
    const prepared = await prepareImageUrlForSubmission(imageUrl);
    return prepared?.startsWith("https://") ? prepared : null;
  } catch {
    return null;
  }
};

export const postExtractStyle = async (imageUrl: string): Promise<StyleExtractionResult> => {
  if (!imageUrl?.trim()) {
    throw new Error("Image URL is required for style extraction.");
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetchWithAuth("/api/ai/extract-style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
      signal: controller.signal,
      shortpulseLogScope: "generation",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const detail =
        (typeof payload?.detail === "string" && payload.detail.trim()) ||
        (typeof payload?.error === "string" && payload.error.trim()) ||
        null;
      throw new Error(detail ?? `Style extraction request failed (${response.status}).`);
    }

    const data = await response.json();
    const stylePrompt = typeof data?.stylePrompt === "string" ? data.stylePrompt.trim() : null;
    if (!stylePrompt?.length) {
      throw new Error("Style extraction response did not include a style prompt.");
    }

    return {
      stylePrompt,
      usage: data?.usage,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Style extraction timed out. Please retry.");
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Style extraction failed.");
  } finally {
    window.clearTimeout(timeoutId);
  }
};
