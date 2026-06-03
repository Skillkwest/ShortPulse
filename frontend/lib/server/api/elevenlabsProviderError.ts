/**
 * ElevenLabs provider error helpers.
 * Normalizes upstream rate-limit and busy responses so routes can preserve status and retry hints.
 */

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseRetryAfterSeconds = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return Math.max(1, parsed);
    }
  }
  return null;
};

const formatRetryDelaySuffix = (retryAfterSeconds: number | null): string =>
  retryAfterSeconds === null
    ? " Please retry shortly."
    : ` Please retry in ${retryAfterSeconds} seconds.`;

export type ElevenLabsProviderErrorMetadata = {
  code: string | null;
  message: string;
  requestId: string | null;
  retryAfterSeconds: number | null;
  status: number;
  type: string | null;
};

export class ElevenLabsProviderError extends Error {
  status: number;
  retryAfterSeconds: number | null;
  code: string | null;
  type: string | null;
  requestId: string | null;

  constructor(
    message: string,
    {
      status,
      retryAfterSeconds = null,
      code = null,
      type = null,
      requestId = null,
    }: {
      status: number;
      retryAfterSeconds?: number | null;
      code?: string | null;
      type?: string | null;
      requestId?: string | null;
    }
  ) {
    super(message);
    this.name = "ElevenLabsProviderError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.code = code;
    this.type = type;
    this.requestId = requestId;
  }
}

export const readElevenLabsProviderError = (
  error: unknown
): ElevenLabsProviderErrorMetadata | null => {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const status =
    typeof record.status === "number" && Number.isFinite(record.status)
      ? Math.trunc(record.status)
      : null;
  const message = normalizeOptionalString(record.message);
  if (!status || !message) return null;
  return {
    status,
    message,
    retryAfterSeconds: parseRetryAfterSeconds(record.retryAfterSeconds),
    code: normalizeOptionalString(record.code),
    type: normalizeOptionalString(record.type),
    requestId: normalizeOptionalString(record.requestId),
  };
};

export const resolveElevenLabsProviderUserMessage = ({
  code,
  message,
  retryAfterSeconds,
}: Pick<ElevenLabsProviderErrorMetadata, "code" | "message" | "retryAfterSeconds">): string => {
  const normalizedCode = code?.trim().toLowerCase() ?? "";
  const normalizedMessage = message.trim().toLowerCase();

  if (
    normalizedCode === "concurrent_limit_exceeded" ||
    normalizedCode === "too_many_concurrent_requests" ||
    normalizedMessage.includes("too_many_concurrent_requests")
  ) {
    return `The audio provider is at its concurrency limit right now.${formatRetryDelaySuffix(retryAfterSeconds)}`;
  }

  if (normalizedCode === "system_busy" || normalizedMessage.includes("system_busy")) {
    return `The audio provider is busy right now.${formatRetryDelaySuffix(retryAfterSeconds)}`;
  }

  if (normalizedCode === "rate_limit_exceeded") {
    return `The audio provider is rate limiting requests right now.${formatRetryDelaySuffix(retryAfterSeconds)}`;
  }

  return message;
};
