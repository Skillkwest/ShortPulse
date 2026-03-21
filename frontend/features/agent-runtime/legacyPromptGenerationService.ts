import type { NextApiRequest } from "next";
import { loadAgentPrompt } from "../../lib/agentPromptLoader";
import { AgentPromptId } from "../../lib/agentPromptsConfig";
import type { AuthenticatedApiUser } from "../../lib/server/api/auth";
import { resolveRuntimeSafetyProfile } from "../../lib/server/api/agentSafetyPolicyControlPlane";
import { logGenerationFailure } from "../../lib/server/api/appErrorLogs";
import { fetchOpenAiCompatibleChatCompletion } from "../../lib/server/api/openAiCompat";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";
import {
  resolveStudioAgentSafetyInputPrecheckFieldModes,
  runStudioAgentSafetyInputPrecheck,
} from "./studioAgentSafetyInputPrecheck";
import {
  buildPromptCompilerCacheScopeKey,
  resolvePromptTemplateVersion,
} from "./promptCompilerCacheScopeKey";
import { emitAgentRouteOutcomeTelemetry } from "./agentRouteTelemetry";
import { resolveSafetyEnvironment } from "./safetyPolicy/decisionEngine";
import { resolveSafetyPolicyDocument } from "./safetyPolicy/policyDocument";
import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "./studioAgentRouteOutcomes";
import { buildAgentMachineOutcome } from "./agentMachineOutcome";
import { resolveStudioAgentFallbackReasonLabel } from "./studioAgentFallbackReason";
import type { AgentMachineOutcomeFields } from "../../prefabs/agent/outcomeContract";

const TEXT_ENHANCER_ID: AgentPromptId = "OPENAI_PROMPT_SYSTEM";

type LegacyPromptSuccess = {
  ok: true;
  payload: AgentMachineOutcomeFields & {
    prompt: string;
    usage: {
      inputTokens?: number;
      outputTokens?: number;
    };
  };
};

type LegacyPromptFailure = {
  ok: false;
  status: number;
  payload: AgentMachineOutcomeFields & {
    error: string;
    detail?: string;
    fallback_reason?: string;
  };
};

export type LegacyPromptGenerationResult = LegacyPromptSuccess | LegacyPromptFailure;

const resolvePromptGenerationUpstreamFailureSource = (status: number): string => {
  if (status === 429) return "api.prompt_generation.rate_limited";
  if (status >= 500) return "api.prompt_generation.upstream_unavailable";
  return "api.prompt_generation.upstream_error";
};

