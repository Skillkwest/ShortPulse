/**
 * AI Studio Agent API: brokers chat+vision requests to the configured LLM.
 * Keeps system prompt and context handling server-side to protect keys and size limits.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "node:crypto";
import { loadAgentPrompt } from "../../../lib/agentPromptLoader";
import type {
  AgentActions,
  AgentContext,
  AgentMessage,
  AgentResponse,
} from "../../../prefabs/agent";
import {
  isExplicitEditRequest,
  preservesContext,
  resolveCanonicalPrompt,
  shouldRetryExplicitNoOp,
} from "../../../features/ai-agent/logic/studioAgentCanonical";
import {
  removeAspectRatioLanguage,
  sanitizeGenerationPromptText,
} from "../../../features/ai-studio/logic/agentPromptOwnership";
import { pickSelectedReferencesForThinker } from "../../../features/ai-agent/logic/studioAgentReferenceSelection";
import { buildStudioAgentOrchestration } from "../../../features/ai-agent/logic/studioAgentOrchestration";
import { runThinkerFormatterTurn } from "../../../features/ai-agent/logic/studioAgentThinkerFormatter";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import {
  clampCanonicalPrompt,
  readAgentConversationCanonicalPrompt,
  upsertAgentConversationCanonicalPrompt,
} from "../../../lib/server/api/agentConversationState";

const OPENAI_URL =
  (process.env.OPENAI_API_BASE || "https://api.openai.com/v1") + "/chat/completions";
const DEFAULT_MODEL = "gpt-5-nano";
const DEFAULT_VISION_MODEL = "gpt-5-nano";
const DEFAULT_TIMEOUT_MS = 20000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 120000;
const MAX_MESSAGES = 24;
const MAX_MEDIA = 3;
const AGENT_CONTRACT_VERSION = "1";
const MAX_TEXT_REQUEST_BYTES = 512 * 1024;
const MAX_MIXED_REQUEST_BYTES = 1536 * 1024;
const SESSION_KEY_MAX_CHARS = 160;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 24;
const RATE_LIMIT_MAX_TRACKED_USERS = 5000;

type OpenAIChatMessage =
  | { role: "system" | "assistant" | "user"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" } }
      >;
    };

type ParsedAgentJson = {
  response: AgentResponse;
  status: string | null;
};

type StudioAgentErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "AGENT_DISABLED"
  | "INVALID_REQUEST"
  | "INVALID_SESSION_KEY"
  | "INVALID_MESSAGE_ROLE"
  | "REQUEST_BODY_TOO_LARGE"
  | "RATE_LIMITED"
  | "MESSAGES_REQUIRED";

type StudioAgentErrorResponse = {
  code: StudioAgentErrorCode;
  message: string;
  details?: Record<string, unknown>;
  traceId: string;
};

type RateLimitBucket = {
  timestamps: number[];
  lastSeenAt: number;
};

const requestTimestampsByUser = new Map<string, RateLimitBucket>();

const resolveTraceId = (req: NextApiRequest): string => {
  const headerTraceId = req.headers?.["x-shortpulse-request-id"];
  if (typeof headerTraceId === "string" && headerTraceId.trim().length) {
    return headerTraceId.trim().slice(0, 128);
  }

  const bodyTraceId =
    typeof req.body?.traceId === "string" && req.body.traceId.trim().length
      ? req.body.traceId.trim()
      : null;
  if (bodyTraceId) return bodyTraceId.slice(0, 128);
  return randomUUID();
};

const setContractHeaders = (res: NextApiResponse, traceId: string): void => {
  res.setHeader("Agent-Contract-Version", AGENT_CONTRACT_VERSION);
  res.setHeader("x-agent-trace-id", traceId);
};

const sendError = (res: NextApiResponse, status: number, payload: StudioAgentErrorResponse) =>
  res.status(status).json(payload);

const readRequestBodyBytes = (body: unknown): number => {
  try {
    return Buffer.byteLength(JSON.stringify(body ?? {}), "utf8");
  } catch {
    return 0;
  }
};

const pruneRateLimitBuckets = (): void => {
  if (requestTimestampsByUser.size <= RATE_LIMIT_MAX_TRACKED_USERS) return;
  const excess = requestTimestampsByUser.size - RATE_LIMIT_MAX_TRACKED_USERS;
  const bucketsByLastSeen = [...requestTimestampsByUser.entries()].sort(
    (a, b) => a[1].lastSeenAt - b[1].lastSeenAt
  );
  for (let index = 0; index < excess; index += 1) {
    const oldestUserId = bucketsByLastSeen[index]?.[0];
    if (!oldestUserId) break;
    requestTimestampsByUser.delete(oldestUserId);
  }
};

const isRateLimited = (userId: string): boolean => {
  pruneRateLimitBuckets();
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const bucket = requestTimestampsByUser.get(userId);
  const history = (bucket?.timestamps ?? []).filter((value) => value >= windowStart);
  if (history.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestTimestampsByUser.set(userId, {
      timestamps: history,
      lastSeenAt: now,
    });
    return true;
  }
  history.push(now);
  requestTimestampsByUser.set(userId, {
    timestamps: history,
    lastSeenAt: now,
  });
  return false;
};

const parseMessages = (
  rawMessages: unknown
):
  | { ok: true; messages: AgentMessage[] }
  | {
      ok: false;
      code: StudioAgentErrorCode;
      message: string;
      details?: Record<string, unknown>;
    } => {
  if (!Array.isArray(rawMessages)) {
    return { ok: false, code: "MESSAGES_REQUIRED", message: "messages are required" };
  }
  const parsed: AgentMessage[] = [];
  for (let index = 0; index < rawMessages.length; index += 1) {
    const item = rawMessages[index];
    if (!item || typeof item !== "object") continue;
    const role = (item as AgentMessage).role;
    const content = (item as AgentMessage).content;
    if (role !== "user" && role !== "assistant") {
      return {
        ok: false,
        code: "INVALID_MESSAGE_ROLE",
        message: "Only user and assistant roles are allowed",
        details: {
          index,
          role,
          allowedRoles: ["user", "assistant"],
        },
      };
    }
    if (!content || typeof content !== "string") continue;
    parsed.push({ role, content });
  }
  return { ok: true, messages: parsed.slice(-MAX_MESSAGES) };
};

const safeContext = (context?: AgentContext): AgentContext => {
  if (!context) return {};
  const media =
    context.media
      ?.filter((item) => {
        if (item?.kind && item.kind !== "image") return false;
        const isHttpsUrl = typeof item?.url === "string" && item.url.startsWith("https://");
        return isHttpsUrl;
      })
      .slice(0, MAX_MEDIA) ?? [];

  return {
    activePrompt: sanitizeGenerationPromptText(context.activePrompt ?? null),
    modelId: context.modelId ?? null,
    mode: context.mode,
    creditBalance: context.creditBalance ?? null,
    references: Array.isArray(context.references)
      ? context.references.slice(0, 24).map((reference) => ({
          ...reference,
          promptSnippet: removeAspectRatioLanguage(reference.promptSnippet ?? null),
          caption: removeAspectRatioLanguage(reference.caption ?? null),
        }))
      : [],
    media,
    selectedReferenceIds: Array.isArray(context.selectedReferenceIds)
      ? context.selectedReferenceIds.slice(0, 8)
      : [],
    focusedSource: context.focusedSource ?? undefined,
    focusedReferenceId: context.focusedReferenceId ?? null,
    lastAssistantMessage: sanitizeGenerationPromptText(context.lastAssistantMessage ?? null),
    modeHint: context.modeHint ?? undefined,
  };
};

const buildOpenAiMessages = (
  messages: AgentMessage[],
  context: AgentContext,
  systemPrompt: string,
  orchestration?: Record<string, unknown>
): OpenAIChatMessage[] => {
  const chat: OpenAIChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: `CONTEXT:\n${JSON.stringify(context)}` },
  ];
  if (orchestration) {
    chat.push({ role: "system", content: `ORCHESTRATION:\n${JSON.stringify(orchestration)}` });
  }

  if (context.lastAssistantMessage) {
    chat.push({ role: "assistant", content: context.lastAssistantMessage });
  }

  if (context.media && context.media.length) {
    chat.push({
      role: "user",
      content: [
        { type: "text", text: "Here are media previews (downscaled):" },
        ...context.media.map((item) => ({
          type: "image_url" as const,
          image_url: {
            url: item.url as string,
            detail: "low" as const,
          },
        })),
      ],
    });
  }

  messages.forEach((message) => {
    const role: "user" | "assistant" = message.role === "assistant" ? "assistant" : "user";
    chat.push({
      role,
      content: message.content,
    });
  });
  return chat;
};

const buildThinkerMessages = (payload: unknown, prompt: string): OpenAIChatMessage[] => [
  { role: "system", content: prompt },
  { role: "user", content: JSON.stringify(payload) },
];

const buildFormatterMessages = (semantic: unknown, prompt: string): OpenAIChatMessage[] => [
  { role: "system", content: prompt },
  { role: "user", content: JSON.stringify(semantic) },
];

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
  );
  return cleaned.length ? cleaned : undefined;
};

const asReferenceCard = (value: unknown): AgentActions["referenceCard"] | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.prompt !== "string" || !record.prompt.trim()) return undefined;
  return {
    title: typeof record.title === "string" ? record.title : undefined,
    prompt: record.prompt,
  };
};

const normalizeAgentActions = (value: unknown): AgentResponse["actions"] => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const applyPrompt =
    typeof record.applyPrompt === "string"
      ? record.applyPrompt
      : typeof record.apply_prompt === "string"
        ? record.apply_prompt
        : undefined;

  const cleanedApplyPrompt = sanitizeGenerationPromptText(applyPrompt ?? null) ?? undefined;

  const normalized = {
    applyPrompt: cleanedApplyPrompt,
    variations:
      asStringArray(record.variations)
        ?.map((variation) => sanitizeGenerationPromptText(variation))
        .filter((variation): variation is string => Boolean(variation)) ?? undefined,
    describeTargets: asStringArray(record.describeTargets ?? record.describe_targets),
    referenceCard: (() => {
      const card = asReferenceCard(record.referenceCard);
      if (!card) return undefined;
      const prompt = sanitizeGenerationPromptText(card.prompt ?? null);
      if (!prompt) return undefined;
      return { ...card, prompt };
    })(),
  };

  if (
    !normalized.applyPrompt &&
    !normalized.variations &&
    !normalized.describeTargets &&
    !normalized.referenceCard
  ) {
    return undefined;
  }

  return normalized;
};

const normalizeCompletionText = (rawContent: unknown): string => {
  if (typeof rawContent === "string") return rawContent;
  if (!Array.isArray(rawContent)) return "";
  return rawContent
    .map((part) => {
      const record = part && typeof part === "object" ? (part as Record<string, unknown>) : {};
      return typeof record.text === "string" ? record.text : "";
    })
    .join("\n")
    .trim();
};

const parseAgentJsonWithStatus = (raw: unknown): ParsedAgentJson | null => {
  const candidates: string[] = [];
  const trimmed = normalizeCompletionText(raw).trim();
  if (trimmed) candidates.push(trimmed);
  const braceMatch = trimmed.match(/{[\s\S]*}/);
  if (braceMatch) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== "object") continue;
      const parsedRecord = parsed as Record<string, unknown>;
      const message =
        typeof parsedRecord.message === "string"
          ? (sanitizeGenerationPromptText(parsedRecord.message) ?? "")
          : "";
      const actions = normalizeAgentActions(parsedRecord.actions);
      const usageRecord =
        parsedRecord.usage && typeof parsedRecord.usage === "object"
          ? (parsedRecord.usage as Record<string, unknown>)
          : null;
      const usage = usageRecord
        ? {
            inputTokens:
              typeof usageRecord.inputTokens === "number"
                ? usageRecord.inputTokens
                : typeof usageRecord.input_tokens === "number"
                  ? usageRecord.input_tokens
                  : undefined,
            outputTokens:
              typeof usageRecord.outputTokens === "number"
                ? usageRecord.outputTokens
                : typeof usageRecord.output_tokens === "number"
                  ? usageRecord.output_tokens
                  : undefined,
          }
        : undefined;
      const status = typeof parsedRecord.status === "string" ? parsedRecord.status : null;
      return {
        response: { message, actions, usage },
        status,
      };
    } catch {
      continue;
    }
  }
  return null;
};

const parseAgentJson = (raw: unknown): AgentResponse | null =>
  parseAgentJsonWithStatus(raw)?.response ?? null;

const extractCompletionText = (rawContent: unknown): string => {
  if (typeof rawContent === "string") return rawContent;
  if (!Array.isArray(rawContent)) return "";
  return rawContent
    .map((part) => {
      const record = part && typeof part === "object" ? (part as Record<string, unknown>) : {};
      return typeof record.text === "string" ? record.text : "";
    })
    .join("\n")
    .trim();
};

const fetchOpenAiChatCompletion = async ({
  apiKey,
  model,
  messages,
  timeoutMs,
}: {
  apiKey: string;
  model: string;
  messages: unknown[];
  timeoutMs: number;
}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const withTimeoutMessage = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "OpenAI request timed out";
  }
  return error instanceof Error ? error.message : String(error);
};

const parseRequestTimeoutMs = (value: string | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  const rounded = Math.trunc(parsed);
  if (rounded < MIN_TIMEOUT_MS) return MIN_TIMEOUT_MS;
  if (rounded > MAX_TIMEOUT_MS) return MAX_TIMEOUT_MS;
  return rounded;
};

const resolveModelEnv = (candidate: string | undefined, fallback: string): string => {
  const trimmed = candidate?.trim();
  return trimmed && trimmed.length ? trimmed : fallback;
};

const buildImageSummaryMap = async ({
  context,
  imageDescribePrompt,
  apiKey,
  visionModel,
  timeoutMs,
}: {
  context: AgentContext;
  imageDescribePrompt: string;
  apiKey: string;
  visionModel: string;
  timeoutMs: number;
}): Promise<Map<string, string>> => {
  const mediaItems = (context.media ?? [])
    .filter((item) => item.kind === "image")
    .slice(0, MAX_MEDIA);
  if (!mediaItems.length) return new Map();

  const summaries = await Promise.allSettled(
    mediaItems.map(async (item) => {
      const imageUrl = item.url ?? "";
      if (!imageUrl) return null;
      const response = await fetchOpenAiChatCompletion({
        apiKey,
        model: visionModel,
        timeoutMs,
        messages: [
          { role: "system", content: imageDescribePrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Describe the image exactly as you see it." },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      const rawText = extractCompletionText(data?.choices?.[0]?.message?.content);
      const cleaned = sanitizeGenerationPromptText(rawText) ?? "";
      const summary = cleaned.trim();
      if (!summary.length) return null;
      return { id: item.id, summary };
    })
  );

  const summaryMap = new Map<string, string>();
  summaries.forEach((result) => {
    if (result.status !== "fulfilled" || !result.value?.id || !result.value.summary) return;
    summaryMap.set(result.value.id, result.value.summary);
  });
  return summaryMap;
};

const applyVisionSummariesToContext = (
  context: AgentContext,
  summaryByReferenceId: Map<string, string>
): AgentContext => {
  if (!summaryByReferenceId.size) return context;
  const references = (context.references ?? []).map((reference) => {
    if (reference.kind !== "image") return reference;
    const summary = summaryByReferenceId.get(reference.id);
    if (!summary) return reference;
    const mergedCaption = [summary, reference.caption ?? null]
      .filter(
        (value, index, all): value is string => Boolean(value) && all.indexOf(value) === index
      )
      .join("\n\n");
    return {
      ...reference,
      promptSnippet: summary,
      caption: mergedCaption || summary,
    };
  });

  const media = (context.media ?? []).map((item) => {
    if (item.kind !== "image") return item;
    const summary = summaryByReferenceId.get(item.id);
    if (!summary) return item;
    return {
      ...item,
      thumbnailAlt: summary,
    };
  });

  return {
    ...context,
    references,
    media,
  };
};

const isRefusalResponse = ({
  status,
  response,
}: {
  status: string | null;
  response: AgentResponse;
}): boolean => {
  if (status?.toLowerCase() === "refuse") return true;
  const hasApplyPrompt = Boolean(response.actions?.applyPrompt?.trim());
  if (hasApplyPrompt) return false;
  const message = response.message?.trim() ?? "";
  if (!message.length) return false;
  return /(^|\s)(cannot|can't|unable|refuse|won't|not able)\b/i.test(message);
};

const ensureApplyPromptContract = ({
  parsed,
  fallbackPrompt,
}: {
  parsed: AgentResponse;
  fallbackPrompt: string;
}): AgentResponse => {
  const resolvedFallback = sanitizeGenerationPromptText(fallbackPrompt) ?? "";
  const cleanedApplyPrompt = sanitizeGenerationPromptText(parsed.actions?.applyPrompt ?? null);
  if (!cleanedApplyPrompt) {
    parsed.actions = parsed.actions ?? {};
    parsed.actions.applyPrompt = resolvedFallback;
  } else {
    parsed.actions = parsed.actions ?? {};
    parsed.actions.applyPrompt = cleanedApplyPrompt;
  }
  if (parsed.actions?.applyPrompt && !parsed.actions.referenceCard?.prompt) {
    parsed.actions.referenceCard = {
      title: "Prompt",
      prompt: parsed.actions.applyPrompt,
    };
  }
  parsed.message =
    parsed.actions?.applyPrompt ??
    sanitizeGenerationPromptText(parsed.message ?? null) ??
    resolvedFallback;
  return parsed;
};

const emitTurnTelemetry = ({
  flow,
  path,
  status,
  model,
  retryUsed,
  totalLatencyMs,
  stageLatencyMs,
}: {
  flow: string;
  path: string;
  status: "success" | "refuse" | "error";
  model: string;
  retryUsed: boolean;
  totalLatencyMs: number;
  stageLatencyMs: Record<string, number>;
}) => {
  console.info(
    "[studio-agent][telemetry]",
    JSON.stringify({
      flow,
      path,
      status,
      model,
      retry_used: retryUsed,
      latency_ms_total: totalLatencyMs,
      latency_ms_stage: stageLatencyMs,
    })
  );
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestStartedAt = Date.now();
  const traceId = resolveTraceId(req);
  setContractHeaders(res, traceId);
  const stageLatencyMs: Record<string, number> = {};
  const markStage = (stage: string, startedAt: number) => {
    stageLatencyMs[stage] = Date.now() - startedAt;
  };

  if (req.method !== "POST") {
    return sendError(res, 405, {
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed",
      traceId,
    });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const serverFlag = process.env.STUDIO_AGENT_ENABLED;
  const publicFlag = process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT;
  const featureEnabled =
    typeof serverFlag === "string"
      ? serverFlag === "true"
      : typeof publicFlag === "string"
        ? publicFlag === "true"
        : true;
  if (!featureEnabled) {
    return sendError(res, 503, {
      code: "AGENT_DISABLED",
      message: "Studio agent is disabled",
      traceId,
    });
  }

  const bodyBytes = readRequestBodyBytes(req.body);
  const hasMediaPayload =
    Array.isArray(req.body?.context?.media) && req.body.context.media.length > 0;
  const maxRequestBytes = hasMediaPayload ? MAX_MIXED_REQUEST_BYTES : MAX_TEXT_REQUEST_BYTES;
  if (bodyBytes > maxRequestBytes) {
    return sendError(res, 413, {
      code: "REQUEST_BODY_TOO_LARGE",
      message: "Request body exceeds allowed size limit",
      details: {
        maxBytes: maxRequestBytes,
        actualBytes: bodyBytes,
      },
      traceId,
    });
  }

  if (isRateLimited(user.id)) {
    return sendError(res, 429, {
      code: "RATE_LIMITED",
      message: "Too many studio-agent requests. Please retry shortly.",
      details: {
        windowMs: RATE_LIMIT_WINDOW_MS,
        maxRequests: RATE_LIMIT_MAX_REQUESTS,
      },
      traceId,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not set", traceId });
  }

  const systemPrompt = loadAgentPrompt("STUDIO_AGENT_SYSTEM", process.env.STUDIO_AGENT_SYSTEM);
  const thinkerPrompt = loadAgentPrompt("STUDIO_AGENT_THINKER", process.env.STUDIO_AGENT_THINKER);
  const formatterPrompt = loadAgentPrompt(
    "STUDIO_AGENT_FORMATTER",
    process.env.STUDIO_AGENT_FORMATTER
  );
  const imageDescribePrompt = loadAgentPrompt(
    "OPENAI_PROMPT_IMAGE_DESCRIBE",
    process.env.OPENAI_PROMPT_IMAGE_DESCRIBE
  );
  if (!systemPrompt) {
    return res.status(500).json({ error: "STUDIO_AGENT_SYSTEM prompt missing", traceId });
  }

  const clientSessionKey =
    typeof req.body?.clientSessionKey === "string" ? req.body.clientSessionKey.trim() : "";
  if (!clientSessionKey) {
    return sendError(res, 400, {
      code: "INVALID_SESSION_KEY",
      message: "clientSessionKey is required",
      traceId,
    });
  }
  if (clientSessionKey.length > SESSION_KEY_MAX_CHARS) {
    return sendError(res, 400, {
      code: "INVALID_SESSION_KEY",
      message: "clientSessionKey exceeds allowed length",
      details: {
        maxChars: SESSION_KEY_MAX_CHARS,
      },
      traceId,
    });
  }

  const parsedMessages = parseMessages(req.body?.messages);
  if (!parsedMessages.ok) {
    return sendError(res, 400, {
      code: parsedMessages.code,
      message: parsedMessages.message,
      details: parsedMessages.details,
      traceId,
    });
  }
  const messages = parsedMessages.messages;
  if (!messages.length) {
    return sendError(res, 400, {
      code: "MESSAGES_REQUIRED",
      message: "messages are required",
      traceId,
    });
  }

  const normalizedConversationId = clientSessionKey;
  let context = safeContext(req.body?.context);

  const incomingCanonical =
    typeof req.body?.canonicalPrompt === "string" && req.body.canonicalPrompt.trim().length
      ? (sanitizeGenerationPromptText(req.body.canonicalPrompt.trim()) ?? null)
      : null;

  const canonicalDbEnabled = process.env.STUDIO_AGENT_CANONICAL_DB_ENABLED !== "false";
  const serverVisionEnabled = process.env.STUDIO_AGENT_SERVER_VISION_ENABLED !== "false";
  const textFastPathEnabled = process.env.STUDIO_AGENT_TEXT_FAST_PATH_ENABLED !== "false";
  const openAiModel = resolveModelEnv(process.env.OPENAI_MODEL, DEFAULT_MODEL);
  const openAiVisionModel = resolveModelEnv(process.env.OPENAI_VISION_MODEL, DEFAULT_VISION_MODEL);
  const openAiThinkerModel = resolveModelEnv(process.env.STUDIO_AGENT_THINKER_MODEL, openAiModel);
  const openAiFormatterModel = resolveModelEnv(
    process.env.STUDIO_AGENT_FORMATTER_MODEL,
    openAiThinkerModel
  );
  const requestTimeoutMs = parseRequestTimeoutMs(process.env.STUDIO_AGENT_TIMEOUT_MS);

  let storedCanonical: string | null = null;
  if (canonicalDbEnabled && normalizedConversationId) {
    const canonicalReadStartedAt = Date.now();
    try {
      storedCanonical = await readAgentConversationCanonicalPrompt({
        userId: user.id,
        conversationId: normalizedConversationId,
      });
    } catch (error) {
      console.warn("[studio-agent] canonical db read failed", withTimeoutMessage(error));
      await logApiRouteException({
        req,
        error,
        routeLabel: "ai/studio-agent",
        metadata: {
          user_id: user.id,
          conversation_id: normalizedConversationId,
          stage: "canonical_read",
        },
      });
    } finally {
      markStage("canonical_read", canonicalReadStartedAt);
    }
  }

  const canonicalPrompt =
    sanitizeGenerationPromptText(storedCanonical) ??
    incomingCanonical ??
    sanitizeGenerationPromptText(context.lastAssistantMessage) ??
    null;
  const effectiveCanonical = clampCanonicalPrompt(canonicalPrompt);

  const selectedReferencesBeforeVision = pickSelectedReferencesForThinker(context);
  const orchestrationBeforeVision = buildStudioAgentOrchestration({
    context,
    messages,
    selectedReferences: selectedReferencesBeforeVision,
    effectiveCanonical,
  });

  let visionSummaryMap = new Map<string, string>();
  if (
    serverVisionEnabled &&
    imageDescribePrompt &&
    orchestrationBeforeVision.shouldRunVisionDescription &&
    (context.media?.length ?? 0) > 0
  ) {
    const visionStartedAt = Date.now();
    try {
      visionSummaryMap = await buildImageSummaryMap({
        context,
        imageDescribePrompt,
        apiKey,
        visionModel: openAiVisionModel,
        timeoutMs: requestTimeoutMs,
      });
      context = applyVisionSummariesToContext(context, visionSummaryMap);
    } catch (error) {
      console.warn("[studio-agent] server vision summary failed", withTimeoutMessage(error));
      await logApiRouteException({
        req,
        error,
        routeLabel: "ai/studio-agent",
        metadata: {
          user_id: user.id,
          conversation_id: normalizedConversationId,
          stage: "vision_summary",
        },
      });
    } finally {
      markStage("vision_summary", visionStartedAt);
    }
  }

  const selectedReferences = pickSelectedReferencesForThinker(context);
  const orchestration = buildStudioAgentOrchestration({
    context,
    messages,
    selectedReferences,
    effectiveCanonical,
  });

  const openAiMessages = buildOpenAiMessages(messages, context, systemPrompt, orchestration);
  const hasV2Prompts = Boolean(thinkerPrompt && formatterPrompt);
  const useV2Path = hasV2Prompts && !(orchestration.flow === "TEXT_ONLY" && textFastPathEnabled);
  const path = useV2Path
    ? "v2_orchestration"
    : orchestration.flow === "TEXT_ONLY"
      ? "text_fast_path"
      : "fallback_fast_path";

  try {
    let retryUsed = false;

    if (useV2Path && thinkerPrompt && formatterPrompt) {
      const userInput = messages[messages.length - 1]?.content ?? "";
      const imageSummaries = selectedReferences
        .filter((reference) => reference.kind === "image")
        .map((reference) => ({
          id: reference.id,
          summary:
            visionSummaryMap.get(reference.id) ??
            reference.caption ??
            reference.promptSnippet ??
            undefined,
        }))
        .filter((entry) => typeof entry.summary === "string" && entry.summary.trim().length > 0);

      const thinkerPayload = {
        input_flow: orchestration.flow,
        orchestration,
        context_type: orchestration.contextType,
        canonical_prompt: effectiveCanonical,
        user_input: userInput,
        text_agent_input: orchestration.textInput,
        edit_instructions:
          effectiveCanonical && userInput.trim().length
            ? `Edit the canonical prompt in place.\nCanonical prompt:\n${effectiveCanonical}\n\nUser change:\n${userInput}`
            : null,
        context_payload:
          orchestration.flow === "TEXT_ONLY"
            ? orchestration.textInput ||
              context.activePrompt ||
              context.references?.[0]?.promptSnippet ||
              ""
            : orchestration.flow === "IMAGE_ONLY"
              ? {
                  image_summaries: imageSummaries,
                }
              : {
                  text_seed: orchestration.textInput,
                  image_summaries: imageSummaries,
                  image_refs: orchestration.imageReferenceIds,
                },
        selected_reference_ids: context.selectedReferenceIds ?? [],
        selected_references: selectedReferences,
        focused_source: context.focusedSource ?? null,
        focused_reference_id: context.focusedReferenceId ?? null,
        mode_hint: context.modeHint ?? null,
      };

      const v2StartedAt = Date.now();
      const firstPass = await runThinkerFormatterTurn({
        apiKey,
        openAiUrl: OPENAI_URL,
        thinkerModel: openAiThinkerModel,
        formatterModel: openAiFormatterModel,
        thinkerMessages: buildThinkerMessages(thinkerPayload, thinkerPrompt),
        buildFormatterMessages: (semantic) => buildFormatterMessages(semantic, formatterPrompt),
        parseAgentJson,
        timeoutMs: requestTimeoutMs,
      });
      markStage("v2_turn", v2StartedAt);

      if (!firstPass.ok) {
        emitTurnTelemetry({
          flow: orchestration.flow,
          path,
          status: "error",
          model: openAiThinkerModel,
          retryUsed: false,
          totalLatencyMs: Date.now() - requestStartedAt,
          stageLatencyMs,
        });
        return res.status(firstPass.status).json({
          error: `Upstream error (${firstPass.stage})`,
          detail: firstPass.detail,
          traceId,
        });
      }

      let parsed = firstPass.result.parsed;
      let nextCanonical = firstPass.result.nextCanonical ?? effectiveCanonical ?? null;
      let usage = firstPass.result.usage;
      let semanticStatus = firstPass.result.semanticStatus;
      const explicitEditRequest = isExplicitEditRequest(userInput);
      const bypassDriftGuard = explicitEditRequest;

      if (
        shouldRetryExplicitNoOp({
          userInput,
          effectiveCanonical,
          nextCanonical,
        })
      ) {
        retryUsed = true;
        const retryStartedAt = Date.now();
        const retryPass = await runThinkerFormatterTurn({
          apiKey,
          openAiUrl: OPENAI_URL,
          thinkerModel: openAiThinkerModel,
          formatterModel: openAiFormatterModel,
          thinkerMessages: buildThinkerMessages(
            {
              ...thinkerPayload,
              retry_instruction:
                "Your previous draft did not apply the explicit user edit. Re-apply the user change to the canonical prompt now and return the full updated prompt.",
            },
            thinkerPrompt
          ),
          buildFormatterMessages: (semantic) => buildFormatterMessages(semantic, formatterPrompt),
          parseAgentJson,
          timeoutMs: requestTimeoutMs,
        });
        markStage("v2_retry_turn", retryStartedAt);
        if (retryPass.ok) {
          parsed = retryPass.result.parsed;
          nextCanonical = retryPass.result.nextCanonical ?? nextCanonical;
          usage = retryPass.result.usage;
          semanticStatus = retryPass.result.semanticStatus;
        }
      }

      const refusal = isRefusalResponse({
        status: semanticStatus,
        response: parsed,
      });

      if (!refusal && effectiveCanonical && nextCanonical && !bypassDriftGuard) {
        if (!preservesContext(effectiveCanonical, nextCanonical)) {
          console.warn("[studio-agent] drift detected; restoring canonical prompt");
          parsed.actions = parsed.actions ?? {};
          parsed.actions.applyPrompt = effectiveCanonical;
          nextCanonical = effectiveCanonical;
        }
      }

      const fallbackPrompt =
        sanitizeGenerationPromptText(
          nextCanonical ??
            effectiveCanonical ??
            context.activePrompt ??
            messages[messages.length - 1]?.content ??
            ""
        ) ?? "";

      if (refusal) {
        parsed = {
          message: parsed.message?.trim() || "I cannot help with that request.",
          actions: undefined,
        };
      } else {
        parsed = ensureApplyPromptContract({ parsed, fallbackPrompt });
      }

      const resolvedCanonical = refusal
        ? effectiveCanonical
        : resolveCanonicalPrompt(parsed.actions?.applyPrompt, nextCanonical, effectiveCanonical);

      if (!refusal && canonicalDbEnabled && normalizedConversationId && resolvedCanonical) {
        const canonicalWriteStartedAt = Date.now();
        try {
          await upsertAgentConversationCanonicalPrompt({
            userId: user.id,
            conversationId: normalizedConversationId,
            canonicalPrompt: resolvedCanonical,
          });
        } catch (error) {
          console.warn("[studio-agent] canonical db upsert failed", withTimeoutMessage(error));
          await logApiRouteException({
            req,
            error,
            routeLabel: "ai/studio-agent",
            metadata: {
              user_id: user.id,
              conversation_id: normalizedConversationId,
              stage: "canonical_write_v2",
            },
          });
        } finally {
          markStage("canonical_write", canonicalWriteStartedAt);
        }
      }

      emitTurnTelemetry({
        flow: orchestration.flow,
        path,
        status: refusal ? "refuse" : "success",
        model: openAiThinkerModel,
        retryUsed,
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
      });

      return res.status(200).json({
        ...parsed,
        usage,
        canonicalPrompt: resolvedCanonical,
        traceId,
      });
    }

    const fastPathStartedAt = Date.now();
    const response = await fetchOpenAiChatCompletion({
      apiKey,
      model: openAiModel,
      messages: openAiMessages,
      timeoutMs: requestTimeoutMs,
    });
    markStage("fast_path_turn", fastPathStartedAt);

    if (!response.ok) {
      const detail = await response.text();
      emitTurnTelemetry({
        flow: orchestration.flow,
        path,
        status: "error",
        model: openAiModel,
        retryUsed: false,
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
      });
      return res.status(response.status).json({ error: "Upstream error", detail, traceId });
    }

    const data = await response.json();
    const contentText = extractCompletionText(data?.choices?.[0]?.message?.content);
    const parsedWithStatus = parseAgentJsonWithStatus(contentText);
    let parsed = parsedWithStatus?.response ?? {
      message: sanitizeGenerationPromptText(contentText || "No response") ?? "No response",
      actions: undefined,
    };

    const refusal = isRefusalResponse({
      status: parsedWithStatus?.status ?? null,
      response: parsed,
    });

    const nextCanonical = sanitizeGenerationPromptText(
      parsed?.actions?.applyPrompt ?? parsed?.message ?? effectiveCanonical ?? null
    );

    if (refusal) {
      parsed = {
        message: parsed.message?.trim() || "I cannot help with that request.",
        actions: undefined,
      };
    } else {
      const fallbackPrompt =
        sanitizeGenerationPromptText(
          nextCanonical ??
            effectiveCanonical ??
            context.activePrompt ??
            messages[messages.length - 1]?.content ??
            ""
        ) ?? "";
      parsed = ensureApplyPromptContract({ parsed, fallbackPrompt });
    }

    const resolvedCanonical = refusal
      ? effectiveCanonical
      : resolveCanonicalPrompt(parsed.actions?.applyPrompt, nextCanonical, effectiveCanonical);

    if (!refusal && canonicalDbEnabled && normalizedConversationId && resolvedCanonical) {
      const canonicalWriteStartedAt = Date.now();
      try {
        await upsertAgentConversationCanonicalPrompt({
          userId: user.id,
          conversationId: normalizedConversationId,
          canonicalPrompt: resolvedCanonical,
        });
      } catch (error) {
        console.warn("[studio-agent] canonical db upsert failed", withTimeoutMessage(error));
        await logApiRouteException({
          req,
          error,
          routeLabel: "ai/studio-agent",
          metadata: {
            user_id: user.id,
            conversation_id: normalizedConversationId,
            stage: "canonical_write_fast_path",
          },
        });
      } finally {
        markStage("canonical_write", canonicalWriteStartedAt);
      }
    }

    emitTurnTelemetry({
      flow: orchestration.flow,
      path,
      status: refusal ? "refuse" : "success",
      model: openAiModel,
      retryUsed: false,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
    });

    return res.status(200).json({
      ...parsed,
      usage: {
        inputTokens: data?.usage?.prompt_tokens,
        outputTokens: data?.usage?.completion_tokens,
      },
      canonicalPrompt: resolvedCanonical,
      traceId,
    });
  } catch (error) {
    emitTurnTelemetry({
      flow: "unknown",
      path,
      status: "error",
      model: openAiModel,
      retryUsed: false,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
    });
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai/studio-agent",
      metadata: {
        user_id: user.id,
        conversation_id: normalizedConversationId,
      },
    });
    return res.status(500).json({
      error: "Agent call failed",
      detail: withTimeoutMessage(error),
      traceId,
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};
