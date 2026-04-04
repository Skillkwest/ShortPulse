/**
 * Provider status parsing and classification policy for AI Studio task polling.
 */
import type { Provider } from "../../logic/stateParsers";
import type { StudioOutput } from "../../types";

export type PollStatus = {
  status?: unknown;
  state?: unknown;
  generationId?: unknown;
  generation_id?: unknown;
  data?: { status?: unknown; state?: unknown; result?: { status?: unknown; state?: unknown } };
  result?: { status?: unknown; state?: unknown };
  output?: { status?: unknown; state?: unknown };
  resultJson?: unknown;
  raw?: unknown;
  error?: unknown;
  failMsg?: unknown;
  failCode?: unknown;
  message?: unknown;
  statusMessage?: unknown;
  detail?: unknown;
};

export const longRunningVideoProviders = new Set<Provider>([
  "fal-kling",
  "fal-kling-3",
  "fal-seedance",
  "fal-seedance-i2v",
  "fal-sora",
  "fal-veo",
  "fal-veo-i2v",
  "kie-veo",
  "kie-kling",
]);

export const nonTerminalStates = new Set([
  "pending",
  "queued",
  "in_queue",
  "in-progress",
  "in_progress",
  "running",
  "processing",
  "starting",
  "submitted",
  "created",
]);

export const terminalSuccessStates = new Set([
  "success",
  "completed",
  "succeeded",
  "done",
  "complete",
  "finished",
]);

export const terminalFailureStates = new Set(["fail", "failed", "error", "cancelled", "canceled"]);

/**
 * Maps provider status values to normalized AI Studio task-state values.
 */
export const normalizeProviderStateToTaskState = (state: string): StudioOutput["taskState"] => {
  if (terminalSuccessStates.has(state)) return "success";
  if (terminalFailureStates.has(state)) return "fail";
  if (nonTerminalStates.has(state)) return "running";
  return "running";
};

/**
 * Condenses long provider errors for top-level UI presentation.
 */
export const condenseError = (message: string) => {
  if (!message) return "";
  const trimmed = message.trim();
  if (trimmed.length <= 80) return trimmed;
  const firstSentenceEnd = trimmed.indexOf(".");
  if (firstSentenceEnd > 0 && firstSentenceEnd < 80) {
    return trimmed.slice(0, firstSentenceEnd + 1);
  }
  return `${trimmed.slice(0, 77)}…`;
};

/**
 * Produces a stable short-form error message for compact surfaces.
 */
export const createShortErrorMessage = (message: string) => {
  if (!message) return "Generation failed";
  const lower = message.toLowerCase();

  if (
    lower.includes("content") &&
    (lower.includes("policy") || lower.includes("checker") || lower.includes("flagged"))
  ) {
    return "Content not allowed";
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Request timed out";
  }

  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Rate limit exceeded";
  }

  if (message.length <= 35) return message;
  return `${message.slice(0, 32)}…`;
};

const PROVIDER_SAFETY_BLOCK_PATTERNS = [
  /\bunsafe\b/i,
  /\bnsfw\b/i,
  /\bexplicit\b/i,
  /\badult\b/i,
  /\bnudity\b/i,
  /\bsexual\b/i,
  /\bmoderation\b/i,
  /\bcontent safety\b/i,
  /\bsafety system\b/i,
  /\bcontent policy\b/i,
];

/**
 * Returns true when a provider failure message indicates a safety/NSFW block.
 */
export const isProviderSafetyBlockMessage = (message: string | null | undefined): boolean => {
  if (typeof message !== "string") return false;
  const normalized = message.trim();
  if (!normalized) return false;
  return PROVIDER_SAFETY_BLOCK_PATTERNS.some((pattern) => pattern.test(normalized));
};

/**
 * Returns true when the output failure should be labeled as NSFW on compact UI surfaces.
 */
