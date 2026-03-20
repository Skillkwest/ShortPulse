import type { NextApiRequest } from "next";
import { loadAgentPrompt } from "../../lib/agentPromptLoader";
import { AgentPromptId } from "../../lib/agentPromptsConfig";
import type { AuthenticatedApiUser } from "../../lib/server/api/auth";
import { resolveRuntimeSafetyProfile } from "../../lib/server/api/agentSafetyPolicyControlPlane";
import { logGenerationFailure } from "../../lib/server/api/appErrorLogs";
import { fetchOpenAiCompatibleChatCompletion } from "../../lib/server/api/openAiCompat";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";
import { runStudioAgentSafetyInputPrecheck } from "./studioAgentSafetyInputPrecheck";
import { resolveSafetyEnvironment } from "./safetyPolicy/decisionEngine";
import { resolveSafetyPolicyDocument } from "./safetyPolicy/policyDocument";
import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "./studioAgentRouteOutcomes";
import { buildAgentMachineOutcome } from "./agentMachineOutcome";
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
    return {
      ok: false,
      status: 500,
      payload: {
        ...buildAgentMachineOutcome({
          outcomeClass: "route_error",
          reasonCode: "CONFIG_MISSING",
        }),
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
    return {
      ok: false,
      status: 500,
      payload: {
        ...buildAgentMachineOutcome({
          outcomeClass: "route_error",
          reasonCode: "CONFIG_MISSING",
        }),
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
    return {
      ok: false,
      status: 400,
      payload: {
        ...buildAgentMachineOutcome({
          outcomeClass: "route_error",
          reasonCode: "REQUEST_INVALID",
        }),
        error: "Prompt is required",
      },
    };
  }
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
        modality: precheckResult.decision?.modality ?? "text",
        category: precheckResult.decision?.category ?? null,
        decision_action: precheckResult.decision?.action ?? "refuse",
        decision_source: precheckResult.decision?.source ?? null,
      })
    );
    return {
      ok: true,
      payload: {
        prompt: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
        usage: {},
        ...buildAgentMachineOutcome({
          outcomeClass: "refusal_safety",
          reasonCode: "SAFETY_INPUT_REFUSAL",
        }),
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
        modality: precheckResult.decision?.modality ?? "text",
        category: precheckResult.decision?.category ?? null,
        decision_action: precheckResult.decision?.action ?? "rewrite",
        decision_source: precheckResult.decision?.source ?? null,
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
      return {
        ok: false,
        status: response.status,
        payload: {
          ...buildAgentMachineOutcome({
            outcomeClass: "upstream_error",
            reasonCode: "UPSTREAM_ERROR",
          }),
          error: "Upstream error",
          detail,
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
      return {
        ok: false,
        status: 502,
        payload: {
          ...buildAgentMachineOutcome({
            outcomeClass: "upstream_error",
            reasonCode: "UPSTREAM_ERROR",
          }),
          error: "No prompt returned",
        },
      };
    }

    return {
      ok: true,
      payload: {
        prompt: nextPrompt,
        usage: {
          inputTokens: typeof promptTokens === "number" ? promptTokens : undefined,
          outputTokens: typeof completionTokens === "number" ? completionTokens : undefined,
        },
        ...buildAgentMachineOutcome({
          outcomeClass: "success_prompt",
          reasonCode: "SUCCESS_PROMPT",
        }),
      },
    };
  } catch (error) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.prompt_generation.transport_error",
      message: "Prompt generation failed",
      statusCode: 500,
      stack: error instanceof Error ? (error.stack ?? null) : null,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: { detail: String(error) },
    });
    return {
      ok: false,
      status: 500,
      payload: {
        ...buildAgentMachineOutcome({
          outcomeClass: "upstream_error",
          reasonCode: "UPSTREAM_ERROR",
        }),
        error: "Prompt generation failed",
        detail: String(error),
      },
    };
  }
};
