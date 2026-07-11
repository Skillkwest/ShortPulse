/**
 * OpenAI request helpers for describe-image.
 * Encapsulates retries, fallback decisions, and structured style extraction.
 */
import { fetchOpenAiResponse } from "./openAiCompat";
import { STYLE_PROMPT_MAX_CHARACTERS } from "../../model-runtime/styleCreatorLimits";

const OPENAI_TIMEOUT_MS = 25000;
const OPENAI_UPSTREAM_MAX_ATTEMPTS = 2;
const OPENAI_UPSTREAM_RETRY_DELAY_MS = 450;
const MAX_UPSTREAM_DETAIL_LENGTH = 3000;
const TRANSIENT_OPENAI_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const NON_RETRYABLE_OPENAI_DETAIL_PATTERNS: RegExp[] = [
  /\bparse\/repair\s+failed\b/i,
  /\bcontract\s+violation\b/i,
];

export type OpenAiStructuredStyleAttemptResult =
  | {
      ok: true;
      data: {
        styleTitle: string;
        stylePrompt: string;
      };
      usage: {
        inputTokens?: number;
        outputTokens?: number;
      };
      model: string;
      attemptCount: number;
      elapsedMs: number;
    }
  | {
      ok: false;
      status: number;
      detail: string;
      model: string;
      attemptCount: number;
      elapsedMs: number;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
      };
    };

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const trimDetail = (value: string): string => value.trim().slice(0, MAX_UPSTREAM_DETAIL_LENGTH);

const extractUpstreamDetail = (raw: string): string => {
  const normalized = trimDetail(raw);
  if (!normalized) return "Unknown upstream error.";
  try {
    const parsed = JSON.parse(normalized);
    const parsedRecord = toRecord(parsed);
    const parsedError = toRecord(parsedRecord.error);
    const message =
      (typeof parsedError.message === "string" ? parsedError.message : null) ||
      (typeof parsedRecord.message === "string" ? parsedRecord.message : null);
    return trimDetail(message ?? normalized);
  } catch {
    return normalized;
  }
};

const STYLE_EXTRACTION_JSON_SCHEMA = {
  type: "json_schema",
  name: "style_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      styleTitle: {
        type: "string",
        minLength: 1,
        maxLength: 80,
      },
      stylePrompt: {
        type: "string",
        minLength: 1,
        maxLength: STYLE_PROMPT_MAX_CHARACTERS,
      },
    },
    required: ["styleTitle", "stylePrompt"],
    additionalProperties: false,
  },
} as const;

const extractResponsesUsage = (
  payload: Record<string, unknown>
): {
  inputTokens?: number;
  outputTokens?: number;
} => {
  const usage = toRecord(payload.usage);
  const inputTokens = asNumber(usage.input_tokens) ?? asNumber(usage.prompt_tokens);
  const outputTokens = asNumber(usage.output_tokens) ?? asNumber(usage.completion_tokens);
  return {
    inputTokens,
    outputTokens,
  };
};

const extractResponsesRefusal = (payload: Record<string, unknown>): string | null => {
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const rawItem of output) {
    const item = toRecord(rawItem);
    const content = Array.isArray(item.content) ? item.content : [];
    for (const rawContent of content) {
      const contentRecord = toRecord(rawContent);
      if (contentRecord.type === "refusal") {
        return asString(contentRecord.refusal) ?? "The model refused the request.";
      }
    }
  }
  return null;
};

const extractResponsesText = (payload: Record<string, unknown>): string | null => {
  const directOutputText = asString(payload.output_text);
  if (directOutputText) return directOutputText;

  const output = Array.isArray(payload.output) ? payload.output : [];
  const textParts: string[] = [];

  for (const rawItem of output) {
    const item = toRecord(rawItem);
    const content = Array.isArray(item.content) ? item.content : [];
    for (const rawContent of content) {
      const contentRecord = toRecord(rawContent);
      if (contentRecord.type === "output_text") {
        const text = asString(contentRecord.text);
        if (text) textParts.push(text);
      }
    }
  }

  const joined = textParts.join("\n").trim();
  return joined.length ? joined : null;
};

