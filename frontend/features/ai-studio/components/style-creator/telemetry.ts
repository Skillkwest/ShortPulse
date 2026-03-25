/**
 * Telemetry helpers for styles-library extraction outcomes.
 */
import { reportAppError } from "../../../../lib/appErrorReporter";
import {
  STYLE_EXTRACTION_TELEMETRY_FAMILY,
  STYLE_EXTRACTION_TELEMETRY_SOURCE,
  STYLE_SOURCE_RESOLUTION_TELEMETRY_FAMILY,
  STYLE_SOURCE_RESOLUTION_TELEMETRY_SOURCE,
} from "./constants";
import type {
  StyleExtractionFlow,
  StyleExtractionOutcome,
  StyleExtractionTelemetryMetadata,
  StyleSourceResolutionDiagnosticMetadata,
} from "./types";

type StyleSourceResolutionCaptureEntry = {
  capture_version: string;
  capturedAt: string;
  flow: StyleExtractionFlow;
  outcome: "resolved" | "blocked_source";
  resolved_source_kind: "file" | "internal" | "external" | null;
  internal_payload_present: boolean | null;
  internal_drag_token_present: boolean | null;
  raw_snapshot_seed_count: number | null;
  transfer_types: string[] | null;
  reference_origin: string | null;
  reference_output_id: string | null;
  reference_media_id: string | null;
  reference_image_index: number | null;
  reference_source_surface: string | null;
  reference_url_kind: string | null;
  reference_render_url_kind: string | null;
  image_url_kind: string | null;
  plain_text_kind: string | null;
  resolution_stage: "primary" | "server_copy_fallback" | null;
  resolution_reason: string | null;
  candidate_count: number | null;
  server_copy_attempted: boolean | null;
  error: string | null;
};

type StyleSourceResolutionDebugHandle = {
  version: string;
  snapshot: () => StyleSourceResolutionCaptureEntry[];
  latest: () => StyleSourceResolutionCaptureEntry | null;
  clear: () => void;
};

const STYLE_SOURCE_RESOLUTION_CAPTURE_LIMIT = 12;
const STYLE_SOURCE_RESOLUTION_CAPTURE_VERSION = "style-source-resolution-v2";
const styleSourceResolutionCaptureBuffer: StyleSourceResolutionCaptureEntry[] = [];

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

const normalizeResolutionReason = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized.length) return undefined;
  return normalized.slice(0, 64);
};

const normalizeTransferTypes = (value: string[] | null | undefined): string[] | null => {
  if (!Array.isArray(value)) return null;
  const next = value
    .map((item) =>
      typeof item === "string"
        ? item
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9/_+.-]+/g, "_")
            .slice(0, 80)
        : ""
    )
    .filter(Boolean);
  return next.length ? next : null;
};

const normalizeTelemetryValue = (
  value: string | null | undefined,
  maxLength = 120
): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.slice(0, maxLength) : null;
};

const normalizeCaptureEntry = (
  metadata: StyleSourceResolutionDiagnosticMetadata
): StyleSourceResolutionCaptureEntry => ({
  capture_version: STYLE_SOURCE_RESOLUTION_CAPTURE_VERSION,
  capturedAt: new Date().toISOString(),
  flow: metadata.flow,
  outcome: metadata.outcome,
  resolved_source_kind: metadata.resolvedSourceKind ?? null,
  internal_payload_present:
    typeof metadata.internalPayloadPresent === "boolean" ? metadata.internalPayloadPresent : null,
  internal_drag_token_present:
    typeof metadata.internalDragTokenPresent === "boolean"
      ? metadata.internalDragTokenPresent
      : null,
  raw_snapshot_seed_count:
    typeof metadata.rawSnapshotSeedCount === "number" &&
    Number.isFinite(metadata.rawSnapshotSeedCount)
      ? Math.max(0, Math.trunc(metadata.rawSnapshotSeedCount))
      : null,
  transfer_types: normalizeTransferTypes(metadata.transferTypes),
  reference_origin: normalizeTelemetryValue(metadata.referenceOrigin, 80),
  reference_output_id: normalizeTelemetryValue(metadata.referenceOutputId, 120),
  reference_media_id: normalizeTelemetryValue(metadata.referenceMediaId, 120),
  reference_image_index:
    typeof metadata.referenceImageIndex === "number" &&
    Number.isFinite(metadata.referenceImageIndex)
      ? Math.max(0, Math.trunc(metadata.referenceImageIndex))
      : null,
  reference_source_surface: normalizeTelemetryValue(metadata.referenceSourceSurface, 80),
  reference_url_kind: normalizeTelemetryValue(metadata.referenceUrlKind, 80),
  reference_render_url_kind: normalizeTelemetryValue(metadata.referenceRenderUrlKind, 80),
  image_url_kind: normalizeTelemetryValue(metadata.imageUrlKind, 80),
  plain_text_kind: normalizeTelemetryValue(metadata.plainTextKind, 80),
  resolution_stage:
    metadata.resolutionStage === "primary" || metadata.resolutionStage === "server_copy_fallback"
      ? metadata.resolutionStage
      : null,
  resolution_reason: normalizeResolutionReason(metadata.resolutionReason) ?? null,
  candidate_count:
    typeof metadata.candidateCount === "number" && Number.isFinite(metadata.candidateCount)
      ? Math.max(0, Math.trunc(metadata.candidateCount))
      : null,
  server_copy_attempted:
    typeof metadata.serverCopyAttempted === "boolean" ? metadata.serverCopyAttempted : null,
  error: normalizeTelemetryError(metadata.errorMessage) ?? null,
});

