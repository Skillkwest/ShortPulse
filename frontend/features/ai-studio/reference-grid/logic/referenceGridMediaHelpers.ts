import type { StudioOutput } from "../../types";
import { isVideoUrl } from "../../logic/stateParsers";
import { isRenderableAdaptiveUrl } from "../../../../lib/adaptive-media";

export const hasAdaptiveQueryParams = (url: string): boolean =>
  /[?&]width=\d+/i.test(url) && /[?&]quality=\d+/i.test(url);

export const isNextOptimizerUrl = (url: string): boolean =>
  /^\/_next\/image\?/i.test(url) || /\/_next\/image\?/i.test(url);

export const normalizeComparableUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("/")) return trimmed;
  if (typeof window === "undefined") return trimmed;
  try {
    return new URL(trimmed, window.location.origin).toString();
  } catch {
    return trimmed;
  }
};

export const resolveOptimizerSourceUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !isNextOptimizerUrl(trimmed)) return null;
  try {
    const parsed = new URL(trimmed, "https://shortpulse.local");
    const source = parsed.searchParams.get("url");
    if (!source) return null;
    return normalizeComparableUrl(source);
  } catch {
    return null;
  }
};

export const resolveFirstRenderableUrl = (
  ...candidates: Array<string | null | undefined>
): string | null => {
  for (const candidate of candidates) {
    if (!isRenderableAdaptiveUrl(candidate)) continue;
    const trimmed = candidate.trim();
    return trimmed;
  }
  return null;
};

export const isOutputVideoPreview = (
  output: Pick<StudioOutput, "mode"> | null | undefined,
  url: string | null | undefined
): boolean => {
  if (!url) return false;
  if (output?.mode === "video") return true;
  if (output?.mode === "image") return false;
  return isVideoUrl(url);
};
