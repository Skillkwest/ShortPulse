/**
 * Client-side helper to request an image description from our AI agent.
 * Uses the image describer system prompt (Agent 2) defined in `frontend/lib/agentPromptsConfig.ts`.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

export type ImageDescriptionResult = {
  description: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export const prepareImageUrl = async (imageUrl: string): Promise<string | null> => {
  if (!imageUrl?.trim()) return null;

  // Function to resize and compress image
  const optimizeImage = async (url: string): Promise<string | null> => {
    try {
      return await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 2048; // Max dimension for compatibility & speed

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(url); // Fallback to original
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          // Convert to JPEG with 0.85 quality for good balance
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          resolve(dataUrl);
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    } catch {
      return url; // Fallback
    }
  };

  if (imageUrl.startsWith("blob:")) {
    try {
      // For blobs, we optimize them
      return await optimizeImage(imageUrl);
    } catch {
      return null;
    }
  }
  return imageUrl;
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
