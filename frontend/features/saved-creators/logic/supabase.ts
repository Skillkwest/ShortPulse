/**
 * Supabase data access for the Saved Creators feature.
 */
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import { Creator, Platform } from "../types";
import { sanitizeHandle } from "../utils/handles";

export const AUTH_REQUIRED_ERROR = "AUTH_REQUIRED";

type SavedCreatorRow = {
  id: string;
  handle: string;
  platform: string | null;
  followers: number | null;
  avg_views: number | null;
  created_at?: string | null;
};

const normalizePlatform = (value: string | null | undefined): Platform => {
  const normalized = (value || "instagram").toLowerCase();
  if (normalized === "tiktok") return "TikTok";
  if (normalized === "youtube") return "YouTube";
  return "Instagram";
};

const mapRowToCreator = (row: SavedCreatorRow): Creator => ({
  id: row.id,
  handle: sanitizeHandle(row.handle),
  platform: normalizePlatform(row.platform),
  followers: row.followers || 0,
  avgViews: row.avg_views || 0,
  videosTracked: 0,
  avatarUrl: null,
});

const getUserId = async () => {
  const supabase = ensureSupabaseQueryClient();
  const userId = await readSupabaseUserId();
  if (!userId) {
    throw new Error(AUTH_REQUIRED_ERROR);
  }
  return { supabase, userId };
};

export const fetchCreators = async (): Promise<Creator[]> => {
  const { supabase } = await getUserId();
  const { data, error } = await supabase
    .from("saved_creators")
    .select("id, handle, platform, followers, avg_views, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data || []).map(mapRowToCreator);
};

export const insertCreator = async (payload: {
  handle: string;
  platform: Platform;
  followers?: number | string;
  avgViews?: number | string;
}): Promise<Creator> => {
  const { supabase, userId } = await getUserId();
  const normalizedHandle = sanitizeHandle(payload.handle);
  const insertPayload = {
    handle: normalizedHandle,
    platform: payload.platform.toLowerCase(),
    followers: payload.followers ? Number(payload.followers) : 0,
    avg_views: payload.avgViews ? Number(payload.avgViews) : 0,
    user_id: userId,
  };

  const { data, error } = await supabase
    .from("saved_creators")
    .insert(insertPayload)
    .select("id, handle, platform, followers, avg_views")
    .single();
  if (error) {
    throw error;
  }
  return mapRowToCreator(data as SavedCreatorRow);
};

export const deleteCreator = async (id: string) => {
  const { supabase } = await getUserId();
  const { error } = await supabase.from("saved_creators").delete().eq("id", id);
  if (error) {
    throw error;
  }
};
