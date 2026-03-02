/**
 * AI Studio session persistence server helpers.
 * Centralizes request validation, cursor encoding, and service-role RPC calls.
 */
import { getSupabaseAdmin } from "./supabaseAdmin";

const AI_STUDIO_SESSION_UPSERT_RPC = "upsert_ai_studio_session_snapshot";
const AI_STUDIO_SESSION_GET_RPC = "get_ai_studio_session_snapshot";
const AI_STUDIO_SESSION_LIST_RPC = "list_ai_studio_sessions";
const AI_STUDIO_SESSION_TTL = "180 days";
const AI_STUDIO_SESSION_USER_CAP = 100;
const AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES = 900_000;
const AI_STUDIO_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonObject = Record<string, unknown>;

type SessionUpsertRpcRow = {
  user_id: string;
  session_id: string;
  title: string | null;
  schema_version: number;
  save_seq: number;
  updated_at: string;
  expires_at: string;
};

type SessionGetRpcRow = SessionUpsertRpcRow & {
  snapshot: JsonObject;
};

type SessionListRpcRow = {
  session_id: string;
  title: string | null;
  schema_version: number;
  save_seq: number;
  updated_at: string;
  expires_at: string;
};

export type AiStudioSessionCursor = {
  updatedAt: string;
  sessionId: string;
};

export type AiStudioSessionSaveResult = {
  userId: string;
  sessionId: string;
  title: string | null;
  schemaVersion: number;
  saveSeq: number;
  updatedAt: string;
  expiresAt: string;
};

export type AiStudioSessionGetResult = AiStudioSessionSaveResult & {
  snapshot: JsonObject;
};

export type AiStudioSessionListItem = {
  sessionId: string;
  title: string | null;
  schemaVersion: number;
  saveSeq: number;
  updatedAt: string;
  expiresAt: string;
};

const isRecord = (value: unknown): value is JsonObject => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const takeFirstRow = <T>(data: unknown): T | null => {
  if (!Array.isArray(data) || data.length === 0) return null;
  return (data[0] as T) ?? null;
};

/**
 * Parses and validates an AI Studio `sid` UUID.
 */
export const parseAiStudioSessionId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !AI_STUDIO_SESSION_ID_PATTERN.test(trimmed)) return null;
  return trimmed.toLowerCase();
};

/**
 * Validates snapshot payload shape and size for session save requests.
 */
export const parseAiStudioSessionSnapshot = (value: unknown): JsonObject | null => {
  if (!isRecord(value)) return null;
  try {
    const snapshotBytes = Buffer.byteLength(JSON.stringify(value), "utf8");
    if (snapshotBytes > AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES) return null;
    return value;
  } catch {
    return null;
  }
};

/**
 * Encodes list pagination cursor.
 */
export const encodeAiStudioSessionCursor = (cursor: AiStudioSessionCursor): string => {
  const raw = `${cursor.updatedAt}|${cursor.sessionId}`;
  return Buffer.from(raw, "utf8").toString("base64url");
};

/**
 * Decodes and validates list pagination cursor.
 */
export const decodeAiStudioSessionCursor = (
  cursor: string | null
): AiStudioSessionCursor | null => {
  if (!cursor || typeof cursor !== "string") return null;
  let raw: string;
  try {
    raw = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const [updatedAtRaw, sessionIdRaw] = raw.split("|");
  if (!updatedAtRaw || !sessionIdRaw) return null;
  const sessionId = parseAiStudioSessionId(sessionIdRaw);
  if (!sessionId) return null;
  const updatedAtMs = Date.parse(updatedAtRaw);
  if (!Number.isFinite(updatedAtMs)) return null;
  return {
    updatedAt: new Date(updatedAtMs).toISOString(),
    sessionId,
  };
};

/**
 * Saves one AI Studio snapshot through the service-role RPC boundary.
 */
export const saveAiStudioSessionSnapshot = async ({
  userId,
  sessionId,
  snapshot,
  schemaVersion,
  title,
}: {
  userId: string;
  sessionId: string;
  snapshot: JsonObject;
  schemaVersion?: number;
  title?: string | null;
}): Promise<AiStudioSessionSaveResult> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc(AI_STUDIO_SESSION_UPSERT_RPC, {
    p_user_id: userId,
    p_session_id: sessionId,
    p_snapshot: snapshot,
    p_schema_version: schemaVersion ?? 1,
    p_title: title ?? null,
    p_ttl: AI_STUDIO_SESSION_TTL,
    p_user_cap: AI_STUDIO_SESSION_USER_CAP,
  });
  if (error) {
    throw new Error(`Failed to save AI Studio session snapshot: ${error.message}`);
  }
  const row = takeFirstRow<SessionUpsertRpcRow>(data);
  if (!row) {
    throw new Error("Failed to save AI Studio session snapshot: RPC returned no rows");
  }
  return {
    userId: row.user_id,
    sessionId: row.session_id,
    title: row.title ?? null,
    schemaVersion: row.schema_version,
    saveSeq: row.save_seq,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
};

/**
 * Loads one persisted AI Studio session snapshot for a user.
 */
export const getAiStudioSessionSnapshot = async ({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string;
}): Promise<AiStudioSessionGetResult | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc(AI_STUDIO_SESSION_GET_RPC, {
    p_user_id: userId,
    p_session_id: sessionId,
  });
  if (error) {
    throw new Error(`Failed to get AI Studio session snapshot: ${error.message}`);
  }
  const row = takeFirstRow<SessionGetRpcRow>(data);
  if (!row) return null;
  return {
    userId: row.user_id,
    sessionId: row.session_id,
    title: row.title ?? null,
    schemaVersion: row.schema_version,
    saveSeq: row.save_seq,
    snapshot: row.snapshot,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
};

/**
 * Lists persisted AI Studio sessions for a user in deterministic cursor order.
 */
export const listAiStudioSessions = async ({
  userId,
  limit,
  cursor,
}: {
  userId: string;
  limit?: number;
  cursor?: AiStudioSessionCursor | null;
}): Promise<AiStudioSessionListItem[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const normalizedLimit =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(1, Math.min(50, Math.trunc(limit)))
      : 20;
  const { data, error } = await supabaseAdmin.rpc(AI_STUDIO_SESSION_LIST_RPC, {
    p_user_id: userId,
    p_limit: normalizedLimit,
    p_cursor_updated_at: cursor?.updatedAt ?? null,
    p_cursor_session_id: cursor?.sessionId ?? null,
  });
  if (error) {
    throw new Error(`Failed to list AI Studio sessions: ${error.message}`);
  }
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const item = row as SessionListRpcRow;
    return {
      sessionId: item.session_id,
      title: item.title ?? null,
      schemaVersion: item.schema_version,
      saveSeq: item.save_seq,
      updatedAt: item.updated_at,
      expiresAt: item.expires_at,
    };
  });
};
