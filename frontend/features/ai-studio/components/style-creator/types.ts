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

export type StyleExtractionTelemetryMetadata = {
  stage?: "prepare" | "extract" | "preview_source";
  sourceUrlKind?: "data" | "url" | "unknown";
  errorClass?: "blocked_source" | "fallback" | "unknown";
  errorMessage?: string;
};

export type StyleExtractionRuntimeResult = {
  outcome: StyleExtractionOutcome;
  sourceUrlKind: "data" | "url" | "unknown";
  stylePrompt?: string;
  styleTitle?: string;
  errorMessage?: string;
};
