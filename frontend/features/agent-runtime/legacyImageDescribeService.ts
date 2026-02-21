import type { NextApiRequest } from "next";
import { loadAgentPrompt } from "../../lib/agentPromptLoader";
import { AgentPromptId } from "../../lib/agentPromptsConfig";
import type { AuthenticatedApiUser } from "../../lib/server/api/auth";
import { logGenerationFailure } from "../../lib/server/api/appErrorLogs";
import {
  extractImageDescriptionText,
  requestOpenAiImageDescribeWithRetry,
  resolveImageDescribeUpstreamFailureSource,
  shouldRetryWithFallbackVisionModel,
} from "../../lib/server/api/imageDescribeOpenAi";
import { probeImageUrlForDescribe } from "../../lib/server/api/imageDescribeUrlGuard";

const IMAGE_DESCRIBER_ID: AgentPromptId = "OPENAI_PROMPT_IMAGE_DESCRIBE";
const DEFAULT_VISION_MODEL = "gpt-5-nano";
const DEFAULT_FALLBACK_VISION_MODEL = "gpt-5-nano";

type LegacyImageDescribeSuccess = {
  ok: true;
  payload: {
    description: string;
    usage: {
      inputTokens?: number;
      outputTokens?: number;
    };
  };
};

type LegacyImageDescribeFailure = {
  ok: false;
  status: number;
  payload: {
    error: string;
    detail?: string;
    model?: string;
  };
};

export type LegacyImageDescribeResult = LegacyImageDescribeSuccess | LegacyImageDescribeFailure;

export const executeLegacyImageDescribe = async ({
  req,
  user,
  imageUrl,
  routeLabel = "ai/describe-image",
}: {
  req: NextApiRequest;
  user: AuthenticatedApiUser;
  imageUrl: unknown;
  routeLabel?: string;
}): Promise<LegacyImageDescribeResult> => {
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
    return { ok: false, status: 500, payload: { error: "OPENAI_API_KEY is not set" } };
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
    return { ok: false, status: 500, payload: { error: `${IMAGE_DESCRIBER_ID} is not set` } };
  }

  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.image_describe.validation_failed",
      message: "imageUrl is required",
      statusCode: 400,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    return { ok: false, status: 400, payload: { error: "imageUrl is required" } };
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
      return {
        ok: false,
        status: imageProbe.statusCode,
        payload: { error: imageProbe.message, detail: imageProbe.detail },
      };
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
      return {
        ok: false,
        status: describeAttempt.status,
        payload: { error: "Upstream error", detail, model: modelUsed },
      };
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
      return { ok: false, status: 502, payload: { error: "No description returned" } };
    }

    return {
      ok: true,
      payload: {
        description,
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
    return {
      ok: false,
      status: 500,
      payload: { error: "Image description failed", detail: String(error) },
    };
  }
};
