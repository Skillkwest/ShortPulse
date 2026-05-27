/**
 * Timeout budget policy for reference/inpaint pre-submit media preparation.
 * Keeps small runs responsive while allowing larger inpaint payload prep to complete.
 */
import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import {
  FETCH_LOCAL_IMAGE_TIMEOUT_MS,
  UPLOAD_IMAGE_ROUTE_TIMEOUT_MS,
} from "../../utils/imageUploadTimeouts";

const PREPARE_REFERENCE_TIMEOUT_BASE_MS = 14_000;
const PREPARE_REFERENCE_TIMEOUT_PER_WORK_UNIT_MS = 12_000;
// Local Expert Edit/reference uploads can require a full local fetch plus the
// canonical upload route before provider submit begins.
const PREPARE_REFERENCE_TIMEOUT_LOCAL_UPLOAD_BUFFER_MS = 8_000;
const PREPARE_REFERENCE_TIMEOUT_LOCAL_UPLOAD_BONUS_MS = Math.max(
  0,
  FETCH_LOCAL_IMAGE_TIMEOUT_MS +
    UPLOAD_IMAGE_ROUTE_TIMEOUT_MS +
    PREPARE_REFERENCE_TIMEOUT_LOCAL_UPLOAD_BUFFER_MS -
    PREPARE_REFERENCE_TIMEOUT_BASE_MS
);
const PREPARE_REFERENCE_TIMEOUT_MAX_MS = 120_000;

const hasNonEmptyUrl = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const isLocalUploadCandidate = (value: string | null | undefined): boolean => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) return false;
  return normalized.startsWith("blob:") || normalized.startsWith("data:image/");
};

const countLocalUploadUnits = ({
  imageInputs,
  inpaintOverride,
}: {
  imageInputs: string[];
  inpaintOverride?: InpaintSubmissionOverride | null;
}): number => {
  const referenceLocalUploads = imageInputs.reduce(
    (total, candidate) => total + (isLocalUploadCandidate(candidate) ? 1 : 0),
    0
  );
  if (!inpaintOverride) {
    return referenceLocalUploads;
  }
  const inpaintLocalUploads =
    (isLocalUploadCandidate(inpaintOverride.baseImageInput) ? 1 : 0) +
    (isLocalUploadCandidate(inpaintOverride.maskInput) ? 1 : 0) +
    (isLocalUploadCandidate(inpaintOverride.referenceImageInput) ? 1 : 0);
  return referenceLocalUploads + inpaintLocalUploads;
};

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
    (hasNonEmptyUrl(inpaintOverride.maskInput) ? 1 : 0) +
    (hasNonEmptyUrl(inpaintOverride.referenceImageInput) ? 1 : 0);
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
  const localUploadUnitCount = countLocalUploadUnits({ imageInputs, inpaintOverride });
  const normalizedUnitCount = Math.max(1, workUnitCount);
  const timeoutMs = Math.min(
    PREPARE_REFERENCE_TIMEOUT_MAX_MS,
    PREPARE_REFERENCE_TIMEOUT_BASE_MS +
      (normalizedUnitCount - 1) * PREPARE_REFERENCE_TIMEOUT_PER_WORK_UNIT_MS +
      localUploadUnitCount * PREPARE_REFERENCE_TIMEOUT_LOCAL_UPLOAD_BONUS_MS
  );

  return {
    workUnitCount,
    timeoutMs,
  };
};
