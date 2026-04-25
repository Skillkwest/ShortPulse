/**
 * Client-side helper to extract reusable style descriptors from an image.
 * Uses the style extraction system prompt defined in `frontend/lib/agentPromptsConfig.ts`.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

export type StyleExtractionFailureClass =
  | "timeout"
  | "canceled"
  | "network_transient"
  | "upstream_http"
  | "unknown";

export type StyleExtractionResult = {
  stylePrompt: string;
  styleTitle: string;
  attemptCount: number;
  totalMs: number;
  probeMs: number | null;
  openAiMs: number | null;
  modelUsed: string | null;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

/**
 * Keep client timeout budget aligned with server-side extraction runtime.
 * The active path sends image data directly, and the route owns upstream retries.
 */
const STYLE_EXTRACTION_TOTAL_DEADLINE_MS = 95000;
const STYLE_EXTRACTION_REQUEST_TIMEOUT_MS = 58000;
const STYLE_EXTRACTION_TIMEOUT_MESSAGE = "Style extraction timed out. Please retry.";
const STYLE_EXTRACTION_CANCELED_MESSAGE = "Style extraction was interrupted. Please retry.";
const STYLE_EXTRACTION_TRANSIENT_MESSAGE = "Style extraction hit a network issue. Please retry.";
const STYLE_EXTRACTION_GENERIC_MESSAGE = "Style extraction failed. Please retry.";

type StyleExtractionErrorDetails = {
  failureClass: StyleExtractionFailureClass;
  userMessage: string;
  attemptCount: number;
  totalMs: number;
  statusCode?: number | null;
  probeMs?: number | null;
  openAiMs?: number | null;
  modelUsed?: string | null;
};

type StyleExtractionError = Error &
  StyleExtractionErrorDetails & {
    code: "STYLE_EXTRACTION_CLIENT_ERROR";
  };

const STYLE_EXTRACTION_ERROR_CODE = "STYLE_EXTRACTION_CLIENT_ERROR";
const TRANSIENT_ERROR_PATTERN =
  /\b(network|fetch failed|failed to fetch|econnreset|etimedout|eai_again|timeout)\b/i;
const ABORTED_ERROR_PATTERN = /\boperation was aborted\b/i;
const parseIntegerHeader = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;
  return parsed;
};

const readResponseMetrics = (
  response: Response
): {
  attemptCount: number | null;
  probeMs: number | null;
  openAiMs: number | null;
  modelUsed: string | null;
} => {
  const modelRaw = response.headers.get("x-shortpulse-style-model-used");
  const modelUsed = modelRaw?.trim() ? modelRaw.trim() : null;
  return {
    attemptCount: parseIntegerHeader(response.headers.get("x-shortpulse-style-attempt-count")),
    probeMs: parseIntegerHeader(response.headers.get("x-shortpulse-style-probe-ms")),
    openAiMs: parseIntegerHeader(response.headers.get("x-shortpulse-style-openai-ms")),
    modelUsed,
  };
};

const createStyleExtractionError = ({
  failureClass,
  userMessage,
  attemptCount,
  totalMs,
  statusCode,
  probeMs,
  openAiMs,
  modelUsed,
}: StyleExtractionErrorDetails): StyleExtractionError => {
  const error = new Error(userMessage) as StyleExtractionError;
  error.code = STYLE_EXTRACTION_ERROR_CODE;
  error.failureClass = failureClass;
  error.userMessage = userMessage;
  error.attemptCount = attemptCount;
  error.totalMs = totalMs;
  error.statusCode = statusCode ?? null;
  error.probeMs = probeMs ?? null;
  error.openAiMs = openAiMs ?? null;
  error.modelUsed = modelUsed ?? null;
  return error;
};

export const isStyleExtractionError = (error: unknown): error is StyleExtractionError => {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === STYLE_EXTRACTION_ERROR_CODE;
};

