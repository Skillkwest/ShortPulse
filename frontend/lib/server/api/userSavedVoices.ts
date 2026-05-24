import { getSupabaseAdmin } from "./supabaseAdmin";
import { isExcludedElevenLabsVoiceId } from "../elevenlabsVoiceExclusions";
import { assertUserScopedMediaStoragePath } from "../../mediaStoragePath";

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
  sampleStoragePath: string | null;
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
const OWNED_CUSTOM_VOICES_TABLE = "user_owned_custom_voices";
const OWNED_CUSTOM_VOICES_SELECT =
  "user_id, provider, voice_id, display_name, description, preview_url, sample_storage_path, origin_kind, saved_source, provider_delete_eligible, ownership_provenance, ownership_confidence, created_at, updated_at";

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const SAVED_VOICE_SAMPLE_SIGNED_URL_TTL_SECONDS = 60 * 60;

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

const isMissingOwnedCustomVoicesTableError = (error: unknown): boolean => {
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
  return maybeError.message.includes(OWNED_CUSTOM_VOICES_TABLE);
};

const isOwnedCustomVoicesPersistenceUnavailableError = (error: unknown): boolean => {
  if (isMissingOwnedCustomVoicesTableError(error)) return true;
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
    sampleStoragePath: normalizeOptionalString(record.sampleStoragePath),
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

const normalizeOwnedCustomVoice = (value: unknown): SavedAiStudioVoice | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const voiceId = normalizeOptionalString(record.voice_id);
  const name = normalizeOptionalString(record.display_name);
  if (!voiceId || !name) return null;
  if (isExcludedElevenLabsVoiceId(voiceId)) return null;

  return {
    voiceId,
    name,
    previewUrl: normalizeOptionalString(record.preview_url),
    description: normalizeOptionalString(record.description),
    provider: "elevenlabs",
    isFallback: false,
    createdAt: normalizeOptionalString(record.created_at) ?? new Date(0).toISOString(),
    originKind: isSavedVoiceOriginKind(normalizeOptionalString(record.origin_kind))
      ? (normalizeOptionalString(record.origin_kind) as SavedAiStudioVoiceOriginKind)
      : "provider-user-created",
    savedSource: isSavedVoiceSource(normalizeOptionalString(record.saved_source))
      ? (normalizeOptionalString(record.saved_source) as SavedAiStudioVoiceSource)
      : "legacy",
    providerDeleteEligible:
      typeof record.provider_delete_eligible === "boolean"
        ? record.provider_delete_eligible
        : false,
    sampleStoragePath: normalizeOptionalString(record.sample_storage_path),
  };
};

