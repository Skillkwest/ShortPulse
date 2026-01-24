/**
 * Client-side helper to request an image description from our AI agent.
 * Uses the image describer system prompt (Agent 2) defined in `frontend/lib/agentPromptsConfig.ts`.
 */
export type ImageDescriptionResult = {
  description: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export const prepareImageUrl = async (imageUrl: string): Promise<string | null> => {
  if (!imageUrl?.trim()) return null;
  if (imageUrl.startsWith("blob:")) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      return await new Promise((resolve) => {
        reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (_error) {
      return null;
    }
  }
  return imageUrl;
};

export const postDescribeImage = async (imageUrl: string): Promise<ImageDescriptionResult | null> => {
  if (!imageUrl?.trim()) return null;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("/api/ai/describe-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
      signal: controller.signal,
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
  } catch (_error) {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
