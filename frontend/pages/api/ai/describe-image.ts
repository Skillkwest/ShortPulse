/**
 * Generates a descriptive caption for an image using OpenAI vision.
 * System prompt comes from frontend/lib/agentPromptsConfig.ts (Agent 2) with env fallback.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { loadAgentPrompt } from "../../../lib/agentPromptLoader";
import { AgentPromptId } from "../../../lib/agentPromptsConfig";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logGenerationFailure } from "../../../lib/server/api/appErrorLogs";
import {
  extractImageDescriptionText,
  requestOpenAiImageDescribeWithRetry,
  resolveImageDescribeUpstreamFailureSource,
  shouldRetryWithFallbackVisionModel,
} from "../../../lib/server/api/imageDescribeOpenAi";
import { probeImageUrlForDescribe } from "../../../lib/server/api/imageDescribeUrlGuard";

const IMAGE_DESCRIBER_ID: AgentPromptId = "OPENAI_PROMPT_IMAGE_DESCRIBE";
const DEFAULT_VISION_MODEL = "gpt-5-nano";
const DEFAULT_FALLBACK_VISION_MODEL = "gpt-5-nano";
const DEPRECATION_SUNSET = "Sun, 26 Apr 2026 00:00:00 GMT";
const DEPRECATION_LINK =
  process.env.STUDIO_AGENT_DEPRECATION_DOC_URL ||
  "https://docs.shortpulse.app/agent-route-migration";

const setDeprecationHeaders = (res: NextApiResponse): void => {
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", DEPRECATION_SUNSET);
  res.setHeader("Link", `<${DEPRECATION_LINK}>; rel="deprecation"`);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const routeLabel = "ai/describe-image";
  setDeprecationHeaders(res);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const apiKey = process.env.OPENAI_API_KEY;
  const systemPrompt = loadAgentPrompt(IMAGE_DESCRIBER_ID, process.env[IMAGE_DESCRIBER_ID]);
  if (!apiKey) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.image_describe.config_missing",
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
      source: "api.image_describe.config_missing",
      message: `${IMAGE_DESCRIBER_ID} is not set`,
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    return res.status(500).json({ error: `${IMAGE_DESCRIBER_ID} is not set` });
  }

  const { imageUrl } = req.body as { imageUrl?: string };
  if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.trim()) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.image_describe.validation_failed",
      message: "imageUrl is required",
      statusCode: 400,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    return res.status(400).json({ error: "imageUrl is required" });
  }

  try {
    const normalizedImageUrl = imageUrl.trim();
    const imageProbe = await probeImageUrlForDescribe(normalizedImageUrl);
    if (!imageProbe.ok) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.image_describe.validation_failed",
        message: imageProbe.message,
        statusCode: imageProbe.statusCode,
        userId: user.id,
        userEmail: user.email ?? null,
        metadata: {
          detail: imageProbe.detail,
        },
      });
      return res
        .status(imageProbe.statusCode)
        .json({ error: imageProbe.message, detail: imageProbe.detail });
    }

    const primaryVisionModel = (process.env.OPENAI_VISION_MODEL || DEFAULT_VISION_MODEL).trim();
    const fallbackVisionModel = (
      process.env.OPENAI_VISION_FALLBACK_MODEL || DEFAULT_FALLBACK_VISION_MODEL
    ).trim();

    const attemptedModels: string[] = [primaryVisionModel];
    let describeAttempt = await requestOpenAiImageDescribeWithRetry({
      apiKey,
      model: primaryVisionModel,
      systemPrompt,
      imageUrl: normalizedImageUrl,
    });

    if (
      !describeAttempt.ok &&
      shouldRetryWithFallbackVisionModel({
        status: describeAttempt.status,
        detail: describeAttempt.detail,
        primaryModel: primaryVisionModel,
        fallbackModel: fallbackVisionModel,
      })
    ) {
      attemptedModels.push(fallbackVisionModel);
      describeAttempt = await requestOpenAiImageDescribeWithRetry({
        apiKey,
        model: fallbackVisionModel,
        systemPrompt,
        imageUrl: normalizedImageUrl,
      });
    }

    if (!describeAttempt.ok) {
      const detail = describeAttempt.detail;
      const modelUsed = describeAttempt.model;
      await logGenerationFailure({
        req,
        routeLabel,
        source: resolveImageDescribeUpstreamFailureSource(describeAttempt.status),
        message: "Upstream error",
        statusCode: describeAttempt.status,
        userId: user.id,
        userEmail: user.email ?? null,
        metadata: {
          detail,
          model: modelUsed,
          attempted_models: attemptedModels,
        },
      });
      return res
        .status(describeAttempt.status)
        .json({ error: "Upstream error", detail, model: modelUsed });
    }

    const data = describeAttempt.data;
    const description = extractImageDescriptionText(data);
    const usage =
      data.usage && typeof data.usage === "object" && !Array.isArray(data.usage)
        ? (data.usage as Record<string, unknown>)
        : {};
    const promptTokens = usage.prompt_tokens;
    const completionTokens = usage.completion_tokens;
    if (!description) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.image_describe.empty_response",
        message: "No description returned",
        statusCode: 502,
        userId: user.id,
        userEmail: user.email ?? null,
      });
      return res.status(502).json({ error: "No description returned" });
    }

    return res.status(200).json({
      description,
      usage: {
        inputTokens: typeof promptTokens === "number" ? promptTokens : undefined,
        outputTokens: typeof completionTokens === "number" ? completionTokens : undefined,
      },
    });
  } catch (error) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.image_describe.transport_error",
      message: "Image description failed",
      statusCode: 500,
      stack: error instanceof Error ? (error.stack ?? null) : null,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: {
        detail: String(error),
      },
    });
    return res.status(500).json({ error: "Image description failed", detail: String(error) });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};