const clearStyleSourceResolutionCaptures = (): void => {
  styleSourceResolutionCaptureBuffer.length = 0;
};

const getStyleSourceResolutionCaptures = (): StyleSourceResolutionCaptureEntry[] => [
  ...styleSourceResolutionCaptureBuffer,
];

const installStyleSourceResolutionDebugHandle = (): void => {
  if (typeof window === "undefined") return;
  if (window.__shortpulseStyleSourceResolution) return;
  window.__shortpulseStyleSourceResolution = {
    version: STYLE_SOURCE_RESOLUTION_CAPTURE_VERSION,
    snapshot: getStyleSourceResolutionCaptures,
    latest: () =>
      styleSourceResolutionCaptureBuffer.length
        ? styleSourceResolutionCaptureBuffer[styleSourceResolutionCaptureBuffer.length - 1]
        : null,
    clear: clearStyleSourceResolutionCaptures,
  };
};

const recordStyleSourceResolutionCapture = (
  metadata: StyleSourceResolutionDiagnosticMetadata
): void => {
  const entry = normalizeCaptureEntry(metadata);
  styleSourceResolutionCaptureBuffer.push(entry);
  if (styleSourceResolutionCaptureBuffer.length > STYLE_SOURCE_RESOLUTION_CAPTURE_LIMIT) {
    styleSourceResolutionCaptureBuffer.splice(
      0,
      styleSourceResolutionCaptureBuffer.length - STYLE_SOURCE_RESOLUTION_CAPTURE_LIMIT
    );
  }
  installStyleSourceResolutionDebugHandle();
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
      resolution_stage:
        metadata?.resolutionStage === "primary" ||
        metadata?.resolutionStage === "server_copy_fallback"
          ? metadata.resolutionStage
          : null,
      resolution_reason: normalizeResolutionReason(metadata?.resolutionReason) ?? null,
      candidate_count:
        typeof metadata?.candidateCount === "number" && Number.isFinite(metadata.candidateCount)
          ? Math.max(0, Math.trunc(metadata.candidateCount))
          : null,
      server_copy_attempted:
        typeof metadata?.serverCopyAttempted === "boolean" ? metadata.serverCopyAttempted : null,
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

/**
 * Emits diagnostic telemetry for style source-resolution packet capture.
 */
export const trackStyleSourceResolutionDiagnostic = (
  metadata: StyleSourceResolutionDiagnosticMetadata
): void => {
  recordStyleSourceResolutionCapture(metadata);
  void reportAppError({
    source: STYLE_SOURCE_RESOLUTION_TELEMETRY_SOURCE,
    scope: "app",
    severity: "low",
    message: `style_source_resolution.${metadata.outcome}`,
    metadata: {
      telemetry_family: STYLE_SOURCE_RESOLUTION_TELEMETRY_FAMILY,
      telemetry_version: 1,
      flow: metadata.flow,
      outcome: metadata.outcome,
      resolved_source_kind: metadata.resolvedSourceKind ?? null,
      internal_payload_present:
        typeof metadata.internalPayloadPresent === "boolean"
          ? metadata.internalPayloadPresent
          : null,
      internal_drag_token_present:
        typeof metadata.internalDragTokenPresent === "boolean"
          ? metadata.internalDragTokenPresent
          : null,
      raw_snapshot_seed_count:
        typeof metadata.rawSnapshotSeedCount === "number" &&
        Number.isFinite(metadata.rawSnapshotSeedCount)
          ? Math.max(0, Math.trunc(metadata.rawSnapshotSeedCount))
          : null,
      transfer_types: normalizeTransferTypes(metadata.transferTypes),
      reference_origin: normalizeTelemetryValue(metadata.referenceOrigin, 80),
      reference_output_id: normalizeTelemetryValue(metadata.referenceOutputId, 120),
      reference_media_id: normalizeTelemetryValue(metadata.referenceMediaId, 120),
      reference_image_index:
        typeof metadata.referenceImageIndex === "number" &&
        Number.isFinite(metadata.referenceImageIndex)
          ? Math.max(0, Math.trunc(metadata.referenceImageIndex))
          : null,
      reference_source_surface: normalizeTelemetryValue(metadata.referenceSourceSurface, 80),
      reference_url_kind: normalizeTelemetryValue(metadata.referenceUrlKind, 80),
      reference_render_url_kind: normalizeTelemetryValue(metadata.referenceRenderUrlKind, 80),
      image_url_kind: normalizeTelemetryValue(metadata.imageUrlKind, 80),
      plain_text_kind: normalizeTelemetryValue(metadata.plainTextKind, 80),
      resolution_stage:
        metadata.resolutionStage === "primary" ||
        metadata.resolutionStage === "server_copy_fallback"
          ? metadata.resolutionStage
          : null,
      resolution_reason: normalizeResolutionReason(metadata.resolutionReason) ?? null,
      candidate_count:
        typeof metadata.candidateCount === "number" && Number.isFinite(metadata.candidateCount)
          ? Math.max(0, Math.trunc(metadata.candidateCount))
          : null,
      server_copy_attempted:
        typeof metadata.serverCopyAttempted === "boolean" ? metadata.serverCopyAttempted : null,
      error: normalizeTelemetryError(metadata.errorMessage) ?? null,
    },
  });
};

declare global {
  interface Window {
    __shortpulseStyleSourceResolution?: StyleSourceResolutionDebugHandle;
  }
}
