/**
 * OpenAI request helpers for describe-image.
 * Encapsulates retries, fallback decisions, and response text extraction.
 */
import { fetchOpenAiCompatibleChatCompletion } from "./openAiCompat";

const OPENAI_TIMEOUT_MS = 25000;
const OPENAI_UPSTREAM_MAX_ATTEMPTS = 2;
const OPENAI_UPSTREAM_RETRY_DELAY_MS = 450;
const MAX_UPSTREAM_DETAIL_LENGTH = 3000;
const TRANSIENT_OPENAI_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export type OpenAiDescribeAttemptResult =
  | {
      ok: true;
      data: Record<string, unknown>;
      model: string;
    }
  | {
      ok: false;
      status: number;
      detail: string;
      model: string;
    };

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

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

const requestOpenAiImageDescribe = async ({
  apiKey,
  model,
  systemPrompt,
  imageUrl,
  userText = "Describe the image exactly as you see it.",
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  imageUrl: string;
  userText?: string;
}): Promise<OpenAiDescribeAttemptResult> => {
  try {
    const response = await fetchOpenAiCompatibleChatCompletion({
      apiKey,
      model,
      openAiApiBase: process.env.OPENAI_API_BASE,
      timeoutMs: OPENAI_TIMEOUT_MS,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    });

    if (!response.ok) {
      const detail = extractUpstreamDetail(await response.text());
      return {
        ok: false,
        status: response.status,
        detail,
        model,
      };
    }

    const parsed = toRecord(await response.json());
    return { ok: true, data: parsed, model };
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return {
      ok: false,
      status: 500,
      detail: trimDetail(detail),
      model,
    };
  }
};

const isTransientOpenAiFailure = (attempt: OpenAiDescribeAttemptResult): boolean => {
  if (attempt.ok) return false;
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

export const requestOpenAiImageDescribeWithRetry = async (params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  imageUrl: string;
  userText?: string;
}): Promise<OpenAiDescribeAttemptResult> => {
  let attempt = await requestOpenAiImageDescribe(params);
  for (
    let retry = 1;
    retry < OPENAI_UPSTREAM_MAX_ATTEMPTS && isTransientOpenAiFailure(attempt);
    retry += 1
  ) {
    await sleep(OPENAI_UPSTREAM_RETRY_DELAY_MS * retry);
    attempt = await requestOpenAiImageDescribe(params);
  }
  return attempt;
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

export const extractImageDescriptionText = (payload: Record<string, unknown>): string | null => {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = toRecord(choices[0]);
  const message = toRecord(firstChoice.message);
  const content = message.content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed.length ? trimmed : null;
  }
  if (!Array.isArray(content)) return null;
  const joined = content
    .map((entry) => toRecord(entry))
    .map((entry) => (typeof entry.text === "string" ? entry.text.trim() : ""))
    .filter((entry) => entry.length > 0)
    .join(" ")
    .trim();
  return joined.length ? joined : null;
};
