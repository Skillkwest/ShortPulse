/**
 * Standard Create agent runtime for AI Studio.
 * Owns Standard request execution and forwards raw conversation turns to OpenAI.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { buildAgentMachineOutcome } from "../agentMachineOutcome";
import {
  buildSafeCompletionTelemetryDisposition,
  buildStudioAgentSafetyRefusalPayload,
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentUpstreamErrorPayload,
  emitStudioAgentInputPrecheckTelemetry,
  emitStudioAgentTurnTelemetry,
  isStudioAgentSafetyRefusalUpstreamError,
} from "../studioAgentRouteOutcomes";
import {
  isStudioAgentFeatureEnabled,
  parseStudioAgentRequestEnvelope,
  resolveStudioAgentTraceId,
  sendStudioAgentError,
  setStudioAgentContractHeaders,
} from "../studioAgentRouteEnvelope";
import {
  fetchStudioAgentChatCompletion,
  formatStudioAgentErrorMessage,
  resolveStudioAgentOpenAiConfig,
} from "../studioAgentOpenAiGateway";
import {
  hasInboundStudioAgentCanonicalPrompt,
  hasStudioAgentPulseContext,
  isPulseCreateAgentSessionNamespace,
  isStandardCreateAgentSessionNamespace,
  readStudioAgentClientSessionNamespace,
} from "../studioAgentRouteModeBoundary";
import {
  extractStudioAgentProviderCompletion,
  isStudioAgentRefusalResponse,
  parseStudioAgentJsonWithStatus,
} from "../studioAgentResponseNormalization";
import {
  classifyStudioAgentFailure,
  computeStudioAgentRetryDelayMs,
  shouldRetryStudioAgentFailure,
  waitForStudioAgentRetry,
} from "../studioAgentFailurePolicy";
import {
  MISSING_PROVIDER_API_KEY_MESSAGE,
  resolveProviderErrorHandling,
} from "../safetyPolicy/providerErrorPolicy";
import { sanitizeGenerationPromptText } from "../../agent-core/promptText";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import {
  buildOpenAiResponsesInput,
  extractOpenAiResponsesOutput,
  fetchOpenAiResponse,
  type OpenAiChatMessage,
} from "../../../lib/server/api/openAiCompat";
import {
  resolveRequiredRuntimeAgentPrompt,
  type RequiredRuntimeAgentPromptResolution,
  RequiredRuntimeAgentPromptMissingError,
  RequiredRuntimeAgentPromptUnavailableError,
} from "../../../lib/server/api/runtimeAgentPromptControlPlane";
import type { AgentContext, AgentMessage, AgentResponse } from "../../../prefabs/agent";
import {
  resolveStandardWebSearchToolChoice,
  type StandardWebSearchToolChoice,
} from "../standardWebSearch";
import {
  resolveSafeCompletionRecoveryEligibility,
  resolveSafeCompletionSystemInstruction,
  stripEditableSafeCompletionSystemInstruction,
  withSafeCompletionRecoveryInstruction,
  type SafeCompletionRecoveryOutcome,
  type SafeCompletionRecoverySkipReason,
  type SafeCompletionRefusalSource,
} from "../studioAgentSafeCompletion";
import { resolveStudioAgentSafetyRuntimeConfig } from "../studioAgentSafetyRuntimeConfig";
import {
  resolveStudioAgentSafetyInputPrecheckFieldModes,
  runStudioAgentSafetyInputPrecheck,
} from "../studioAgentSafetyInputPrecheck";
import { resolveSafetyModality } from "../safetyPolicy/decisionEngine";
import {
  buildPromptCompilerCacheScopeKey,
  resolvePromptTemplateVersion,
} from "../promptCompilerCacheScopeKey";
import { finalizeStudioAgentResponseSafety } from "../studioAgentSafetyResponseFinalizer";
import { maybeTriggerSafetyIncidentAutoRollback } from "../safetyPolicy/incidentAutoRollback";

const STANDARD_ROUTE_LABEL = "ai/studio-agent-standard";
const STANDARD_TELEMETRY_PATH = "standard_agent";
const STANDARD_EXTENDED_TEXT_TIMEOUT_CHAR_THRESHOLD = 2500;
const STANDARD_MAX_PROMPT_REFERENCE_SNIPPETS = 8;
const STANDARD_PROMPT_REFERENCE_SNIPPET_MAX_CHARS = 320;
const STANDARD_SYSTEM_CONTEXT_FIELD_MAX_CHARS = 220;
const STANDARD_RESPONSE_STYLE_GUIDANCE = [
  "Standard response formatting rules:",
  "- Prefer a calm, readable response shape: short paragraphs first, then bullets or numbered lists only when the content is naturally grouped.",
  "- Use a brief section label only when it clearly improves scanning. Most replies should not need headings.",
  "- A short closing note is okay when helpful, but do not turn the reply into a workflow, questionnaire, or template.",
  "- Avoid dense text walls, but do not over-structure the reply either.",
  "- Avoid visual separators, boxed callout phrasing, step labels, option-card phrasing, reply-chip phrasing, or other Pulse-style guided formatting.",
  "Good shape examples:",
  '- "Keep the opening visual simple and emotionally clear.\\n\\n- Lead with the product\\n- Save the reveal for the end"',
  '- "The tone should stay grounded and direct. If helpful, I can turn this into a final prompt next."',
  "Bad shape examples:",
  '- "Best Direction:\\n---\\nTip: Pick one path"',
  '- "Reply with: 1 2 3"',
].join("\n");
type StandardOpenAiImageDetail = "high" | "auto";

const STANDARD_DIRECTIVE_SHIFT_VERBS = new Set([
  "add",
  "change",
  "focus",
  "keep",
  "make",
  "move",
  "remove",
  "rewrite",
  "shift",
  "show",
  "switch",
  "turn",
  "use",
]);

const isLikelyStandardDirectiveShift = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized.length || normalized.includes("?")) {
    return false;
  }
  const firstWord = normalized.match(/[a-z]+/)?.[0] ?? "";
  return STANDARD_DIRECTIVE_SHIFT_VERBS.has(firstWord);
};

const STANDARD_NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const resolveRequestedStandardOptionCount = (value: string): number | null => {
  const normalized = value.trim().toLowerCase();
  if (!normalized.length) {
    return null;
  }
  const numericMatch = normalized.match(/\b([2-9]|10)\b/);
  if (numericMatch) {
    return Number(numericMatch[1]);
  }
  for (const [word, count] of Object.entries(STANDARD_NUMBER_WORDS)) {
    if (normalized.includes(word)) {
      return count;
    }
  }
  return null;
};

const isLikelyStandardBrainstormRequest = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized.length) {
    return false;
  }
  return /(brainstorm|ideas|hooks|options|directions|variations|versions|alternatives|ways)\b/.test(
    normalized
  );
};

const isLikelyStandardEvaluationRequest = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized.length) {
    return false;
  }
  return /(too generic|what('|’)s weak|what is weak|what works|what('|’)s working|how would you improve|how can i improve|is this working|does this work|evaluate|critique|what('|’)s off|what is off|what('|’)s wrong|what is wrong)\b/.test(
    normalized
  );
};

const clipStandardSystemContextField = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= STANDARD_SYSTEM_CONTEXT_FIELD_MAX_CHARS) {
    return normalized;
  }
  return `${normalized.slice(0, STANDARD_SYSTEM_CONTEXT_FIELD_MAX_CHARS - 1).trimEnd()}...`;
};

const buildStandardRuntimeContextBlock = (context: AgentContext): string => {
  const lines: string[] = [];
  const activePrompt = clipStandardSystemContextField(context.activePrompt);
  const lastAssistantMessage = clipStandardSystemContextField(context.lastAssistantMessage);
  const selectedReferenceCount = Array.isArray(context.selectedReferenceIds)
    ? context.selectedReferenceIds.length
    : 0;
  const promptReferenceCount =
    context.references?.filter((reference) => reference.kind === "prompt").length ?? 0;
  const imageReferenceCount =
    context.references?.filter(
      (reference) => reference.kind === "image" || reference.kind === "video"
    ).length ?? 0;

  if (context.modeHint) {
    lines.push(`Mode hint: ${context.modeHint}`);
  }
  if (context.focusedSource) {
    lines.push(`Focused source: ${context.focusedSource}`);
  }
  if (activePrompt) {
    lines.push(`Visible composer prompt: ${activePrompt}`);
  }
  if (lastAssistantMessage) {
    lines.push(`Most recent assistant reply: ${lastAssistantMessage}`);
  }
  if (selectedReferenceCount > 0) {
    lines.push(`Selected reference count: ${selectedReferenceCount}`);
  }
  if (promptReferenceCount > 0) {
    lines.push(`Prompt reference count: ${promptReferenceCount}`);
  }
  if (imageReferenceCount > 0) {
    lines.push(`Image reference count: ${imageReferenceCount}`);
  }
  if (context.modelId) {
    lines.push(`Current model id: ${context.modelId}`);
  }

  if (!lines.length) {
    return "";
  }

  return ["Standard runtime context:", ...lines].join("\n");
};

const buildStandardReplyBehaviorBlock = ({
  context,
  latestUserText,
  webSearchToolChoice,
}: {
  context: AgentContext;
  latestUserText: string;
  webSearchToolChoice?: StandardWebSearchToolChoice | null;
}): string => {
  const lines: string[] = [
    "Standard reply behavior:",
    "- Answer the user's latest message directly before offering optional next help.",
    "- Use the conversation's Standard session memory to preserve active goals, constraints, and accepted prompt direction, but do not quote that memory block verbatim.",
    "- When the latest user turn already gives enough direction to continue, prefer a concrete refinement over another clarifying question.",
  ];

  if (context.lastAssistantMessage?.includes("?") && latestUserText.trim().length > 0) {
    if (isLikelyStandardDirectiveShift(latestUserText)) {
      lines.push(
        "- The previous assistant turn ended with a question, but the latest user turn is a direct revision request. Apply that revision to the current direction instead of treating it like a short answer."
      );
    } else {
      lines.push(
        "- The previous assistant turn ended with a question. Treat the latest user turn as a likely answer and continue from it instead of restarting the conversation."
      );
    }
  }

  if (isLikelyStandardBrainstormRequest(latestUserText)) {
    const requestedCount = resolveRequestedStandardOptionCount(latestUserText);
    if (requestedCount) {
      lines.push(
        `- The user asked for multiple options. Provide ${requestedCount} distinct options or directions before offering any follow-up question.`
      );
    } else {
      lines.push(
        "- The user is brainstorming. Offer multiple distinct options or directions before asking a follow-up question."
      );
    }
  }

  if (webSearchToolChoice) {
    lines.push(
      "- This turn has web search tooling available for current information. Use the provided web search tool and do not claim that you lack web or live lookup access.",
      "- If the user asks you to open, go to, or take them to a webpage, provide the direct URL or Markdown link instead of claiming that you opened the page or controlled the browser.",
      "- If the user provides a specific URL and says it is the right destination, treat that URL as the direct answer unless they explicitly ask you to verify it."
    );
  }

  if (isLikelyStandardEvaluationRequest(latestUserText)) {
    lines.push(
      "- The user is asking for evaluation or critique. Give a direct judgment first, then explain the strongest reasons, then offer the most useful improvement."
    );
  }

  if (context.modeHint === "reference") {
    lines.push(
      "- Reference mode is active. Use the referenced prompts or images when they are relevant, but keep the reply conversational unless the user explicitly asks for a final prompt."
    );
  }

  if (context.focusedSource === "prompt") {
    lines.push(
      "- The user is focused on prompt material. Prefer refining or evaluating the prompt content that is already in play."
    );
  }

  if (context.focusedSource === "image") {
    lines.push(
      "- The user is focused on image material. Ground the reply in what the image references imply for composition, style, or subject treatment."
    );
  }

  if (context.focusedSource === "agent-output") {
    lines.push(
      "- The user is focused on prior assistant output. Build on that output directly instead of starting a new direction unless the latest user turn asks for one."
    );
  }

  if (context.activePrompt?.trim().length) {
    lines.push(
      "- A visible composer prompt already exists. If you improve it, preserve its core intent unless the user asks to change direction."
    );
  }

  if (context.modeHint === "describe") {
    lines.push(
      "- The user likely wants descriptive help, not an automatic rewrite into a generation prompt."
    );
  }

  if (context.modeHint === "chat") {
    lines.push(
      "- Keep the turn conversational. Do not force the reply into a reusable prompt unless the user explicitly asks for one."
    );
  }

  return lines.join("\n");
};

const resolveStandardFlow = (
  context: {
    media?: Array<unknown> | null;
    references?: Array<{ kind?: string | null } | null> | null;
  } | null
): "TEXT_ONLY" | "MIXED" => {
  const hasMediaContext = (context?.media?.length ?? 0) > 0;
  const hasImageReferenceContext =
    context?.references?.some((reference) => {
      const kind = reference?.kind;
      return kind === "image" || kind === "video";
    }) ?? false;
  return hasMediaContext || hasImageReferenceContext ? "MIXED" : "TEXT_ONLY";
};

const buildStandardOpenAiMessages = ({
  messages,
  context,
  systemPrompt,
  imageDetail = "high",
  webSearchToolChoice,
  safeCompletionInstruction,
}: {
  messages: AgentMessage[];
  context: AgentContext;
  systemPrompt?: string | null;
  imageDetail?: StandardOpenAiImageDetail;
  webSearchToolChoice?: StandardWebSearchToolChoice | null;
  safeCompletionInstruction?: string | null;
}): OpenAiChatMessage[] => {
  const latestUserText = resolveLatestStandardUserText(messages);
  const promptReferenceSnippets = resolveStandardPromptReferenceSnippets({
    context,
    latestUserText,
  });
  const replyBehaviorBlock = buildStandardReplyBehaviorBlock({
    context,
    latestUserText,
    webSearchToolChoice,
  });
  const promptReferenceBlock = promptReferenceSnippets.length
    ? `Attached reference text:\n${promptReferenceSnippets.map((snippet) => `- ${snippet}`).join("\n")}`
    : "";
  const imageParts =
    context.media
      ?.filter((item) => item.kind === "image" && typeof item.url === "string" && item.url.length)
      .map((item) => ({
        type: "image_url" as const,
        image_url: {
          url: item.url as string,
          detail: imageDetail,
        },
      })) ?? [];
  const latestUserIndex = messages.reduce(
    (latestIndex, message, index) => (message.role === "user" ? index : latestIndex),
    -1
  );

  const conversationMessages = messages.map((message, index): OpenAiChatMessage => {
    const role = message.role === "assistant" ? "assistant" : "user";
    if (index !== latestUserIndex || role !== "user") {
      return {
        role,
        content: message.content,
      };
    }
    const textContent = message.content.trim();
    const combinedTextContent = [textContent, promptReferenceBlock].filter(Boolean).join("\n\n");
    if (!imageParts.length) {
      return {
        role,
        content: combinedTextContent,
      };
    }
    return {
      role,
      content: combinedTextContent.length
        ? [{ type: "text", text: combinedTextContent }, ...imageParts]
        : imageParts,
    };
  });
  const normalizedSystemPrompt = typeof systemPrompt === "string" ? systemPrompt.trim() : "";
  const canonicalSystemPrompt = safeCompletionInstruction
    ? stripEditableSafeCompletionSystemInstruction(normalizedSystemPrompt)
    : normalizedSystemPrompt;
  const runtimeContextBlock = buildStandardRuntimeContextBlock(context);
  const effectiveSystemPrompt = canonicalSystemPrompt.length
    ? [
        canonicalSystemPrompt,
        runtimeContextBlock,
        replyBehaviorBlock,
        STANDARD_RESPONSE_STYLE_GUIDANCE,
        safeCompletionInstruction,
      ]
        .filter(Boolean)
        .join("\n\n")
    : [
        runtimeContextBlock,
        replyBehaviorBlock,
        STANDARD_RESPONSE_STYLE_GUIDANCE,
        safeCompletionInstruction,
      ]
        .filter(Boolean)
        .join("\n\n");
  return [{ role: "system", content: effectiveSystemPrompt }, ...conversationMessages];
};

const clipStandardPromptReferenceSnippet = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > STANDARD_PROMPT_REFERENCE_SNIPPET_MAX_CHARS
    ? `${trimmed.slice(0, STANDARD_PROMPT_REFERENCE_SNIPPET_MAX_CHARS - 1)}...`
    : trimmed;
};

const resolveLatestStandardUserText = (messages: AgentMessage[]): string => {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.content.trim().length > 0);
  return latestUserMessage?.content.trim() ?? "";
};

const resolveStandardPromptReferenceSnippets = ({
  context,
  latestUserText,
}: {
  context: AgentContext;
  latestUserText: string;
}): string[] => {
  const normalizedLatestUserText = latestUserText.trim();
  return Array.from(
    new Set(
      context.references
        ?.filter((item) => item.kind === "prompt")
        .map((item) => clipStandardPromptReferenceSnippet(item.promptSnippet))
        .filter((item): item is string => Boolean(item) && item !== normalizedLatestUserText) ?? []
    )
  ).slice(0, STANDARD_MAX_PROMPT_REFERENCE_SNIPPETS);
};

const measureStandardTextPayloadChars = ({
  messages,
  context,
}: {
  messages: AgentMessage[];
  context: AgentContext;
}): number => {
  const latestUserText = resolveLatestStandardUserText(messages);
  const promptReferenceChars = resolveStandardPromptReferenceSnippets({
    context,
    latestUserText,
  }).reduce((total, snippet) => total + snippet.length, 0);
  const messageChars = messages.reduce(
    (total, message) => total + message.content.trim().length,
    0
  );
  return messageChars + promptReferenceChars;
};

const summarizeStandardTextPayload = ({
  messages,
  context,
}: {
  messages: AgentMessage[];
  context: AgentContext;
}) => {
  const latestUserText = resolveLatestStandardUserText(messages);
  const promptReferenceSnippets = resolveStandardPromptReferenceSnippets({
    context,
    latestUserText,
  });
  const promptReferenceChars = promptReferenceSnippets.reduce(
    (total, snippet) => total + snippet.length,
    0
  );
  const textPayloadChars =
    messages.reduce((total, message) => total + message.content.trim().length, 0) +
    promptReferenceChars;
  return {
    latestUserChars: latestUserText.length,
    promptReferenceChars,
    promptReferenceSnippetCount: promptReferenceSnippets.length,
    textPayloadChars,
  };
};

const executeStandardOpenAiWithRetry = async ({
  apiKey,
  openAiUrl,
  model,
  messages,
  timeoutMs,
  maxAttempts,
  retryBaseDelayMs,
  retryMaxDelayMs,
  responsesEnabled,
  chatFallbackEnabled,
  webSearchToolChoice,
  env,
}: {
  apiKey: string;
  openAiUrl: string;
  model: string;
  messages: OpenAiChatMessage[];
  timeoutMs: number;
  maxAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  responsesEnabled: boolean;
  chatFallbackEnabled: boolean;
  webSearchToolChoice?: StandardWebSearchToolChoice | null;
  env?: NodeJS.ProcessEnv;
}): Promise<
  | { ok: true; response: Response; retryCount: number; transport: "chat" | "responses" }
  | {
      ok: false;
      detail: string;
      retryCount: number;
      status?: number;
      error?: unknown;
    }
> => {
  let attempt = 1;
  let retryCount = 0;
  const requiresResponsesTransport = Boolean(webSearchToolChoice);
  const effectiveResponsesEnabled = responsesEnabled || requiresResponsesTransport;
  const effectiveChatFallbackEnabled = requiresResponsesTransport ? false : chatFallbackEnabled;

  const executeChatTurn = async (): Promise<Response> =>
    await fetchStudioAgentChatCompletion({
      apiKey,
      openAiUrl,
      model,
      messages,
      timeoutMs,
      env: {
        ...(env ?? process.env),
        SHORTPULSE_OPENAI_RESPONSES_ENABLED: "false",
        SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED: "false",
      },
    });

  while (true) {
    try {
      if (!effectiveResponsesEnabled) {
        const response = await executeChatTurn();
        if (response.ok) {
          return { ok: true, response, retryCount, transport: "chat" };
        }

        const detail = await response.text();
        const failureClass = classifyStudioAgentFailure({
          status: response.status,
          detail,
        });
        if (
          !shouldRetryStudioAgentFailure({
            failureClass,
            attempt,
            maxAttempts,
          })
        ) {
          return {
            ok: false,
            status: response.status,
            detail,
            retryCount,
          };
        }
      } else {
        const response = await fetchOpenAiResponse({
          apiKey,
          openAiUrl,
          timeoutMs,
          body: {
            model,
            input: buildOpenAiResponsesInput(messages),
            store: false,
            ...(webSearchToolChoice
              ? {
                  tools: [{ type: "web_search" }],
                  tool_choice: webSearchToolChoice,
                }
              : {}),
          },
        });
        if (response.ok) {
          return { ok: true, response, retryCount, transport: "responses" };
        }

        const responsesDetail = await response.text();
        if (
          isStudioAgentSafetyRefusalUpstreamError({
            status: response.status,
            detail: responsesDetail,
          })
        ) {
          return {
            ok: false,
            status: response.status,
            detail: responsesDetail,
            retryCount,
          };
        }

        if (effectiveChatFallbackEnabled) {
          const fallbackResponse = await executeChatTurn();
          if (fallbackResponse.ok) {
            return { ok: true, response: fallbackResponse, retryCount, transport: "chat" };
          }
          const detail = await fallbackResponse.text();
          const failureClass = classifyStudioAgentFailure({
            status: fallbackResponse.status,
            detail,
          });
          if (
            !shouldRetryStudioAgentFailure({
              failureClass,
              attempt,
              maxAttempts,
            })
          ) {
            return {
              ok: false,
              status: fallbackResponse.status,
              detail,
              retryCount,
            };
          }
        } else {
          const failureClass = classifyStudioAgentFailure({
            status: response.status,
            detail: responsesDetail,
          });
          if (
            !shouldRetryStudioAgentFailure({
              failureClass,
              attempt,
              maxAttempts,
            })
          ) {
            return {
              ok: false,
              status: response.status,
              detail: responsesDetail,
              retryCount,
            };
          }
        }
      }
    } catch (error) {
      const detail = formatStudioAgentErrorMessage(error);
      const failureClass = classifyStudioAgentFailure({ detail });
      if (
        !shouldRetryStudioAgentFailure({
          failureClass,
          attempt,
          maxAttempts,
        })
      ) {
        return {
          ok: false,
          detail,
          retryCount,
          error,
        };
      }
    }

    retryCount += 1;
    const retryDelayMs = computeStudioAgentRetryDelayMs({
      attempt,
      baseDelayMs: retryBaseDelayMs,
      maxDelayMs: retryMaxDelayMs,
    });
    await waitForStudioAgentRetry(retryDelayMs);
    attempt += 1;
  }
};

export const resolveStandardOpenAiExecutionProfile = ({
  flow,
  openAiModel,
  openAiVisionModel,
  turnTimeoutMs,
  visionTimeoutMs,
  pulseTurnTimeoutMs,
  textPayloadChars = 0,
}: {
  flow: "TEXT_ONLY" | "MIXED";
  openAiModel: string;
  openAiVisionModel: string;
  turnTimeoutMs: number;
  visionTimeoutMs: number;
  pulseTurnTimeoutMs: number;
  textPayloadChars?: number;
}): {
  model: string;
  timeoutMs: number;
  imageDetail: StandardOpenAiImageDetail;
} => {
  if (flow === "MIXED") {
    return {
      model: openAiVisionModel,
      timeoutMs: Math.max(turnTimeoutMs, visionTimeoutMs, pulseTurnTimeoutMs),
      imageDetail: "auto",
    };
  }

  return {
    model: openAiModel,
    timeoutMs:
      textPayloadChars >= STANDARD_EXTENDED_TEXT_TIMEOUT_CHAR_THRESHOLD
        ? Math.max(turnTimeoutMs, pulseTurnTimeoutMs)
        : turnTimeoutMs,
    imageDetail: "high",
  };
};

const summarizeStandardContextForExceptionLog = (context: AgentContext) => {
  const references = Array.isArray(context.references) ? context.references : [];
  const media = Array.isArray(context.media) ? context.media : [];
  return {
    reference_count: references.length,
    image_reference_count: references.filter(
      (reference) => reference.kind === "image" || reference.kind === "video"
    ).length,
    prompt_reference_count: references.filter((reference) => reference.kind === "prompt").length,
    media_count: media.length,
    image_media_count: media.filter((item) => item.kind === "image").length,
    mode_hint: context.modeHint ?? null,
    focused_source: context.focusedSource ?? null,
  };
};

const extractStandardOpenAiResponse = ({
  payload,
  fallbackPrompt,
}: {
  payload: unknown;
  fallbackPrompt: string;
}): {
  response: AgentResponse;
  refusal: boolean;
  refusalSource: SafeCompletionRefusalSource | null;
} | null => {
  if (!payload || typeof payload !== "object") return null;
  const choices = (
    payload as {
      choices?: Array<{ message?: { content?: unknown; refusal?: unknown } }>;
    }
  ).choices;
  const message = choices?.[0]?.message;
  const completion = extractStudioAgentProviderCompletion({
    content: message?.content,
    refusal: message?.refusal,
  });
  if (completion.typedRefusal) {
    return {
      response: { message: completion.typedRefusal, actions: undefined },
      refusal: true,
      refusalSource: "typed_model",
    };
  }
  const raw = completion.text;
  const parsed = parseStudioAgentJsonWithStatus(raw, { allowUnstructured: false });
  if (!parsed) {
    const directMessage = completion.text;
    if (typeof directMessage !== "string" || directMessage.trim().length === 0) {
      return null;
    }
    const response: AgentResponse = {
      message: directMessage.trim(),
      actions: undefined,
    };
    return {
      response,
      refusal: isStudioAgentRefusalResponse({
        status: null,
        response,
      }),
      refusalSource: isStudioAgentRefusalResponse({ status: null, response })
        ? "lexical_model"
        : null,
    };
  }

  if (
    isStudioAgentRefusalResponse({
      status: parsed.status,
      response: parsed.response,
    })
  ) {
    return {
      response: {
        message: parsed.response.message,
        actions: undefined,
      },
      refusal: true,
      refusalSource: "semantic_model",
    };
  }

  return {
    response: normalizeStandardSuccessResponse({
      parsed: parsed.response,
      fallbackPrompt: parsed.response.message || fallbackPrompt,
    }),
    refusal: false,
    refusalSource: null,
  };
};

const extractStandardOpenAiResponsesResult = ({
  payload,
  fallbackPrompt,
}: {
  payload: unknown;
  fallbackPrompt: string;
}): {
  response: AgentResponse;
  refusal: boolean;
  refusalSource: SafeCompletionRefusalSource | null;
} | null => {
  if (!payload || typeof payload !== "object") return null;
  const payloadRecord = payload as Record<string, unknown>;
  const completion = extractOpenAiResponsesOutput(payloadRecord);
  if (completion.refusal) {
    return {
      response: { message: completion.refusal, actions: undefined, conversationState: null },
      refusal: true,
      refusalSource: "typed_model",
    };
  }
  const raw = completion.text;
  const parsed = parseStudioAgentJsonWithStatus(raw, { allowUnstructured: false });
  if (!parsed) {
    const directMessage = raw.trim();
    if (!directMessage.length) {
      return null;
    }
    const response: AgentResponse = {
      ...normalizeStandardSuccessResponse({
        parsed: {
          message: directMessage,
          actions: undefined,
        },
        fallbackPrompt: directMessage,
      }),
      conversationState: null,
    };
    return {
      response,
      refusal: isStudioAgentRefusalResponse({
        status: null,
        response,
      }),
      refusalSource: isStudioAgentRefusalResponse({ status: null, response })
        ? "lexical_model"
        : null,
    };
  }

  if (
    isStudioAgentRefusalResponse({
      status: parsed.status,
      response: parsed.response,
    })
  ) {
    return {
      response: {
        message: parsed.response.message,
        actions: undefined,
      },
      refusal: true,
      refusalSource: "semantic_model",
    };
  }

  return {
    response: {
      ...normalizeStandardSuccessResponse({
        parsed: parsed.response,
        fallbackPrompt: parsed.response.message || fallbackPrompt,
      }),
      conversationState: null,
    },
    refusal: false,
    refusalSource: null,
  };
};

const normalizeStandardSuccessResponse = ({
  parsed,
  fallbackPrompt,
}: {
  parsed: AgentResponse;
  fallbackPrompt: string;
}): AgentResponse => {
  const normalizedApplyPrompt =
    sanitizeGenerationPromptText(parsed.actions?.applyPrompt ?? null)?.trim() ?? "";
  const normalizedMessage =
    sanitizeGenerationPromptText(parsed.message ?? null)?.trim() ??
    sanitizeGenerationPromptText(fallbackPrompt)?.trim() ??
    "";

  return {
    ...parsed,
    actions: normalizedApplyPrompt.length > 0 ? { applyPrompt: normalizedApplyPrompt } : undefined,
    message:
      normalizedMessage.length > 0
        ? normalizedMessage
        : normalizedApplyPrompt.length > 0
          ? normalizedApplyPrompt
          : "",
  };
};

const resolveStandardSuccessOutcomeClass = (
  response: AgentResponse
): {
  outcomeClass: "success_prompt" | "success_message";
  reasonCode: "SUCCESS_PROMPT" | "SUCCESS_MESSAGE";
} => {
  const hasPromptArtifact = Boolean(response.actions?.applyPrompt?.trim());
  return hasPromptArtifact
    ? { outcomeClass: "success_prompt", reasonCode: "SUCCESS_PROMPT" }
    : { outcomeClass: "success_message", reasonCode: "SUCCESS_MESSAGE" };
};

/**
 * Runs one Standard Create agent request as a pass-through OpenAI chat turn.
 */
