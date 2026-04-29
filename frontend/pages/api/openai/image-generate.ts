import type { NextApiRequest, NextApiResponse } from "next";
import {
  type OpenAiImage2Quality,
  type OpenAiImage2Size,
  OPENAI_GPT_IMAGE_2_MODEL_ID,
} from "../../../lib/model-runtime/openAiImage2";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  captureSucceededGenerationByProviderRequest,
  chargeGenerationRequest,
} from "../../../lib/server/api/generationBilling";
import { readGenerationAbandonmentContext } from "../../../lib/server/api/generationAbandonment";
import {
  generateOpenAiImage,
  persistGeneratedImageAsset,
} from "../../../lib/server/openaiImageGeneration";

type ImageGenerateRequestBody = {
  prompt?: unknown;
  size?: unknown;
  quality?: unknown;
  project_id?: unknown;
  generation_replay?: unknown;
  character_context?: unknown;
  style_context?: unknown;
  shortpulse_context?: unknown;
};

type ImageGenerateSuccessResponse = {
  output: {
    provider: "openai-image";
    mode: "image";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    resultUrls: string[];
    previewStoragePath: string;
    fullStoragePath: string;
    mimeType: string;
    modelId: string;
    savedMediaIds: string[];
  };
};

type ImageGenerateErrorResponse = {
  error: string;
  details?: string;
};

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const normalizeSize = (value: unknown): OpenAiImage2Size | null => {
  const normalized = normalizeRequiredString(value)?.toLowerCase();
  if (normalized === "1024x1024" || normalized === "1024x1536" || normalized === "1536x1024") {
    return normalized;
  }
  return null;
};

const normalizeQuality = (value: unknown): OpenAiImage2Quality | null => {
  const normalized = normalizeRequiredString(value)?.toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImageGenerateSuccessResponse | ImageGenerateErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  let charge: Awaited<ReturnType<typeof chargeGenerationRequest>> = null;

  try {
    const body = (req.body ?? {}) as ImageGenerateRequestBody;
    const prompt = normalizeRequiredString(body.prompt);
    const size = normalizeSize(body.size);
    const quality = normalizeQuality(body.quality);
    const projectId = normalizeRequiredString(body.project_id);
    const generationReplay = asRecord(body.generation_replay) ?? {};
    const characterContext = asRecord(body.character_context) ?? {};
    const styleContext = asRecord(body.style_context) ?? {};
    const shortpulseContext = asRecord(body.shortpulse_context) ?? {};

    if (!prompt || !size || !quality) {
      return res.status(400).json({
        error: "Invalid request",
        details: "prompt, size, and quality are required.",
      });
    }

    charge = await chargeGenerationRequest({
      req,
      res,
      modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
      payload: {
        prompt,
        size,
        quality,
        n: 1,
      },
      reason: "openai-gpt-image-2 generation",
    });
    if (!charge) return;

    const generated = await generateOpenAiImage({
      prompt,
      size,
      quality,
    });
    const providerRequestId = generated.providerRequestId ?? `openai:${charge.sourceRef}`;
    const submitLink = await charge.markSubmitted(providerRequestId, {
      source_mode: "image",
      requested_size: size,
      requested_quality: quality,
    });
    if (!submitLink.ok) {
      throw new Error(`Unable to link generation billing reservation: ${submitLink.status}`);
    }

    const persisted = await persistGeneratedImageAsset({
      userId: charge.userId,
      projectId,
      promptText: prompt,
      modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
      providerRequestId,
      requestId: charge.sourceRef,
      requestedSize: size,
      requestedQuality: quality,
      outputBuffer: generated.buffer,
      outputContentType: generated.contentType,
      generationReplay,
      characterContext,
      styleContext,
      extraMetadata: {
        billing_mode: charge.billingMode,
        billing_source_ref: charge.sourceRef,
        debited_credits: charge.credits,
        pricing_metadata: charge.chargeMetadata,
        provider_request_id: providerRequestId,
        revised_prompt: generated.revisedPrompt,
        shortpulse_context: shortpulseContext,
        provider_usage: generated.usage,
      },
    });
    const captureResult = await captureSucceededGenerationByProviderRequest({
      userId: charge.userId,
      providerRequestId,
      reason: "OpenAI image generation completed.",
      routeLabel: "openai-image-generate",
      detail: {
        generation_id: persisted.generationId,
        source_ref: charge.sourceRef,
        source_mode: "image",
      },
    });
    if (!captureResult.settled) {
      throw new Error(`Unable to capture generation billing reservation: ${captureResult.note}`);
    }

    return res.status(200).json({
      output: {
        provider: "openai-image",
        mode: "image",
        generationId: persisted.generationId,
        mediaFileId: persisted.mediaFileId,
        requestId: persisted.requestId,
        previewUrl: persisted.signedUrl,
        resultUrls: [persisted.signedUrl],
        previewStoragePath: persisted.storagePath,
        fullStoragePath: persisted.storagePath,
        mimeType: generated.contentType,
        modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
        savedMediaIds: persisted.mediaFileId ? [persisted.mediaFileId] : [],
      },
    });
  } catch (error) {
    if (charge) {
      const abandonment = await readGenerationAbandonmentContext({
        userId: charge.userId,
        sourceRef: charge.sourceRef,
        requestId: charge.sourceRef,
      });
      if (!abandonment.abandoned || !abandonment.noRefund) {
        await charge.refund("Auto-refund: OpenAI image generation failed.", {
          source_mode: "image",
        });
      }
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "openai-image-generate",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to generate image",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
