import type { NextApiRequest, NextApiResponse } from "next";
import { resolveRequiredAudioVoiceoverModelId } from "../../../lib/model-runtime/modelCatalog";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  readElevenLabsProviderError,
  resolveElevenLabsProviderUserMessage,
} from "../../../lib/server/api/elevenlabsProviderError";
import { listSavedVoicesForUser } from "../../../lib/server/api/userSavedVoices";
import { toErrorMessage } from "../../../lib/server/api/errorMessage";
import {
  captureSucceededGenerationByProviderRequest,
  chargeGenerationRequest,
} from "../../../lib/server/api/generationBilling";
import {
  generateElevenLabsVoiceover,
  listElevenLabsVoices,
  persistGeneratedAudioAsset,
} from "../../../lib/server/elevenlabs";
import { resolveVoiceAccessForUser } from "../../../lib/server/elevenlabsVoiceLibrary";
import { markAudioCompanionArtPendingBestEffort } from "../../../lib/server/audioCompanionArt/routePending";
import { readGenerationWorkspaceRuntimeKeyFromContext } from "../../../lib/server/api/generationWorkspaceRuntimeKey";
import { generateAudioReferenceTitleBestEffort } from "../../../lib/server/audioTitleGeneration";

type TextToSpeechRequestBody = {
  voiceId?: unknown;
  voiceName?: unknown;
  text?: unknown;
  outputFormat?: unknown;
  config?: unknown;
  project_id?: unknown;
  projectId?: unknown;
  shortpulse_context?: unknown;
  workflow_reload?: unknown;
};

type GenerateAudioSuccessResponse = {
  output: {
    provider: "elevenlabs";
    mode: "audio";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    resultUrls: string[];
    previewStoragePath: string;
    fullStoragePath: string;
    companionArtUrl: string | null;
    companionArtStoragePath: string | null;
    companionArtStatus: "pending";
    mimeType: string;
    durationMs: null;
    waveformPeaks: null;
    title: string;
    modelId: string;
    voiceId: string;
    voiceName: string;
    saveState: "saved" | "idle" | "failed" | "blocked_storage";
    saveError: string | null;
  };
};

type GenerateAudioErrorResponse = {
  error: string;
  details?: string;
  code?: string;
  retryAfterSeconds?: number;
};

