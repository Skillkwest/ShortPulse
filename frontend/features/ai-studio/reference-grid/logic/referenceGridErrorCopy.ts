/**
 * Reference Grid failure-copy policy.
 * Keeps card text deliberately short while fuller explanations stay in banners and detail modals.
 */
import { EXPLICIT_CONTENT_FAILURE_TITLE } from "../../../../lib/explicitContentFailure";
import { isProviderSafetyBlockedOutput } from "../../hooks/taskPolling/providerStatusPolicy";
import {
  INSUFFICIENT_CREDITS_TITLE,
  isInsufficientCreditsLike,
} from "../../logic/insufficientCredits";
import type { StudioOutput } from "../../types";

export const REFERENCE_GRID_GENERIC_ERROR_TITLE = "Generation failed";

type ReferenceGridErrorOutput = Pick<
  StudioOutput,
  "taskState" | "errorMessage" | "errorMessageShort" | "errorDetail" | "errorPayload"
>;

/**
 * Resolves the only error text allowed inside failed Reference Grid cards.
 * Provider/status details must be shown in banners or the detail modal, never in the card.
 */
export const resolveReferenceGridErrorTitle = (output: ReferenceGridErrorOutput): string =>
  isInsufficientCreditsLike(output)
    ? INSUFFICIENT_CREDITS_TITLE
    : isProviderSafetyBlockedOutput(output)
      ? EXPLICIT_CONTENT_FAILURE_TITLE
      : REFERENCE_GRID_GENERIC_ERROR_TITLE;

/**
 * Resolves the visual tone for failed Reference Grid cards.
 */
export const resolveReferenceGridFailureTone = (
  output: ReferenceGridErrorOutput
): "credits" | "error" => (isInsufficientCreditsLike(output) ? "credits" : "error");
