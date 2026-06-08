/**
 * Authenticated GPT Image 2 edit route.
 * Validates standard edit payloads, charges through shared billing, calls OpenAI Images edits,
 * and persists the direct-complete output into canonical generation/media records.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  type OpenAiImage2InputFidelity,
  type OpenAiImage2Quality,
  type OpenAiImage2ProviderSize,
  OPENAI_GPT_IMAGE_2_DEFAULT_INPUT_FIDELITY,
  OPENAI_GPT_IMAGE_2_MODEL_ID,
  isOpenAiGptImage2ProviderSize,
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
  type ResolvedInternalMediaFile,
  readInternalEditMediaRefsFromPayload,
  readInternalMediaRefsFromPayload,
  resolveOpenAiImageFilesForInternalEditMediaRefs,
  resolveOpenAiImageFilesForInternalMediaRefs,
} from "../../../lib/server/api/internalMediaRefResolution";
import { readGenerationAbandonmentContext } from "../../../lib/server/api/generationAbandonment";
import {
  type OpenAiEditImageSource,
  editOpenAiImage,
  persistGeneratedImageAsset,
} from "../../../lib/server/openaiImageGeneration";
import { readGenerationWorkspaceRuntimeKeyFromContext } from "../../../lib/server/api/generationWorkspaceRuntimeKey";

type ImageEditRequestBody = {
  prompt?: unknown;
  size?: unknown;
  quality?: unknown;
  images?: unknown;
  input_fidelity?: unknown;
  mask?: unknown;
  project_id?: unknown;
  generation_replay?: unknown;
  workflow_reload?: unknown;
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

const normalizeSize = (value: unknown): OpenAiImage2ProviderSize | null => {
  const normalized = normalizeRequiredString(value)?.toLowerCase();
  return normalized && isOpenAiGptImage2ProviderSize(normalized) ? normalized : null;
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
  if (!imageUrls.length || imageUrls.length > 16) return null;
  return imageUrls;
};

const createOpenAiFileSource = (
  file: ResolvedInternalMediaFile | null
): OpenAiEditImageSource | null => {
  if (!file) return null;
  return {
    kind: "file",
    buffer: file.buffer,
    contentType: file.contentType,
    filename: file.filename,
    sourceId: file.storagePath,
  };
};

const createOpenAiUrlSource = (
  imageUrl: string | null | undefined
): OpenAiEditImageSource | null => {
  const normalized = normalizeRequiredString(imageUrl);
  if (!normalized) return null;
  return {
    kind: "url",
    imageUrl: normalized,
  };
};

const dedupeProviderImageSources = (
  sources: Array<OpenAiEditImageSource | null | undefined>,
  limit = 16
): OpenAiEditImageSource[] => {
  const seen = new Set<string>();
  const deduped: OpenAiEditImageSource[] = [];
  sources.forEach((source) => {
    if (!source) return;
    const key =
      source.kind === "url"
        ? `url:${source.imageUrl}`
        : `file:${source.sourceId ?? `${source.filename}:${source.buffer.byteLength}`}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(source);
  });
  return deduped.slice(0, limit);
};

const buildBillingImageRef = (
  source: OpenAiEditImageSource
): { image_url: string } | { file_id: string } =>
  source.kind === "url"
    ? { image_url: source.imageUrl }
    : { file_id: `internal:${source.filename}` };

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
    const workflowReload = asRecord(body.workflow_reload) ?? {};
    const characterContext = asRecord(body.character_context) ?? {};
    const styleContext = asRecord(body.style_context) ?? {};
    const shortpulseContext = asRecord(body.shortpulse_context) ?? {};
    const workspaceRuntimeKey = readGenerationWorkspaceRuntimeKeyFromContext({
      context: shortpulseContext,
      projectId,
    });
    const internalMediaRefs = readInternalMediaRefsFromPayload(body.shortpulse_internal_media_refs);
    const internalEditMediaRefs = readInternalEditMediaRefsFromPayload(
      body.shortpulse_internal_edit_media_refs
    );
    const internalImages = await resolveOpenAiImageFilesForInternalMediaRefs({
      refs: internalMediaRefs,
      userId: user.id,
    });
    const internalEditFiles = await resolveOpenAiImageFilesForInternalEditMediaRefs({
      refs: internalEditMediaRefs,
      userId: user.id,
    });
    const externalDirectImages = filterExternalUrlsFromInternalRefs(directImages, [
      ...internalMediaRefs,
      internalEditMediaRefs.baseImageRef,
      internalEditMediaRefs.referenceImageRef,
    ]);
    const images = dedupeProviderImageSources([
      createOpenAiFileSource(internalEditFiles.baseImageFile),
      createOpenAiFileSource(internalEditFiles.referenceImageFile),
      ...internalImages.map((file) => createOpenAiFileSource(file)),
      ...externalDirectImages.map((imageUrl) => createOpenAiUrlSource(imageUrl)),
    ]);
    const resolvedMask =
      createOpenAiFileSource(internalEditFiles.maskFile) ?? createOpenAiUrlSource(maskUrl);

    if (
      !prompt ||
      !size ||
      !quality ||
      images.length < 1 ||
      !inputFidelity ||
      (hasMaskPayload && !resolvedMask)
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
        images: images.map((source) => buildBillingImageRef(source)),
        input_fidelity: inputFidelity,
        ...(resolvedMask ? { mask: buildBillingImageRef(resolvedMask) } : {}),
      },
      reason: "openai-gpt-image-2 edit",
      shortpulseContext,
    });
    if (!charge) return;
    const settledCharge = charge;

    const edited = await editOpenAiImage({
      prompt,
      size,
      quality,
      images,
      mask: resolvedMask,
    });
    const providerRequestId = edited.providerRequestId ?? `openai:${charge.sourceRef}`;
    const submitLink = await charge.markSubmitted(providerRequestId, {
      source_mode: "image",
      openai_operation: "edit",
      requested_size: size,
      requested_quality: quality,
      input_image_count: images.length,
      input_fidelity: inputFidelity,
      mask_present: Boolean(resolvedMask),
    });
    if (!submitLink.ok) {
      throw new Error(`Unable to link generation billing reservation: ${submitLink.status}`);
    }

    const persisted = await persistGeneratedImageAsset({
      userId: charge.userId,
      projectId,
      workspaceRuntimeKey,
      promptText: prompt,
      modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
      providerRequestId,
      requestId: charge.sourceRef,
      requestedSize: size,
      requestedQuality: quality,
      outputBuffer: edited.buffer,
      outputContentType: edited.contentType,
      generationReplay,
      workflowReload,
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
        mask_present: Boolean(resolvedMask),
        provider_usage: edited.usage,
      },
      beforeVisibleSettlement: async ({ generationId }) => {
        const captureResult = await captureSucceededGenerationByProviderRequest({
          userId: settledCharge.userId,
          providerRequestId,
          reason: "OpenAI image edit completed.",
          routeLabel: "openai-image-edit",
          detail: {
            generation_id: generationId,
            source_ref: settledCharge.sourceRef,
            source_mode: "image",
            openai_operation: "edit",
          },
        });
        if (!captureResult.settled) {
          throw new Error(
            `Unable to capture generation billing reservation: ${captureResult.note}`
          );
        }
      },
    });

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
