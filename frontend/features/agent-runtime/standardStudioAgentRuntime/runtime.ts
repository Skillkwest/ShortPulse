/**
 * Standard Create agent runtime for AI Studio.
 * Owns Standard request execution and returns a Standard-only response contract.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sanitizeGenerationPromptText } from "../../agent-core/promptText";
import { buildAgentMachineOutcome, resolveInfraFallbackReasonCode } from "../agentMachineOutcome";
import { resolveSafetyEnvironment, resolveSafetyModality } from "../safetyPolicy/decisionEngine";
import { resolveSafetyPolicyDocument } from "../safetyPolicy/policyDocument";
import {
  buildStudioAgentInfraFallbackPayload,
  buildStudioAgentRouteFailurePayload,
  buildStudioAgentSafetyRefusalPayload,
  emitStudioAgentInputPrecheckTelemetry,
  emitStudioAgentTurnTelemetry,
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
import { resolveStudioAgentFallbackReasonLabel } from "../studioAgentFallbackReason";
import {
  resolveStudioAgentSafetyInputPrecheckFieldModes,
  runStudioAgentSafetyInputPrecheck,
} from "../studioAgentSafetyInputPrecheck";
import {
  extractStudioAgentCompletionText,
  parseStudioAgentJsonWithStatus,
} from "../studioAgentResponseNormalization";
import { clampCanonicalPrompt } from "../../../lib/server/api/agentConversationState";
import { resolveRuntimeSafetyProfile } from "../../../lib/server/api/agentSafetyPolicyControlPlane";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import type {
  OpenAiChatMessage,
  OpenAiChatResponseFormat,
} from "../../../lib/server/api/openAiCompat";
import type { AgentContext, AgentMessage } from "../../../prefabs/agent";

const DEFAULT_DIRECT_OPENAI_MODEL = "gpt-5.4";
const STANDARD_ROUTE_LABEL = "ai/studio-agent-standard";
const STANDARD_TELEMETRY_PATH = "standard_direct_openai";
const STANDARD_SYSTEM_PROMPT = `You are a professional prompt writer for image generation.
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
const STANDARD_RESPONSE_FORMAT: OpenAiChatResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "studio_agent_standard_direct_response",
    description: "Standard mode direct agent response.",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: {
          type: "string",
          enum: ["message", "prompt", "refuse"],
        },
        message: {
          type: "string",
        },
        actions: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                applyPrompt: {
                  anyOf: [{ type: "string" }, { type: "null" }],
                },
              },
              required: ["applyPrompt"],
            },
            { type: "null" },
          ],
        },
      },
      required: ["status", "message", "actions"],
    },
  },
};
const STANDARD_RESPONSE_CONTRACT_PROMPT = `Return only JSON matching the provided schema.
Use status="message" and actions.applyPrompt=null for ordinary chat, help, clarification, or questions.
Use status="prompt" and actions.applyPrompt=<generation-ready prompt> only when the user asks you to create, rewrite, improve, describe, or convert something into a generation prompt.
Use status="refuse" and actions.applyPrompt=null only for disallowed or unsafe requests.`;
const STANDARD_IMAGE_FALLBACK_TEXT =
  "Describe this image as a detailed production-ready prompt for image generation.";

type StandardRuntimeResult = {
  message: string;
  actions?: { applyPrompt?: string | null };
  semanticStatus?: string | null;
};

const resolveStandardDirectOpenAiEnabled = (env: NodeJS.ProcessEnv): boolean =>
  env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED === "true";

const resolveStandardDirectOpenAiModel = (env: NodeJS.ProcessEnv): string =>
  env.STUDIO_AGENT_DIRECT_OPENAI_MODEL?.trim() || DEFAULT_DIRECT_OPENAI_MODEL;

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
}: {
  messages: AgentMessage[];
  context: AgentContext;
}): OpenAiChatMessage[] => {
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
    { role: "system", content: STANDARD_SYSTEM_PROMPT },
    { role: "system", content: STANDARD_RESPONSE_CONTRACT_PROMPT },
    ...messages.map((message, index): OpenAiChatMessage => {
      const role = message.role === "assistant" ? "assistant" : "user";
      if (index !== latestUserIndex || !imageParts.length || role !== "user") {
        return {
          role,
          content: message.content,
        };
      }
      const textContent = message.content.trim() || STANDARD_IMAGE_FALLBACK_TEXT;
      return {
        role,
        content: [{ type: "text", text: textContent }, ...imageParts],
      };
    }),
  ];
};

const extractStandardOpenAiResponse = (payload: unknown): StandardRuntimeResult | null => {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const raw = choices?.[0]?.message?.content;
  const parsed = parseStudioAgentJsonWithStatus(raw, { allowUnstructured: false });
  if (parsed?.response.message?.trim() || parsed?.response.actions?.applyPrompt?.trim()) {
    return {
      message:
        parsed.response.message?.trim() || parsed.response.actions?.applyPrompt?.trim() || "",
      actions: parsed.response.actions,
      semanticStatus: parsed.status ?? null,
    };
  }
  const directMessage = sanitizeGenerationPromptText(extractStudioAgentCompletionText(raw));
  if (!directMessage?.trim().length) return null;
  return {
    message: directMessage.trim(),
    actions: {
      applyPrompt: directMessage.trim(),
    },
    semanticStatus: "prompt",
  };
};

/**
 * Runs one Standard Create agent request with the Standard-only direct response contract.
 */
