/**
 * Timeout budget policy for reference/inpaint pre-submit media preparation.
 * Keeps small runs responsive while allowing larger inpaint payload prep to complete.
 */
import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";

const PREPARE_REFERENCE_TIMEOUT_BASE_MS = 10_000;
const PREPARE_REFERENCE_TIMEOUT_PER_WORK_UNIT_MS = 8_000;
const PREPARE_REFERENCE_TIMEOUT_MAX_MS = 45_000;

const hasNonEmptyUrl = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const countPreflightWorkUnits = ({
  imageInputs,
  inpaintOverride,
}: {
  imageInputs: string[];
  inpaintOverride?: InpaintSubmissionOverride | null;
}): number => {
  const referenceUnits = imageInputs.reduce(
    (total, candidate) => total + (hasNonEmptyUrl(candidate) ? 1 : 0),
    0
  );
  if (!inpaintOverride) {
    return referenceUnits;
  }
  const inpaintUnits =
    (hasNonEmptyUrl(inpaintOverride.baseImageInput) ? 1 : 0) +
    (hasNonEmptyUrl(inpaintOverride.maskInput) ? 1 : 0);
  return referenceUnits + inpaintUnits;
};

export type PrepareReferenceTimeoutBudget = {
  workUnitCount: number;
  timeoutMs: number;
};

/**
 * Resolves the deadline budget for media preparation before provider submission.
 */
export const resolvePrepareReferenceTimeoutBudget = ({
  imageInputs,
  inpaintOverride,
}: {
  imageInputs: string[];
  inpaintOverride?: InpaintSubmissionOverride | null;
}): PrepareReferenceTimeoutBudget => {
  const workUnitCount = countPreflightWorkUnits({ imageInputs, inpaintOverride });
  const normalizedUnitCount = Math.max(1, workUnitCount);
  const timeoutMs = Math.min(
    PREPARE_REFERENCE_TIMEOUT_MAX_MS,
    PREPARE_REFERENCE_TIMEOUT_BASE_MS +
      (normalizedUnitCount - 1) * PREPARE_REFERENCE_TIMEOUT_PER_WORK_UNIT_MS
  );

  return {
    workUnitCount,
    timeoutMs,
  };
};