const DEFAULT_VOICEOVER_MODEL_ID = resolveRequiredAudioVoiceoverModelId();
const ALLOWED_MODEL_IDS = new Set([DEFAULT_VOICEOVER_MODEL_ID]);

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateAudioSuccessResponse | GenerateAudioErrorResponse>
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
      routeLabel: "elevenlabs-text-to-speech.auth",
      scope: "generation",
    });
    return res.status(500).json({
      error: "Unable to generate speech",
      details: sanitizeCustomerFacingProviderText(
        toErrorMessage(error, "Unknown error"),
        "Unable to generate speech."
      ),
    });
  }
  if (!user) return;
  let charge: Awaited<ReturnType<typeof chargeGenerationRequest>> = null;

  if (!process.env.ELEVENLABS_API_KEY?.trim()) {
    return res.status(503).json({
      error: "Service unavailable",
      details: "Audio generation is temporarily unavailable.",
    });
  }

  try {
    const body = (req.body ?? {}) as TextToSpeechRequestBody;
    const voiceId = normalizeRequiredString(body.voiceId);
    const voiceName = normalizeRequiredString(body.voiceName);
    const text = normalizeRequiredString(body.text);
    const outputFormat = normalizeRequiredString(body.outputFormat);
    const config =
      body.config && typeof body.config === "object" && !Array.isArray(body.config)
        ? (body.config as Record<string, unknown>)
        : null;
    const modelId = normalizeRequiredString(config?.model_id);
    const projectId = normalizeRequiredString(body.project_id ?? body.projectId);
    const shortpulseContext = asRecord(body.shortpulse_context);
    const workspaceRuntimeKey = readGenerationWorkspaceRuntimeKeyFromContext({
      context: shortpulseContext,
      projectId,
    });
    const workflowReload = asRecord(body.workflow_reload) ?? {};

    if (!voiceId || !voiceName || !text || !outputFormat || !config || !modelId) {
      return res.status(400).json({
        error: "Invalid request",
        details: "voiceId, voiceName, text, outputFormat, and config.model_id are required.",
      });
    }

    if (!ALLOWED_MODEL_IDS.has(modelId)) {
      return res.status(400).json({
        error: "Invalid request",
        details: "config.model_id is not supported for this audio workflow.",
      });
    }

    const savedVoices = await listSavedVoicesForUser(user.id);
    const savedVoiceMatch = savedVoices.some(
      (savedVoice) => savedVoice.voiceId.trim().toLowerCase() === voiceId.toLowerCase()
    );
    let providerVoices = [] as Awaited<ReturnType<typeof listElevenLabsVoices>>;
    let providerLookupFailed = false;
    if (!savedVoiceMatch) {
      try {
        providerVoices = await listElevenLabsVoices();
      } catch {
        providerLookupFailed = true;
      }
    }

    const voiceAccess = resolveVoiceAccessForUser({
      voiceId,
      savedVoices,
      providerVoices,
    });
    if (!voiceAccess) {
      if (providerLookupFailed && !savedVoiceMatch) {
        return res.status(503).json({
          error: "Voice is unavailable",
          details: "The selected voice could not be verified right now. Try again shortly.",
        });
      }
      return res.status(403).json({
        error: "Voice is unavailable",
        details: "The selected voice is not available for this account.",
      });
    }
    const effectiveVoiceName = voiceAccess.resolvedVoice.name;

    charge = await chargeGenerationRequest({
      req,
      res,
      modelId,
      payload: {
        text,
        text_characters: text.length,
      },
      reason: "elevenlabs-text-to-speech generation",
      shortpulseContext,
    });
    if (!charge) return;
    const settledCharge = charge;
    const titlePromise = generateAudioReferenceTitleBestEffort({
      sourceMode: "voiceover",
      promptText: text,
      voiceName: effectiveVoiceName,
      uniqueSeed: charge.sourceRef,
    });

    const generated = await generateElevenLabsVoiceover({
      voiceId,
      text,
      outputFormat,
      body: config,
    });
    const voiceoverTitle = await titlePromise;
    const providerRequestId = generated.providerRequestId ?? `elevenlabs:${charge.sourceRef}`;
    const submitLink = await charge.markSubmitted(providerRequestId, {
      source_mode: "voiceover",
    });
    if (!submitLink.ok) {
      throw new Error(`Unable to link generation billing reservation: ${submitLink.status}`);
    }

    const persisted = await persistGeneratedAudioAsset({
      userId: charge.userId,
      promptText: text,
      provider: "elevenlabs",
      modelId,
      providerRequestId,
      requestId: charge.sourceRef,
      projectId,
      workspaceRuntimeKey,
      sourceMode: "voiceover",
      displayTitle: voiceoverTitle,
      voiceId,
      voiceName: effectiveVoiceName,
      outputBuffer: generated.buffer,
      outputContentType: generated.contentType,
      outputFormat,
      workflowReload,
      extraMetadata: {
        billing_mode: charge.billingMode,
        billing_source_ref: charge.sourceRef,
        debited_credits: charge.credits,
        pricing_metadata: charge.chargeMetadata,
        provider_request_id: providerRequestId,
        voiceover_title: voiceoverTitle,
        text_character_count: text.length,
        ...(shortpulseContext ? { shortpulse_context: shortpulseContext } : {}),
      },
      beforeVisibleSettlement: async ({ generationId }) => {
        const captureResult = await captureSucceededGenerationByProviderRequest({
          userId: settledCharge.userId,
          providerRequestId,
          reason: "Audio voiceover generation completed.",
          routeLabel: "elevenlabs-text-to-speech",
          detail: {
            generation_id: generationId,
            source_ref: settledCharge.sourceRef,
            source_mode: "voiceover",
          },
        });
        if (!captureResult.settled) {
          throw new Error(
            `Unable to capture generation billing reservation: ${captureResult.note}`
          );
        }
      },
    });
    const persistedVoiceoverTitle = persisted.displayTitle ?? voiceoverTitle;
    await markAudioCompanionArtPendingBestEffort({
      req,
      routeLabel: "elevenlabs-text-to-speech",
      generationId: persisted.generationId,
      userId: charge.userId,
      user,
    });

    return res.status(200).json({
      output: {
        provider: "elevenlabs",
        mode: "audio",
        generationId: persisted.generationId,
        mediaFileId: persisted.mediaFileId,
        requestId: persisted.requestId,
        previewUrl: persisted.signedUrl,
        resultUrls: [persisted.signedUrl],
        previewStoragePath: persisted.storagePath,
        fullStoragePath: persisted.storagePath,
        companionArtUrl: null,
        companionArtStoragePath: null,
        companionArtStatus: "pending",
        mimeType: generated.contentType,
        durationMs: null,
        waveformPeaks: null,
        title: persistedVoiceoverTitle,
        modelId,
        voiceId,
        voiceName: effectiveVoiceName,
        saveState: persisted.saveState,
        saveError: persisted.saveError,
      },
    });
  } catch (error) {
    if (charge) {
      await charge.refund("Auto-refund: audio voiceover generation failed.", {
        source_mode: "voiceover",
      });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-text-to-speech",
      scope: "generation",
      user,
    });

    const providerError = readElevenLabsProviderError(error);
    if (providerError && (providerError.status === 429 || providerError.status === 503)) {
      if (providerError.retryAfterSeconds !== null) {
        res.setHeader("Retry-After", String(providerError.retryAfterSeconds));
      }
      return res.status(providerError.status).json({
        error: "Unable to generate speech",
        details: sanitizeCustomerFacingProviderText(
          resolveElevenLabsProviderUserMessage(providerError),
          "Unable to generate speech."
        ),
        code: providerError.code ?? undefined,
        retryAfterSeconds: providerError.retryAfterSeconds ?? undefined,
      });
    }

    return res.status(500).json({
      error: "Unable to generate speech",
      details: sanitizeCustomerFacingProviderText(
        toErrorMessage(error, "Unknown error"),
        "Unable to generate speech."
      ),
    });
  }
}
