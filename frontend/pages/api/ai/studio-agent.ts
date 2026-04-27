/**
 * AI Studio Agent API: brokers chat+vision requests to the configured LLM.
 * Keeps system prompt and context handling server-side to protect keys and size limits.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { loadAgentPrompt } from "../../../lib/agentPromptLoader";
import { sanitizeGenerationPromptText } from "../../../features/agent-core/promptText";
import { pickSelectedReferencesForThinker } from "../../../features/ai-agent/logic/studioAgentReferenceSelection";
import { buildStudioAgentOrchestration } from "../../../features/ai-agent/logic/studioAgentOrchestration";
import { readStudioAgentCanonicalPrompt } from "../../../features/agent-runtime/studioAgentCanonicalPersistence";
import {
  fetchStudioAgentChatCompletion,
  formatStudioAgentErrorMessage,
  resolveStudioAgentOpenAiConfig,
} from "../../../features/agent-runtime/studioAgentOpenAiGateway";
import { executeStudioAgentCoordinator } from "../../../features/agent-runtime/studioAgentCoordinator";
import {
  resolveStudioAgentSafetyInputPrecheckFieldModes,
  runStudioAgentSafetyInputPrecheck,
} from "../../../features/agent-runtime/studioAgentSafetyInputPrecheck";
import {
  resolveSafetyEnvironment,
  resolveSafetyModality,
} from "../../../features/agent-runtime/safetyPolicy/decisionEngine";
import { resolveSafetyPolicyDocument } from "../../../features/agent-runtime/safetyPolicy/policyDocument";
import { resolveProviderErrorNormalizationMode } from "../../../features/agent-runtime/safetyPolicy/providerErrorPolicy";
import {
  buildStudioAgentInfraFallbackPayload,
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentSafetyRefusalPayload,
  emitStudioAgentInputPrecheckTelemetry,
  emitStudioAgentUntrustedImageTextTelemetry,
} from "../../../features/agent-runtime/studioAgentRouteOutcomes";
import {
  isStudioAgentFeatureEnabled,
  parseStudioAgentRequestEnvelope,
  resolveStudioAgentTraceId,
  sendStudioAgentError,
  setStudioAgentContractHeaders,
} from "../../../features/agent-runtime/studioAgentRouteEnvelope";
import {
  applyStudioAgentVisionSummariesToContext,
  buildStudioAgentImageSummaryMap,
  describeStudioAgentVisionSummaryError,
} from "../../../features/agent-runtime/studioAgentVisionSummaries";
import {
  buildAgentMachineOutcome,
  resolveInfraFallbackReasonCode,
} from "../../../features/agent-runtime/agentMachineOutcome";
import { resolveStudioAgentFallbackReasonLabel } from "../../../features/agent-runtime/studioAgentFallbackReason";
import {
  buildPromptCompilerCacheScopeKey,
  resolvePromptTemplateVersion,
} from "../../../features/agent-runtime/promptCompilerCacheScopeKey";
import {
  buildStudioAgentWorkflowSessionUpdate,
  buildStudioAgentPulseSystemMessage,
  isStudioAgentWorkflowPulse,
  resolveLatestStudioAgentUserInput,
} from "../../../features/agent-runtime/studioAgentPulseRuntime";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { clampCanonicalPrompt } from "../../../lib/server/api/agentConversationState";
import { resolveRuntimeSafetyProfile } from "../../../lib/server/api/agentSafetyPolicyControlPlane";
import { emitStudioAgentTurnTelemetry } from "../../../features/agent-runtime/studioAgentRouteOutcomes";
import type { AgentContext, AgentMessage } from "../../../prefabs/agent";
import type { OpenAiChatMessage } from "../../../lib/server/api/openAiCompat";
import {
  extractStudioAgentCompletionText,
  hasStructuredJsonCandidates,
  parseStudioAgentJsonWithStatus,
} from "../../../features/agent-runtime/studioAgentResponseNormalization";

const DEFAULT_DIRECT_OPENAI_MODEL = "gpt-5.4";
const DIRECT_OPENAI_SYSTEM_PROMPT = `You are a professional prompt writer for image generation.
Optimize prompts for Google Nano Banana family image models and Seedream family image models.
Be concise, helpful, and business casual.

If the user is asking for help, answer briefly and directly.
If the user attaches an image, analyze the image visually and turn it into a detailed generation-ready prompt.
If the user asks you to describe an image or convert it into a prompt, base your answer on the visible content plus any user instructions. 
  - You must capture every nuance of the image. Describe the subject, composition, lighting, style, and quality details in a way that would allow a similar image to be generated. 
  - Describe the subject with specific nouns and adjectives, the composition with spatial relationships and framing details, the lighting with references to time of day, light quality, and shadows, the style with art movement or medium references, and the quality with details like resolution, clarity, and color depth. 
  - If the subject is a person, describe their appearance, clothing, expression, and pose in detail. Capture eye color, hair color and style, skin tone, clothing colors and styles, facial expression, and body pose.
If the user's message appears to be an image-generation prompt or a request to create one, rewrite it into a strong production-ready prompt with clear subject, composition, lighting, style, and quality details.
When rewriting a prompt, return only the final prompt unless the user explicitly asks for explanation.
Do not add markdown, labels, or extra commentary unless the user asks for it.`;
const DIRECT_OPENAI_WORKFLOW_SYSTEM_PROMPT = `You are the ShortPulse workflow pulse runtime.
Behave like a guided custom GPT workflow.
Follow the ACTIVE PULSE PROFILE system message exactly.
You may ask the next required question or return a final artifact when the workflow is complete.
Do not force every answer into a rewritten prompt.
Return only JSON with this exact shape and no markdown:
{"status":"needs_input"|"ready"|"refuse","message":"string","actions":{"applyPrompt":"string|null"}}
Use status="needs_input" when you are asking the next question or collecting workflow input.
Use status="ready" only when the workflow is complete and you are returning the final artifact.
Use status="refuse" only when the request is disallowed or unsafe.
Keep message content as plain text, but shape it for rich rendering with strong headings, blank lines, separator lines, and emphasis markers when helpful.
When presenting choices, prefer a polished layout with a short heading, a brief intro, a reply-choice row or numbered options, and a concise follow-up hint.
Ask one question at a time and make the next user response obvious.
If the user already gave a valid non-empty answer to the current step, do not repeat the same step verbatim. Continue, or ask one narrow clarification only if the answer is unusable.
For input-collection turns, do not include workflow labels such as "CURRENT STEP" or a standalone step title. Prefer:
<short heading>

<one short question or intro>

Reply with:

1) <option one>
2) <option two>

Reply with one option or type your own.`;
const DIRECT_OPENAI_IMAGE_FALLBACK_TEXT =
  "Describe this image as a detailed production-ready prompt for image generation.";

const resolveDirectOpenAiBypassEnabled = (env: NodeJS.ProcessEnv): boolean =>
  env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED === "true";

const resolveDirectOpenAiModel = (env: NodeJS.ProcessEnv): string =>
  env.STUDIO_AGENT_DIRECT_OPENAI_MODEL?.trim() || DEFAULT_DIRECT_OPENAI_MODEL;

const buildDirectOpenAiMessages = ({
  messages,
  context,
}: {
  messages: AgentMessage[];
  context: AgentContext;
}): OpenAiChatMessage[] => {
  const pulseSystemMessage = buildStudioAgentPulseSystemMessage(context.pulse);
  const workflowPulseActive = isStudioAgentWorkflowPulse(context.pulse);
  const imageParts =
    context.media
      ?.filter((item) => item.kind === "image" && typeof item.url === "string" && item.url.length)
      .map((item) => ({
        type: "image_url" as const,
        image_url: {
          url: item.url as string,
          detail: "high" as const,
        },
      })) ?? [];
  const latestUserIndex = messages.reduce(
    (latestIndex, message, index) => (message.role === "user" ? index : latestIndex),
    -1
  );

  return [
    {
      role: "system",
      content: workflowPulseActive
        ? DIRECT_OPENAI_WORKFLOW_SYSTEM_PROMPT
        : DIRECT_OPENAI_SYSTEM_PROMPT,
    },
    ...(pulseSystemMessage ? [{ role: "system" as const, content: pulseSystemMessage }] : []),
    ...messages.map((message, index): OpenAiChatMessage => {
      const role = message.role === "assistant" ? "assistant" : "user";
      if (index !== latestUserIndex || !imageParts.length || role !== "user") {
        return {
          role,
          content: message.content,
        };
      }
      const textContent = message.content.trim() || DIRECT_OPENAI_IMAGE_FALLBACK_TEXT;
      return {
        role,
        content: [{ type: "text", text: textContent }, ...imageParts],
      };
    }),
  ];
};

const extractDirectOpenAiResponse = ({
  payload,
  pulse,
}: {
  payload: unknown;
  pulse?: AgentContext["pulse"] | null;
}): {
  message: string;
  actions?: { applyPrompt?: string | null };
  semanticStatus?: string | null;
} | null => {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const raw = choices?.[0]?.message?.content;
  if (isStudioAgentWorkflowPulse(pulse)) {
    if (!hasStructuredJsonCandidates(raw)) {
      return null;
    }
    const parsed = parseStudioAgentJsonWithStatus(raw);
    if (parsed?.response.message?.trim()) {
      return {
        message: parsed.response.message.trim(),
        actions: parsed.response.actions,
        semanticStatus: parsed.status ?? null,
      };
    }
    return null;
  }
  const directMessage = sanitizeGenerationPromptText(
    typeof raw === "string" ? raw : extractStudioAgentCompletionText(raw)
  );
  if (!directMessage?.trim().length) return null;
  return {
    message: directMessage.trim(),
    actions: {
      applyPrompt: directMessage.trim(),
    },
  };
};

const resolveDirectOpenAiBypassFlow = (
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
    return res.status(500).json({
      ...buildStudioAgentRouteFailurePayload({
        traceId,
        detail: "OPENAI_API_KEY is not set",
        reasonCode: "CONFIG_MISSING",
      }),
      error: "OPENAI_API_KEY is not set",
    });
  }

  const normalizedConversationId = requestEnvelope.value.clientSessionKey;
  let messages = requestEnvelope.value.messages;
  let context = requestEnvelope.value.context;
  const incomingCanonical = requestEnvelope.value.incomingCanonical;
  const directOpenAiBypassRequested = requestEnvelope.value.directOpenAiBypass;

  const directOpenAiBypassEnabled = resolveDirectOpenAiBypassEnabled(process.env);
  const safetyInputPrecheckEnabled =
    process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED !== "false";
  const safetyDebugEnabled = process.env.STUDIO_AGENT_SAFETY_DEBUG === "true";
  const safetyProfile = await resolveRuntimeSafetyProfile({
    envProfileId: process.env.STUDIO_AGENT_SAFETY_PROFILE_ACTIVE ?? null,
  });
  const safetyProfileId = safetyProfile.profileId;
  const safetyPolicyDocument = resolveSafetyPolicyDocument({
    activePolicy: safetyProfile.activePolicy,
    profileId: safetyProfileId,
  });
  const safetyPolicySchemaVersion = safetyPolicyDocument.schemaVersion;
  const safetyEnvironment = resolveSafetyEnvironment(process.env.NODE_ENV);
  const safetyDevAbsoluteZeroEnabled =
    process.env.STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED === "true";
  const openAiConfig = resolveStudioAgentOpenAiConfig(process.env);
  const { openAiUrl, turnTimeoutMs } = openAiConfig;
  const directOpenAiModel = resolveDirectOpenAiModel(process.env);

  if (directOpenAiBypassEnabled && directOpenAiBypassRequested) {
    const directBypassFlow = resolveDirectOpenAiBypassFlow(context);
    const directSafetyModality = resolveSafetyModality({
      route: "studio-agent",
      flow: directBypassFlow,
    });
    const directCanonicalPrompt =
      incomingCanonical ?? sanitizeGenerationPromptText(context.lastAssistantMessage) ?? null;
    let effectiveCanonical = clampCanonicalPrompt(directCanonicalPrompt);
    const directPrecheckStartedAt = Date.now();
    const precheckResult = runStudioAgentSafetyInputPrecheck({
      enabled: safetyInputPrecheckEnabled,
      messages,
      context,
      canonicalPrompt: effectiveCanonical,
      modality: directSafetyModality,
      profileId: safetyProfileId,
      environment: safetyEnvironment,
      devAbsoluteZeroEnabled: safetyDevAbsoluteZeroEnabled,
      policyDocument: safetyPolicyDocument,
      rewriteRecheckMode: "allow_or_rewrite",
      fieldModes: resolveStudioAgentSafetyInputPrecheckFieldModes({
        sharedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES,
        scopedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT,
      }),
    });
    markStage("direct_bypass_input_precheck", directPrecheckStartedAt);
    const safetyTelemetryProfileId =
      safetyProfileId === "prod_safe_v1" ||
      safetyProfileId === "staging_lenient" ||
      safetyProfileId === "dev_absolute_zero"
        ? safetyProfileId
        : null;
    if (precheckResult.outcome !== "pass") {
      emitStudioAgentInputPrecheckTelemetry({
        flow: directBypassFlow,
        outcome: precheckResult.outcome,
        rewrittenFieldCount: precheckResult.rewrittenFieldCount,
        providerCallSkipped: precheckResult.providerCallSkipped,
        policyVersion: safetyProfile.policyVersion,
        policySchemaVersion: safetyPolicyDocument.schemaVersion,
        promptTemplateVersion: null,
        runtimeScopeKey: null,
        profileId: safetyTelemetryProfileId,
        modality: precheckResult.decision?.modality ?? "text",
        category: precheckResult.decision?.category ?? null,
        decisionAction: precheckResult.decision?.action ?? null,
        decisionSource: precheckResult.decision?.source ?? null,
        hardFloorViolation: precheckResult.decision?.hardFloorViolation ?? false,
        refusalField: precheckResult.scopeTelemetry.refusalField,
        rewrittenFields: precheckResult.scopeTelemetry.rewrittenFields,
        nonBlockingSignalCount: precheckResult.scopeTelemetry.nonBlockingSignalCount,
      });
    }
    if (precheckResult.outcome === "refusal") {
      return res.status(200).json(
        buildStudioAgentSafetyRefusalPayload({
          traceId,
          canonicalPrompt: precheckResult.canonicalPrompt,
          reasonCode: "SAFETY_INPUT_REFUSAL",
        })
      );
    }
    messages = precheckResult.messages;
    context = precheckResult.context;
    effectiveCanonical = precheckResult.canonicalPrompt;

    const directOpenAiRoundTripStartedAt = Date.now();
    try {
      const directMessages = buildDirectOpenAiMessages({
        messages,
        context,
      });
      const directResponse = await fetchStudioAgentChatCompletion({
        apiKey,
        openAiUrl,
        model: directOpenAiModel,
        messages: directMessages,
        timeoutMs: turnTimeoutMs,
      });
      markStage("direct_openai_roundtrip", directOpenAiRoundTripStartedAt);

      if (!directResponse.ok) {
        const detail = await directResponse.text();
        const reasonCode = resolveInfraFallbackReasonCode({
          status: directResponse.status,
          detail,
        });
        const fallbackReason = resolveStudioAgentFallbackReasonLabel({
          status: directResponse.status,
          detail,
        });
        emitStudioAgentTurnTelemetry({
          flow: directBypassFlow,
          path: "direct_openai_bypass",
          status: "success",
          model: directOpenAiModel,
          outcomeClass: "fallback_infra",
          retryUsed: false,
          reasonCode,
          totalLatencyMs: Date.now() - requestStartedAt,
          stageLatencyMs,
          fallbackReason,
          safetyTelemetry: {
            policyVersion: safetyProfile.policyVersion,
            policySchemaVersion: safetyPolicyDocument.schemaVersion,
            promptTemplateVersion: null,
            runtimeScopeKey: null,
            profileId: safetyTelemetryProfileId,
            modality: directSafetyModality,
          },
        });
        return res.status(200).json(
          buildStudioAgentInfraFallbackPayload({
            traceId,
            canonicalPrompt: effectiveCanonical,
            reasonCode,
            fallbackReason,
          })
        );
      }

      const directPayload = await directResponse.json();
      const directResult = extractDirectOpenAiResponse({
        payload: directPayload,
        pulse: context.pulse,
      });
      if (!directResult) {
        emitStudioAgentTurnTelemetry({
          flow: directBypassFlow,
          path: "direct_openai_bypass",
          status: "success",
          model: directOpenAiModel,
          outcomeClass: "fallback_infra",
          retryUsed: false,
          reasonCode: "INFRA_FALLBACK_OUTPUT_CONTRACT",
          totalLatencyMs: Date.now() - requestStartedAt,
          stageLatencyMs,
          fallbackReason: "stage_prompt_missing",
          safetyTelemetry: {
            policyVersion: safetyProfile.policyVersion,
            policySchemaVersion: safetyPolicyDocument.schemaVersion,
            promptTemplateVersion: null,
            runtimeScopeKey: null,
            profileId: safetyTelemetryProfileId,
            modality: directSafetyModality,
          },
        });
        return res.status(200).json(
          buildStudioAgentInfraFallbackPayload({
            traceId,
            canonicalPrompt: effectiveCanonical,
            reasonCode: "INFRA_FALLBACK_OUTPUT_CONTRACT",
            fallbackReason: "stage_prompt_missing",
          })
        );
      }

      const nextCanonical = clampCanonicalPrompt(
        directResult.actions?.applyPrompt ?? effectiveCanonical
      );
      const directOutcomeClass = directResult.actions?.applyPrompt
        ? "success_prompt"
        : "success_message";
      const directReasonCode = directResult.actions?.applyPrompt
        ? "SUCCESS_PROMPT"
        : "SUCCESS_MESSAGE";
      emitStudioAgentTurnTelemetry({
        flow: directBypassFlow,
        path: "direct_openai_bypass",
        status: "success",
        model: directOpenAiModel,
        outcomeClass: directOutcomeClass,
        retryUsed: false,
        reasonCode: directReasonCode,
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
        safetyTelemetry: {
          policyVersion: safetyProfile.policyVersion,
          policySchemaVersion: safetyPolicyDocument.schemaVersion,
          promptTemplateVersion: null,
          runtimeScopeKey: null,
          profileId: safetyTelemetryProfileId,
          modality: directSafetyModality,
        },
      });
      return res.status(200).json({
        message: directResult.message,
        actions: directResult.actions,
        workflowSession: buildStudioAgentWorkflowSessionUpdate({
          pulse: context.pulse,
          response: directResult,
          semanticStatus: directResult.semanticStatus ?? null,
          latestUserInput: resolveLatestStudioAgentUserInput(messages),
        }),
        ...buildAgentMachineOutcome({
          outcomeClass: directOutcomeClass,
          reasonCode: directReasonCode,
        }),
        canonicalPrompt: nextCanonical,
        traceId,
      });
    } catch (error) {
      markStage("direct_openai_roundtrip", directOpenAiRoundTripStartedAt);
      await logApiRouteException({
        req,
        error,
        routeLabel: "ai/studio-agent",
        metadata: {
          user_id: user.id,
          conversation_id: normalizedConversationId,
          stage: "direct_openai_bypass",
        },
      });
      const fallbackReason = resolveStudioAgentFallbackReasonLabel({
        detail: formatStudioAgentErrorMessage(error),
      });
      const reasonCode = resolveInfraFallbackReasonCode({
        detail: formatStudioAgentErrorMessage(error),
      });
      emitStudioAgentTurnTelemetry({
        flow: directBypassFlow,
        path: "direct_openai_bypass",
        status: "success",
        model: directOpenAiModel,
        outcomeClass: "fallback_infra",
        retryUsed: false,
        reasonCode,
        totalLatencyMs: Date.now() - requestStartedAt,
        stageLatencyMs,
        fallbackReason,
        safetyTelemetry: {
          policyVersion: safetyProfile.policyVersion,
          policySchemaVersion: safetyPolicyDocument.schemaVersion,
          promptTemplateVersion: null,
          runtimeScopeKey: null,
          profileId: safetyTelemetryProfileId,
          modality: directSafetyModality,
        },
      });
      return res.status(200).json(
        buildStudioAgentInfraFallbackPayload({
          traceId,
          canonicalPrompt: effectiveCanonical,
          reasonCode,
          fallbackReason,
        })
      );
    }
  }

  const canonicalDbEnabled = process.env.STUDIO_AGENT_CANONICAL_DB_ENABLED !== "false";
  const serverVisionEnabled = process.env.STUDIO_AGENT_SERVER_VISION_ENABLED !== "false";
  const singleStageEnabled = process.env.STUDIO_AGENT_SINGLE_STAGE_ENABLED !== "false";
  const legacyV2FallbackEnabled = process.env.STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED === "true";
  const textFastPathEnabled = process.env.STUDIO_AGENT_TEXT_FAST_PATH_ENABLED !== "false";
  const envPostprocessMode = String(process.env.STUDIO_AGENT_SAFETY_POSTPROCESS_MODE ?? "")
    .trim()
    .toLowerCase();
  const safetyPostProcessMode =
    envPostprocessMode === "enforce" ||
    envPostprocessMode === "shadow" ||
    envPostprocessMode === "off"
      ? envPostprocessMode
      : process.env.STUDIO_AGENT_SAFETY_POSTPROCESS_ENABLED === "false"
        ? "off"
        : safetyPolicyDocument.postprocess.mode;
  const safetyProviderErrorMode = resolveProviderErrorNormalizationMode(
    process.env.STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE
  );
  const safetyAutoRollbackEnabled = process.env.STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED === "true";
  const promptEditorSystemPrompt = loadAgentPrompt(
    "STUDIO_AGENT_SYSTEM",
    process.env.STUDIO_AGENT_SYSTEM
  );
  const workflowSystemPrompt = loadAgentPrompt(
    "STUDIO_AGENT_WORKFLOW_SYSTEM",
    process.env.STUDIO_AGENT_WORKFLOW_SYSTEM
  );
  const thinkerPrompt = loadAgentPrompt("STUDIO_AGENT_THINKER", process.env.STUDIO_AGENT_THINKER);
  const formatterPrompt = loadAgentPrompt(
    "STUDIO_AGENT_FORMATTER",
    process.env.STUDIO_AGENT_FORMATTER
  );
  const imageDescribePrompt = loadAgentPrompt(
    "OPENAI_PROMPT_IMAGE_DESCRIBE",
    process.env.OPENAI_PROMPT_IMAGE_DESCRIBE
  );
  const systemPrompt = isStudioAgentWorkflowPulse(context.pulse)
    ? (workflowSystemPrompt ?? promptEditorSystemPrompt)
    : promptEditorSystemPrompt;
  if (!systemPrompt) {
    return res.status(500).json({
      ...buildStudioAgentRouteFailurePayload({
        traceId,
        detail: "STUDIO_AGENT_SYSTEM prompt missing",
        reasonCode: "CONFIG_MISSING",
      }),
      error: "STUDIO_AGENT_SYSTEM prompt missing",
    });
  }
  const promptTemplateVersion = resolvePromptTemplateVersion({
    route: "studio-agent",
    prompts: [systemPrompt, thinkerPrompt ?? "", formatterPrompt ?? "", imageDescribePrompt ?? ""],
  });
  const runtimeScopeKey = buildPromptCompilerCacheScopeKey({
    route: "studio-agent",
    promptTemplateVersion,
    policySchemaVersion: safetyPolicySchemaVersion,
    controlPlanePolicyVersion: safetyProfile.policyVersion,
  });
  const {
    openAiModel,
    openAiVisionModel,
    openAiThinkerModel,
    openAiFormatterModel,
    visionTimeoutMs,
    upstreamRetryMaxAttempts,
    upstreamRetryBaseDelayMs,
    upstreamRetryMaxDelayMs,
  } = openAiConfig;

  const storedCanonical = await readStudioAgentCanonicalPrompt({
    req,
    userId: user.id,
    conversationId: normalizedConversationId,
    canonicalDbEnabled,
    markStage,
    formatErrorMessage: formatStudioAgentErrorMessage,
  });

  const canonicalPrompt =
    sanitizeGenerationPromptText(storedCanonical) ??
    incomingCanonical ??
    sanitizeGenerationPromptText(context.lastAssistantMessage) ??
    null;
  let effectiveCanonical = clampCanonicalPrompt(canonicalPrompt);

  const selectedReferencesBeforePrecheck = pickSelectedReferencesForThinker(context);
  const orchestrationBeforePrecheck = buildStudioAgentOrchestration({
    context,
    messages,
    selectedReferences: selectedReferencesBeforePrecheck,
    effectiveCanonical,
  });
  const precheckResult = runStudioAgentSafetyInputPrecheck({
    enabled: safetyInputPrecheckEnabled,
    messages,
    context,
    canonicalPrompt: effectiveCanonical,
    modality: resolveSafetyModality({
      route: "studio-agent",
      flow: orchestrationBeforePrecheck.flow,
    }),
    profileId: safetyProfileId,
    environment: safetyEnvironment,
    devAbsoluteZeroEnabled: safetyDevAbsoluteZeroEnabled,
    policyDocument: safetyPolicyDocument,
    rewriteRecheckMode: "allow_or_rewrite",
    fieldModes: resolveStudioAgentSafetyInputPrecheckFieldModes({
      sharedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES,
      scopedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT,
    }),
  });
  const safetyTelemetryProfileId =
    safetyProfileId === "prod_safe_v1" ||
    safetyProfileId === "staging_lenient" ||
    safetyProfileId === "dev_absolute_zero"
      ? safetyProfileId
      : null;
  if (precheckResult.outcome !== "pass") {
    emitStudioAgentInputPrecheckTelemetry({
      flow: orchestrationBeforePrecheck.flow,
      outcome: precheckResult.outcome,
      rewrittenFieldCount: precheckResult.rewrittenFieldCount,
      providerCallSkipped: precheckResult.providerCallSkipped,
      policyVersion: safetyProfile.policyVersion,
      policySchemaVersion: safetyPolicySchemaVersion,
      promptTemplateVersion,
      runtimeScopeKey,
      profileId: safetyTelemetryProfileId,
      modality: precheckResult.decision?.modality ?? "text",
      category: precheckResult.decision?.category ?? null,
      decisionAction: precheckResult.decision?.action ?? null,
      decisionSource: precheckResult.decision?.source ?? null,
      hardFloorViolation: precheckResult.decision?.hardFloorViolation ?? false,
      refusalField: precheckResult.scopeTelemetry.refusalField,
      rewrittenFields: precheckResult.scopeTelemetry.rewrittenFields,
      nonBlockingSignalCount: precheckResult.scopeTelemetry.nonBlockingSignalCount,
    });
  }
  if (precheckResult.outcome === "refusal") {
    return res.status(200).json(
      buildStudioAgentSafetyRefusalPayload({
        traceId,
        canonicalPrompt: precheckResult.canonicalPrompt,
        reasonCode: "SAFETY_INPUT_REFUSAL",
      })
    );
  }
  messages = precheckResult.messages;
  context = precheckResult.context;
  effectiveCanonical = precheckResult.canonicalPrompt;

  const selectedReferencesBeforeVision = pickSelectedReferencesForThinker(context);
  const orchestrationBeforeVision = buildStudioAgentOrchestration({
    context,
    messages,
    selectedReferences: selectedReferencesBeforeVision,
    effectiveCanonical,
  });

  let visionSummaryMap = new Map<string, string>();
  let untrustedImageTextSignalCount = 0;
  let untrustedImageTextAffectedImageCount = 0;
  let untrustedImageTextRemovedLineCount = 0;
  if (
    serverVisionEnabled &&
    imageDescribePrompt &&
    orchestrationBeforeVision.shouldRunVisionDescription &&
    (context.media?.length ?? 0) > 0
  ) {
    const visionStartedAt = Date.now();
    try {
      visionSummaryMap = await buildStudioAgentImageSummaryMap({
        openAiUrl,
        context,
        imageDescribePrompt,
        apiKey,
        visionModel: openAiVisionModel,
        timeoutMs: visionTimeoutMs,
        onUntrustedImageTextSignal: (signal) => {
          untrustedImageTextSignalCount += 1;
          untrustedImageTextAffectedImageCount += 1;
          untrustedImageTextRemovedLineCount += signal.removedInstructionLikeLineCount;
        },
      });
      context = applyStudioAgentVisionSummariesToContext(context, visionSummaryMap);
      emitStudioAgentUntrustedImageTextTelemetry({
        flow: orchestrationBeforeVision.flow,
        signalCount: untrustedImageTextSignalCount,
        affectedImageCount: untrustedImageTextAffectedImageCount,
        removedInstructionLikeLineCount: untrustedImageTextRemovedLineCount,
        policyVersion: safetyProfile.policyVersion,
        policySchemaVersion: safetyPolicySchemaVersion,
        promptTemplateVersion,
        runtimeScopeKey,
        profileId: safetyTelemetryProfileId,
      });
    } catch (error) {
      console.warn(
        "[studio-agent] server vision summary failed",
        describeStudioAgentVisionSummaryError(error)
      );
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
  const coordinatorResult = await executeStudioAgentCoordinator({
    req,
    traceId,
    requestStartedAt,
    stageLatencyMs,
    markStage,
    apiKey,
    openAiUrl,
    systemPrompt,
    openAiModel,
    openAiThinkerModel,
    openAiFormatterModel,
    thinkerPrompt,
    formatterPrompt,
    turnTimeoutMs,
    upstreamRetryMaxAttempts,
    upstreamRetryBaseDelayMs,
    upstreamRetryMaxDelayMs,
    singleStageEnabled,
    legacyV2FallbackEnabled,
    textFastPathEnabled,
    orchestration,
    context,
    messages,
    selectedReferences,
    visionSummaryMap,
    effectiveCanonical,
    normalizedConversationId,
    userId: user.id,
    userEmail: user.email ?? null,
    canonicalDbEnabled,
    safetyPostProcessMode,
    safetyDebugEnabled,
    safetyProfileId,
    safetyPolicyDocument,
    safetyPolicyVersion: safetyProfile.policyVersion,
    safetyPolicySchemaVersion,
    safetyPromptTemplateVersion: promptTemplateVersion,
    runtimeScopeKey,
    safetyEnvironment,
    safetyDevAbsoluteZeroEnabled,
    safetyProviderErrorMode,
    safetyAutoRollbackEnabled,
  });

  return res.status(coordinatorResult.status).json(coordinatorResult.payload);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};
