import { getSupabaseAdmin } from "./supabaseAdmin";

const DEFAULT_MEDIA_AUTOSAVE_ENABLED = true;

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
}): Promise<boolean> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_preferences")
      .select("media_autosave_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return false;
    const value = (data as { media_autosave_enabled?: unknown } | null)?.media_autosave_enabled;
    return typeof value === "boolean" ? value : DEFAULT_MEDIA_AUTOSAVE_ENABLED;
  } catch {
    return false;
  }
};