export const executeLegacyPromptGeneration = async ({
  req,
  user,
  prompt,
  routeLabel = "ai/generate-prompt",
}: {
  req: NextApiRequest;
  user: AuthenticatedApiUser;
  prompt: unknown;
  routeLabel?: string;
}): Promise<LegacyPromptGenerationResult> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const systemPrompt = loadAgentPrompt(TEXT_ENHANCER_ID, process.env.OPENAI_PROMPT_SYSTEM);
  const inputPrecheckEnabled =
    process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_GENERATE_PROMPT_ENABLED !== "false";
  const safetyProfile = await resolveRuntimeSafetyProfile({
    envProfileId: process.env.STUDIO_AGENT_SAFETY_PROFILE_ACTIVE ?? null,
  });
  const safetyPolicyDocument = resolveSafetyPolicyDocument({
    activePolicy: safetyProfile.activePolicy,
    profileId: safetyProfile.profileId,
  });
  const safetyEnvironment = resolveSafetyEnvironment(process.env.NODE_ENV);
  const safetyDevAbsoluteZeroEnabled =
    process.env.STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED === "true";
  const safetyTelemetryProfileId =
    safetyProfile.profileId === "prod_safe_v1" ||
    safetyProfile.profileId === "staging_lenient" ||
    safetyProfile.profileId === "dev_absolute_zero"
      ? safetyProfile.profileId
      : null;
  let promptTemplateVersion: string | null = null;
  let runtimeScopeKey: string | null = null;
  const emitPromptRouteTelemetry = ({
    statusCode,
    machineOutcome,
    category,
    decisionAction,
    decisionSource,
    providerBlocked,
    fallbackReason,
  }: {
    statusCode: number;
    machineOutcome: AgentMachineOutcomeFields;
    category?: string | null;
    decisionAction?: string | null;
    decisionSource?: string | null;
    providerBlocked?: boolean | null;
    fallbackReason?: string | null;
  }) => {
    emitAgentRouteOutcomeTelemetry({
      telemetryTag: "generate-prompt",
      routeLabel,
      statusCode,
      machineOutcome,
      policyVersion: safetyProfile.policyVersion,
      policySchemaVersion: safetyPolicyDocument.schemaVersion,
      promptTemplateVersion,
      runtimeScopeKey,
      profileId: safetyTelemetryProfileId,
      modality: "text",
      category,
      decisionAction,
      decisionSource,
      providerBlocked,
      fallbackReason,
    });
  };
  if (!apiKey) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.prompt_generation.config_missing",
      message: "OPENAI_API_KEY is not set",
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "route_error",
      reasonCode: "CONFIG_MISSING",
    });
    emitPromptRouteTelemetry({
      statusCode: 500,
      machineOutcome,
    });
    return {
      ok: false,
      status: 500,
      payload: {
        ...machineOutcome,
        error: "OPENAI_API_KEY is not set",
      },
    };
  }

  if (!systemPrompt) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.prompt_generation.config_missing",
      message: "OPENAI_PROMPT_SYSTEM is not set",
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "route_error",
      reasonCode: "CONFIG_MISSING",
    });
    emitPromptRouteTelemetry({
      statusCode: 500,
      machineOutcome,
    });
    return {
      ok: false,
      status: 500,
      payload: {
        ...machineOutcome,
        error: "OPENAI_PROMPT_SYSTEM is not set",
      },
    };
  }

  if (typeof prompt !== "string" || !prompt.trim()) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.prompt_generation.validation_failed",
      message: "Prompt is required",
      statusCode: 400,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "route_error",
      reasonCode: "REQUEST_INVALID",
    });
    emitPromptRouteTelemetry({
      statusCode: 400,
      machineOutcome,
    });
    return {
      ok: false,
      status: 400,
      payload: {
        ...machineOutcome,
        error: "Prompt is required",
      },
    };
  }
  promptTemplateVersion = resolvePromptTemplateVersion({
    route: "generate-prompt",
    prompts: [systemPrompt],
  });
  const safetyPolicySchemaVersion = safetyPolicyDocument.schemaVersion;
  runtimeScopeKey = buildPromptCompilerCacheScopeKey({
    route: "generate-prompt",
    promptTemplateVersion,
    policySchemaVersion: safetyPolicySchemaVersion,
    controlPlanePolicyVersion: safetyProfile.policyVersion,
  });
  let providerPrompt = prompt;
  const precheckResult = runStudioAgentSafetyInputPrecheck({
    enabled: inputPrecheckEnabled,
    messages: [{ role: "user", content: providerPrompt }],
    context: {},
    canonicalPrompt: null,
    modality: "text",
    profileId: safetyProfile.profileId,
    environment: safetyEnvironment,
    devAbsoluteZeroEnabled: safetyDevAbsoluteZeroEnabled,
    policyDocument: safetyPolicyDocument,
    rewriteRecheckMode: "allow_or_rewrite",
    fieldModes: resolveStudioAgentSafetyInputPrecheckFieldModes({
      sharedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES,
      scopedRawValue: process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_GENERATE_PROMPT,
    }),
  });
  if (precheckResult.outcome === "refusal") {
    console.info(
      "[generate-prompt][safety-input-precheck]",
      JSON.stringify({
        safety_stage: "input_precheck",
        route: routeLabel,
        safety_outcome: "refusal",
        provider_call_skipped: true,
        profile_id: safetyProfile.profileId,
        policy_version: safetyProfile.policyVersion,
        policy_schema_version: safetyPolicySchemaVersion,
        prompt_template_version: promptTemplateVersion,
        runtime_scope_key: runtimeScopeKey,
        modality: precheckResult.decision?.modality ?? "text",
        category: precheckResult.decision?.category ?? null,
        decision_action: precheckResult.decision?.action ?? "refuse",
        decision_source: precheckResult.decision?.source ?? null,
        refusal_field: precheckResult.scopeTelemetry.refusalField,
        rewritten_fields: precheckResult.scopeTelemetry.rewrittenFields,
        non_blocking_signal_count: precheckResult.scopeTelemetry.nonBlockingSignalCount,
      })
    );
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "refusal_safety",
      reasonCode: "SAFETY_INPUT_REFUSAL",
    });
    emitPromptRouteTelemetry({
      statusCode: 200,
      machineOutcome,
      category: precheckResult.decision?.category ?? null,
      decisionAction: precheckResult.decision?.action ?? "refuse",
      decisionSource: precheckResult.decision?.source ?? null,
      providerBlocked: true,
    });
    return {
      ok: true,
      payload: {
        prompt: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
        usage: {},
        ...machineOutcome,
      },
    };
  }
  if (precheckResult.outcome === "rewritten") {
    providerPrompt = precheckResult.messages[0]?.content ?? providerPrompt;
    console.info(
      "[generate-prompt][safety-input-precheck]",
      JSON.stringify({
        safety_stage: "input_precheck",
        route: routeLabel,
        safety_outcome: "rewritten",
        provider_call_skipped: false,
        rewritten_field_count: precheckResult.rewrittenFieldCount,
        profile_id: safetyProfile.profileId,
        policy_version: safetyProfile.policyVersion,
        policy_schema_version: safetyPolicySchemaVersion,
        prompt_template_version: promptTemplateVersion,
        runtime_scope_key: runtimeScopeKey,
        modality: precheckResult.decision?.modality ?? "text",
        category: precheckResult.decision?.category ?? null,
        decision_action: precheckResult.decision?.action ?? "rewrite",
        decision_source: precheckResult.decision?.source ?? null,
        refusal_field: precheckResult.scopeTelemetry.refusalField,
        rewritten_fields: precheckResult.scopeTelemetry.rewrittenFields,
        non_blocking_signal_count: precheckResult.scopeTelemetry.nonBlockingSignalCount,
      })
    );
  }

  try {
    const response = await fetchOpenAiCompatibleChatCompletion({
      apiKey,
      model: process.env.OPENAI_MODEL ?? "gpt-5-nano",
      openAiApiBase: process.env.OPENAI_API_BASE,
      timeoutMs: 20000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: providerPrompt },
      ],
    });

    if (!response.ok) {
      const detail = await response.text();
      const fallbackReason = resolveStudioAgentFallbackReasonLabel({
        status: response.status,
        detail,
      });
      await logGenerationFailure({
        req,
        routeLabel,
        source: resolvePromptGenerationUpstreamFailureSource(response.status),
        message: "Upstream error",
        statusCode: response.status,
        userId: user.id,
        userEmail: user.email ?? null,
        metadata: { detail },
      });
      const machineOutcome = buildAgentMachineOutcome({
        outcomeClass: "upstream_error",
        reasonCode: "UPSTREAM_ERROR",
      });
      emitPromptRouteTelemetry({
        statusCode: response.status,
        machineOutcome,
        fallbackReason,
      });
      return {
        ok: false,
        status: response.status,
        payload: {
          ...machineOutcome,
          error: "Upstream error",
          detail,
          fallback_reason: fallbackReason,
        },
      };
    }

    const data = await response.json();
    const nextPrompt = sanitizeGenerationPromptText(data?.choices?.[0]?.message?.content) ?? null;
    const promptTokens = data?.usage?.prompt_tokens;
    const completionTokens = data?.usage?.completion_tokens;

    if (!nextPrompt) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.prompt_generation.empty_response",
        message: "No prompt returned",
        statusCode: 502,
        userId: user.id,
        userEmail: user.email ?? null,
      });
      const machineOutcome = buildAgentMachineOutcome({
        outcomeClass: "upstream_error",
        reasonCode: "UPSTREAM_OUTPUT_CONTRACT",
      });
      const fallbackReason = resolveStudioAgentFallbackReasonLabel({
        stage: "prompt_missing",
        status: 502,
      });
      emitPromptRouteTelemetry({
        statusCode: 502,
        machineOutcome,
        fallbackReason,
      });
      return {
        ok: false,
        status: 502,
        payload: {
          ...machineOutcome,
          error: "No prompt returned",
          fallback_reason: fallbackReason,
        },
      };
    }

    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "success_prompt",
      reasonCode: "SUCCESS_PROMPT",
    });
    emitPromptRouteTelemetry({
      statusCode: 200,
      machineOutcome,
      category: precheckResult.decision?.category ?? null,
      decisionAction: precheckResult.decision?.action ?? null,
      decisionSource: precheckResult.decision?.source ?? null,
      providerBlocked: false,
    });
    return {
      ok: true,
      payload: {
        prompt: nextPrompt,
        usage: {
          inputTokens: typeof promptTokens === "number" ? promptTokens : undefined,
          outputTokens: typeof completionTokens === "number" ? completionTokens : undefined,
        },
        ...machineOutcome,
      },
    };
  } catch (error) {
    const detail = String(error);
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.prompt_generation.transport_error",
      message: "Prompt generation failed",
      statusCode: 500,
      stack: error instanceof Error ? (error.stack ?? null) : null,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: { detail },
    });
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "upstream_error",
      reasonCode: "UPSTREAM_ERROR",
    });
    const fallbackReason = resolveStudioAgentFallbackReasonLabel({
      detail,
    });
    emitPromptRouteTelemetry({
      statusCode: 500,
      machineOutcome,
      fallbackReason,
    });
    return {
      ok: false,
      status: 500,
      payload: {
        ...machineOutcome,
        error: "Prompt generation failed",
        detail,
        fallback_reason: fallbackReason,
      },
    };
  }
};
