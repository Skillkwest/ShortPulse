/**
 * Provider-error normalization policy for user-lane response behavior.
 */
import {
  classifyStudioAgentFailure,
  resolveStudioAgentFailureResolution,
  type StudioAgentFailureClass,
  type StudioAgentFailureResolution,
} from "../studioAgentFailurePolicy";

export type ProviderErrorNormalizationMode = "production_normalized" | "development_verbatim";

export const REMOTE_MEDIA_FETCH_FAILURE_MESSAGE =
  "One attached image could not be fetched by the provider. Try re-adding the preview or using a smaller image.";

const SIGNED_MEDIA_URL_PATTERN = /https?:\/\/[^\s)]+\/storage\/v1\/object\/sign\/[^\s)\]}>"']+/gi;

const REMOTE_MEDIA_FETCH_DETAIL_PATTERNS: RegExp[] = [
  /\btimeout\s+while\s+downloading\b/i,
  /\btimed\s*out\s+while\s+downloading\b/i,
  /\bfailed\s+to\s+download\b/i,
];

const redactSignedMediaUrls = (detail: string): string =>
  detail.replace(SIGNED_MEDIA_URL_PATTERN, "[signed media URL]");

const isRemoteMediaFetchFailure = (detail: string): boolean =>
  REMOTE_MEDIA_FETCH_DETAIL_PATTERNS.some((pattern) => pattern.test(detail));

export const resolveProviderErrorNormalizationMode = (
  rawMode?: string | null
): ProviderErrorNormalizationMode => {
  const normalized = String(rawMode ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "development_verbatim" || normalized === "verbatim") {
    return "development_verbatim";
  }
  return "production_normalized";
};

export const resolveProviderErrorHandling = ({
  status,
  detail,
  safetyRefusal = false,
  normalizationMode,
}: {
  status?: number | null;
  detail?: string | null;
  safetyRefusal?: boolean;
  normalizationMode: ProviderErrorNormalizationMode;
}): {
  failureClass: StudioAgentFailureClass;
  failureResolution: StudioAgentFailureResolution;
  detailForClient?: string;
} => {
  const detailText = String(detail ?? "").trim();
  const failureClass = classifyStudioAgentFailure({
    status,
    detail: detailText,
    safetyRefusal,
  });
  const failureResolution = resolveStudioAgentFailureResolution({ failureClass });

  if (failureResolution !== "hard_error") {
    return { failureClass, failureResolution };
  }

  if (!detailText.length) {
    return { failureClass, failureResolution };
  }

  if (normalizationMode === "development_verbatim") {
    return { failureClass, failureResolution, detailForClient: detailText };
  }

  if (detailText.length) {
    if (isRemoteMediaFetchFailure(detailText)) {
      return {
        failureClass,
        failureResolution,
        detailForClient: REMOTE_MEDIA_FETCH_FAILURE_MESSAGE,
      };
    }
  }

  if (typeof status === "number" && status >= 500) {
    return { failureClass, failureResolution };
  }

  return {
    failureClass,
    failureResolution,
    detailForClient: redactSignedMediaUrls(detailText),
  };
};
