/**
 * AI Studio Agent API: brokers chat+vision requests to the configured LLM.
 * Keeps system prompt and context handling server-side to protect keys and size limits.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { loadAgentPrompt } from "../../../lib/agentPromptLoader";
import type { AgentContext, AgentMessage } from "../../../prefabs/agent";
import {
  isExplicitEditRequest,
  preservesContext,
  shouldRetryExplicitNoOp,
} from "../../../features/ai-agent/logic/studioAgentCanonical";
import { sanitizeGenerationPromptText } from "../../../features/agent-core/promptText";
import { pickSelectedReferencesForThinker } from "../../../features/ai-agent/logic/studioAgentReferenceSelection";
import { buildStudioAgentOrchestration } from "../../../features/ai-agent/logic/studioAgentOrchestration";
import { runThinkerFormatterTurn } from "../../../features/ai-agent/logic/studioAgentThinkerFormatter";
import { STUDIO_AGENT_MAX_MEDIA } from "../../../features/agent-runtime/studioAgentRequestGuards";
import {
  isStudioAgentFeatureEnabled,
  parseStudioAgentRequestEnvelope,
  resolveStudioAgentTraceId,
  sendStudioAgentError,
  setStudioAgentContractHeaders,
} from "../../../features/agent-runtime/studioAgentRouteEnvelope";
import {
  extractStudioAgentCompletionText,
  isStudioAgentRefusalResponse,
  parseStudioAgentJson,
  parseStudioAgentJsonWithStatus,
} from "../../../features/agent-runtime/studioAgentResponseNormalization";
import { resolveStudioAgentTurnResponse } from "../../../features/agent-runtime/studioAgentTurnResponse";
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

type OpenAIChatMessage =
  | { role: "system" | "assistant" | "user"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" } }
      >;
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
    .slice(0, STUDIO_AGENT_MAX_MEDIA);
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
      const rawText = extractStudioAgentCompletionText(data?.choices?.[0]?.message?.content);
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
  const traceId = resolveStudioAgentTraceId(req);
  setStudioAgentContractHeaders(res, traceId);
  const stageLatencyMs: Record<string, number> = {};
  const markStage = (stage: string, startedAt: number) => {
    stageLatencyMs[stage] = Date.now() - startedAt;
  };

  if (req.method !== "POST") {
    return sendStudioAgentError(res, 405, {
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed",
      traceId,
    });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  if (
    !isStudioAgentFeatureEnabled({
      serverFlag: process.env.STUDIO_AGENT_ENABLED,
      publicFlag: process.env.NEXT_PUBLIC_ENABLE_STUDIO_AGENT,
    })
  ) {
    return sendStudioAgentError(res, 503, {
      code: "AGENT_DISABLED",
      message: "Studio agent is disabled",
      traceId,
    });
  }

  const requestEnvelope = parseStudioAgentRequestEnvelope({
    req,
    userId: user.id,
    traceId,
  });
  if (!requestEnvelope.ok) {
    return sendStudioAgentError(res, requestEnvelope.status, requestEnvelope.payload);
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

  const normalizedConversationId = requestEnvelope.value.clientSessionKey;
  const messages = requestEnvelope.value.messages;
  let context = requestEnvelope.value.context;
  const incomingCanonical = requestEnvelope.value.incomingCanonical;

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
        parseAgentJson: parseStudioAgentJson,
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
          parseAgentJson: parseStudioAgentJson,
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

      const preResolutionRefusal = isStudioAgentRefusalResponse({
        status: semanticStatus,
        response: parsed,
      });

      if (!preResolutionRefusal && effectiveCanonical && nextCanonical && !bypassDriftGuard) {
        if (!preservesContext(effectiveCanonical, nextCanonical)) {
          console.warn("[studio-agent] drift detected; restoring canonical prompt");
          parsed.actions = parsed.actions ?? {};
          parsed.actions.applyPrompt = effectiveCanonical;
          nextCanonical = effectiveCanonical;
        }
      }

      const resolvedTurn = resolveStudioAgentTurnResponse({
        parsed,
        semanticStatus,
        nextCanonical,
        effectiveCanonical,
        context,
        messages,
      });
      parsed = resolvedTurn.parsed;
      const refusal = resolvedTurn.refusal;
      const resolvedCanonical = resolvedTurn.resolvedCanonical;

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
    const contentText = extractStudioAgentCompletionText(data?.choices?.[0]?.message?.content);
    const parsedWithStatus = parseStudioAgentJsonWithStatus(contentText);
    let parsed = parsedWithStatus?.response ?? {
      message: sanitizeGenerationPromptText(contentText || "No response") ?? "No response",
      actions: undefined,
    };

    const nextCanonical = sanitizeGenerationPromptText(
      parsed?.actions?.applyPrompt ?? parsed?.message ?? effectiveCanonical ?? null
    );

    const resolvedTurn = resolveStudioAgentTurnResponse({
      parsed,
      semanticStatus: parsedWithStatus?.status ?? null,
      nextCanonical,
      effectiveCanonical,
      context,
      messages,
    });
    parsed = resolvedTurn.parsed;
    const refusal = resolvedTurn.refusal;
    const resolvedCanonical = resolvedTurn.resolvedCanonical;

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
