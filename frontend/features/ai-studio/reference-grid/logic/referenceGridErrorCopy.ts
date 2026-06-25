/**
 * Reference Grid failure-copy policy.
 * Keeps card text deliberately short while fuller explanations stay in banners and detail modals.
 */
import { EXPLICIT_CONTENT_FAILURE_TITLE } from "../../../../lib/explicitContentFailure";
import { isProviderSafetyBlockedOutput } from "../../hooks/taskPolling/providerStatusPolicy";
import type { StudioOutput } from "../../types";

export const REFERENCE_GRID_GENERIC_ERROR_TITLE = "Generation failed";

type ReferenceGridErrorOutput = Pick<
  StudioOutput,
  "taskState" | "errorMessage" | "errorMessageShort" | "errorDetail"
>;

/**
 * Resolves the only error text allowed inside failed Reference Grid cards.
 * Provider/status details must be shown in banners or the detail modal, never in the card.
 */
export const resolveReferenceGridErrorTitle = (output: ReferenceGridErrorOutput): string =>
  isProviderSafetyBlockedOutput(output)
    ? EXPLICIT_CONTENT_FAILURE_TITLE
    : REFERENCE_GRID_GENERIC_ERROR_TITLE;