const mergeSavedVoices = ({
  legacyVoices,
  ownedCustomVoices,
}: {
  legacyVoices: SavedAiStudioVoice[];
  ownedCustomVoices: SavedAiStudioVoice[];
}): SavedAiStudioVoice[] => {
  const merged = new Map<string, SavedAiStudioVoice>();
  for (const voice of ownedCustomVoices) {
    merged.set(voice.voiceId.trim().toLowerCase(), voice);
  }
  for (const voice of legacyVoices) {
    const lookupKey = voice.voiceId.trim().toLowerCase();
    if (!merged.has(lookupKey)) {
      merged.set(lookupKey, voice);
    }
  }
  return Array.from(merged.values()).sort((left, right) =>
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

const refreshSavedVoiceSampleUrls = async ({
  userId,
  voices,
}: {
  userId: string;
  voices: SavedAiStudioVoice[];
}): Promise<SavedAiStudioVoice[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  return await Promise.all(
    voices.map(async (voice) => {
      if (!voice.sampleStoragePath) return voice;
      try {
        const storagePath = assertUserScopedMediaStoragePath({
          userId,
          path: voice.sampleStoragePath,
          label: "Saved voice sample storage path",
        });
        const signedResult = await supabaseAdmin.storage
          .from("media_library")
          .createSignedUrl(storagePath, SAVED_VOICE_SAMPLE_SIGNED_URL_TTL_SECONDS);
        if (signedResult.error || !signedResult.data?.signedUrl) {
          return voice;
        }
        return {
          ...voice,
          previewUrl: signedResult.data.signedUrl,
        };
      } catch {
        return voice;
      }
    })
  );
};

const readLegacySavedVoicesForUser = async (userId: string): Promise<SavedAiStudioVoice[]> => {
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

const readOwnedCustomVoicesForUser = async (userId: string): Promise<SavedAiStudioVoice[]> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from(OWNED_CUSTOM_VOICES_TABLE)
      .select(OWNED_CUSTOM_VOICES_SELECT)
      .eq("user_id", userId)
      .eq("provider", "elevenlabs")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Array.isArray(data)
      ? data
          .map((row) => normalizeOwnedCustomVoice(row))
          .filter((voice): voice is SavedAiStudioVoice => Boolean(voice))
      : [];
  } catch (error) {
    if (isOwnedCustomVoicesPersistenceUnavailableError(error)) {
      return [];
    }
    throw error;
  }
};

const resolveOwnershipProvenance = (voice: {
  originKind?: SavedAiStudioVoiceOriginKind;
  savedSource?: SavedAiStudioVoiceSource;
}): "text_to_voice_create" | "voice_clone" | "provider_save" | "legacy_migrated" => {
  if (voice.savedSource === "text-to-voice-create") return "text_to_voice_create";
  if (voice.savedSource === "voice-clone") return "voice_clone";
  if (voice.savedSource === "provider-save") return "provider_save";
  return "legacy_migrated";
};

const shouldPersistInOwnedCustomVoices = (voice: {
  originKind?: SavedAiStudioVoiceOriginKind;
  savedSource?: SavedAiStudioVoiceSource;
  providerDeleteEligible?: boolean;
}): boolean =>
  voice.originKind === "provider-user-created" ||
  voice.savedSource === "text-to-voice-create" ||
  voice.savedSource === "voice-clone" ||
  voice.providerDeleteEligible === true;

const upsertOwnedCustomVoiceForUser = async ({
  userId,
  voice,
}: {
  userId: string;
  voice: SavedAiStudioVoice;
}): Promise<void> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from(OWNED_CUSTOM_VOICES_TABLE).upsert(
    {
      user_id: userId,
      provider: "elevenlabs",
      voice_id: voice.voiceId,
      display_name: voice.name,
      description: voice.description,
      preview_url: voice.previewUrl,
      sample_storage_path: voice.sampleStoragePath,
      origin_kind: voice.originKind,
      saved_source: voice.savedSource,
      provider_delete_eligible: voice.providerDeleteEligible,
      ownership_provenance: resolveOwnershipProvenance(voice),
      ownership_confidence:
        voice.savedSource === "text-to-voice-create" || voice.savedSource === "voice-clone"
          ? "high"
          : "migrated",
      created_at: voice.createdAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider,voice_id" }
  );
  if (error) throw error;
};

export const listSavedVoicesForUser = async (userId: string): Promise<SavedAiStudioVoice[]> => {
  const [legacyVoices, ownedCustomVoices] = await Promise.all([
    readLegacySavedVoicesForUser(userId),
    readOwnedCustomVoicesForUser(userId),
  ]);
  const mergedVoices = mergeSavedVoices({
    legacyVoices,
    ownedCustomVoices,
  });
  return await refreshSavedVoiceSampleUrls({
    userId,
    voices: mergedVoices,
  });
};

export const saveVoiceForUser = async ({
  userId,
  voice,
}: {
  userId: string;
  voice: Pick<SavedAiStudioVoice, "voiceId" | "name" | "previewUrl" | "description"> &
    Partial<
      Pick<
        SavedAiStudioVoice,
        "originKind" | "savedSource" | "providerDeleteEligible" | "sampleStoragePath"
      >
    >;
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
    sampleStoragePath: normalizeOptionalString(voice.sampleStoragePath),
  };

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const legacyVoices = await readLegacySavedVoicesForUser(userId);
    const nextVoices = [
      nextVoice,
      ...legacyVoices.filter(
        (existingVoice) => existingVoice.voiceId.toLowerCase() !== nextVoice.voiceId.toLowerCase()
      ),
    ];

    if (shouldPersistInOwnedCustomVoices(nextVoice)) {
      try {
        await upsertOwnedCustomVoiceForUser({
          userId,
          voice: nextVoice,
        });
      } catch (error) {
        if (!isOwnedCustomVoicesPersistenceUnavailableError(error)) {
          throw error;
        }
      }
    }

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
    const legacyVoices = await readLegacySavedVoicesForUser(userId);
    let deletedOwnedCustomVoice = false;
    try {
      const { data, error } = await supabaseAdmin
        .from(OWNED_CUSTOM_VOICES_TABLE)
        .delete()
        .select("voice_id")
        .eq("user_id", userId)
        .eq("provider", "elevenlabs")
        .eq("voice_id", voiceId);
      if (error) throw error;
      deletedOwnedCustomVoice = Array.isArray(data) ? data.length > 0 : false;
    } catch (error) {
      if (!isOwnedCustomVoicesPersistenceUnavailableError(error)) {
        throw error;
      }
    }

    const existingVoices = mergeSavedVoices({
      legacyVoices,
      ownedCustomVoices: [],
    });
    const nextVoices = existingVoices.filter(
      (existingVoice) => existingVoice.voiceId.trim().toLowerCase() !== normalizedVoiceId
    );

    const removedLegacyVoice = nextVoices.length !== existingVoices.length;

    if (!removedLegacyVoice && !deletedOwnedCustomVoice) {
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
