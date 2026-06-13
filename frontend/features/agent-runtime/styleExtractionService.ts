/**
 * Service for extracting reusable style descriptors from images.
 * Owns the server-side normalization and structured-output contract.
 */
import type { NextApiRequest } from "next";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";
import { AgentPromptId } from "../../lib/agentPromptsConfig";
import { sanitizeCustomerFacingProviderText } from "../../lib/customerFacingProviderText";
import {
  resolveRequiredStyleExtractionFallbackVisionModelId,
  resolveRequiredStyleExtractionVisionModelId,
} from "../../lib/model-runtime/modelCatalog";
import type { AuthenticatedApiUser } from "../../lib/server/api/auth";
import { logGenerationFailure } from "../../lib/server/api/appErrorLogs";
import {
  RequiredRuntimeAgentPromptMissingError,
  RequiredRuntimeAgentPromptUnavailableError,
  resolveRequiredRuntimeAgentPrompt,
} from "../../lib/server/api/runtimeAgentPromptControlPlane";
import {
  buildPromptCompilerCacheScopeKey,
  resolvePromptTemplateVersion,
} from "./promptCompilerCacheScopeKey";
import { emitAgentRouteOutcomeTelemetry } from "./agentRouteTelemetry";
import { enforceLeadingHardStyleClass } from "./styleExtractionPromptPolicy";
import {
  requestOpenAiStructuredStyleExtractionWithRetry,
  resolveImageDescribeUpstreamFailureSource,
  shouldRetryWithFallbackVisionModel,
} from "../../lib/server/api/imageDescribeOpenAi";
import { STUDIO_AGENT_UNAVAILABLE_MESSAGE } from "./studioAgentFailurePolicy";
import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "./studioAgentRouteOutcomes";
import { buildAgentMachineOutcome, resolveUpstreamReasonCode } from "./agentMachineOutcome";
import { resolveStudioAgentFallbackReasonLabel } from "./studioAgentFallbackReason";
import type { AgentMachineOutcomeFields } from "../../prefabs/agent/outcomeContract";

const STYLE_EXTRACTOR_ID: AgentPromptId = "OPENAI_PROMPT_STYLE_EXTRACT";
const DEFAULT_VISION_MODEL = resolveRequiredStyleExtractionVisionModelId();
const DEFAULT_FALLBACK_VISION_MODEL = resolveRequiredStyleExtractionFallbackVisionModelId();
const MAX_STYLE_PROMPT_LENGTH = 4000;
const MAX_STYLE_TITLE_LENGTH = 80;
const DEFAULT_STYLE_TITLE_FALLBACK = "Extracted Style";
const STYLE_EXTRACTION_UNAVAILABLE_MESSAGE = "Style extraction is temporarily unavailable.";

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
  if (
    clamped === STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE ||
    clamped === STUDIO_AGENT_UNAVAILABLE_MESSAGE
  ) {
    return clamped;
  }
  const anchored = clampStylePrompt(enforceLeadingHardStyleClass(clamped));
  if (!anchored) return null;
  return anchored.length > 0 ? anchored : null;
};

const clampStyleTitle = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_STYLE_TITLE_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_STYLE_TITLE_LENGTH).trim();
};

const toTitleCaseWords = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2) return word.toUpperCase();
      return `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");

const sanitizeTitleFragment = (value: string): string =>
  value
    .replace(/^STYLE\s*TITLE\s*:?\s*/i, "")
    .replace(/^title\s*:?\s*/i, "")
    .replace(/[“”"]/g, "")
    .replace(/[`*_]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const normalizeExtractedStyleTitle = (value: string): string | null => {
  const firstLine = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => sanitizeTitleFragment(line))
    .find((line) => line.length > 0);
  if (!firstLine) return null;
  const withoutInlineMeta = firstLine
    .replace(/\bSTYLE\s*ADD-ON\b.*$/i, "")
    .replace(/\b(?:descriptors?|descriptor block)\b.*$/i, "")
    .replace(/[,:;\-.]+$/g, "")
    .trim();
  if (!withoutInlineMeta) return null;
  const singleSegment = withoutInlineMeta.includes(",")
    ? (withoutInlineMeta.split(",")[0] ?? "").trim()
    : withoutInlineMeta;
  if (!singleSegment) return null;
  if (isRefusalOrFallbackText(singleSegment)) return null;
  const safeTitle = sanitizeGenerationPromptText(singleSegment);
  if (!safeTitle) return null;
  const clamped = clampStyleTitle(safeTitle);
  if (!clamped) return null;
  const normalizedTitle = toTitleCaseWords(clamped);
  if (!normalizedTitle) return null;
  return normalizedTitle;
};

