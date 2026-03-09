/**
 * Legacy helper service for extracting reusable style descriptors from images.
 * Mirrors describe-image route hardening patterns (URL probe + retries + model fallback).
 */
import type { NextApiRequest } from "next";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";
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
import { STUDIO_AGENT_INFRA_FALLBACK_MESSAGE } from "./studioAgentFailurePolicy";
import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "./studioAgentRouteOutcomes";

const STYLE_EXTRACTOR_ID: AgentPromptId = "OPENAI_PROMPT_STYLE_EXTRACT";
const DEFAULT_VISION_MODEL = "gpt-5-nano";
const DEFAULT_FALLBACK_VISION_MODEL = "gpt-5-nano";
const MAX_STYLE_PROMPT_LENGTH = 4000;

const clampStylePrompt = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_STYLE_PROMPT_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_STYLE_PROMPT_LENGTH).trim();
};

const normalizeExtractedStylePrompt = (value: string): string | null => {
  const withoutHeading = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^STYLE\s*ADD-ON\s*:?$/i.test(line))
    .join(", ")
    .replace(/^\s*STYLE\s*ADD-ON\s*:?\s*/i, "")
    .replace(/(^|,\s*)(?:[-*]|\d+\.)\s+/g, "$1")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*,+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/^,\s*|\s*,$/g, "")
    .trim();

  const sanitized = sanitizeGenerationPromptText(withoutHeading);
  if (!sanitized) return null;
  const clamped = clampStylePrompt(sanitized);
  return clamped.length > 0 ? clamped : null;
};

const isRefusalOrFallbackText = (value: string): boolean => {
  const normalized = value.trim();
  return (
    normalized === STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE ||
    normalized === STUDIO_AGENT_INFRA_FALLBACK_MESSAGE
  );
};

type LegacyStyleExtractionSuccess = {
  ok: true;
  payload: {
    stylePrompt: string;
    usage: {
      inputTokens?: number;
      outputTokens?: number;
    };
  };
};

type LegacyStyleExtractionFailure = {
  ok: false;
  status: number;
  payload: {
    error: string;
    detail?: string;
    model?: string;
  };
};

export type LegacyStyleExtractionResult =
  | LegacyStyleExtractionSuccess
  | LegacyStyleExtractionFailure;

export const executeLegacyStyleExtraction = async ({
  req,
  user,
  imageUrl,
  routeLabel = "ai/extract-style",
}: {
  req: NextApiRequest;
  user: AuthenticatedApiUser;
  imageUrl: unknown;
  routeLabel?: string;
}): Promise<LegacyStyleExtractionResult> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const systemPrompt = loadAgentPrompt(STYLE_EXTRACTOR_ID, process.env[STYLE_EXTRACTOR_ID]);

  if (!apiKey) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.style_extraction.config_missing",
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
      source: "api.style_extraction.config_missing",
      message: `${STYLE_EXTRACTOR_ID} is not set`,
      statusCode: 500,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    return {
      ok: false,
      status: 500,
      payload: { error: `${STYLE_EXTRACTOR_ID} is not set` },
    };
  }

  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.style_extraction.validation_failed",
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
        source: "api.style_extraction.validation_failed",
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
    let extractionAttempt = await requestOpenAiImageDescribeWithRetry({
      apiKey,
      model: primaryVisionModel,
      systemPrompt,
      imageUrl: normalizedImageUrl,
      userText: "Extract only reusable visual style descriptors.",
    });

    if (
      !extractionAttempt.ok &&
      shouldRetryWithFallbackVisionModel({
        status: extractionAttempt.status,
        detail: extractionAttempt.detail,
        primaryModel: primaryVisionModel,
        fallbackModel: fallbackVisionModel,
      })
    ) {
      attemptedModels.push(fallbackVisionModel);
      extractionAttempt = await requestOpenAiImageDescribeWithRetry({
        apiKey,
        model: fallbackVisionModel,
        systemPrompt,
        imageUrl: normalizedImageUrl,
        userText: "Extract only reusable visual style descriptors.",
      });
    }

    if (!extractionAttempt.ok) {
      const detail = extractionAttempt.detail;
      const modelUsed = extractionAttempt.model;
      await logGenerationFailure({
        req,
        routeLabel,
        source: resolveImageDescribeUpstreamFailureSource(extractionAttempt.status),
        message: "Upstream error",
        statusCode: extractionAttempt.status,
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
        status: extractionAttempt.status,
        payload: {
          error: "Upstream error",
          detail,
          ...(extractionAttempt.status < 500 && modelUsed ? { model: modelUsed } : {}),
        },
      };
    }

    const data = extractionAttempt.data;
    const extractedText = extractImageDescriptionText(data);
    const stylePrompt = extractedText ? normalizeExtractedStylePrompt(extractedText) : null;

    if (!stylePrompt || isRefusalOrFallbackText(stylePrompt)) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.style_extraction.empty_response",
        message: "No style prompt returned",
        statusCode: 502,
        userId: user.id,
        userEmail: user.email ?? null,
      });
      return {
        ok: false,
        status: 502,
        payload: {
          error: "No style prompt returned",
          detail: "Unable to extract style descriptors from the provided image.",
        },
      };
    }

    const usage =
      data.usage && typeof data.usage === "object" && !Array.isArray(data.usage)
        ? (data.usage as Record<string, unknown>)
        : {};
    const promptTokens = usage.prompt_tokens;
    const completionTokens = usage.completion_tokens;

    return {
      ok: true,
      payload: {
        stylePrompt,
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
      source: "api.style_extraction.transport_error",
      message: "Style extraction failed",
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
      payload: { error: "Style extraction failed" },
    };
  }
};