const classifyUnknownExtractionError = (
  error: unknown,
  timeoutTriggered: boolean
): {
  failureClass: StyleExtractionFailureClass;
  userMessage: string;
} => {
  if (error instanceof DOMException && error.name === "AbortError") {
    if (timeoutTriggered) {
      return {
        failureClass: "timeout",
        userMessage: STYLE_EXTRACTION_TIMEOUT_MESSAGE,
      };
    }
    return {
      failureClass: "canceled",
      userMessage: STYLE_EXTRACTION_CANCELED_MESSAGE,
    };
  }

  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  if (ABORTED_ERROR_PATTERN.test(rawMessage) && !timeoutTriggered) {
    return {
      failureClass: "canceled",
      userMessage: STYLE_EXTRACTION_CANCELED_MESSAGE,
    };
  }
  if (TRANSIENT_ERROR_PATTERN.test(rawMessage)) {
    return {
      failureClass: "network_transient",
      userMessage: STYLE_EXTRACTION_TRANSIENT_MESSAGE,
    };
  }
  return {
    failureClass: "unknown",
    userMessage: STYLE_EXTRACTION_GENERIC_MESSAGE,
  };
};

export const postExtractStyle = async (imageDataUrl: string): Promise<StyleExtractionResult> => {
  if (!imageDataUrl?.trim()) {
    throw new Error("Image data is required for style extraction.");
  }

  const startedAt = Date.now();
  const timeoutMs = Math.min(
    STYLE_EXTRACTION_REQUEST_TIMEOUT_MS,
    STYLE_EXTRACTION_TOTAL_DEADLINE_MS
  );
  const controller = new AbortController();
  let timeoutTriggered = false;
  const timeoutId = window.setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetchWithAuth("/api/ai/extract-style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl }),
      signal: controller.signal,
      shortpulseLogScope: "generation",
    });
    const responseMetrics = readResponseMetrics(response);
    const totalMs = Date.now() - startedAt;

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const rawDetail =
        (typeof payload?.detail === "string" && payload.detail.trim()) ||
        (typeof payload?.error === "string" && payload.error.trim()) ||
        null;
      const detail = rawDetail?.replace(/\bAbortError\b.*$/i, "").trim();
      throw createStyleExtractionError({
        failureClass: "upstream_http",
        userMessage: detail?.length
          ? detail
          : `Style extraction request failed (${response.status}).`,
        attemptCount:
          responseMetrics.attemptCount && responseMetrics.attemptCount > 0
            ? responseMetrics.attemptCount
            : 1,
        totalMs,
        statusCode: response.status,
        probeMs: responseMetrics.probeMs,
        openAiMs: responseMetrics.openAiMs,
        modelUsed: responseMetrics.modelUsed,
      });
    }

    const data = await response.json();
    const stylePrompt = typeof data?.stylePrompt === "string" ? data.stylePrompt.trim() : null;
    const styleTitle = typeof data?.styleTitle === "string" ? data.styleTitle.trim() : null;
    if (!stylePrompt?.length) {
      throw createStyleExtractionError({
        failureClass: "unknown",
        userMessage: STYLE_EXTRACTION_GENERIC_MESSAGE,
        attemptCount: 1,
        totalMs,
        probeMs: responseMetrics.probeMs,
        openAiMs: responseMetrics.openAiMs,
        modelUsed: responseMetrics.modelUsed,
      });
    }
    if (!styleTitle?.length) {
      throw createStyleExtractionError({
        failureClass: "unknown",
        userMessage: STYLE_EXTRACTION_GENERIC_MESSAGE,
        attemptCount: 1,
        totalMs,
        probeMs: responseMetrics.probeMs,
        openAiMs: responseMetrics.openAiMs,
        modelUsed: responseMetrics.modelUsed,
      });
    }

    return {
      stylePrompt,
      styleTitle,
      attemptCount:
        responseMetrics.attemptCount && responseMetrics.attemptCount > 0
          ? responseMetrics.attemptCount
          : 1,
      totalMs,
      probeMs: responseMetrics.probeMs,
      openAiMs: responseMetrics.openAiMs,
      modelUsed: responseMetrics.modelUsed,
      usage: data?.usage,
    };
  } catch (error) {
    const totalMs = Date.now() - startedAt;
    throw isStyleExtractionError(error)
      ? error
      : createStyleExtractionError({
          ...classifyUnknownExtractionError(error, timeoutTriggered),
          attemptCount: 1,
          totalMs,
        });
  } finally {
    window.clearTimeout(timeoutId);
  }
};