const buildFallbackStyleTitle = (stylePrompt: string | null): string => {
  if (!stylePrompt) return DEFAULT_STYLE_TITLE_FALLBACK;
  const descriptorParts = stylePrompt
    .split(",")
    .map((part) =>
      part
        .replace(/\b(?:style|look|aesthetic|finish)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter(Boolean)
    .slice(0, 2);
  const rawTitle = descriptorParts
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!rawTitle) return DEFAULT_STYLE_TITLE_FALLBACK;
  const words = rawTitle.split(/\s+/).slice(0, 5).join(" ");
  const titled = normalizeExtractedStyleTitle(words);
  return titled ?? DEFAULT_STYLE_TITLE_FALLBACK;
};

const isRefusalOrFallbackText = (value: string): boolean => {
  const normalized = value.trim();
  return (
    normalized === STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE ||
    normalized === STUDIO_AGENT_UNAVAILABLE_MESSAGE
  );
};

type StyleExtractionSuccess = {
  ok: true;
  payload: AgentMachineOutcomeFields & {
    stylePrompt: string;
    styleTitle: string;
    usage: {
      inputTokens?: number;
      outputTokens?: number;
    };
    fallback_reason?: string;
  };
  diagnostics?: StyleExtractionDiagnostics;
};

type StyleExtractionFailure = {
  ok: false;
  status: number;
  payload: AgentMachineOutcomeFields & {
    error: string;
    detail?: string;
    model?: string;
    fallback_reason?: string;
  };
  diagnostics?: StyleExtractionDiagnostics;
};

export type StyleExtractionResult = StyleExtractionSuccess | StyleExtractionFailure;

export type StyleExtractionDiagnostics = {
  attemptCount: number | null;
  probeMs: number | null;
  openAiMs: number | null;
  parseMs: number | null;
  totalMs: number;
  modelUsed: string | null;
};

const normalizeDuration = (value: number): number => Math.max(0, Math.trunc(value));

const normalizeUsage = (
  usage:
    | {
        inputTokens?: number;
        outputTokens?: number;
      }
    | null
    | undefined
): {
  inputTokens?: number;
  outputTokens?: number;
} => {
  return {
    inputTokens: typeof usage?.inputTokens === "number" ? usage.inputTokens : undefined,
    outputTokens: typeof usage?.outputTokens === "number" ? usage.outputTokens : undefined,
  };
};

const isImageDataUrl = (value: string): boolean => {
  const normalized = value.trim();
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(normalized);
};

export const executeStyleExtraction = async ({
  req,
  user,
  imageDataUrl,
  routeLabel = "ai/extract-style",
}: {
  req: NextApiRequest;
  user: AuthenticatedApiUser;
  imageDataUrl: unknown;
  routeLabel?: string;
}): Promise<StyleExtractionResult> => {
  const apiKey = process.env.OPENAI_API_KEY;
  let promptTemplateVersion: string | null = null;
  let runtimeScopeKey: string | null = null;
  const emitStyleRouteTelemetry = ({
    statusCode,
    machineOutcome,
    fallbackReason,
  }: {
    statusCode: number;
    machineOutcome: AgentMachineOutcomeFields;
    fallbackReason?: string | null;
  }) => {
    emitAgentRouteOutcomeTelemetry({
      telemetryTag: "extract-style",
      routeLabel,
      statusCode,
      machineOutcome,
      policyVersion: null,
      policySchemaVersion: null,
      promptTemplateVersion,
      runtimeScopeKey,
      profileId: null,
      modality: "image",
      category: null,
      decisionAction: null,
      decisionSource: null,
      providerBlocked: null,
      hardFloorViolation: null,
      rollbackTriggered: null,
      fallbackReason,
    });
  };

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
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "route_error",
      reasonCode: "CONFIG_MISSING",
    });
    emitStyleRouteTelemetry({
      statusCode: 500,
      machineOutcome,
    });
    return {
      ok: false,
      status: 500,
      payload: {
        ...machineOutcome,
        error: STYLE_EXTRACTION_UNAVAILABLE_MESSAGE,
      },
    };
  }

  const normalizedImageDataUrl =
    typeof imageDataUrl === "string" && imageDataUrl.trim() ? imageDataUrl.trim() : null;

  if (!normalizedImageDataUrl) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.style_extraction.validation_failed",
      message: "imageDataUrl is required",
      statusCode: 400,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "route_error",
      reasonCode: "REQUEST_INVALID",
    });
    emitStyleRouteTelemetry({
      statusCode: 400,
      machineOutcome,
    });
    return {
      ok: false,
      status: 400,
      payload: {
        ...machineOutcome,
        error: "imageDataUrl is required",
      },
    };
  }

  if (normalizedImageDataUrl && !isImageDataUrl(normalizedImageDataUrl)) {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.style_extraction.validation_failed",
      message: "imageDataUrl must be a base64 image data URL",
      statusCode: 400,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "route_error",
      reasonCode: "REQUEST_INVALID",
    });
    emitStyleRouteTelemetry({
      statusCode: 400,
      machineOutcome,
    });
    return {
      ok: false,
      status: 400,
      payload: {
        ...machineOutcome,
        error: "imageDataUrl must be a base64 image data URL",
      },
    };
  }

  let runtimePrompt: Awaited<ReturnType<typeof resolveRequiredRuntimeAgentPrompt>>;
  try {
    runtimePrompt = await resolveRequiredRuntimeAgentPrompt({
      promptId: STYLE_EXTRACTOR_ID,
    });
  } catch (error) {
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "route_error",
      reasonCode: "CONFIG_MISSING",
    });
    if (
      error instanceof RequiredRuntimeAgentPromptMissingError ||
      error instanceof RequiredRuntimeAgentPromptUnavailableError ||
      (error instanceof Error &&
        (error.name === "RequiredRuntimeAgentPromptMissingError" ||
          error.name === "RequiredRuntimeAgentPromptUnavailableError"))
    ) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.style_extraction.config_missing",
        message: error instanceof Error ? error.message : `${STYLE_EXTRACTOR_ID} is unavailable`,
        statusCode: 503,
        userId: user.id,
        userEmail: user.email ?? null,
      });
      emitStyleRouteTelemetry({
        statusCode: 503,
        machineOutcome,
      });
      return {
        ok: false,
        status: 503,
        payload: {
          ...machineOutcome,
          error: STYLE_EXTRACTION_UNAVAILABLE_MESSAGE,
        },
      };
    }
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.style_extraction.config_missing",
      message: error instanceof Error ? error.message : "Style extraction prompt lookup failed",
      statusCode: 500,
      stack: error instanceof Error ? (error.stack ?? null) : null,
      userId: user.id,
      userEmail: user.email ?? null,
    });
    emitStyleRouteTelemetry({
      statusCode: 500,
      machineOutcome,
    });
    return {
      ok: false,
      status: 500,
      payload: {
        ...machineOutcome,
        error: STYLE_EXTRACTION_UNAVAILABLE_MESSAGE,
      },
    };
  }
  const systemPrompt = runtimePrompt.promptBody;
  promptTemplateVersion = resolvePromptTemplateVersion({
    route: "extract-style",
    prompts: [systemPrompt],
  });
  runtimeScopeKey = buildPromptCompilerCacheScopeKey({
    route: "extract-style",
    promptTemplateVersion,
    policySchemaVersion: null,
    controlPlanePolicyVersion: null,
  });

  try {
    const extractionStartedAt = Date.now();
    let openAiMs = 0;
    let parseMs: number | null = null;
    let attemptCount = 0;
    let modelUsed: string | null = null;

    const primaryVisionModel = (process.env.OPENAI_VISION_MODEL || DEFAULT_VISION_MODEL).trim();
    const fallbackVisionModel = (
      process.env.OPENAI_VISION_FALLBACK_MODEL || DEFAULT_FALLBACK_VISION_MODEL
    ).trim();

    const attemptedModels: string[] = [primaryVisionModel];

    let extractionAttempt = await requestOpenAiStructuredStyleExtractionWithRetry({
      apiKey,
      model: primaryVisionModel,
      systemPrompt,
      imageDataUrl: normalizedImageDataUrl,
    });
    openAiMs += extractionAttempt.elapsedMs;
    attemptCount += extractionAttempt.attemptCount;
    modelUsed = extractionAttempt.model;

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
      extractionAttempt = await requestOpenAiStructuredStyleExtractionWithRetry({
        apiKey,
        model: fallbackVisionModel,
        systemPrompt,
        imageDataUrl: normalizedImageDataUrl,
      });
      openAiMs += extractionAttempt.elapsedMs;
      attemptCount += extractionAttempt.attemptCount;
      modelUsed = extractionAttempt.model;
    }

    if (!extractionAttempt.ok) {
      const detail = extractionAttempt.detail;
      const customerDetail = sanitizeCustomerFacingProviderText(detail, "Style extraction failed.");
      const modelUsedForFailure = extractionAttempt.model;
      const fallbackReason = resolveStudioAgentFallbackReasonLabel({
        status: extractionAttempt.status,
        detail,
      });
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
          model: modelUsedForFailure,
          attempted_models: attemptedModels,
          failure_class: "upstream_http",
          attempt_count: attemptCount,
          openai_ms: normalizeDuration(openAiMs),
          total_ms: normalizeDuration(Date.now() - extractionStartedAt),
        },
      });
      const machineOutcome = buildAgentMachineOutcome({
        outcomeClass: "upstream_error",
        reasonCode: resolveUpstreamReasonCode({ detail }),
      });
      emitStyleRouteTelemetry({
        statusCode: extractionAttempt.status,
        machineOutcome,
        fallbackReason,
      });
      return {
        ok: false,
        status: extractionAttempt.status,
        payload: {
          ...machineOutcome,
          error: "Upstream error",
          detail: customerDetail,
          fallback_reason: fallbackReason,
        },
        diagnostics: {
          attemptCount,
          probeMs: null,
          openAiMs: normalizeDuration(openAiMs),
          parseMs: null,
          totalMs: normalizeDuration(Date.now() - extractionStartedAt),
          modelUsed,
        },
      };
    }

    const parseStartedAt = Date.now();
    const structuredData = extractionAttempt.data as { stylePrompt: string; styleTitle: string };
    const parsedExtraction = {
      stylePrompt: normalizeExtractedStylePrompt(structuredData.stylePrompt),
      styleTitle:
        normalizeExtractedStyleTitle(structuredData.styleTitle) ??
        buildFallbackStyleTitle(normalizeExtractedStylePrompt(structuredData.stylePrompt)),
    };
    parseMs = normalizeDuration(Date.now() - parseStartedAt);
    const stylePrompt = parsedExtraction.stylePrompt;
    const styleTitle = parsedExtraction.styleTitle;

    if (!stylePrompt || isRefusalOrFallbackText(stylePrompt)) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.style_extraction.empty_response",
        message: "No style prompt returned",
        statusCode: 502,
        userId: user.id,
        userEmail: user.email ?? null,
        metadata: {
          failure_class: "empty_response",
          attempt_count: attemptCount,
          openai_ms: normalizeDuration(openAiMs),
          parse_ms: parseMs,
          total_ms: normalizeDuration(Date.now() - extractionStartedAt),
          model: modelUsed,
        },
      });
      const machineOutcome = buildAgentMachineOutcome({
        outcomeClass: "upstream_error",
        reasonCode: resolveUpstreamReasonCode({ stage: "style_prompt_missing" }),
      });
      const fallbackReason = resolveStudioAgentFallbackReasonLabel({
        stage: "style_prompt_missing",
        status: 502,
        detail: parsedExtraction.stylePrompt ?? "No style prompt returned",
      });
      emitStyleRouteTelemetry({
        statusCode: 502,
        machineOutcome,
        fallbackReason,
      });
      return {
        ok: false,
        status: 502,
        payload: {
          ...machineOutcome,
          error: "No style prompt returned",
          detail: "Unable to extract style descriptors from the provided image.",
          fallback_reason: fallbackReason,
        },
        diagnostics: {
          attemptCount,
          probeMs: null,
          openAiMs: normalizeDuration(openAiMs),
          parseMs,
          totalMs: normalizeDuration(Date.now() - extractionStartedAt),
          modelUsed,
        },
      };
    }
    const successOutcome = buildAgentMachineOutcome({
      outcomeClass: "success_prompt",
      reasonCode: "SUCCESS_PROMPT",
    });
    emitStyleRouteTelemetry({
      statusCode: 200,
      machineOutcome: successOutcome,
    });

    return {
      ok: true,
      payload: {
        ...successOutcome,
        stylePrompt,
        styleTitle,
        usage: normalizeUsage(
          (
            extractionAttempt as {
              usage?: {
                inputTokens?: number;
                outputTokens?: number;
              };
            }
          ).usage
        ),
      },
      diagnostics: {
        attemptCount,
        probeMs: null,
        openAiMs: normalizeDuration(openAiMs),
        parseMs,
        totalMs: normalizeDuration(Date.now() - extractionStartedAt),
        modelUsed,
      },
    };
  } catch (error) {
    const detail = String(error);
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
        detail,
      },
    });
    const machineOutcome = buildAgentMachineOutcome({
      outcomeClass: "upstream_error",
      reasonCode: resolveUpstreamReasonCode({ detail }),
    });
    const fallbackReason = resolveStudioAgentFallbackReasonLabel({
      detail,
    });
    emitStyleRouteTelemetry({
      statusCode: 500,
      machineOutcome,
      fallbackReason,
    });
    return {
      ok: false,
      status: 500,
      payload: {
        ...machineOutcome,
        error: "Style extraction failed",
        fallback_reason: fallbackReason,
      },
    };
  }
};