const extractStructuredStyleData = (
  payload: Record<string, unknown>
):
  | {
      ok: true;
      data: {
        styleTitle: string;
        stylePrompt: string;
      };
    }
  | {
      ok: false;
      detail: string;
    } => {
  const refusal = extractResponsesRefusal(payload);
  if (refusal) {
    return {
      ok: false,
      detail: refusal,
    };
  }

  const directParsed =
    payload.output_parsed &&
    typeof payload.output_parsed === "object" &&
    !Array.isArray(payload.output_parsed)
      ? (payload.output_parsed as Record<string, unknown>)
      : null;
  const parsedPayload = (() => {
    if (directParsed) return directParsed;
    const outputText = extractResponsesText(payload);
    if (!outputText) return null;
    try {
      const parsed = JSON.parse(outputText);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  })();

  if (!parsedPayload) {
    return {
      ok: false,
      detail: "Structured style extraction returned no parseable JSON output.",
    };
  }

  const styleTitle = asString(parsedPayload.styleTitle);
  const stylePrompt = asString(parsedPayload.stylePrompt);
  if (!styleTitle || !stylePrompt) {
    return {
      ok: false,
      detail: "Structured style extraction returned incomplete output.",
    };
  }

  return {
    ok: true,
    data: {
      styleTitle,
      stylePrompt,
    },
  };
};

const isTransientOpenAiFailure = (attempt: OpenAiStructuredStyleAttemptResult): boolean => {
  if (attempt.ok) return false;
  if (NON_RETRYABLE_OPENAI_DETAIL_PATTERNS.some((pattern) => pattern.test(attempt.detail))) {
    return false;
  }
  if (TRANSIENT_OPENAI_STATUS_CODES.has(attempt.status)) return true;
  const detail = attempt.detail.toLowerCase();
  return (
    detail.includes("timeout") ||
    detail.includes("timed out") ||
    detail.includes("network") ||
    detail.includes("fetch failed") ||
    detail.includes("aborterror") ||
    detail.includes("econnreset") ||
    detail.includes("etimedout")
  );
};

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const requestOpenAiStructuredStyleExtraction = async ({
  apiKey,
  model,
  systemPrompt,
  imageDataUrl,
  beforeProviderCall,
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  imageDataUrl: string;
  beforeProviderCall?: () => Promise<void>;
}): Promise<OpenAiStructuredStyleAttemptResult> => {
  const startedAt = Date.now();
  try {
    await beforeProviderCall?.();
    const response = await fetchOpenAiResponse({
      apiKey,
      openAiApiBase: process.env.OPENAI_API_BASE,
      timeoutMs: OPENAI_TIMEOUT_MS,
      body: {
        model,
        store: false,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Analyze this image and extract only reusable visual style descriptors. Keep stylePrompt ${STYLE_PROMPT_MAX_CHARACTERS} characters or fewer. Return the structured result only.`,
              },
              {
                type: "input_image",
                image_url: imageDataUrl,
                detail: "high",
              },
            ],
          },
        ],
        text: {
          format: STYLE_EXTRACTION_JSON_SCHEMA,
        },
      },
    });

    const responseText = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: extractUpstreamDetail(responseText),
        model,
        attemptCount: 1,
        elapsedMs: Date.now() - startedAt,
      };
    }

    let parsedPayload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(responseText);
      parsedPayload = toRecord(parsed);
    } catch {
      return {
        ok: false,
        status: 502,
        detail: "contract violation: structured style extraction returned invalid JSON.",
        model,
        attemptCount: 1,
        elapsedMs: Date.now() - startedAt,
      };
    }

    const extracted = extractStructuredStyleData(parsedPayload);
    const usage = extractResponsesUsage(parsedPayload);
    if (!extracted.ok) {
      return {
        ok: false,
        status: 502,
        detail: `contract violation: ${extracted.detail}`,
        usage,
        model,
        attemptCount: 1,
        elapsedMs: Date.now() - startedAt,
      };
    }

    return {
      ok: true,
      data: extracted.data,
      usage,
      model,
      attemptCount: 1,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return {
      ok: false,
      status: 500,
      detail: trimDetail(detail),
      model,
      attemptCount: 1,
      elapsedMs: Date.now() - startedAt,
    };
  }
};

export const requestOpenAiStructuredStyleExtractionWithRetry = async (params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  imageDataUrl: string;
  beforeProviderCall?: () => Promise<void>;
}): Promise<OpenAiStructuredStyleAttemptResult> => {
  const startedAt = Date.now();
  let attempt = await requestOpenAiStructuredStyleExtraction(params);
  let attemptCount = 1;
  for (
    let retry = 1;
    retry < OPENAI_UPSTREAM_MAX_ATTEMPTS && isTransientOpenAiFailure(attempt);
    retry += 1
  ) {
    await sleep(OPENAI_UPSTREAM_RETRY_DELAY_MS * retry);
    attempt = await requestOpenAiStructuredStyleExtraction(params);
    attemptCount += 1;
  }
  if (attempt.ok) {
    return {
      ...attempt,
      attemptCount,
      elapsedMs: Date.now() - startedAt,
    };
  }
  return {
    ...attempt,
    attemptCount,
    elapsedMs: Date.now() - startedAt,
  };
};

export const shouldRetryWithFallbackVisionModel = ({
  status,
  detail,
  primaryModel,
  fallbackModel,
}: {
  status: number;
  detail: string;
  primaryModel: string;
  fallbackModel: string;
}): boolean => {
  if (status !== 400) return false;
  if (!fallbackModel || fallbackModel === primaryModel) return false;
  const normalized = detail.toLowerCase();
  return (
    normalized.includes("does not support") ||
    normalized.includes("unsupported") ||
    normalized.includes("vision") ||
    normalized.includes("image input") ||
    normalized.includes("multimodal")
  );
};

export const resolveImageDescribeUpstreamFailureSource = (status: number): string => {
  if (status === 429) return "api.image_describe.rate_limited";
  if (status >= 500) return "api.image_describe.upstream_unavailable";
  return "api.image_describe.upstream_error";
};
