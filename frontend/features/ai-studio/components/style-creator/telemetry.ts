/**
 * Telemetry helpers for styles-library extraction outcomes.
 */
import { reportAppError } from "../../../../lib/appErrorReporter";
import { STYLE_EXTRACTION_TELEMETRY_FAMILY, STYLE_EXTRACTION_TELEMETRY_SOURCE } from "./constants";
import type {
  StyleExtractionFlow,
  StyleExtractionOutcome,
  StyleExtractionTelemetryMetadata,
} from "./types";

const normalizeTelemetryError = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed.length) return undefined;
  return trimmed.slice(0, 180);
};

/**
 * Emits normalized extraction telemetry with stable metadata keys.
 */
export const trackStyleExtractionOutcome = (
  outcome: StyleExtractionOutcome,
  flow: StyleExtractionFlow,
  metadata?: StyleExtractionTelemetryMetadata
): void => {
  void reportAppError({
    source: STYLE_EXTRACTION_TELEMETRY_SOURCE,
    scope: "app",
    severity: "low",
    message: `style_extraction.${outcome}`,
    metadata: {
      telemetry_family: STYLE_EXTRACTION_TELEMETRY_FAMILY,
      telemetry_version: 1,
      outcome,
      flow,
      stage: metadata?.stage ?? "extract",
      source_url_kind: metadata?.sourceUrlKind ?? "unknown",
      error_class: metadata?.errorClass ?? (outcome === "success" ? null : "unknown"),
      error: normalizeTelemetryError(metadata?.errorMessage) ?? null,
    },
  });
};
