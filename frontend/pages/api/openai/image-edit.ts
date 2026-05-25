/**
 * Authenticated GPT Image 2 edit route.
 * Validates standard edit payloads, charges through shared billing, calls OpenAI Images edits,
 * and persists the direct-complete output into canonical generation/media records.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  type OpenAiImage2InputFidelity,
  type OpenAiImage2Quality,
  type OpenAiImage2Size,
  OPENAI_GPT_IMAGE_2_DEFAULT_INPUT_FIDELITY,
  OPENAI_GPT_IMAGE_2_MODEL_ID,
} from "../../../lib/model-runtime/openAiImage2";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { toErrorMessage } from "../../../lib/server/api/errorMessage";
import {
  captureSucceededGenerationByProviderRequest,
  chargeGenerationRequest,
} from "../../../lib/server/api/generationBilling";
import {
  filterExternalUrlsFromInternalRefs,
  readInternalEditMediaRefsFromPayload,
  readInternalMediaRefsFromPayload,
  resolveSignedUrlsForInternalEditMediaRefs,
  resolveSignedUrlsForInternalMediaRefs,
} from "../../../lib/server/api/internalMediaRefResolution";
import { readGenerationAbandonmentContext } from "../../../lib/server/api/generationAbandonment";
import {
  editOpenAiImage,
  persistGeneratedImageAsset,
} from "../../../lib/server/openaiImageGeneration";

type ImageEditRequestBody = {
  prompt?: unknown;
  size?: unknown;
  quality?: unknown;
  images?: unknown;
  input_fidelity?: unknown;
  mask?: unknown;
  project_id?: unknown;
  generation_replay?: unknown;
  character_context?: unknown;
  style_context?: unknown;
  shortpulse_context?: unknown;
  shortpulse_internal_media_refs?: unknown;
  shortpulse_internal_edit_media_refs?: unknown;
};

type ImageEditSuccessResponse = {
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
    saveState: "saved" | "idle" | "failed" | "blocked_storage";
    saveError: string | null;
  };
};

type ImageEditErrorResponse = {
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

const normalizeInputFidelity = (value: unknown): OpenAiImage2InputFidelity | null => {
  if (value == null) return OPENAI_GPT_IMAGE_2_DEFAULT_INPUT_FIDELITY;
  const normalized = normalizeRequiredString(value)?.toLowerCase();
  if (normalized === "low" || normalized === "high") {
    return OPENAI_GPT_IMAGE_2_DEFAULT_INPUT_FIDELITY;
  }
  return null;
};

const normalizeImageSources = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const imageUrls = value
    .map((entry) => {
      const record = asRecord(entry);
      return normalizeRequiredString(record?.image_url);
    })
    .filter((imageUrl): imageUrl is string => Boolean(imageUrl));
  if (!imageUrls.length || imageUrls.length > 8) return null;
  return imageUrls;
};

const dedupeImageSources = (sources: Array<string | null | undefined>, limit = 8): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];
  sources.forEach((source) => {
    const normalized = normalizeRequiredString(source);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    deduped.push(normalized);
  });
  return deduped.slice(0, limit);
};

const normalizeOptionalMaskUrl = (value: unknown): string | null | undefined => {
  if (value == null) return undefined;
  const record = asRecord(value);
  const imageUrl = normalizeRequiredString(record?.image_url);
  return imageUrl ?? null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImageEditSuccessResponse | ImageEditErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  let charge: Awaited<ReturnType<typeof chargeGenerationRequest>> = null;

  try {
    const body = (req.body ?? {}) as ImageEditRequestBody;
    const prompt = normalizeRequiredString(body.prompt);
    const size = normalizeSize(body.size);
    const quality = normalizeQuality(body.quality);
    const directImages = normalizeImageSources(body.images) ?? [];
    const inputFidelity = normalizeInputFidelity(body.input_fidelity);
    const maskUrl = normalizeOptionalMaskUrl(body.mask);
    const hasMaskPayload = body.mask != null;
    const projectId = normalizeRequiredString(body.project_id);
    const generationReplay = asRecord(body.generation_replay) ?? {};
    const characterContext = asRecord(body.character_context) ?? {};
    const styleContext = asRecord(body.style_context) ?? {};
    const shortpulseContext = asRecord(body.shortpulse_context) ?? {};
    const internalMediaRefs = readInternalMediaRefsFromPayload(body.shortpulse_internal_media_refs);
    const internalEditMediaRefs = readInternalEditMediaRefsFromPayload(
      body.shortpulse_internal_edit_media_refs
    );
    const internalImages = await resolveSignedUrlsForInternalMediaRefs({
      refs: internalMediaRefs,
      userId: user.id,
    });
    const internalEditSignedUrls = await resolveSignedUrlsForInternalEditMediaRefs({
      refs: internalEditMediaRefs,
      userId: user.id,
    });
    const externalDirectImages = filterExternalUrlsFromInternalRefs(directImages, [
      ...internalMediaRefs,
      internalEditMediaRefs.baseImageRef,
      internalEditMediaRefs.referenceImageRef,
    ]);
    const images = dedupeImageSources([
      internalEditSignedUrls.baseImageUrl,
      internalEditSignedUrls.referenceImageUrl,
      ...internalImages,
      ...externalDirectImages,
    ]);
    const resolvedMaskUrl = internalEditSignedUrls.maskUrl ?? maskUrl;

    if (
      !prompt ||
      !size ||
      !quality ||
      images.length < 1 ||
      !inputFidelity ||
      (hasMaskPayload && !resolvedMaskUrl)
    ) {
      return res.status(400).json({
        error: "Invalid request",
        details:
          "prompt, size, quality, images, optional compatibility input_fidelity, and an optional valid mask are required.",
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
        images: images.map((imageUrl) => ({ image_url: imageUrl })),
        input_fidelity: inputFidelity,
        ...(resolvedMaskUrl ? { mask: { image_url: resolvedMaskUrl } } : {}),
      },
      reason: "openai-gpt-image-2 edit",
    });
    if (!charge) return;

    const edited = await editOpenAiImage({
      prompt,
      size,
      quality,
      images,
      maskUrl: resolvedMaskUrl,
    });
    const providerRequestId = edited.providerRequestId ?? `openai:${charge.sourceRef}`;
    const submitLink = await charge.markSubmitted(providerRequestId, {
      source_mode: "image",
      openai_operation: "edit",
      requested_size: size,
      requested_quality: quality,
      input_image_count: images.length,
      input_fidelity: inputFidelity,
      mask_present: Boolean(resolvedMaskUrl),
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
      outputBuffer: edited.buffer,
      outputContentType: edited.contentType,
      generationReplay,
      characterContext,
      styleContext,
      extraMetadata: {
        billing_mode: charge.billingMode,
        billing_source_ref: charge.sourceRef,
        debited_credits: charge.credits,
        pricing_metadata: charge.chargeMetadata,
        provider_request_id: providerRequestId,
        revised_prompt: edited.revisedPrompt,
        shortpulse_context: shortpulseContext,
        openai_operation: "edit",
        input_image_count: images.length,
        input_fidelity: inputFidelity,
        mask_present: Boolean(resolvedMaskUrl),
        provider_usage: edited.usage,
      },
    });
    const captureResult = await captureSucceededGenerationByProviderRequest({
      userId: charge.userId,
      providerRequestId,
      reason: "OpenAI image edit completed.",
      routeLabel: "openai-image-edit",
      detail: {
        generation_id: persisted.generationId,
        source_ref: charge.sourceRef,
        source_mode: "image",
        openai_operation: "edit",
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
        mimeType: edited.contentType,
        modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
        savedMediaIds: persisted.mediaFileId ? [persisted.mediaFileId] : [],
        saveState: persisted.saveState,
        saveError: persisted.saveError,
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
        await charge.refund("Auto-refund: OpenAI image edit failed.", {
          source_mode: "image",
          openai_operation: "edit",
        });
      }
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "openai-image-edit",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to edit image",
      details: toErrorMessage(error, "Unknown error"),
    });
  }
}
