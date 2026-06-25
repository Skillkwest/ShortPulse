/**
 * Client helpers for authenticated Sound -> Voice action routes.
 * Keeps route request/response parsing out of the Voices panel while preserving UI-owned state.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { sanitizeCustomerFacingProviderText } from "../../../lib/customerFacingProviderText";

export type VoiceDesignPreviewApiResult = {
  generatedVoiceId: string;
  previewToken: string;
  audioBase64: string;
  mediaType: string | null;
  durationSecs: number | null;
  language: string | null;
};

export type VoiceDesignApiResult = {
  previews?: VoiceDesignPreviewApiResult[];
  previewText?: string | null;
  modelId?: string | null;
  error?: string | null;
  details?: string | null;
};

export type CreatedVoiceApiResult = {
  voice?: {
    voiceId?: string | null;
    name?: string | null;
    previewUrl?: string | null;
    description?: string | null;
    isFallback?: boolean;
  };
  error?: string | null;
  details?: string | null;
};

export type DeleteVoiceApiResult = {
  status?: "ok";
  voiceId?: string;
  action?: "remove" | "delete";
  error?: string | null;
  details?: string | null;
};

const readJsonPayload = async <TPayload>(response: Response): Promise<TPayload | null> =>
  (await response.json().catch(() => null)) as TPayload | null;

const getProviderErrorMessage = (
  payload: { error?: unknown; details?: unknown } | null,
  fallback: string
): string =>
  sanitizeCustomerFacingProviderText(
    typeof payload?.details === "string"
      ? payload.details
      : typeof payload?.error === "string"
        ? payload.error
        : null,
    fallback
  );

/**
 * Requests generated voice-design previews from the protected ElevenLabs helper route.
 */
export const requestVoiceDesignPreviews = async ({
  voiceName,
  voiceDescription,
}: {
  voiceName: string;
  voiceDescription: string;
}): Promise<VoiceDesignApiResult | null> => {
  const response = await fetchWithAuth("/api/elevenlabs/text-to-voice/design", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voiceName,
      voiceDescription,
    }),
    shortpulseLogScope: "generation",
  });
  const payload = await readJsonPayload<VoiceDesignApiResult>(response);
  if (!response.ok) {
    throw new Error(getProviderErrorMessage(payload, "Unable to generate voice previews."));
  }
  return payload;
};

/**
 * Saves a selected generated voice preview as a reusable provider-backed voice.
 */
export const createDesignedVoice = async ({
  voiceName,
  voiceDescription,
  generatedVoiceId,
  generatedVoiceToken,
  playedNotSelectedVoiceIds,
  playedNotSelectedVoiceTokens,
}: {
  voiceName: string;
  voiceDescription: string;
  generatedVoiceId: string;
  generatedVoiceToken: string | null;
  playedNotSelectedVoiceIds: string[];
  playedNotSelectedVoiceTokens: string[];
}): Promise<CreatedVoiceApiResult | null> => {
  const response = await fetchWithAuth("/api/elevenlabs/text-to-voice/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voiceName,
      voiceDescription,
      generatedVoiceId,
      generatedVoiceToken,
      playedNotSelectedVoiceIds,
      playedNotSelectedVoiceTokens,
    }),
    shortpulseLogScope: "generation",
  });
  const payload = await readJsonPayload<CreatedVoiceApiResult>(response);
  if (!response.ok) {
    throw new Error(getProviderErrorMessage(payload, "Unable to create voice."));
  }
  return payload;
};

/**
 * Creates a reusable provider voice from a staged, caller-owned voice sample.
 */
export const cloneProviderVoice = async ({
  voiceName,
  sourceStoragePath,
  sourceName,
}: {
  voiceName: string;
  sourceStoragePath: string;
  sourceName: string;
}): Promise<CreatedVoiceApiResult | null> => {
  const response = await fetchWithAuth("/api/elevenlabs/voices/clone", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      voiceName,
      sourceStoragePath,
      sourceName,
      removeBackgroundNoise: true,
    }),
    shortpulseLogScope: "generation",
  });
  const payload = await readJsonPayload<CreatedVoiceApiResult>(response);
  if (!response.ok) {
    throw new Error(getProviderErrorMessage(payload, "Unable to clone voice."));
  }
  return payload;
};

/**
 * Removes or deletes a voice through the server-authoritative voice library route.
 */
export const deleteProviderVoice = async (
  voiceId: string
): Promise<DeleteVoiceApiResult | null> => {
  const response = await fetchWithAuth(`/api/elevenlabs/voices/${encodeURIComponent(voiceId)}`, {
    method: "DELETE",
    shortpulseLogScope: "generation",
  });
  const payload = await readJsonPayload<DeleteVoiceApiResult>(response);
  if (!response.ok) {
    throw new Error(getProviderErrorMessage(payload, "Unable to delete voice."));
  }
  return payload;
};

/**
 * Enhances voiceover script text with ElevenLabs v3-ready performance tags.
 */
export const enhanceVoiceoverScript = async (script: string): Promise<string> => {
  const response = await fetchWithAuth("/api/ai/voiceover-enhance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ script }),
    shortpulseLogScope: "generation",
    shortpulseSkipErrorLogging: true,
  });
  const payload = await readJsonPayload<{
    enhancedScript?: unknown;
    error?: unknown;
    details?: unknown;
  }>(response);
  if (!response.ok) {
    throw new Error(getProviderErrorMessage(payload, "Unable to enhance voiceover."));
  }
  if (typeof payload?.enhancedScript !== "string" || !payload.enhancedScript.trim()) {
    throw new Error("Unable to enhance voiceover.");
  }
  return payload.enhancedScript;
};
