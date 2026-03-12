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

const normalizeClassifierReason = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized.length) return undefined;
  return normalized.slice(0, 64);
};

/**
 * Emits normalized extraction telemetry with stable metadata keys.
 */
export const trackStyleExtractionOutcome = (
  outcome: StyleExtractionOutcome,
  flow: StyleExtractionFlow,
  metadata?: StyleExtractionTelemetryMetadata
): void => {
  const failureClass = metadata?.failureClass ?? (outcome === "success" ? null : "unknown");
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
      failure_class: failureClass,
      error_class: failureClass,
      classifier_reason: normalizeClassifierReason(metadata?.classifierReason) ?? null,
      attempt_count:
        typeof metadata?.attemptCount === "number" && Number.isFinite(metadata.attemptCount)
          ? Math.max(0, Math.trunc(metadata.attemptCount))
          : null,
      probe_ms:
        typeof metadata?.probeMs === "number" && Number.isFinite(metadata.probeMs)
          ? Math.max(0, Math.trunc(metadata.probeMs))
          : null,
      openai_ms:
        typeof metadata?.openAiMs === "number" && Number.isFinite(metadata.openAiMs)
          ? Math.max(0, Math.trunc(metadata.openAiMs))
          : null,
      total_ms:
        typeof metadata?.totalMs === "number" && Number.isFinite(metadata.totalMs)
          ? Math.max(0, Math.trunc(metadata.totalMs))
          : null,
      model_used:
        typeof metadata?.modelUsed === "string" && metadata.modelUsed.trim().length
          ? metadata.modelUsed.trim().slice(0, 120)
          : null,
      error: normalizeTelemetryError(metadata?.errorMessage) ?? null,
    },
  });
};
