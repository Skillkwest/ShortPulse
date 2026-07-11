/**
 * Seedance video-reference pricing helpers.
 * Resolves Seedance reference-video duration from existing AI Studio media metadata.
 */
import type { StudioOutput, WorkflowReloadVideoMediaSlot } from "../types";
import {
  SEEDANCE_REFERENCE_VIDEO_DURATION_LIMIT_SECONDS,
  validateSeedanceReferenceVideoDuration,
} from "../../../lib/model-runtime/seedanceReferenceVideoValidation";

export type SeedanceVideoReferenceDuration = Pick<
  WorkflowReloadVideoMediaSlot,
  "sourceUrl" | "durationMs"
>;

export { SEEDANCE_REFERENCE_VIDEO_DURATION_LIMIT_SECONDS };

export const resolveSeedanceVideoReferenceDurationLimitError = (
  inputVideoDurationSeconds: number | null | undefined,
  inputVideoCount = inputVideoDurationSeconds == null ? 0 : 1
): string | null =>
  validateSeedanceReferenceVideoDuration({
    modelId: "kie-ai/seedance-2",
    inputVideoCount,
    inputVideoDurationSeconds,
  })?.message ?? null;

const normalizeUrl = (value: string | null | undefined): string => value?.trim() ?? "";

const resolveOutputUrls = (output: StudioOutput): string[] =>
  [
    output.previewUrl,
    output.fullUrl,
    output.localObjectUrl,
    ...(Array.isArray(output.resultUrls) ? output.resultUrls : []),
  ].filter((value): value is string => Boolean(normalizeUrl(value)));

const normalizeDurationMs = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;

/**
 * Finds durable duration metadata for the selected reference URLs in the current output set.
 */
export const resolveSeedanceVideoReferenceDurations = ({
  referenceVideoUrls,
  outputs = [],
}: {
  referenceVideoUrls: readonly string[];
  outputs?: readonly StudioOutput[] | null;
}): SeedanceVideoReferenceDuration[] => {
  const wantedUrls = Array.from(new Set(referenceVideoUrls.map(normalizeUrl).filter(Boolean)));
  if (!wantedUrls.length) return [];

  const durationByUrl = new Map<string, number>();
  outputs?.forEach((output) => {
    const durationMs = normalizeDurationMs(output.durationMs);
    if (durationMs == null) return;
    resolveOutputUrls(output).forEach((url) => {
      const normalizedUrl = normalizeUrl(url);
      if (wantedUrls.includes(normalizedUrl) && !durationByUrl.has(normalizedUrl)) {
        durationByUrl.set(normalizedUrl, durationMs);
      }
    });
  });

  return wantedUrls.flatMap((sourceUrl) => {
    const durationMs = durationByUrl.get(sourceUrl);
    return durationMs == null ? [] : [{ sourceUrl, durationMs }];
  });
};

/**
 * Sums known durations for selected Seedance reference-video URLs.
 */
export const resolveSeedanceInputVideoDurationSeconds = ({
  referenceVideoUrls,
  outputs = [],
  persistedVideoReferences = [],
}: {
  referenceVideoUrls: readonly string[];
  outputs?: readonly StudioOutput[] | null;
  persistedVideoReferences?: readonly SeedanceVideoReferenceDuration[] | null;
}): number | null => {
  const wantedUrls = new Set(referenceVideoUrls.map(normalizeUrl).filter(Boolean));
  if (!wantedUrls.size) return null;

  const durationByUrl = new Map<string, number>();
  persistedVideoReferences?.forEach((reference) => {
    const sourceUrl = normalizeUrl(reference.sourceUrl);
    const durationMs = normalizeDurationMs(reference.durationMs);
    if (sourceUrl && wantedUrls.has(sourceUrl) && durationMs != null) {
      durationByUrl.set(sourceUrl, durationMs);
    }
  });
  resolveSeedanceVideoReferenceDurations({ referenceVideoUrls, outputs }).forEach((reference) => {
    const sourceUrl = normalizeUrl(reference.sourceUrl);
    const durationMs = normalizeDurationMs(reference.durationMs);
    if (sourceUrl && durationMs != null && !durationByUrl.has(sourceUrl)) {
      durationByUrl.set(sourceUrl, durationMs);
    }
  });

  if (durationByUrl.size !== wantedUrls.size) return null;
  const totalDurationMs = Array.from(durationByUrl.values()).reduce(
    (total, durationMs) => total + durationMs,
    0
  );

  return totalDurationMs > 0 ? totalDurationMs / 1000 : null;
};