export const runStandardStudioAgentRuntime = async (req: NextApiRequest, res: NextApiResponse) => {
  const requestStartedAt = Date.now();
  const traceId = resolveStudioAgentTraceId(req);
  setStudioAgentContractHeaders(res, traceId);
  const stageLatencyMs: Record<string, number> = {};
  const markStage = (stage: string, startedAt: number) => {
    stageLatencyMs[stage] = Date.now() - startedAt;
  };

  if (req.method === "POST") {
    const clientSessionNamespace = readStudioAgentClientSessionNamespace(req.body);
    const hasCrossModeContinuity = isPulseCreateAgentSessionNamespace(clientSessionNamespace);
    const hasInvalidStandardNamespace =
      clientSessionNamespace !== null &&
      !isStandardCreateAgentSessionNamespace(clientSessionNamespace);
    if (
      req.body?.runtimeMode === "pulse" ||
      hasStudioAgentPulseContext(req.body?.context) ||
      hasCrossModeContinuity ||
      hasInvalidStandardNamespace
    ) {
      return sendStudioAgentError(res, 400, {
        code: "INVALID_REQUEST",
        message: "Standard agent runtime requires a Standard runtime payload.",
        traceId,
      });
    }
    if (hasInboundStudioAgentCanonicalPrompt(req.body)) {
      return sendStudioAgentError(res, 400, {
        code: "INVALID_REQUEST",
        message: "Standard agent runtime does not accept canonicalPrompt.",
        traceId,
      });
    }
    req.body = {
      ...req.body,
      runtimeMode: "standard",
    };
  }

  if (req.method !== "POST") {
    return sendStudioAgentError(res, 405, {
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed",
      traceId,
    });
  }

  const authVerificationStartedAt = Date.now();
  const user = await requireApiUser(req, res);
  markStage("auth_verification", authVerificationStartedAt);
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

  const requestEnvelopeStartedAt = Date.now();
  const requestEnvelope = parseStudioAgentRequestEnvelope({
    req,
    userId: user.id,
    traceId,
  });
  markStage("request_envelope", requestEnvelopeStartedAt);
  if (!requestEnvelope.ok) {
    return sendStudioAgentError(res, requestEnvelope.status, requestEnvelope.payload);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      ...buildStudioAgentRouteFailurePayload({
        traceId,
        detail: MISSING_PROVIDER_API_KEY_MESSAGE,
        reasonCode: "CONFIG_MISSING",
      }),
      error: MISSING_PROVIDER_API_KEY_MESSAGE,
    });
  }

  const normalizedConversationId = requestEnvelope.value.clientSessionKey;
  let messages = requestEnvelope.value.messages;
  let context = requestEnvelope.value.context;
  const originalLatestUserText = resolveLatestStandardUserText(messages);
  const flow = resolveStandardFlow(context);
  let resolvedSystemPrompt: RequiredRuntimeAgentPromptResolution;
  const runtimePromptResolutionStartedAt = Date.now();
  try {
    resolvedSystemPrompt = await resolveRequiredRuntimeAgentPrompt({
      promptId: "STUDIO_AGENT_SYSTEM",
    });
    markStage("runtime_prompt_resolution", runtimePromptResolutionStartedAt);
  } catch (error) {
    markStage("runtime_prompt_resolution", runtimePromptResolutionStartedAt);
    const detail =
      error instanceof RequiredRuntimeAgentPromptMissingError ||
      error instanceof RequiredRuntimeAgentPromptUnavailableError ||
      (error instanceof Error &&
        (error.name === "RequiredRuntimeAgentPromptMissingError" ||
          error.name === "RequiredRuntimeAgentPromptUnavailableError"))
        ? error.message
        : "Standard runtime system prompt unavailable.";
    emitStudioAgentTurnTelemetry({
      flow,
      path: STANDARD_TELEMETRY_PATH,
      status: "error",
      traceId,
      model: process.env.OPENAI_MODEL ?? "unknown",
      outcomeClass: "route_error",
      retryUsed: false,
      reasonCode: "CONFIG_MISSING",
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      safetyTelemetry: {
        runtimeScopeKey: "studio-agent-standard",
      },
    });
    return res.status(500).json({
      ...buildStudioAgentRouteFailurePayload({
        traceId,
        detail,
        reasonCode: "CONFIG_MISSING",
      }),
      error: detail,
    });
  }

  const safetyRuntimeConfig = await resolveStudioAgentSafetyRuntimeConfig(process.env);
  const openAiConfig = resolveStudioAgentOpenAiConfig(process.env);
  const providerErrorNormalizationMode = safetyRuntimeConfig.providerErrorMode;
  const safeCompletionInstruction = resolveSafeCompletionSystemInstruction(process.env);
  const promptTemplateVersion = resolvePromptTemplateVersion({
    route: "studio-agent",
    prompts: [resolvedSystemPrompt.promptBody, safeCompletionInstruction ?? "disabled"],
  });
  const runtimeScopeKey = buildPromptCompilerCacheScopeKey({
    route: "studio-agent",
    promptTemplateVersion,
    policySchemaVersion: safetyRuntimeConfig.policySchemaVersion,
    controlPlanePolicyVersion: safetyRuntimeConfig.profile.policyVersion,
  });
  const safetyModality = resolveSafetyModality({ route: "studio-agent", flow });
  const precheckResult = runStudioAgentSafetyInputPrecheck({
    enabled: safetyRuntimeConfig.inputPrecheckEnabled,
    messages,
    context,
    canonicalPrompt: null,
    modality: safetyModality,
    profileId: safetyRuntimeConfig.profileId,
    environment: safetyRuntimeConfig.environment,
    devAbsoluteZeroEnabled: safetyRuntimeConfig.devAbsoluteZeroEnabled,
    policyDocument: safetyRuntimeConfig.policyDocument,
    rewriteRecheckMode: "allow_or_rewrite",
    fieldModes: resolveStudioAgentSafetyInputPrecheckFieldModes({
      sharedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES,
      scopedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT,
    }),
  });
  const safetyTelemetryProfileId = safetyRuntimeConfig.profileId;
  if (precheckResult.outcome !== "pass") {
    emitStudioAgentInputPrecheckTelemetry({
      flow,
      outcome: precheckResult.outcome,
      rewrittenFieldCount: precheckResult.rewrittenFieldCount,
      providerCallSkipped: precheckResult.providerCallSkipped,
      policyVersion: safetyRuntimeConfig.profile.policyVersion,
      policySchemaVersion: safetyRuntimeConfig.policySchemaVersion,
      promptTemplateVersion,
      runtimeScopeKey,
      profileId: safetyTelemetryProfileId,
      modality: precheckResult.decision?.modality ?? safetyModality,
      category: precheckResult.decision?.category ?? null,
      decisionAction: precheckResult.decision?.action ?? null,
      decisionSource: precheckResult.decision?.source ?? null,
      hardFloorViolation: precheckResult.decision?.hardFloorViolation ?? false,
      refusalField: precheckResult.scopeTelemetry.refusalField,
      rewrittenFields: precheckResult.scopeTelemetry.rewrittenFields,
      nonBlockingSignalCount: precheckResult.scopeTelemetry.nonBlockingSignalCount,
      safeCompletionTelemetry:
        precheckResult.outcome === "refusal"
          ? buildSafeCompletionTelemetryDisposition({
              enabled: safetyRuntimeConfig.safeCompletionEnabled,
              recoverySkipReason: precheckResult.decision?.hardFloorViolation
                ? "hard_floor"
                : "policy_refusal",
            })
          : undefined,
    });
  }
  if (precheckResult.outcome === "refusal") {
    return res.status(200).json(
      buildStudioAgentSafetyRefusalPayload({
        traceId,
        canonicalPrompt: null,
        reasonCode: "SAFETY_INPUT_REFUSAL",
      })
    );
  }
  messages = precheckResult.messages;
  context = precheckResult.context;
  const textPayloadChars = measureStandardTextPayloadChars({ messages, context });
  const textPayloadSummary = summarizeStandardTextPayload({ messages, context });
  const executionProfile = resolveStandardOpenAiExecutionProfile({
    flow,
    openAiModel: openAiConfig.openAiModel,
    openAiVisionModel: openAiConfig.openAiVisionModel,
    turnTimeoutMs: openAiConfig.turnTimeoutMs,
    visionTimeoutMs: openAiConfig.visionTimeoutMs,
    pulseTurnTimeoutMs: openAiConfig.pulseTurnTimeoutMs,
    textPayloadChars,
  });
  const standardModel = executionProfile.model;
  const webSearchToolChoice = resolveStandardWebSearchToolChoice({
    flow,
    latestUserText: resolveLatestStandardUserText(messages),
    mode: openAiConfig.standardWebSearchMode,
  });
  const openAiRoundTripStartedAt = Date.now();
  const standardOpenAiMessages = buildStandardOpenAiMessages({
    messages,
    context,
    systemPrompt: resolvedSystemPrompt.promptBody,
    imageDetail: executionProfile.imageDetail,
    webSearchToolChoice,
    safeCompletionInstruction,
  });
  try {
    const directResponseResult = await executeStandardOpenAiWithRetry({
      apiKey,
      openAiUrl: openAiConfig.openAiUrl,
      model: standardModel,
      messages: standardOpenAiMessages,
      timeoutMs: executionProfile.timeoutMs,
      maxAttempts: openAiConfig.upstreamRetryMaxAttempts,
      retryBaseDelayMs: openAiConfig.upstreamRetryBaseDelayMs,
      retryMaxDelayMs: openAiConfig.upstreamRetryMaxDelayMs,
      responsesEnabled: openAiConfig.standardResponsesEnabled,
      chatFallbackEnabled: openAiConfig.standardChatFallbackEnabled,
      webSearchToolChoice,
      env: {
        ...process.env,
        SHORTPULSE_OPENAI_RESPONSES_ENABLED:
          openAiConfig.standardResponsesEnabled || Boolean(webSearchToolChoice) ? "true" : "false",
        SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED:
          openAiConfig.standardChatFallbackEnabled && !webSearchToolChoice ? "true" : "false",
      },
    });
    markStage("standard_openai_roundtrip", openAiRoundTripStartedAt);

    if (!directResponseResult.ok) {
      const safetyRefusal =
        typeof directResponseResult.status === "number" &&
        isStudioAgentSafetyRefusalUpstreamError({
          status: directResponseResult.status,
          detail: directResponseResult.detail,
        });
      const providerErrorHandling = resolveProviderErrorHandling({
        status: directResponseResult.status,
        detail: directResponseResult.detail,
        safetyRefusal,
        normalizationMode: providerErrorNormalizationMode,
      });
      if (directResponseResult.error) {
        throw Object.assign(
          directResponseResult.error instanceof Error
            ? directResponseResult.error
            : new Error(directResponseResult.detail),
          { retryCount: directResponseResult.retryCount }
        );
      }

      if (providerErrorHandling.failureResolution === "canonical_refusal") {
        emitStudioAgentTurnTelemetry({
          flow,
          path: STANDARD_TELEMETRY_PATH,
          status: "refuse",
          traceId,
          model: standardModel,
          outcomeClass: "refusal_safety",
          retryUsed: directResponseResult.retryCount > 0,
          retryCount: directResponseResult.retryCount,
          reasonCode: "PROVIDER_SAFETY_REFUSAL",
          totalLatencyMs: Date.now() - requestStartedAt,
          stageLatencyMs,
          safetyTelemetry: {
            policyVersion: safetyRuntimeConfig.profile.policyVersion,
            policySchemaVersion: safetyRuntimeConfig.policySchemaVersion,
            promptTemplateVersion,
            runtimeScopeKey,
            profileId: safetyTelemetryProfileId,
            modality: safetyModality,
            decisionAction: "refuse",
            providerBlocked: true,
            ...buildSafeCompletionTelemetryDisposition({
              enabled: safetyRuntimeConfig.safeCompletionEnabled,
              recoverySkipReason: "not_model_refusal",
            }),
          },
        });
        return res.status(200).json(
          buildStudioAgentSafetyRefusalPayload({
            traceId,
            canonicalPrompt: null,
            reasonCode: "PROVIDER_SAFETY_REFUSAL",
          })
        );
      }

      emitStudioAgentTurnTelemetry({
        flow,
        path: STANDARD_TELEMETRY_PATH,
        status: "error",
        traceId,
        model: standardModel,
        outcomeClass: "upstream_error",
        retryUsed: directResponseResult.retryCount > 0,
        retryCount: directResponseResult.retryCount,
        reasonCode: "UPSTREAM_ERROR",
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
        safetyTelemetry: {
          runtimeScopeKey: "studio-agent-standard",
        },
      });
      return res.status(directResponseResult.status ?? 502).json(
        buildStudioAgentUpstreamErrorPayload({
          traceId,
          detail: providerErrorHandling.detailForClient ?? directResponseResult.detail,
        })
      );
    }

    const directPayload = await directResponseResult.response.json();
    const directResult =
      directResponseResult.transport === "responses"
        ? extractStandardOpenAiResponsesResult({
            payload: directPayload,
            fallbackPrompt: messages[messages.length - 1]?.content?.trim() || "",
          })
        : extractStandardOpenAiResponse({
            payload: directPayload,
            fallbackPrompt: messages[messages.length - 1]?.content?.trim() || "",
          });
    if (!directResult) {
      emitStudioAgentTurnTelemetry({
        flow,
        path: STANDARD_TELEMETRY_PATH,
        status: "error",
        traceId,
        model: standardModel,
        outcomeClass: "upstream_error",
        retryUsed: directResponseResult.retryCount > 0,
        retryCount: directResponseResult.retryCount,
        reasonCode: "UPSTREAM_ERROR",
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
        safetyTelemetry: {
          runtimeScopeKey: "studio-agent-standard",
        },
      });
      return res.status(502).json(
        buildStudioAgentUpstreamErrorPayload({
          traceId,
          detail: "Standard agent output contract violation.",
          stage: "standard_openai_response",
        })
      );
    }

    let resolvedDirectResult = directResult;
    let recoveryEligible = false;
    let recoveryAttempted = false;
    let recoveryOutcome: SafeCompletionRecoveryOutcome = "not_attempted";
    let recoverySkipReason: SafeCompletionRecoverySkipReason | null = "not_model_refusal";
    let recoveryLatencyMs: number | null = null;

    if (directResult.refusal) {
      const eligibility = resolveSafeCompletionRecoveryEligibility({
        enabled: safetyRuntimeConfig.safeCompletionEnabled,
        inputPrecheckEnabled: safetyRuntimeConfig.inputPrecheckEnabled,
        decision: precheckResult.decision,
        latestUserText: originalLatestUserText,
        refusalSource: directResult.refusalSource,
        hasUnclassifiedMedia: flow === "MIXED",
      });
      recoveryEligible = eligibility.eligible;
      recoverySkipReason = eligibility.eligible ? null : eligibility.skipReason;
      if (eligibility.eligible) {
        recoveryAttempted = true;
        const recoveryStartedAt = Date.now();
        try {
          const recoveryResponseResult = await executeStandardOpenAiWithRetry({
            apiKey,
            openAiUrl: openAiConfig.openAiUrl,
            model: standardModel,
            messages: withSafeCompletionRecoveryInstruction(standardOpenAiMessages),
            timeoutMs: executionProfile.timeoutMs,
            maxAttempts: 1,
            retryBaseDelayMs: openAiConfig.upstreamRetryBaseDelayMs,
            retryMaxDelayMs: openAiConfig.upstreamRetryMaxDelayMs,
            responsesEnabled: directResponseResult.transport === "responses",
            chatFallbackEnabled: false,
            webSearchToolChoice: null,
            env: {
              ...process.env,
              SHORTPULSE_OPENAI_RESPONSES_ENABLED:
                directResponseResult.transport === "responses" ? "true" : "false",
              SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED: "false",
            },
          });
          if (recoveryResponseResult.ok) {
            const recoveryPayload = await recoveryResponseResult.response.json();
            const recoveryResult =
              recoveryResponseResult.transport === "responses"
                ? extractStandardOpenAiResponsesResult({
                    payload: recoveryPayload,
                    fallbackPrompt: originalLatestUserText,
                  })
                : extractStandardOpenAiResponse({
                    payload: recoveryPayload,
                    fallbackPrompt: originalLatestUserText,
                  });
            if (recoveryResult && !recoveryResult.refusal) {
              resolvedDirectResult = recoveryResult;
              recoveryOutcome = "recovered";
            } else if (recoveryResult?.refusal) {
              recoveryOutcome = "refused";
            } else {
              recoveryOutcome = "error";
            }
          } else {
            recoveryOutcome = "error";
          }
        } catch {
          recoveryOutcome = "error";
        } finally {
          recoveryLatencyMs = Date.now() - recoveryStartedAt;
          markStage("safe_completion_recovery", recoveryStartedAt);
        }
      }
    }

    const safetyFinalization = await finalizeStudioAgentResponseSafety({
      response: resolvedDirectResult.response,
      refusal: resolvedDirectResult.refusal,
      canonicalPrompt: null,
      fallbackCanonicalPrompt: null,
      route: "studio-agent",
      flow,
      mode: safetyRuntimeConfig.postProcessMode,
      debug: safetyRuntimeConfig.debugEnabled,
      traceId,
      profileId: safetyRuntimeConfig.profileId,
      environment: safetyRuntimeConfig.environment,
      devAbsoluteZeroEnabled: safetyRuntimeConfig.devAbsoluteZeroEnabled,
      modality: safetyModality,
      policyDocument: safetyRuntimeConfig.policyDocument,
    });
    let safetyRollbackTriggered = false;
    if (safetyFinalization.hardFloorViolation) {
      try {
        const rollbackResult = await maybeTriggerSafetyIncidentAutoRollback({
          environment: safetyRuntimeConfig.environment,
          autoRollbackEnabled: safetyRuntimeConfig.autoRollbackEnabled,
          hardFloorViolation: true,
          actorUserId: user.id,
          actorEmail: user.email ?? null,
          source: "studio_agent_standard_runtime_hard_floor",
          reason: "Standard studio agent runtime hard-floor incident.",
        });
        safetyRollbackTriggered = rollbackResult.rollbackTriggered;
      } catch (error) {
        await logApiRouteException({
          req,
          error,
          routeLabel: STANDARD_ROUTE_LABEL,
          metadata: {
            trace_id: traceId,
            user_id: user.id,
            conversation_id: normalizedConversationId,
            stage: "safety_auto_rollback",
          },
        });
      }
    }
    const safeCompletionTelemetry = {
      policyVersion: safetyRuntimeConfig.profile.policyVersion,
      policySchemaVersion: safetyRuntimeConfig.policySchemaVersion,
      promptTemplateVersion,
      runtimeScopeKey,
      profileId: safetyTelemetryProfileId,
      modality: safetyModality,
      category: safetyFinalization.decisionCategory,
      decisionAction: safetyFinalization.decisionAction,
      decisionSource: safetyFinalization.decisionSource,
      hardFloorViolation: safetyFinalization.hardFloorViolation,
      rollbackTriggered: safetyRollbackTriggered,
      ...buildSafeCompletionTelemetryDisposition({
        enabled: safetyRuntimeConfig.safeCompletionEnabled,
        refusalSource: directResult.refusalSource,
        recoveryEligible,
        recoveryAttempted,
        recoveryOutcome,
        recoverySkipReason,
        recoveryLatencyMs,
      }),
    } as const;

    if (safetyFinalization.refusal) {
      emitStudioAgentTurnTelemetry({
        flow,
        path: STANDARD_TELEMETRY_PATH,
        status: "refuse",
        traceId,
        model: standardModel,
        outcomeClass: safetyFinalization.forcedRefusal ? "refusal_safety" : "refusal_model",
        retryUsed: directResponseResult.retryCount > 0,
        retryCount: directResponseResult.retryCount,
        reasonCode: safetyFinalization.forcedRefusal
          ? "SAFETY_OUTPUT_REFUSAL"
          : "PROVIDER_SAFETY_REFUSAL",
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
        safetyOutcome:
          safetyFinalization.outcome === "pass" ? undefined : safetyFinalization.outcome,
        safetySource: safetyFinalization.outcome === "pass" ? undefined : "model_output",
        safetyFallback:
          safetyFinalization.outcome === "pass" ? undefined : safetyFinalization.fallbackUsed,
        safetyDebugReason: safetyFinalization.debugReason,
        safetyDebugEnabled: safetyRuntimeConfig.debugEnabled,
        safetyTelemetry: safeCompletionTelemetry,
      });
      return res.status(200).json(
        buildStudioAgentSafetyRefusalPayload({
          traceId,
          canonicalPrompt: null,
          reasonCode: safetyFinalization.forcedRefusal
            ? "SAFETY_OUTPUT_REFUSAL"
            : "PROVIDER_SAFETY_REFUSAL",
          outcomeClass: safetyFinalization.forcedRefusal ? "refusal_safety" : "refusal_model",
        })
      );
    }

    const successOutcome = resolveStandardSuccessOutcomeClass(safetyFinalization.response);

    emitStudioAgentTurnTelemetry({
      flow,
      path: STANDARD_TELEMETRY_PATH,
      status: "success",
      traceId,
      model: standardModel,
      outcomeClass: successOutcome.outcomeClass,
      retryUsed: directResponseResult.retryCount > 0,
      retryCount: directResponseResult.retryCount,
      reasonCode: successOutcome.reasonCode,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      safetyOutcome: safetyFinalization.outcome === "pass" ? undefined : safetyFinalization.outcome,
      safetySource: safetyFinalization.outcome === "pass" ? undefined : "model_output",
      safetyFallback:
        safetyFinalization.outcome === "pass" ? undefined : safetyFinalization.fallbackUsed,
      safetyDebugReason: safetyFinalization.debugReason,
      safetyDebugEnabled: safetyRuntimeConfig.debugEnabled,
      safetyTelemetry: safeCompletionTelemetry,
    });
    return res.status(200).json({
      ...safetyFinalization.response,
      ...buildAgentMachineOutcome({
        outcomeClass: successOutcome.outcomeClass,
        reasonCode: successOutcome.reasonCode,
      }),
      canonicalPrompt: null,
      traceId,
    });
  } catch (error) {
    markStage("standard_openai_roundtrip", openAiRoundTripStartedAt);
    await logApiRouteException({
      req,
      error,
      routeLabel: STANDARD_ROUTE_LABEL,
      metadata: {
        trace_id: traceId,
        user_id: user.id,
        conversation_id: normalizedConversationId,
        stage: "standard_openai",
        flow,
        execution_model: standardModel,
        execution_image_detail: executionProfile.imageDetail,
        effective_timeout_ms: executionProfile.timeoutMs,
        configured_turn_timeout_ms: openAiConfig.turnTimeoutMs,
        configured_vision_timeout_ms: openAiConfig.visionTimeoutMs,
        configured_pulse_turn_timeout_ms: openAiConfig.pulseTurnTimeoutMs,
        message_count: messages.length,
        retry_count:
          typeof (error as { retryCount?: unknown })?.retryCount === "number"
            ? ((error as { retryCount: number }).retryCount ?? 0)
            : 0,
        text_payload_chars: textPayloadSummary.textPayloadChars,
        latest_user_chars: textPayloadSummary.latestUserChars,
        prompt_reference_chars: textPayloadSummary.promptReferenceChars,
        prompt_reference_snippet_count: textPayloadSummary.promptReferenceSnippetCount,
        stage_latency_ms: stageLatencyMs,
        ...summarizeStandardContextForExceptionLog(context),
      },
    });
    const detail = formatStudioAgentErrorMessage(error);
    const providerErrorHandling = resolveProviderErrorHandling({
      detail,
      normalizationMode: providerErrorNormalizationMode,
    });
    emitStudioAgentTurnTelemetry({
      flow,
      path: STANDARD_TELEMETRY_PATH,
      status: "error",
      traceId,
      model: standardModel,
      outcomeClass: "upstream_error",
      retryUsed:
        typeof (error as { retryCount?: unknown })?.retryCount === "number" &&
        ((error as { retryCount: number }).retryCount ?? 0) > 0,
      retryCount:
        typeof (error as { retryCount?: unknown })?.retryCount === "number"
          ? ((error as { retryCount: number }).retryCount ?? 0)
          : 0,
      reasonCode: "UPSTREAM_ERROR",
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      safetyTelemetry: {
        runtimeScopeKey: "studio-agent-standard",
      },
    });
    return res.status(502).json(
      buildStudioAgentUpstreamErrorPayload({
        traceId,
        detail: providerErrorHandling.detailForClient ?? detail,
        stage: "standard_openai",
      })
    );
  }
};
