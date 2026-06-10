/**
 * Generates a square style-card preview image for prompt-only custom Styles Library creation.
 * The route bills through the canonical Create image pricing path but returns only a compact
 * data URL for style preference persistence, avoiding normal Reference Grid/media artifacts.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import sharp from "sharp";
import {
  OPENAI_GPT_IMAGE_2_MODEL_ID,
  type OpenAiImage2Quality,
  type OpenAiImage2ProviderSize,
} from "../../../lib/model-runtime/openAiImage2";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { toErrorMessage } from "../../../lib/server/api/errorMessage";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";
import { STYLE_PROMPT_MAX_CHARACTERS } from "../../../features/ai-studio/components/style-creator/constants";
import {
  captureSucceededGenerationByProviderRequest,
  chargeGenerationRequest,
} from "../../../lib/server/api/generationBilling";
import { generateOpenAiImage } from "../../../lib/server/openaiImageGeneration";

type StylePreviewGenerateRequestBody = {
  styleId?: unknown;
  styleName?: unknown;
  stylePrompt?: unknown;
};

type StylePreviewGenerateSuccessResponse = {
  previewImageUrl: string;
  modelId: typeof OPENAI_GPT_IMAGE_2_MODEL_ID;
  size: OpenAiImage2ProviderSize;
  quality: OpenAiImage2Quality;
};

type StylePreviewGenerateErrorResponse = {
  error: string;
  details?: string;
};

const STYLE_PREVIEW_SIZE: OpenAiImage2ProviderSize = "1024x1024";
const STYLE_PREVIEW_QUALITY: OpenAiImage2Quality = "low";
const STYLE_PREVIEW_JPEG_QUALITY = 86;
const STYLE_PREVIEW_MAX_STYLE_ID_LENGTH = 160;
const STYLE_PREVIEW_MAX_STYLE_NAME_LENGTH = 120;

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveStylePreviewValidationError = ({
  styleId,
  styleName,
  stylePrompt,
}: {
  styleId: string | null;
  styleName: string | null;
  stylePrompt: string | null;
}): string | null => {
  if (!styleId || !styleName || !stylePrompt) {
    return "styleId, styleName, and stylePrompt are required.";
  }
  if (styleId.length > STYLE_PREVIEW_MAX_STYLE_ID_LENGTH) {
    return `styleId must be ${STYLE_PREVIEW_MAX_STYLE_ID_LENGTH} characters or fewer.`;
  }
  if (styleName.length > STYLE_PREVIEW_MAX_STYLE_NAME_LENGTH) {
    return `styleName must be ${STYLE_PREVIEW_MAX_STYLE_NAME_LENGTH} characters or fewer.`;
  }
  if (stylePrompt.length > STYLE_PROMPT_MAX_CHARACTERS) {
    return `stylePrompt must be ${STYLE_PROMPT_MAX_CHARACTERS} characters or fewer.`;
  }
  return null;
};

const buildStylePreviewPrompt = ({
  styleName,
  stylePrompt,
}: {
  styleName: string;
  stylePrompt: string;
}): string =>
  [
    `Create a single square visual reference image for the custom style "${styleName}".`,
    "The image should demonstrate the style itself rather than show UI, text, watermarks, logos, or before-and-after panels.",
    `Style description: ${stylePrompt}`,
  ].join("\n");

const convertGeneratedImageToStylePreviewDataUrl = async (buffer: Buffer): Promise<string> => {
  const previewBuffer = await sharp(buffer)
    .resize(512, 512, {
      fit: "cover",
      position: "center",
    })
    .jpeg({
      quality: STYLE_PREVIEW_JPEG_QUALITY,
      mozjpeg: true,
    })
    .toBuffer();

  return `data:image/jpeg;base64,${previewBuffer.toString("base64")}`;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StylePreviewGenerateSuccessResponse | StylePreviewGenerateErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  let charge: Awaited<ReturnType<typeof chargeGenerationRequest>> = null;

  try {
    const body = (req.body ?? {}) as StylePreviewGenerateRequestBody;
    const styleId = normalizeRequiredString(body.styleId);
    const styleName = normalizeRequiredString(body.styleName);
    const stylePrompt = normalizeRequiredString(body.stylePrompt);
    const validationError = resolveStylePreviewValidationError({
      styleId,
      styleName,
      stylePrompt,
    });

    if (validationError) {
      return res.status(400).json({
        error: "Invalid request",
        details: validationError,
      });
    }
    const validatedStyleId = styleId as string;
    const validatedStyleName = styleName as string;
    const validatedStylePrompt = stylePrompt as string;

    const prompt = buildStylePreviewPrompt({
      styleName: validatedStyleName,
      stylePrompt: validatedStylePrompt,
    });
    const shortpulseContext = {
      selected_tool: "create",
      mode: "image",
      source_mode: "style_preview",
      style_id: validatedStyleId,
      style_name: validatedStyleName,
    };

    charge = await chargeGenerationRequest({
      req,
      res,
      modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
      payload: {
        prompt,
        size: STYLE_PREVIEW_SIZE,
        quality: STYLE_PREVIEW_QUALITY,
        n: 1,
      },
      reason: "openai-gpt-image-2 style preview generation",
      shortpulseContext,
    });
    if (!charge) return;

    const generated = await generateOpenAiImage({
      prompt,
      size: STYLE_PREVIEW_SIZE,
      quality: STYLE_PREVIEW_QUALITY,
    });
    const providerRequestId = generated.providerRequestId ?? `openai:${charge.sourceRef}`;
    const submitLink = await charge.markSubmitted(providerRequestId, {
      source_mode: "style_preview",
      requested_size: STYLE_PREVIEW_SIZE,
      requested_quality: STYLE_PREVIEW_QUALITY,
      style_id: validatedStyleId,
    });
    if (!submitLink.ok) {
      throw new Error(`Unable to link style preview billing reservation: ${submitLink.status}`);
    }

    const previewImageUrl = await convertGeneratedImageToStylePreviewDataUrl(generated.buffer);
    const captureResult = await captureSucceededGenerationByProviderRequest({
      userId: charge.userId,
      providerRequestId,
      reason: "Style preview image generated.",
      routeLabel: "ai-generate-style-preview",
      detail: {
        source_ref: charge.sourceRef,
        source_mode: "style_preview",
        style_id: validatedStyleId,
      },
    });
    if (!captureResult.settled) {
      throw new Error(`Unable to capture style preview billing reservation: ${captureResult.note}`);
    }

    return res.status(200).json({
      previewImageUrl,
      modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
      size: STYLE_PREVIEW_SIZE,
      quality: STYLE_PREVIEW_QUALITY,
    });
  } catch (error) {
    if (charge) {
      await charge.refund("Auto-refund: style preview image generation failed.", {
        source_mode: "style_preview",
      });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai-generate-style-preview",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to generate style preview",
      details: sanitizeCustomerFacingProviderText(
        toErrorMessage(error, "Unknown error"),
        "Style preview generation failed."
      ),
    });
  }
}
