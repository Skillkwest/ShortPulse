import { getSupabaseAdmin } from "./supabaseAdmin";
import { isExcludedElevenLabsVoiceId } from "../elevenlabsVoiceExclusions";

export type SavedAiStudioVoice = {
  voiceId: string;
  name: string;
  previewUrl: string | null;
  description: string | null;
  provider: "elevenlabs";
  isFallback: false;
  createdAt: string;
  originKind: SavedAiStudioVoiceOriginKind;
  savedSource: SavedAiStudioVoiceSource;
  providerDeleteEligible: boolean;
};

export type SavedAiStudioVoiceOriginKind =
  | "provider-default"
  | "provider-saved"
  | "provider-user-created"
  | "legacy-saved";

export type SavedAiStudioVoiceSource =
  | "provider-save"
  | "text-to-voice-create"
  | "voice-clone"
  | "legacy";

const SAVED_VOICES_COLUMN = "ai_studio_saved_voices";

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isSavedVoiceOriginKind = (value: string | null): value is SavedAiStudioVoiceOriginKind =>
  value === "provider-default" ||
  value === "provider-saved" ||
  value === "provider-user-created" ||
  value === "legacy-saved";

const isSavedVoiceSource = (value: string | null): value is SavedAiStudioVoiceSource =>
  value === "provider-save" ||
  value === "text-to-voice-create" ||
  value === "voice-clone" ||
  value === "legacy";

const isMissingSavedVoicesPreferenceError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  if (
    maybeError.code === "PGRST205" ||
    maybeError.code === "PGRST204" ||
    maybeError.code === "42P01" ||
    maybeError.code === "42703"
  ) {
    return true;
  }
  if (typeof maybeError.message !== "string") return false;
  return (
    maybeError.message.includes("user_preferences") ||
    maybeError.message.includes(SAVED_VOICES_COLUMN)
  );
};

const isSavedVoicesPersistenceUnavailableError = (error: unknown): boolean => {
  if (isMissingSavedVoicesPreferenceError(error)) return true;
  return (
    error instanceof Error &&
    error.message.includes("Supabase admin environment is not configured.")
  );
};

const normalizeSavedVoice = (value: unknown): SavedAiStudioVoice | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const voiceId = normalizeOptionalString(record.voiceId);
  const name = normalizeOptionalString(record.name);
  if (!voiceId || !name) return null;
  if (isExcludedElevenLabsVoiceId(voiceId)) return null;

  return {
    voiceId,
    name,
    previewUrl: normalizeOptionalString(record.previewUrl),
    description: normalizeOptionalString(record.description),
    provider: "elevenlabs",
    isFallback: false,
    createdAt: normalizeOptionalString(record.createdAt) ?? new Date(0).toISOString(),
    originKind: isSavedVoiceOriginKind(normalizeOptionalString(record.originKind))
      ? (normalizeOptionalString(record.originKind) as SavedAiStudioVoiceOriginKind)
      : "legacy-saved",
    savedSource: isSavedVoiceSource(normalizeOptionalString(record.savedSource))
      ? (normalizeOptionalString(record.savedSource) as SavedAiStudioVoiceSource)
      : "legacy",
    providerDeleteEligible:
      typeof record.providerDeleteEligible === "boolean" ? record.providerDeleteEligible : false,
  };
};

const normalizeSavedVoices = (value: unknown): SavedAiStudioVoice[] => {
  if (!Array.isArray(value)) return [];
  const deduped = new Map<string, SavedAiStudioVoice>();
  for (const entry of value) {
    const normalized = normalizeSavedVoice(entry);
    if (!normalized) continue;
    deduped.set(normalized.voiceId.trim().toLowerCase(), normalized);
  }
  return Array.from(deduped.values()).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
};

const hasExcludedSavedVoice = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const record = entry as Record<string, unknown>;
    return isExcludedElevenLabsVoiceId(normalizeOptionalString(record.voiceId));
  });

export const listSavedVoicesForUser = async (userId: string): Promise<SavedAiStudioVoice[]> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("user_preferences")
      .select(SAVED_VOICES_COLUMN)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    const normalizedVoices = normalizeSavedVoices(data?.[SAVED_VOICES_COLUMN]);

    if (hasExcludedSavedVoice(data?.[SAVED_VOICES_COLUMN])) {
      const { error: cleanupError } = await supabaseAdmin.from("user_preferences").upsert(
        {
          user_id: userId,
          [SAVED_VOICES_COLUMN]: normalizedVoices,
        },
        { onConflict: "user_id" }
      );
      if (cleanupError) throw cleanupError;
    }

    return normalizedVoices;
  } catch (error) {
    if (isSavedVoicesPersistenceUnavailableError(error)) {
      return [];
    }
    throw error;
  }
};

export const saveVoiceForUser = async ({
  userId,
  voice,
}: {
  userId: string;
  voice: Pick<SavedAiStudioVoice, "voiceId" | "name" | "previewUrl" | "description"> &
    Partial<Pick<SavedAiStudioVoice, "originKind" | "savedSource" | "providerDeleteEligible">>;
}): Promise<SavedAiStudioVoice | null> => {
  const normalizedVoiceId = voice.voiceId.trim();
  const normalizedVoiceName = voice.name.trim().replace(/\s+/g, " ");
  if (
    !normalizedVoiceId ||
    !normalizedVoiceName ||
    isExcludedElevenLabsVoiceId(normalizedVoiceId)
  ) {
    return null;
  }

  const nextVoice: SavedAiStudioVoice = {
    voiceId: normalizedVoiceId,
    name: normalizedVoiceName,
    previewUrl: normalizeOptionalString(voice.previewUrl),
    description: normalizeOptionalString(voice.description),
    provider: "elevenlabs",
    isFallback: false,
    createdAt: new Date().toISOString(),
    originKind: voice.originKind ?? "legacy-saved",
    savedSource: voice.savedSource ?? "legacy",
    providerDeleteEligible: voice.providerDeleteEligible ?? false,
  };

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const existingVoices = await listSavedVoicesForUser(userId);
    const nextVoices = [
      nextVoice,
      ...existingVoices.filter(
        (existingVoice) => existingVoice.voiceId.toLowerCase() !== nextVoice.voiceId.toLowerCase()
      ),
    ];

    const { error } = await supabaseAdmin.from("user_preferences").upsert(
      {
        user_id: userId,
        [SAVED_VOICES_COLUMN]: nextVoices,
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
    return nextVoice;
  } catch (error) {
    if (isSavedVoicesPersistenceUnavailableError(error)) {
      return null;
    }
    throw error;
  }
};

/**
 * Removes a saved AI Studio voice from the authenticated user's preferences.
 * Returns true when a persisted saved-voices row changed.
 */
export const deleteSavedVoiceForUser = async ({
  userId,
  voiceId,
}: {
  userId: string;
  voiceId: string;
}): Promise<boolean> => {
  const normalizedVoiceId = voiceId.trim().toLowerCase();
  if (!normalizedVoiceId) {
    return false;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const existingVoices = await listSavedVoicesForUser(userId);
    const nextVoices = existingVoices.filter(
      (existingVoice) => existingVoice.voiceId.trim().toLowerCase() !== normalizedVoiceId
    );

    if (nextVoices.length === existingVoices.length) {
      return false;
    }

    const { error } = await supabaseAdmin.from("user_preferences").upsert(
      {
        user_id: userId,
        [SAVED_VOICES_COLUMN]: nextVoices,
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
    return true;
  } catch (error) {
    if (isSavedVoicesPersistenceUnavailableError(error)) {
      return false;
    }
    throw error;
  }
};
