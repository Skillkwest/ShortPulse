/**
 * Extraction classification helpers for styles-library flows.
 */
import { BLOCKED_STYLE_IMAGE_SOURCE_ERROR } from "./constants";
import type { StyleExtractionOutcome, StyleExtractionRuntimeResult } from "./types";
import { isStyleExtractionError } from "../../logic/styleExtraction";

const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    if (trimmed.length) return trimmed;
  }
  return "unknown_error";
};

/**
 * Detects blocked-source extraction failures.
 */
export const isBlockedStyleSourceError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const normalizedMessage = error.message.trim().toLowerCase();
  return (
    normalizedMessage === BLOCKED_STYLE_IMAGE_SOURCE_ERROR ||
    normalizedMessage.includes("blocks browser access")
  );
};

/**
 * Maps extraction exceptions to deterministic outcome categories.
 */
export const classifyStyleExtractionOutcome = (error: unknown): StyleExtractionOutcome =>
  isBlockedStyleSourceError(error) ? "blocked_source" : "fallback";

/**
 * Builds a normalized extraction runtime result for create/drop flows.
 */
export const buildExtractionFailureResult = (error: unknown): StyleExtractionRuntimeResult => ({
  outcome: classifyStyleExtractionOutcome(error),
  sourceUrlKind: "unknown",
  errorMessage: normalizeErrorMessage(error),
  failureClass: isBlockedStyleSourceError(error)
    ? "blocked_source"
    : isStyleExtractionError(error)
      ? error.failureClass
      : "unknown",
  attemptCount: isStyleExtractionError(error) ? error.attemptCount : null,
  probeMs: isStyleExtractionError(error) ? (error.probeMs ?? null) : null,
  openAiMs: isStyleExtractionError(error) ? (error.openAiMs ?? null) : null,
  totalMs: isStyleExtractionError(error) ? error.totalMs : null,
  modelUsed: isStyleExtractionError(error) ? (error.modelUsed ?? null) : null,
});
