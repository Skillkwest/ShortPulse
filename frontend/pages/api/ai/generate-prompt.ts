/**
 * Generates an improved text prompt using OpenAI.
 * System prompt + API key are provided via environment variables to keep secrets server-side.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { loadAgentPrompt } from "../../../lib/agentPromptLoader";
import { AgentPromptId } from "../../../lib/agentPromptsConfig";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logGenerationFailure } from "../../../lib/server/api/appErrorLogs";
import { sanitizeGenerationPromptText } from "../../../features/ai-studio/logic/agentPromptOwnership";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const TEXT_ENHANCER_ID: AgentPromptId = "OPENAI_PROMPT_SYSTEM";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const routeLabel = "ai/generate-prompt";
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

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
    return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
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
    return res.status(500).json({ error: "OPENAI_PROMPT_SYSTEM is not set" });
  }

  const { prompt } = req.body as { prompt?: string };
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.prompt_generation.validation_failed",
      message: "Prompt is required",
      statusCode: 400,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5-nano",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.prompt_generation.upstream_error",
        message: "Upstream error",
        statusCode: response.status,
        userId: user.id,
        userEmail: user.email ?? null,
        metadata: { detail },
      });
      return res.status(response.status).json({ error: "Upstream error", detail });
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
      return res.status(502).json({ error: "No prompt returned" });
    }

    return res.status(200).json({
      prompt: nextPrompt,
      usage: {
        inputTokens: typeof promptTokens === "number" ? promptTokens : undefined,
        outputTokens: typeof completionTokens === "number" ? completionTokens : undefined,
      },
    });
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
    return res.status(500).json({ error: "Prompt generation failed", detail: String(error) });
  }
}
