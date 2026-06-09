/**
 * Client helper for generating prompt-only Styles Library preview images.
 * Calls the authenticated Styles-owned preview route and normalizes recoverable errors.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";

export type StylePreviewGenerationFailureClass =
  | "timeout"
  | "canceled"
  | "billing"
  | "admission"
  | "upstream_http"
  | "network_transient"
  | "unknown";

export type StylePreviewGenerationResult = {
  previewImageUrl: string;
  modelId: string | null;
  size: string | null;
  quality: string | null;
};

type StylePreviewGenerationErrorDetails = {
  failureClass: StylePreviewGenerationFailureClass;
  userMessage: string;
  statusCode?: number | null;
};

type StylePreviewGenerationError = Error &
  StylePreviewGenerationErrorDetails & {
    code: "STYLE_PREVIEW_GENERATION_CLIENT_ERROR";
  };

const STYLE_PREVIEW_GENERATION_ERROR_CODE = "STYLE_PREVIEW_GENERATION_CLIENT_ERROR";
const STYLE_PREVIEW_GENERATION_TIMEOUT_MS = 90000;
const STYLE_PREVIEW_GENERATION_TIMEOUT_MESSAGE = "Style preview generation timed out.";
const STYLE_PREVIEW_GENERATION_CANCELED_MESSAGE = "Style preview generation was interrupted.";
const STYLE_PREVIEW_GENERATION_TRANSIENT_MESSAGE = "Style preview generation hit a network issue.";
const STYLE_PREVIEW_GENERATION_GENERIC_MESSAGE = "Style preview generation failed.";
const STYLE_PREVIEW_GENERATION_SAFETY_MESSAGE =
  "The preview image was blocked by the safety system.";
const STYLE_PREVIEW_SAFETY_VIOLATIONS_PATTERN = /\bsafety_violations\s*=\s*\[([^\]]*)\]/i;
const STYLE_PREVIEW_SAFETY_REASON_PATTERN = /\breason:\s*([^.!?]+)[.!?]?/i;
const TRANSIENT_ERROR_PATTERN =
  /\b(network|fetch failed|failed to fetch|econnreset|etimedout|eai_again|timeout)\b/i;
const ABORTED_ERROR_PATTERN = /\boperation was aborted\b/i;

const createStylePreviewGenerationError = ({
  failureClass,
  userMessage,
  statusCode,
}: StylePreviewGenerationErrorDetails): StylePreviewGenerationError => {
  const error = new Error(userMessage) as StylePreviewGenerationError;
  error.code = STYLE_PREVIEW_GENERATION_ERROR_CODE;
  error.failureClass = failureClass;
  error.userMessage = userMessage;
  error.statusCode = statusCode ?? null;
  return error;
};

export const isStylePreviewGenerationError = (
  error: unknown
): error is StylePreviewGenerationError => {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === STYLE_PREVIEW_GENERATION_ERROR_CODE;
};

const classifyResponseFailure = ({
  status,
  detail,
}: {
  status: number;
  detail: string | null;
}): StylePreviewGenerationErrorDetails => {
  if (status === 402) {
    return {
      failureClass: "billing",
      userMessage: detail || "Not enough credits to generate the style preview.",
      statusCode: status,
    };
  }
  if (status === 429) {
    return {
      failureClass: "admission",
      userMessage: detail || "Too many generations are running. Retry shortly.",
      statusCode: status,
    };
  }
  return {
    failureClass: "upstream_http",
    userMessage: detail || `Style preview generation failed (${status}).`,
    statusCode: status,
  };
};

const classifyUnknownGenerationError = (
  error: unknown,
  timeoutTriggered: boolean
): Pick<StylePreviewGenerationErrorDetails, "failureClass" | "userMessage"> => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return timeoutTriggered
      ? {
          failureClass: "timeout",
          userMessage: STYLE_PREVIEW_GENERATION_TIMEOUT_MESSAGE,
        }
      : {
          failureClass: "canceled",
          userMessage: STYLE_PREVIEW_GENERATION_CANCELED_MESSAGE,
        };
  }

  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  if (ABORTED_ERROR_PATTERN.test(rawMessage) && !timeoutTriggered) {
    return {
      failureClass: "canceled",
      userMessage: STYLE_PREVIEW_GENERATION_CANCELED_MESSAGE,
    };
  }
  if (TRANSIENT_ERROR_PATTERN.test(rawMessage)) {
    return {
      failureClass: "network_transient",
      userMessage: STYLE_PREVIEW_GENERATION_TRANSIENT_MESSAGE,
    };
  }
  return {
    failureClass: "unknown",
    userMessage: STYLE_PREVIEW_GENERATION_GENERIC_MESSAGE,
  };
};

const normalizeResponseDetail = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const rawDetail =
    (typeof record.details === "string" && record.details.trim()) ||
    (typeof record.detail === "string" && record.detail.trim()) ||
    (typeof record.error === "string" && record.error.trim()) ||
    null;
  if (!rawDetail) return null;

  const safetyMatch = rawDetail.match(STYLE_PREVIEW_SAFETY_VIOLATIONS_PATTERN);
  const safetyReasonMatch = rawDetail.match(STYLE_PREVIEW_SAFETY_REASON_PATTERN);
  if (safetyMatch || /\bsafety\s+(?:system|policy|violation|violations)\b/i.test(rawDetail)) {
    const reasons = (safetyMatch?.[1] ?? safetyReasonMatch?.[1] ?? "")
      .split(/[,\s]+/)
      .map((reason) =>
        reason
          .replace(/["'`]/g, "")
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
      .filter((reason, index, array) => array.indexOf(reason) === index);
    return reasons.length > 0
      ? `${STYLE_PREVIEW_GENERATION_SAFETY_MESSAGE} Reason: ${reasons.join(", ")}.`
      : STYLE_PREVIEW_GENERATION_SAFETY_MESSAGE;
  }

  const detail = sanitizeCustomerFacingProviderText(
    rawDetail,
    STYLE_PREVIEW_GENERATION_GENERIC_MESSAGE
  );
  return detail ? detail.slice(0, 240) : null;
};

/**
 * Generates a compact data-URL preview image for a prompt-only custom style.
 */
