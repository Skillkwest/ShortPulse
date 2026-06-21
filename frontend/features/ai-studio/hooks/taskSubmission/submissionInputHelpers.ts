/**
 * Pure input helpers for AI Studio task submission.
 * Keeps URL normalization and panel-owner resolution out of the orchestration hook.
 */
import type { InternalMediaRef } from "../../../../lib/media/internalMediaRefs";
import type { ToolId } from "../../types";
import type { AiStudioSubmitPanelKey } from "../useAiStudioCreationState";

/**
 * Returns true when at least one internal media reference can be forwarded.
 */
export const hasUsableInternalMediaRefs = (
  refs: Array<InternalMediaRef | null | undefined>
): boolean => refs.some((ref) => Boolean(ref));

const asTrimmedString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Keeps Expert Edit restore-only inputs from being resent to providers.
 */
export const resolveRestoreOnlyImageInputs = ({
  providerImageInputs,
  restoreImageInputs = [],
}: {
  providerImageInputs: string[];
  restoreImageInputs?: string[];
}): string[] => {
  const providerReferenceInputUrls = new Set(
    providerImageInputs
      .map((url) => asTrimmedString(url))
      .filter((url): url is string => Boolean(url))
  );
  return Array.from(
    new Set(
      restoreImageInputs
        .map((url) => asTrimmedString(url))
        .filter((url): url is string => Boolean(url))
        .filter((url) => !providerReferenceInputUrls.has(url))
    )
  );
};

/**
 * Resolves which panel owns the submission lifecycle spinner.
 */
export const resolveSubmissionOwner = ({
  override,
  isVideoSubmission,
  effectiveTool,
}: {
  override?: AiStudioSubmitPanelKey;
  isVideoSubmission: boolean;
  effectiveTool: ToolId | null;
}): AiStudioSubmitPanelKey => {
  if (override) return override;
  if (isVideoSubmission) return "video";
  return effectiveTool === "image" || effectiveTool === "edit" ? "edit" : "create";
};