export const runStandardStudioAgentRuntime = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === "POST") {
    req.body = {
      ...req.body,
      runtimeMode: "standard",
    };
  }

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

  if (!resolveStandardDirectOpenAiEnabled(process.env)) {
    return sendStudioAgentError(res, 503, {
      code: "AGENT_DISABLED",
      message: "Standard mode requires the direct OpenAI route, but it is not enabled.",
      traceId,
    });
  }

  const normalizedConversationId = requestEnvelope.value.clientSessionKey;
  let messages = requestEnvelope.value.messages;
  let context = requestEnvelope.value.context;
  const incomingCanonical = requestEnvelope.value.incomingCanonical;
  const flow = resolveStandardFlow(context);
  const safetyInputPrecheckEnabled =
    process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED !== "false";
  const safetyProfile = await resolveRuntimeSafetyProfile({
    envProfileId: process.env.STUDIO_AGENT_SAFETY_PROFILE_ACTIVE ?? null,
  });
  const safetyProfileId = safetyProfile.profileId;
  const safetyPolicyDocument = resolveSafetyPolicyDocument({
    activePolicy: safetyProfile.activePolicy,
    profileId: safetyProfileId,
  });
  const safetyEnvironment = resolveSafetyEnvironment(process.env.NODE_ENV);
  const safetyDevAbsoluteZeroEnabled =
    process.env.STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED === "true";
  const safetyModality = resolveSafetyModality({
    route: "studio-agent",
    flow,
  });
  const safetyTelemetryProfileId =
    safetyProfileId === "prod_safe_v1" ||
    safetyProfileId === "staging_lenient" ||
    safetyProfileId === "dev_absolute_zero"
      ? safetyProfileId
      : null;
  let effectiveCanonical = clampCanonicalPrompt(
    incomingCanonical ?? sanitizeGenerationPromptText(context.lastAssistantMessage) ?? null
  );
  const precheckStartedAt = Date.now();
  const precheckResult = runStudioAgentSafetyInputPrecheck({
    enabled: safetyInputPrecheckEnabled,
    messages,
    context,
    canonicalPrompt: effectiveCanonical,
    modality: safetyModality,
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
  markStage("standard_input_precheck", precheckStartedAt);
  if (precheckResult.outcome !== "pass") {
    emitStudioAgentInputPrecheckTelemetry({
      flow,
      outcome: precheckResult.outcome,
      rewrittenFieldCount: precheckResult.rewrittenFieldCount,
      providerCallSkipped: precheckResult.providerCallSkipped,
      policyVersion: safetyProfile.policyVersion,
      policySchemaVersion: safetyPolicyDocument.schemaVersion,
      promptTemplateVersion: null,
      runtimeScopeKey: "studio-agent-standard",
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

  const openAiConfig = resolveStudioAgentOpenAiConfig(process.env);
  const directModel = resolveStandardDirectOpenAiModel(process.env);
  const openAiRoundTripStartedAt = Date.now();
  try {
    const directResponse = await fetchStudioAgentChatCompletion({
      apiKey,
      openAiUrl: openAiConfig.openAiUrl,
      model: directModel,
      messages: buildStandardOpenAiMessages({ messages, context }),
      timeoutMs: openAiConfig.turnTimeoutMs,
      responseFormat: STANDARD_RESPONSE_FORMAT,
    });
    markStage("standard_openai_roundtrip", openAiRoundTripStartedAt);

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
        flow,
        path: STANDARD_TELEMETRY_PATH,
        status: "success",
        model: directModel,
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
          runtimeScopeKey: "studio-agent-standard",
          profileId: safetyTelemetryProfileId,
          modality: safetyModality,
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
    const directResult = extractStandardOpenAiResponse(directPayload);
    if (!directResult) {
      emitStudioAgentTurnTelemetry({
        flow,
        path: STANDARD_TELEMETRY_PATH,
        status: "success",
        model: directModel,
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
          runtimeScopeKey: "studio-agent-standard",
          profileId: safetyTelemetryProfileId,
          modality: safetyModality,
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
    const outcomeClass = directResult.actions?.applyPrompt ? "success_prompt" : "success_message";
    const reasonCode = directResult.actions?.applyPrompt ? "SUCCESS_PROMPT" : "SUCCESS_MESSAGE";
    emitStudioAgentTurnTelemetry({
      flow,
      path: STANDARD_TELEMETRY_PATH,
      status: "success",
      model: directModel,
      outcomeClass,
      retryUsed: false,
      reasonCode,
      totalLatencyMs: Date.now() - requestStartedAt,
      stageLatencyMs,
      safetyTelemetry: {
        policyVersion: safetyProfile.policyVersion,
        policySchemaVersion: safetyPolicyDocument.schemaVersion,
        promptTemplateVersion: null,
        runtimeScopeKey: "studio-agent-standard",
        profileId: safetyTelemetryProfileId,
        modality: safetyModality,
      },
    });
    return res.status(200).json({
      message: directResult.message,
      actions: directResult.actions,
      ...buildAgentMachineOutcome({
        outcomeClass,
        reasonCode,
      }),
      canonicalPrompt: nextCanonical,
      traceId,
    });
  } catch (error) {
    markStage("standard_openai_roundtrip", openAiRoundTripStartedAt);
    await logApiRouteException({
      req,
      error,
      routeLabel: STANDARD_ROUTE_LABEL,
      metadata: {
        user_id: user.id,
        conversation_id: normalizedConversationId,
        stage: "standard_openai",
      },
    });
    const fallbackReason = resolveStudioAgentFallbackReasonLabel({
      detail: formatStudioAgentErrorMessage(error),
    });
    const reasonCode = resolveInfraFallbackReasonCode({
      detail: formatStudioAgentErrorMessage(error),
    });
    emitStudioAgentTurnTelemetry({
      flow,
      path: STANDARD_TELEMETRY_PATH,
      status: "success",
      model: directModel,
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
        runtimeScopeKey: "studio-agent-standard",
        profileId: safetyTelemetryProfileId,
        modality: safetyModality,
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
};
