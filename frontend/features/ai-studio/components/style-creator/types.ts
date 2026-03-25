/**
 * Local types for styles-library creator orchestration.
 */
import type {
  StylesLibraryStyleDetails,
  StylesLibraryStyleExtractionFlow,
  StylesLibraryStyleExtractionOutcome,
} from "../../types";

export type StyleExtractionOutcome = StylesLibraryStyleExtractionOutcome;
export type StyleExtractionFlow = StylesLibraryStyleExtractionFlow;

export type PendingStyleEditState = {
  mode: "edit" | "create";
  styleId: string;
  styleTitle: string;
  details: StylesLibraryStyleDetails;
};

export type ResolvedDroppedStylePreview = {
  previewImageUrl: string;
  extractionSourceImageUrl: string;
  promptText: string;
};

export type StyleExtractionFailureClass =
  | "blocked_source"
  | "timeout"
  | "canceled"
  | "network_transient"
  | "upstream_http"
  | "fallback"
  | "unknown";

export type StyleExtractionTelemetryMetadata = {
  stage?: "prepare" | "extract" | "preview_source";
  sourceUrlKind?: "data" | "url" | "unknown";
  failureClass?: StyleExtractionFailureClass;
  errorMessage?: string;
  classifierReason?: string;
  resolutionStage?: "primary" | "server_copy_fallback" | null;
  resolutionReason?: string | null;
  candidateCount?: number | null;
  serverCopyAttempted?: boolean | null;
  attemptCount?: number | null;
  probeMs?: number | null;
  openAiMs?: number | null;
  totalMs?: number | null;
  modelUsed?: string | null;
};

export type StyleExtractionRuntimeResult = {
  outcome: StyleExtractionOutcome;
  sourceUrlKind: "data" | "url" | "unknown";
  stylePrompt?: string;
  styleTitle?: string;
  errorMessage?: string;
  failureClass?: StyleExtractionFailureClass;
  attemptCount?: number | null;
  probeMs?: number | null;
  openAiMs?: number | null;
  totalMs?: number | null;
  modelUsed?: string | null;
};

export type StyleSourceResolutionDiagnosticMetadata = {
  flow: StyleExtractionFlow;
  outcome: "resolved" | "blocked_source";
  resolvedSourceKind?: "file" | "internal" | "external" | null;
  internalPayloadPresent?: boolean | null;
  transferTypes?: string[] | null;
  referenceOrigin?: string | null;
  referenceOutputId?: string | null;
  referenceMediaId?: string | null;
  referenceImageIndex?: number | null;
  referenceSourceSurface?: string | null;
  referenceUrlKind?: string | null;
  referenceRenderUrlKind?: string | null;
  imageUrlKind?: string | null;
  plainTextKind?: string | null;
  resolutionStage?: "primary" | "server_copy_fallback" | null;
  resolutionReason?: string | null;
  candidateCount?: number | null;
  serverCopyAttempted?: boolean | null;
  errorMessage?: string;
};
