/**
 * Generates and persists private preview samples for newly created ElevenLabs voices.
 * The saved storage path is the durable authority; signed URLs are refreshed on library load.
 */
import { randomUUID } from "crypto";
import { ELEVENLABS_VOICEOVER_MODEL_ID } from "../model-runtime/elevenLabsModels";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { generateElevenLabsVoiceover } from "./elevenlabs";

const MEDIA_BUCKET = "media_library";
const VOICE_SAMPLE_TEXT = "This is a preview sample for your new ShortPulse voice.";
const VOICE_SAMPLE_OUTPUT_FORMAT = "mp3_44100_128";
const VOICE_SAMPLE_SIGNED_URL_TTL_SECONDS = 60 * 60;

const AUDIO_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

const resolveAudioExtension = (contentType: string): string => {
  const normalizedContentType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return AUDIO_EXTENSION_BY_CONTENT_TYPE[normalizedContentType] ?? "mp3";
};

const sanitizePathSegment = (value: string): string => {
  const sanitized = value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "voice";
};

export type PersistedElevenLabsVoiceSample = {
  previewUrl: string;
  sampleStoragePath: string;
  mimeType: string;
  providerRequestId: string | null;
};

/**
 * Generates a short TTS preview with the new voice and stores it under the user's
 * private voice-samples namespace.
 */
export const createPersistedElevenLabsVoiceSample = async ({
  userId,
  voiceId,
}: {
  userId: string;
  voiceId: string;
}): Promise<PersistedElevenLabsVoiceSample> => {
  const generatedSample = await generateElevenLabsVoiceover({
    voiceId,
    text: VOICE_SAMPLE_TEXT,
    outputFormat: VOICE_SAMPLE_OUTPUT_FORMAT,
    body: {
      model_id: ELEVENLABS_VOICEOVER_MODEL_ID,
      language_code: null,
      voice_settings: {
        stability: 1,
        similarity_boost: 1,
        speed: 1,
        style: 0,
        use_speaker_boost: true,
      },
    },
  });
  const extension = resolveAudioExtension(generatedSample.contentType);
  const storagePath = assertUserScopedMediaStoragePath({
    userId,
    path: `${userId}/voice-samples/${sanitizePathSegment(voiceId)}/${randomUUID()}.${extension}`,
    label: "Voice sample storage path",
  });
  const supabaseAdmin = getSupabaseAdmin();
  const uploadResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, generatedSample.buffer, {
      contentType: generatedSample.contentType,
      upsert: false,
    });
  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || "Unable to persist voice sample.");
  }

  const signedResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, VOICE_SAMPLE_SIGNED_URL_TTL_SECONDS);
  if (signedResult.error || !signedResult.data?.signedUrl) {
    throw new Error(signedResult.error?.message || "Unable to sign voice sample.");
  }

  return {
    previewUrl: signedResult.data.signedUrl,
    sampleStoragePath: storagePath,
    mimeType: generatedSample.contentType,
    providerRequestId: generatedSample.providerRequestId,
  };
};

/**
 * Deletes a persisted voice sample from the caller-scoped private storage namespace.
 */
export const deletePersistedElevenLabsVoiceSample = async ({
  userId,
  sampleStoragePath,
}: {
  userId: string;
  sampleStoragePath: string;
}): Promise<void> => {
  const storagePath = assertUserScopedMediaStoragePath({
    userId,
    path: sampleStoragePath,
    label: "Voice sample storage path",
  });
  const supabaseAdmin = getSupabaseAdmin();
  const removeResult = await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([storagePath]);
  if (removeResult.error) {
    throw new Error(removeResult.error.message || "Unable to delete persisted voice sample.");
  }
};
