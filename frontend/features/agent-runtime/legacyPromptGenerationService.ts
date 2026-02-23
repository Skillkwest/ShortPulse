import type { NextApiRequest } from "next";
import { loadAgentPrompt } from "../../lib/agentPromptLoader";
import { AgentPromptId } from "../../lib/agentPromptsConfig";
import type { AuthenticatedApiUser } from "../../lib/server/api/auth";
import { logGenerationFailure } from "../../lib/server/api/appErrorLogs";
import { fetchOpenAiCompatibleChatCompletion } from "../../lib/server/api/openAiCompat";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";

const TEXT_ENHANCER_ID: AgentPromptId = "OPENAI_PROMPT_SYSTEM";

type LegacyPromptSuccess = {
  ok: true;
  payload: {
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
  payload: {
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
    return { ok: false, status: 500, payload: { error: "OPENAI_API_KEY is not set" } };
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
    return { ok: false, status: 500, payload: { error: "OPENAI_PROMPT_SYSTEM is not set" } };
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
    return { ok: false, status: 400, payload: { error: "Prompt is required" } };
  }

  try {
    const response = await fetchOpenAiCompatibleChatCompletion({
      apiKey,
      model: process.env.OPENAI_MODEL ?? "gpt-5-nano",
      openAiApiBase: process.env.OPENAI_API_BASE,
      timeoutMs: 20000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
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
      return { ok: false, status: response.status, payload: { error: "Upstream error", detail } };
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
      return { ok: false, status: 502, payload: { error: "No prompt returned" } };
    }

    return {
      ok: true,
      payload: {
        prompt: nextPrompt,
        usage: {
          inputTokens: typeof promptTokens === "number" ? promptTokens : undefined,
          outputTokens: typeof completionTokens === "number" ? completionTokens : undefined,
        },
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
      payload: { error: "Prompt generation failed", detail: String(error) },
    };
  }
};
