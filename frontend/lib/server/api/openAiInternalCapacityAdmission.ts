/**
 * Owns durable internal-capacity admission for non-priced OpenAI conveniences.
 * This server-only authority never reads or mutates customer credit balances.
 */
import { getSupabaseAdmin } from "./supabaseAdmin";
import { randomUUID } from "node:crypto";
import type { NextApiRequest } from "next";

export type OpenAiInternalEligibility = "paid" | "internal_comp";
export type OpenAiInternalAdmissionStatus =
  | "reserved"
  | "in_progress"
  | "completed"
  | "failed"
  | "expired";

export type OpenAiInternalCapacityUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  requestCount?: number;
  estimatedCostMicrousd?: number;
};

const readUsageInteger = (
  record: Record<string, unknown>,
  ...keys: string[]
): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  }
  return undefined;
};

/** Extracts numeric token usage from Responses, Chat Completions, or normalized route payloads. */
export const extractOpenAiInternalCapacityUsage = (
  payload: unknown
): OpenAiInternalCapacityUsage => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const root = payload as Record<string, unknown>;
  const nested = root.usage;
  const usage =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : root;
  const inputTokens = readUsageInteger(usage, "input_tokens", "prompt_tokens", "inputTokens");
  const outputTokens = readUsageInteger(
    usage,
    "output_tokens",
    "completion_tokens",
    "outputTokens"
  );
  const totalTokens =
    readUsageInteger(usage, "total_tokens", "totalTokens") ??
    (inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : undefined);
  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens }),
  };
};

/** Adds usage from multiple physical calls while retaining only numeric counters. */
export const mergeOpenAiInternalCapacityUsage = (
  current: OpenAiInternalCapacityUsage,
  next: OpenAiInternalCapacityUsage
): OpenAiInternalCapacityUsage => {
  const sum = (left: number | undefined, right: number | undefined): number | undefined =>
    left === undefined && right === undefined ? undefined : (left ?? 0) + (right ?? 0);
  const inputTokens = sum(current.inputTokens, next.inputTokens);
  const outputTokens = sum(current.outputTokens, next.outputTokens);
  const totalTokens = sum(current.totalTokens, next.totalTokens);
  const requestCount = sum(current.requestCount, next.requestCount);
  const estimatedCostMicrousd = sum(current.estimatedCostMicrousd, next.estimatedCostMicrousd);
  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens }),
    ...(requestCount === undefined ? {} : { requestCount }),
    ...(estimatedCostMicrousd === undefined ? {} : { estimatedCostMicrousd }),
  };
};

export type OpenAiInternalCapacityAdmission = {
  id: string;
  userId: string;
  eligibilityKind: OpenAiInternalEligibility;
  routeLane: string;
  sourceRef: string;
  idempotencyKey: string;
  internalBudgetMicrousd: number;
  maxAttempts: number;
  attemptCount: number;
  status: OpenAiInternalAdmissionStatus;
  expiresAt: string;
};

export type OpenAiInternalCapacityLane =
  | "studio_agent.standard"
  | "studio_agent.pulse"
  | "ai.extract_style"
  | "ai.voiceover_enhance";

type AdmissionRow = Record<string, unknown>;

export class OpenAiInternalCapacityError extends Error {
  constructor(
    public readonly status: 402 | 429 | 503,
    public readonly code:
      | "OPENAI_PAID_ACCESS_REQUIRED"
      | "OPENAI_INTERNAL_CAPACITY_EXHAUSTED"
      | "OPENAI_INTERNAL_CAPACITY_UNAVAILABLE",
    message: string
  ) {
    super(message);
    this.name = "OpenAiInternalCapacityError";
  }
}

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const asSafeInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : null;

const parseAdmission = (payload: unknown): OpenAiInternalCapacityAdmission => {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== "object") {
    throw new Error("OpenAI internal-capacity RPC returned an invalid admission.");
  }
  const value = row as AdmissionRow;
  const id = asNonEmptyString(value.id);
  const userId = asNonEmptyString(value.user_id);
  const eligibilityKind = asNonEmptyString(value.eligibility_kind) as OpenAiInternalEligibility;
  const routeLane = asNonEmptyString(value.route_lane);
  const sourceRef = asNonEmptyString(value.source_ref);
  const idempotencyKey = asNonEmptyString(value.idempotency_key);
  const internalBudgetMicrousd = asSafeInteger(value.internal_budget_microusd);
  const maxAttempts = asSafeInteger(value.max_attempts);
  const attemptCount = asSafeInteger(value.attempt_count);
  const status = asNonEmptyString(value.status) as OpenAiInternalAdmissionStatus;
  const expiresAt = asNonEmptyString(value.expires_at);
  if (
    !id ||
    !userId ||
    !["paid", "internal_comp"].includes(eligibilityKind) ||
    !routeLane ||
    !sourceRef ||
    !idempotencyKey ||
    internalBudgetMicrousd === null ||
    maxAttempts === null ||
    attemptCount === null ||
    !["reserved", "in_progress", "completed", "failed", "expired"].includes(status) ||
    !expiresAt
  ) {
    throw new Error("OpenAI internal-capacity RPC returned an invalid admission.");
  }
  return {
    id,
    userId,
    eligibilityKind,
    routeLane,
    sourceRef,
    idempotencyKey,
    internalBudgetMicrousd,
    maxAttempts,
    attemptCount,
    status,
    expiresAt,
  };
};

