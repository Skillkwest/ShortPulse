/**
 * Shared AI Studio error presentation helpers.
 * Keeps compact card/banner copy separate from full technical detail shown in detail surfaces.
 */
import {
  EXPLICIT_CONTENT_FAILURE_DETAIL,
  EXPLICIT_CONTENT_FAILURE_SHORT_MESSAGE,
  isExplicitContentFailureMessage,
  normalizeExplicitContentFailure,
} from "../../../lib/explicitContentFailure";
import {
  normalizeCustomerFacingProviderError,
  normalizeProviderSideGenerationFailure,
  resolveCustomerFacingModelLabel,
} from "../../../lib/customerFacingProviderText";
import { resolveModelLabelById } from "../../../lib/model-runtime/modelCatalog";
import { createShortErrorMessage } from "../hooks/taskPolling/providerStatusPolicy";
import type { StudioOutput } from "../types";

export type AiStudioErrorCategory =
  | "content_policy"
  | "provider_error"
  | "preflight_timeout"
  | "reference_upload"
  | "missing_input"
  | "no_media"
  | "save_error"
  | "unknown";

export type AiStudioErrorPresentation = {
  category: AiStudioErrorCategory;
  modelLabel: string;
  compactMessage: string;
  bannerMessage: string;
  summary: string;
  technicalDetail: string;
  rawPayload: unknown | null;
};

const GENERIC_FAILURE_MESSAGES = new Set([
  "generation failed",
  "generation failed.",
  "invalid request",
  "request failed",
]);

const normalizeComparableText = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const firstPresent = (...values: Array<unknown>): unknown | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (value && typeof value === "object") return value;
  }
  return null;
};

const isGenericFailureMessage = (value: string | null | undefined): boolean => {
  const normalized = normalizeComparableText(value);
  return !normalized || GENERIC_FAILURE_MESSAGES.has(normalized);
};

const stringifyTechnicalPayload = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const resolveCategory = (...values: Array<unknown>): AiStudioErrorCategory => {
  const text = values
    .map((value) => (typeof value === "string" ? value : stringifyTechnicalPayload(value)))
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (isExplicitContentFailureMessage(text)) return "content_policy";
  if (text.includes("content policy") || text.includes("safety system")) return "content_policy";
  if (text.includes("timed out") || text.includes("timeout")) return "preflight_timeout";
  if (text.includes("upload") || text.includes("413") || text.includes("file too large")) {
    return "reference_upload";
  }
  if (text.includes("requires") || text.includes("required")) return "missing_input";
  if (text.includes("no media") || text.includes("without media")) return "no_media";
  if (text.includes("save failed") || text.includes("autosave")) return "save_error";
  if (text.includes("provider") || text.includes("upstream") || text.includes("failed")) {
    return "provider_error";
  }
  return "unknown";
};

const resolveModelLabel = (output: Pick<StudioOutput, "model" | "modelId">): string =>
  resolveCustomerFacingModelLabel({
    model: output.model,
    modelId: output.modelId,
    resolveModelLabel: resolveModelLabelById,
    fallback: "Generation",
  });

export const resolveAiStudioErrorPresentation = (
  output: Pick<
    StudioOutput,
    "model" | "modelId" | "errorMessage" | "errorMessageShort" | "errorDetail" | "errorPayload"
  >
): AiStudioErrorPresentation => {
  const rawPayload = output.errorPayload ?? null;
  const rawCompact =
    !isGenericFailureMessage(output.errorMessageShort) && output.errorMessageShort?.trim()
      ? output.errorMessageShort
      : null;
  const rawMessage = firstPresent(
    rawCompact,
    output.errorMessage,
    output.errorDetail,
    rawPayload,
    "Generation failed"
  );
  const modelLabel = resolveModelLabel(output);
  const normalizedMessage = normalizeCustomerFacingProviderError(rawMessage, "Generation failed");
  const explicitContentFailure = normalizeExplicitContentFailure({
    message: normalizedMessage,
    detail: output.errorDetail ?? output.errorMessage ?? normalizedMessage,
  });
  const category = resolveCategory(
    explicitContentFailure?.errorDetail,
    output.errorDetail,
    output.errorMessage,
    output.errorMessageShort,
    rawPayload
  );
  const summary =
    explicitContentFailure?.errorMessage ??
    normalizeProviderSideGenerationFailure({
      rawFailure: rawMessage,
      normalizedFailure: normalizedMessage,
      modelLabel,
    });
  const compactMessage =
    explicitContentFailure?.errorMessageShort ??
    (rawCompact
      ? normalizeProviderSideGenerationFailure({
          rawFailure: rawCompact,
          normalizedFailure: normalizeCustomerFacingProviderError(rawCompact, rawCompact),
          modelLabel,
        })
      : createShortErrorMessage(summary));
  const bannerMessage =
    explicitContentFailure?.errorDetail ??
    normalizeProviderSideGenerationFailure({
      rawFailure: rawMessage,
      normalizedFailure: normalizedMessage,
      modelLabel,
    });
  const technicalPayload = stringifyTechnicalPayload(rawPayload);
  const technicalDetail =
    explicitContentFailure?.errorDetail ??
    stringifyTechnicalPayload(output.errorDetail) ??
    technicalPayload ??
    stringifyTechnicalPayload(output.errorMessage) ??
    summary;

  return {
    category,
    modelLabel,
    compactMessage:
      category === "content_policy" ? EXPLICIT_CONTENT_FAILURE_SHORT_MESSAGE : compactMessage,
    bannerMessage: category === "content_policy" ? EXPLICIT_CONTENT_FAILURE_DETAIL : bannerMessage,
    summary,
    technicalDetail,
    rawPayload,
  };
};

export const resolveCompactErrorMessage = (
  output: Pick<
    StudioOutput,
    "model" | "modelId" | "errorMessage" | "errorMessageShort" | "errorDetail" | "errorPayload"
  >
): string => resolveAiStudioErrorPresentation(output).compactMessage;

export const resolveBannerErrorMessage = (
  output: Pick<
    StudioOutput,
    "model" | "modelId" | "errorMessage" | "errorMessageShort" | "errorDetail" | "errorPayload"
  >
): string => resolveAiStudioErrorPresentation(output).bannerMessage;

export const resolveTechnicalErrorDetail = (
  output: Pick<
    StudioOutput,
    "model" | "modelId" | "errorMessage" | "errorMessageShort" | "errorDetail" | "errorPayload"
  >
): string => resolveAiStudioErrorPresentation(output).technicalDetail;
