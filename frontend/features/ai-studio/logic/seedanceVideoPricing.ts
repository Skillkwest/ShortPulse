/**
 * Seedance video-reference pricing helpers.
 * Resolves billing-only input-video duration from existing AI Studio media metadata.
 */
import type { StudioOutput } from "../types";

const normalizeUrl = (value: string | null | undefined): string => value?.trim() ?? "";

const resolveOutputUrls = (output: StudioOutput): string[] =>
  [
    output.previewUrl,
    output.fullUrl,
    output.localObjectUrl,
    ...(Array.isArray(output.resultUrls) ? output.resultUrls : []),
  ].filter((value): value is string => Boolean(normalizeUrl(value)));

/**
 * Sums known durations for selected Seedance reference-video URLs.
 */
export const resolveSeedanceInputVideoDurationSeconds = ({
  referenceVideoUrls,
  outputs = [],
}: {
  referenceVideoUrls: readonly string[];
  outputs?: readonly StudioOutput[] | null;
}): number | null => {
  const wantedUrls = new Set(referenceVideoUrls.map(normalizeUrl).filter(Boolean));
  if (!wantedUrls.size) return null;

  let totalDurationMs = 0;
  const matchedUrls = new Set<string>();
  outputs?.forEach((output) => {
    const durationMs = output.durationMs;
    if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) {
      return;
    }
    const matchedOutputUrl = resolveOutputUrls(output).find((url) =>
      wantedUrls.has(normalizeUrl(url))
    );
    if (!matchedOutputUrl) return;
    const normalizedMatchedUrl = normalizeUrl(matchedOutputUrl);
    if (matchedUrls.has(normalizedMatchedUrl)) return;
    matchedUrls.add(normalizedMatchedUrl);
    totalDurationMs += durationMs;
  });

  return matchedUrls.size === wantedUrls.size && totalDurationMs > 0
    ? totalDurationMs / 1000
    : null;
};