export const isProviderSafetyBlockedOutput = (
  output: Pick<StudioOutput, "taskState" | "errorMessage" | "errorMessageShort" | "errorDetail">
): boolean => {
  if (output.taskState !== "fail") return false;
  return (
    isProviderSafetyBlockMessage(output.errorDetail) ||
    isProviderSafetyBlockMessage(output.errorMessage) ||
    isProviderSafetyBlockMessage(output.errorMessageShort)
  );
};

/**
 * Returns whether a value resembles a failure message.
 */
export const looksLikeFailureMessage = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  return /error|fail|denied|invalid|timed out|timeout|insufficient|reject|policy|unsafe|nsfw/i.test(
    value
  );
};

/**
 * Traverses nested payloads to extract the first useful failure message.
 */
export const extractFailureMessageFromDetail = (value: unknown, depth = 0): string | null => {
  if (depth > 3 || value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractFailureMessageFromDetail(item, depth + 1);
      if (nested) return nested;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const direct =
    extractFailureMessageFromDetail(record.msg, depth + 1) ??
    extractFailureMessageFromDetail(record.message, depth + 1) ??
    extractFailureMessageFromDetail(record.error, depth + 1);
  if (direct) return direct;
  return extractFailureMessageFromDetail(record.detail, depth + 1);
};

type ProviderStatusState = {
  state: string;
  hasExplicitState: boolean;
};

/**
 * Derives a normalized provider state from variant status payload shapes.
 */
export const resolveProviderStatusState = (status: PollStatus): ProviderStatusState => {
  const stateRaw =
    status?.status?.toString().toLowerCase() ??
    status?.state?.toString().toLowerCase() ??
    status?.data?.status?.toString().toLowerCase() ??
    status?.data?.state?.toString().toLowerCase() ??
    status?.result?.status?.toString().toLowerCase() ??
    status?.result?.state?.toString().toLowerCase() ??
    status?.output?.status?.toString().toLowerCase() ??
    status?.output?.state?.toString().toLowerCase() ??
    status?.data?.result?.status?.toString().toLowerCase() ??
    status?.data?.result?.state?.toString().toLowerCase() ??
    "pending";
  const state = stateRaw === "succeeded" ? "success" : stateRaw;
  const hasExplicitState =
    status?.status != null ||
    status?.state != null ||
    status?.data?.status != null ||
    status?.data?.state != null ||
    status?.result?.status != null ||
    status?.result?.state != null ||
    status?.output?.status != null ||
    status?.output?.state != null ||
    status?.data?.result?.status != null ||
    status?.data?.result?.state != null;
  return { state, hasExplicitState };
};

export const resolvePollStatusGenerationId = (status: PollStatus): string | null => {
  const readCandidate = (value: unknown): string | null =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  const dataRecord =
    status?.data && typeof status.data === "object"
      ? (status.data as Record<string, unknown>)
      : null;
  const resultRecord =
    status?.result && typeof status.result === "object"
      ? (status.result as Record<string, unknown>)
      : null;
  const outputRecord =
    status?.output && typeof status.output === "object"
      ? (status.output as Record<string, unknown>)
      : null;
  return (
    readCandidate(status?.generationId) ??
    readCandidate(status?.generation_id) ??
    readCandidate(dataRecord?.generationId) ??
    readCandidate(dataRecord?.generation_id) ??
    readCandidate(resultRecord?.generationId) ??
    readCandidate(resultRecord?.generation_id) ??
    readCandidate(outputRecord?.generationId) ??
    readCandidate(outputRecord?.generation_id) ??
    null
  );
};

type ProviderSuccessClassificationInput = {
  state: string;
};

type ProviderSuccessClassification = {
  isTerminalSuccess: boolean;
  shouldTreatAsSuccess: boolean;
};

/**
 * Classifies whether the latest provider status should be treated as success.
 */
export const classifyProviderSuccess = ({
  state,
}: ProviderSuccessClassificationInput): ProviderSuccessClassification => {
  const isTerminalSuccess = terminalSuccessStates.has(state);
  const shouldTreatAsSuccess = isTerminalSuccess;
  return { isTerminalSuccess, shouldTreatAsSuccess };
};
