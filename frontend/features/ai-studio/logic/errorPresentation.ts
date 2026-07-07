/**
 * Shared AI Studio error presentation helpers.
 * Keeps compact card copy separate from plain customer-facing detail surfaces.
 */
import {
  INSUFFICIENT_CREDITS_MESSAGE,
  INSUFFICIENT_CREDITS_TITLE,
  isInsufficientCreditsLike,
} from "./insufficientCredits";
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
  | "admission_limit"
  | "insufficient_credits"
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
const COMPACT_STATUS_CHECK_FAILURE_MESSAGE = "Status check failed.";
const MAX_COMPACT_CARD_MESSAGE_LENGTH = 35;

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

const isNonJsonStatusResponseMessage = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("non-json") &&
    normalized.includes("status") &&
    normalized.includes("response")
  );
};

const resolveCompactProviderMessage = ({
  rawFailure,
  normalizedFailure,
  modelLabel,
}: {
  rawFailure: unknown;
  normalizedFailure: string;
  modelLabel?: string | null;
}): string => {
  if (typeof rawFailure === "string" && isNonJsonStatusResponseMessage(rawFailure)) {
    return COMPACT_STATUS_CHECK_FAILURE_MESSAGE;
  }
  return normalizeProviderSideGenerationFailure({
    rawFailure,
    normalizedFailure,
    modelLabel,
  });
};

const isFieldRequiredMessage = (value: string): boolean =>
  /^[A-Z][A-Za-z0-9 /_-]{0,24} is required\.$/.test(value.trim());

const resolveCategoryCompactMessage = (
  category: AiStudioErrorCategory,
  candidateMessage: string
): string => {
  const shortMessage = createShortErrorMessage(candidateMessage);
  switch (category) {
    case "insufficient_credits":
      return INSUFFICIENT_CREDITS_TITLE;
    case "admission_limit":
      return "Max active generations reached.";
    case "provider_error":
      return "Service issue.";
    case "preflight_timeout":
      return "Request timed out.";
    case "reference_upload":
      return "Upload failed.";
    case "missing_input":
      return isFieldRequiredMessage(shortMessage) ? shortMessage : "Input required.";
    case "no_media":
      return "No media returned.";
    case "save_error":
      return "Save failed.";
    default:
      return shortMessage.length <= MAX_COMPACT_CARD_MESSAGE_LENGTH
        ? shortMessage
        : createShortErrorMessage(shortMessage);
  }
};

const resolveCustomerDetailMessage = ({
  category,
  rawMessage,
  normalizedMessage,
  summary,
  modelLabel,
}: {
  category: AiStudioErrorCategory;
  rawMessage: unknown;
  normalizedMessage: string;
  summary: string;
  modelLabel?: string | null;
}): string => {
  if (typeof rawMessage === "string" && isNonJsonStatusResponseMessage(rawMessage)) {
    return "The generation status check failed. Please try again.";
  }
  if (/\bsigned\s+url\s+expired\b/i.test(normalizedMessage)) {
    return "The reference file expired. Re-add the reference and try again.";
  }
  if (/\bimage_urls?\b/i.test(normalizedMessage)) {
    return "A reference image could not be used. Re-add the reference and try again.";
  }
  switch (category) {
    case "admission_limit":
      return normalizedMessage;
    case "insufficient_credits":
      return INSUFFICIENT_CREDITS_MESSAGE;
    case "provider_error":
      return summary;
    case "preflight_timeout":
      return "Preparing the generation took too long. Please try again.";
    case "reference_upload":
      return "The reference file could not be uploaded. Try a smaller or different file.";
    case "missing_input":
      if (
        /\brequires?\s+(?:at\s+least\s+one\s+)?(?:an?\s+)?image\s+url\b/i.test(normalizedMessage)
      ) {
        const subject = modelLabel?.trim() || "This generation";
        return `${subject} needs an image reference. Add an image and try again.`;
      }
      return normalizedMessage;
    case "no_media":
      return "The generation finished but no media was returned. Please try again.";
    case "save_error":
      return "ShortPulse could not save this item. Please try again.";
    case "unknown":
      return normalizedMessage === "Generation failed"
        ? `${modelLabel?.trim() || "This generation"} failed. Please try again.`
        : normalizedMessage;
    default:
      return normalizedMessage;
  }
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
  if (isInsufficientCreditsLike(text)) return "insufficient_credits";
  if (
    text.includes("max active generations") ||
    text.includes("too many active generations") ||
    text.includes("shared generation capacity") ||
    text.includes("generation admission")
  ) {
    return "admission_limit";
  }
  if (text.includes("content policy") || text.includes("safety system")) return "content_policy";
  if (text.includes("timed out") || text.includes("timeout")) return "preflight_timeout";
  if (text.includes("upload") || text.includes("413") || text.includes("file too large")) {
    return "reference_upload";
  }
  if (text.includes("requires") || text.includes("required")) return "missing_input";
  if (text.includes("no media") || text.includes("without media")) return "no_media";
  if (text.includes("save failed") || text.includes("autosave")) return "save_error";
  if (
    text.includes("provider") ||
    text.includes("upstream") ||
    text.includes("internal error") ||
    text.includes("downstream service")
  ) {
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
  const rawDetailedMessage =
    !isGenericFailureMessage(output.errorMessage) && output.errorMessage?.trim()
      ? output.errorMessage
      : null;
  const rawMessage = firstPresent(
    rawDetailedMessage,
    output.errorDetail,
    rawPayload,
    rawCompact,
    output.errorMessage,
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
    resolveCategoryCompactMessage(
      category,
      rawCompact
        ? resolveCompactProviderMessage({
            rawFailure: rawCompact,
            normalizedFailure: normalizeCustomerFacingProviderError(rawCompact, rawCompact),
            modelLabel,
          })
        : summary
    );
  const customerDetail =
    explicitContentFailure?.errorDetail ??
    resolveCustomerDetailMessage({
      category,
      rawMessage,
      normalizedMessage,
      summary,
      modelLabel,
    });
  const bannerMessage = explicitContentFailure?.errorDetail ?? customerDetail;
  const technicalDetail = explicitContentFailure?.errorDetail ?? customerDetail;

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