const callAdmissionRpc = async (
  name: string,
  params: Record<string, unknown>
): Promise<OpenAiInternalCapacityAdmission> => {
  const { data, error } = await getSupabaseAdmin().rpc(name, params);
  if (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Paid OpenAI internal-capacity access is required")) {
      throw new OpenAiInternalCapacityError(
        402,
        "OPENAI_PAID_ACCESS_REQUIRED",
        "Choose a plan to use this AI feature."
      );
    }
    if (message.includes("allowance is exhausted") || message.includes("attempt limit reached")) {
      throw new OpenAiInternalCapacityError(
        429,
        "OPENAI_INTERNAL_CAPACITY_EXHAUSTED",
        "AI capacity is temporarily exhausted. Please retry later."
      );
    }
    throw new OpenAiInternalCapacityError(
      503,
      "OPENAI_INTERNAL_CAPACITY_UNAVAILABLE",
      "AI capacity admission is temporarily unavailable."
    );
  }
  try {
    return parseAdmission(data);
  } catch {
    throw new OpenAiInternalCapacityError(
      503,
      "OPENAI_INTERNAL_CAPACITY_UNAVAILABLE",
      "AI capacity admission is temporarily unavailable."
    );
  }
};

/** Resolves the request-scoped idempotency identity used by admission RPCs. */
export const resolveOpenAiInternalCapacityRequestId = (req: NextApiRequest): string => {
  const header = req.headers?.["x-shortpulse-request-id"];
  if (typeof header === "string" && header.trim()) return header.trim().slice(0, 160);
  return randomUUID();
};

/** Reserves a parent allowance and atomically consumes its first provider attempt. */
export const admitOpenAiInternalCapacityRequest = async ({
  userId,
  lane,
  requestId,
  internalBudgetMicrousd,
  maxAttempts,
}: {
  userId: string;
  lane: OpenAiInternalCapacityLane;
  requestId: string;
  internalBudgetMicrousd: number;
  maxAttempts: number;
}): Promise<OpenAiInternalCapacityAdmission> => {
  const reserved = await reserveOpenAiInternalCapacity({
    userId,
    routeLane: lane,
    sourceRef: requestId,
    idempotencyKey: requestId,
    internalBudgetMicrousd,
    maxAttempts,
  });
  if (
    reserved.status === "completed" ||
    reserved.status === "failed" ||
    reserved.status === "expired"
  ) {
    throw new OpenAiInternalCapacityError(
      429,
      "OPENAI_INTERNAL_CAPACITY_EXHAUSTED",
      "This AI request has already reached a terminal state."
    );
  }
  return beginOpenAiInternalCapacityAttempt({ admissionId: reserved.id, userId });
};

/** Creates or idempotently resolves one bounded internal OpenAI allowance. */
export const reserveOpenAiInternalCapacity = async ({
  userId,
  routeLane,
  sourceRef,
  idempotencyKey,
  internalBudgetMicrousd,
  maxAttempts,
  ttlSeconds = 900,
}: {
  userId: string;
  routeLane: string;
  sourceRef: string;
  idempotencyKey: string;
  internalBudgetMicrousd: number;
  maxAttempts: number;
  ttlSeconds?: number;
}): Promise<OpenAiInternalCapacityAdmission> =>
  callAdmissionRpc("reserve_openai_internal_capacity_admission", {
    p_user_id: userId,
    p_route_lane: routeLane,
    p_source_ref: sourceRef,
    p_idempotency_key: idempotencyKey,
    p_internal_budget_microusd: Math.trunc(internalBudgetMicrousd),
    p_max_attempts: Math.trunc(maxAttempts),
    p_ttl_seconds: Math.trunc(ttlSeconds),
  });

/** Atomically consumes one attempt from an existing parent allowance. */
export const beginOpenAiInternalCapacityAttempt = async ({
  admissionId,
  userId,
}: {
  admissionId: string;
  userId: string;
}): Promise<OpenAiInternalCapacityAdmission> =>
  callAdmissionRpc("begin_openai_internal_capacity_attempt", {
    p_admission_id: admissionId,
    p_user_id: userId,
  });

const sanitizeUsage = (usage: OpenAiInternalCapacityUsage): Record<string, number> => {
  const pairs: Array<[string, number | undefined]> = [
    ["input_tokens", usage.inputTokens],
    ["output_tokens", usage.outputTokens],
    ["total_tokens", usage.totalTokens],
    ["request_count", usage.requestCount],
    ["estimated_cost_microusd", usage.estimatedCostMicrousd],
  ];
  return Object.fromEntries(
    pairs.filter((entry): entry is [string, number] => {
      const value = entry[1];
      return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
    })
  );
};

/** Settles an allowance with numeric-only, non-identifying usage facts. */
export const settleOpenAiInternalCapacity = async ({
  admissionId,
  userId,
  status,
  usage = {},
}: {
  admissionId: string;
  userId: string;
  status: "completed" | "failed";
  usage?: OpenAiInternalCapacityUsage;
}): Promise<OpenAiInternalCapacityAdmission> =>
  callAdmissionRpc("settle_openai_internal_capacity_admission", {
    p_admission_id: admissionId,
    p_user_id: userId,
    p_status: status,
    p_usage: sanitizeUsage(usage),
  });
