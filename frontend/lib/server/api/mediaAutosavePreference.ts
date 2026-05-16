import { getSupabaseAdmin } from "./supabaseAdmin";

const DEFAULT_MEDIA_AUTOSAVE_ENABLED = true;

export type MediaAutosavePreferenceSource =
  | "stored"
  | "default_missing_row"
  | "default_missing_value"
  | "lookup_error";

export type MediaAutosavePreferenceResult = {
  enabled: boolean;
  source: MediaAutosavePreferenceSource;
};

const AUTOSAVE_PREFERENCE_LOOKUP_FAILED_USER_MESSAGE =
  "Media Library autosave was skipped because your autosave preference could not be verified. You can still save manually.";

export const resolveMediaAutosavePreferenceLookupUserMessage = ({
  enabled,
  source,
}: MediaAutosavePreferenceResult): string | null =>
  !enabled && source === "lookup_error" ? AUTOSAVE_PREFERENCE_LOOKUP_FAILED_USER_MESSAGE : null;

/**
 * Reads the signed-in user's Media Library autosave preference for server persistence lanes.
 * Missing rows keep the default-on behavior, but read failures fail closed so the backend does
 * not contradict a client session that could not confirm autosave authority.
 */
export const readMediaAutosaveEnabledForUser = async ({
  userId,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  userId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<MediaAutosavePreferenceResult> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_preferences")
      .select("media_autosave_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { enabled: false, source: "lookup_error" };
    if (!data) {
      return { enabled: DEFAULT_MEDIA_AUTOSAVE_ENABLED, source: "default_missing_row" };
    }
    const value = (data as { media_autosave_enabled?: unknown } | null)?.media_autosave_enabled;
    if (typeof value === "boolean") {
      return { enabled: value, source: "stored" };
    }
    return { enabled: DEFAULT_MEDIA_AUTOSAVE_ENABLED, source: "default_missing_value" };
  } catch {
    return { enabled: false, source: "lookup_error" };
  }
};
