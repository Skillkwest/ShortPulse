/**
 * Recovery execution runtime helpers extracted from the orchestration layer.
 * Keeps retry/backoff, media URL normalization, and transition guards testable.
 */

import { extractRecoveryMediaUrls } from "./recoveryProviderProbe";
import { isLegalGenerationTransition, normalizeGenerationLifecycleState } from "./stateMachine";

type JsonObject = Record<string, unknown>;

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v"]);

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

const extensionFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const base = parsed.pathname.split("/").pop() ?? "";
    const ext = base.includes(".") ? (base.split(".").pop() ?? "") : "";
    return ext.replace(/[^a-z0-9]+/gi, "").toLowerCase();
  } catch {
    return "";
  }
};

export const sanitizeFilename = (value: string): string => value.replace(/[^\w.-]+/g, "_");

export const clampPrompt = (value?: string | null): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "ai-studio-generation";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48).trim()}...` : trimmed;
};

export const resolveFileType = (contentType: string | null, url: string): "image" | "video" => {
  const normalizedType = (contentType ?? "").toLowerCase();
  if (normalizedType.startsWith("video/")) return "video";
  if (normalizedType.startsWith("image/")) return "image";
  const ext = extensionFromUrl(url);
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "image";
};

export const resolveExtension = (contentType: string | null, url: string): string => {
  const normalizedType = (contentType ?? "").toLowerCase();
  if (normalizedType && CONTENT_TYPE_EXTENSION[normalizedType]) {
    return CONTENT_TYPE_EXTENSION[normalizedType];
  }
  const ext = extensionFromUrl(url);
  if (ext) return ext;
  return normalizedType.startsWith("video/") ? "mp4" : "png";
};

export const resolveRetryDelaySeconds = (attempts: number): number => {
  const base = 120;
  const scaled = base * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(900, Math.round(scaled));
};

export const canTransitionToSuccess = ({
  status,
  failureReasonCode,
  recoveryState,
}: {
  status: string;
  failureReasonCode: string | null;
  recoveryState: string;
}): boolean => {
  const currentState = normalizeGenerationLifecycleState(status);
  if (!currentState) return false;
  if (currentState === "fail") {
    const reason = (failureReasonCode ?? "").toLowerCase();
    const recovery = (recoveryState ?? "").toLowerCase();
    if (
      reason === "terminal_success_no_media" &&
      (recovery === "queued" || recovery === "recovering" || recovery === "recovered")
    ) {
      return true;
    }
  }
  return isLegalGenerationTransition({ from: currentState, to: "success" });
};

export const collectRecoveredUrls = ({
  mediaUrls,
  payload,
}: {
  mediaUrls: string[];
  payload: JsonObject | null;
}): string[] => {
  return Array.from(
    new Set(
      [...mediaUrls, ...(payload ? extractRecoveryMediaUrls(payload) : [])]
        .map((url) => url.trim())
        .filter((url) => Boolean(url))
    )
  );
};
