import { getSupabaseAdmin } from "./supabaseAdmin";

export type SavedAiStudioVoice = {
  voiceId: string;
  name: string;
  previewUrl: string | null;
  description: string | null;
  provider: "elevenlabs";
  isFallback: false;
  createdAt: string;
};

const SAVED_VOICES_COLUMN = "ai_studio_saved_voices";

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

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

  return {
    voiceId,
    name,
    previewUrl: normalizeOptionalString(record.previewUrl),
    description: normalizeOptionalString(record.description),
    provider: "elevenlabs",
    isFallback: false,
    createdAt: normalizeOptionalString(record.createdAt) ?? new Date(0).toISOString(),
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

export const listSavedVoicesForUser = async (userId: string): Promise<SavedAiStudioVoice[]> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("user_preferences")
      .select(SAVED_VOICES_COLUMN)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return normalizeSavedVoices(data?.[SAVED_VOICES_COLUMN]);
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
  voice: Pick<SavedAiStudioVoice, "voiceId" | "name" | "previewUrl" | "description">;
}): Promise<SavedAiStudioVoice | null> => {
  const normalizedVoiceId = voice.voiceId.trim();
  const normalizedVoiceName = voice.name.trim().replace(/\s+/g, " ");
  if (!normalizedVoiceId || !normalizedVoiceName) {
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