export const postGenerateStylePreview = async ({
  styleId,
  styleName,
  stylePrompt,
}: {
  styleId: string;
  styleName: string;
  stylePrompt: string;
}): Promise<StylePreviewGenerationResult> => {
  if (!styleId.trim() || !styleName.trim() || !stylePrompt.trim()) {
    throw new Error("Style id, name, and prompt are required for preview generation.");
  }

  const controller = new AbortController();
  let timeoutTriggered = false;
  const timeoutId = window.setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, STYLE_PREVIEW_GENERATION_TIMEOUT_MS);
  try {
    const response = await fetchWithAuth("/api/ai/generate-style-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ styleId, styleName, stylePrompt }),
      signal: controller.signal,
      shortpulseLogScope: "generation",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw createStylePreviewGenerationError(
        classifyResponseFailure({
          status: response.status,
          detail: normalizeResponseDetail(payload),
        })
      );
    }

    const data = await response.json();
    const previewImageUrl =
      typeof data?.previewImageUrl === "string" ? data.previewImageUrl.trim() : "";
    if (!previewImageUrl.startsWith("data:image/")) {
      throw createStylePreviewGenerationError({
        failureClass: "unknown",
        userMessage: STYLE_PREVIEW_GENERATION_GENERIC_MESSAGE,
      });
    }

    return {
      previewImageUrl,
      modelId: typeof data?.modelId === "string" ? data.modelId : null,
      size: typeof data?.size === "string" ? data.size : null,
      quality: typeof data?.quality === "string" ? data.quality : null,
    };
  } catch (error) {
    throw isStylePreviewGenerationError(error)
      ? error
      : createStylePreviewGenerationError(classifyUnknownGenerationError(error, timeoutTriggered));
  } finally {
    window.clearTimeout(timeoutId);
  }
};
