/**
 * Generates a square style-card preview image for prompt-only custom Styles Library creation.
 * The route bills as a style-preview helper and returns only a compact data URL for style
 * preference persistence, avoiding normal Reference Grid/media artifacts.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import sharp from "sharp";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { toErrorMessage } from "../../../lib/server/api/errorMessage";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";
import { STYLE_PROMPT_MAX_CHARACTERS } from "../../../lib/model-runtime/styleCreatorLimits";
import {
  captureSucceededGenerationByProviderRequest,
  chargeGenerationRequest,
} from "../../../lib/server/api/generationBilling";
import {
  buildFalFluxKleinStylePreviewPayload,
  FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID,
  FAL_FLUX_2_KLEIN_STYLE_PREVIEW_OUTPUT_FORMAT,
  FAL_FLUX_2_KLEIN_STYLE_PREVIEW_SIZE,
  generateFalFluxKleinStylePreviewImage,
} from "../../../lib/server/falStylePreviewGeneration";

type StylePreviewGenerateRequestBody = {
  styleId?: unknown;
  styleName?: unknown;
  stylePrompt?: unknown;
};

type StylePreviewGenerateSuccessResponse = {
  previewImageUrl: string;
  modelId: typeof FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID;
  size: typeof FAL_FLUX_2_KLEIN_STYLE_PREVIEW_SIZE;
  quality: null;
};

type StylePreviewGenerateErrorResponse = {
  error: string;
  details?: string;
};

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

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "ai-generate-style-preview.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Unable to generate style preview",
      details: "Style preview generation failed.",
    });
  }
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

    const providerPayload = buildFalFluxKleinStylePreviewPayload(prompt);
    charge = await chargeGenerationRequest({
      req,
      res,
      modelId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID,
      payload: providerPayload,
      reason: "fal-flux-2-klein style preview generation",
      billingWorkflow: "style_preview",
      shortpulseContext,
    });
    if (!charge) return;

    const generated = await generateFalFluxKleinStylePreviewImage({
      payload: providerPayload,
    });
    const providerRequestId = generated.providerRequestId;
    if (!providerRequestId) {
      throw new Error("Style preview generation did not return a request id.");
    }
    const submitLink = await charge.markSubmitted(providerRequestId, {
      source_mode: "style_preview",
      requested_size: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_SIZE,
      requested_output_format: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_OUTPUT_FORMAT,
      requested_num_inference_steps: providerPayload.num_inference_steps,
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
        provider_media_url: generated.mediaUrl,
      },
    });
    if (!captureResult.settled) {
      throw new Error(`Unable to capture style preview billing reservation: ${captureResult.note}`);
    }

    return res.status(200).json({
      previewImageUrl,
      modelId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID,
      size: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_SIZE,
      quality: null,
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
