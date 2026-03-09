/**
 * Client-side helper to extract reusable style descriptors from an image.
 * Uses the style extraction system prompt defined in `frontend/lib/agentPromptsConfig.ts`.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { prepareImageUrlForSubmission } from "../utils/imageUpload";

export type StyleExtractionResult = {
  stylePrompt: string;
  styleTitle: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

const STYLE_TITLE_FALLBACK = "Extracted Style";
const STYLE_EXTERNAL_FETCH_BLOCKED_MESSAGE =
  "This image source blocks browser access. Download the image and drop the file directly to analyze style.";
const STYLE_NORMALIZE_FAILED_MESSAGE =
  "Unable to prepare image for style extraction. You can still enter the style prompt manually.";

const parseHostname = (value: string | undefined): string | null => {
  if (!value?.trim()) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
};

const resolveTrustedStyleHosts = (): Set<string> => {
  const trustedHosts = new Set<string>();
  const currentHost =
    typeof window !== "undefined" ? window.location.hostname.toLowerCase().replace(/\.$/, "") : "";
  if (currentHost) trustedHosts.add(currentHost);
  const supabaseHost = parseHostname(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (supabaseHost) trustedHosts.add(supabaseHost);
  return trustedHosts;
};

const isTrustedStyleHostUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    return resolveTrustedStyleHosts().has(parsed.hostname.toLowerCase().replace(/\.$/, ""));
  } catch {
    return false;
  }
};

const normalizeExternalStyleImageToManagedUrl = async (url: string): Promise<string> => {
  const response = await fetch(url, { method: "GET", mode: "cors", credentials: "omit" });
  if (!response.ok) {
    throw new Error(`External image download failed (${response.status}).`);
  }
  const blob = await response.blob();
  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error("External image download returned no data.");
  }
  const blobUrl = URL.createObjectURL(blob);
  try {
    const uploadedUrl = await prepareImageUrlForSubmission(blobUrl);
    if (!uploadedUrl?.startsWith("https://")) {
      throw new Error("Managed upload returned an invalid URL.");
    }
    return uploadedUrl;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

const toTitleCaseWords = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2) return word.toUpperCase();
      return `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");

const buildFallbackStyleTitle = (stylePrompt: string): string => {
  const descriptorParts = stylePrompt
    .split(",")
    .map((part) =>
      part
        .replace(/\b(?:style|look|aesthetic|finish)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter(Boolean)
    .slice(0, 2);
  const base = descriptorParts.join(" ").trim();
  if (!base) return STYLE_TITLE_FALLBACK;
  return toTitleCaseWords(base.split(/\s+/).slice(0, 5).join(" ")) || STYLE_TITLE_FALLBACK;
};

const normalizeStyleTitle = (value: unknown, stylePrompt: string): string => {
  const raw =
    typeof value === "string"
      ? value
          .trim()
          .replace(/^STYLE\s*TITLE\s*:?\s*/i, "")
          .replace(/[“”"]/g, "")
          .replace(/\s{2,}/g, " ")
          .replace(/[,:;\-.]+$/g, "")
      : "";
  if (!raw) return buildFallbackStyleTitle(stylePrompt);
  return raw.length <= 80 ? raw : raw.slice(0, 80).trim();
};

export const prepareStyleImageUrl = async (imageUrl: string): Promise<string | null> => {
  if (!imageUrl?.trim()) return null;
  const normalizedInput = imageUrl.trim();
  const prepared = await prepareImageUrlForSubmission(normalizedInput);
  if (!prepared?.startsWith("https://")) return null;
  if (isTrustedStyleHostUrl(prepared)) return prepared;
  try {
    return await normalizeExternalStyleImageToManagedUrl(prepared);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    const normalized = message.toLowerCase();
    if (
      normalized.includes("cors") ||
      normalized.includes("failed to fetch") ||
      normalized.includes("networkerror") ||
      normalized.includes("external image download failed")
    ) {
      throw new Error(STYLE_EXTERNAL_FETCH_BLOCKED_MESSAGE);
    }
    throw new Error(STYLE_NORMALIZE_FAILED_MESSAGE);
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
    const styleTitle = normalizeStyleTitle(data?.styleTitle, stylePrompt);

    return {
      stylePrompt,
      styleTitle,
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
