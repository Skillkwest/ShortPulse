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

  if (typeof status === "number" && status >= 500) {
    return { failureClass, failureResolution };
  }

  return { failureClass, failureResolution, detailForClient: detailText };
};
