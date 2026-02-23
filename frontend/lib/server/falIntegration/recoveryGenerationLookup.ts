/**
 * Recovery generation lookup and parsing helpers.
 * Isolates ai_generations read/query behavior from recovery orchestration.
 */

import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { asString } from "./falAdapter";

type JsonObject = Record<string, unknown>;

export type RecoveryGenerationRow = {
  id: string;
  user_id: string;
  request_id: string | null;
  model_id: string;
  provider: string;
  mode: string;
  prompt_text: string;
  status: string;
  metadata: JsonObject;
  recovery_attempts: number;
  failure_reason_code: string | null;
  recovery_state: string;
  completed_at: string | null;
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const parseRecoveryGenerationRow = (value: unknown): RecoveryGenerationRow | null => {
  const row = asObject(value);
  const id = asString(row.id);
  const userId = asString(row.user_id);
  const modelId = asString(row.model_id);
  const provider = asString(row.provider);
  const mode = asString(row.mode);
  const promptText = asString(row.prompt_text);
  const status = asString(row.status);
  const recoveryState = asString(row.recovery_state) ?? "none";
  if (!id || !userId || !modelId || !provider || !mode || !promptText || !status) {
    return null;
  }
  return {
    id,
    user_id: userId,
    request_id: asString(row.request_id),
    model_id: modelId,
    provider,
    mode,
    prompt_text: promptText,
    status,
    metadata: asObject(row.metadata),
    recovery_attempts: typeof row.recovery_attempts === "number" ? row.recovery_attempts : 0,
    failure_reason_code: asString(row.failure_reason_code),
    recovery_state: recoveryState,
    completed_at: asString(row.completed_at),
  };
};

export const readRecoveryGenerationRow = async ({
  generationId,
  requestId,
  userId,
}: {
  generationId?: string | null;
  requestId?: string | null;
  userId?: string | null;
}): Promise<RecoveryGenerationRow | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const selectFields = [
    "id",
    "user_id",
    "request_id",
    "model_id",
    "provider",
    "mode",
    "prompt_text",
    "status",
    "metadata",
    "recovery_attempts",
    "recovery_state",
    "failure_reason_code",
    "completed_at",
  ].join(", ");
  if (generationId) {
    let query = supabaseAdmin.from("ai_generations").select(selectFields).eq("id", generationId);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : null;
    return parseRecoveryGenerationRow(row);
  }
  if (!requestId) return null;
  let query = supabaseAdmin.from("ai_generations").select(selectFields).eq("request_id", requestId);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return parseRecoveryGenerationRow(row);
};
