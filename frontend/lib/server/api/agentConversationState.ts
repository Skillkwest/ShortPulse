import { getSupabaseAdmin } from "./supabaseAdmin";

const AGENT_CONVERSATION_STATE_TABLE = "ai_agent_conversation_state";
const AGENT_CONVERSATION_UPSERT_RPC = "upsert_ai_agent_conversation_state";
const AGENT_CONVERSATION_TTL = "30 days";
const AGENT_CONVERSATION_RPC_SIGNATURE_MISS =
  "Could not find the function public.upsert_ai_agent_conversation_state";

export const AGENT_CANONICAL_PROMPT_MAX_LENGTH = 4096;
export const AGENT_CANONICAL_USER_ROW_CAP = 200;
export const AGENT_CONVERSATION_ID_MAX_LENGTH = 191;

type ConversationStateRow = {
  canonical_prompt?: string | null;
};

const normalizeConversationId = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > AGENT_CONVERSATION_ID_MAX_LENGTH) return null;
  return trimmed.length ? trimmed : null;
};

export const clampCanonicalPrompt = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  return trimmed.length > AGENT_CANONICAL_PROMPT_MAX_LENGTH
    ? trimmed.slice(0, AGENT_CANONICAL_PROMPT_MAX_LENGTH)
    : trimmed;
};

export const readAgentConversationCanonicalPrompt = async ({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string | null | undefined;
}): Promise<string | null> => {
  const normalizedConversationId = normalizeConversationId(conversationId);
  if (!normalizedConversationId) return null;

  const nowIso = new Date().toISOString();
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from(AGENT_CONVERSATION_STATE_TABLE)
    .select("canonical_prompt")
    .eq("user_id", userId)
    .eq("conversation_id", normalizedConversationId)
    .gt("expires_at", nowIso)
    .maybeSingle<ConversationStateRow>();

  if (error) {
    throw new Error(`Failed to read canonical prompt state: ${error.message}`);
  }

  return clampCanonicalPrompt(data?.canonical_prompt ?? null);
};

type UpsertConversationStateRpcRow = {
  canonical_prompt?: string | null;
};

const isRpcSignatureMissError = (error: { message?: string } | null): boolean => {
  if (!error || typeof error.message !== "string") return false;
  return error.message.includes(AGENT_CONVERSATION_RPC_SIGNATURE_MISS);
};

export const upsertAgentConversationCanonicalPrompt = async ({
  userId,
  conversationId,
  canonicalPrompt,
}: {
  userId: string;
  conversationId: string | null | undefined;
  canonicalPrompt: string | null | undefined;
}): Promise<string | null> => {
  const normalizedConversationId = normalizeConversationId(conversationId);
  const normalizedPrompt = clampCanonicalPrompt(canonicalPrompt);
  if (!normalizedConversationId || !normalizedPrompt) return null;

  const supabaseAdmin = getSupabaseAdmin();
  let { data, error } = await supabaseAdmin.rpc(AGENT_CONVERSATION_UPSERT_RPC, {
    p_user_id: userId,
    p_conversation_id: normalizedConversationId,
    p_canonical_prompt: normalizedPrompt,
    p_ttl: AGENT_CONVERSATION_TTL,
    p_user_cap: AGENT_CANONICAL_USER_ROW_CAP,
  });

  if (isRpcSignatureMissError(error)) {
    const legacyRpcResult = await supabaseAdmin.rpc(AGENT_CONVERSATION_UPSERT_RPC, {
      p_user_id: userId,
      p_conversation_id: normalizedConversationId,
      p_canonical_prompt: normalizedPrompt,
      p_user_cap: AGENT_CANONICAL_USER_ROW_CAP,
    });
    data = legacyRpcResult.data;
    error = legacyRpcResult.error;
  }

  if (error) {
    throw new Error(`Failed to upsert canonical prompt state: ${error.message}`);
  }

  const firstRow = Array.isArray(data)
    ? ((data[0] as UpsertConversationStateRpcRow) ?? null)
    : null;
  return clampCanonicalPrompt(firstRow?.canonical_prompt ?? normalizedPrompt);
};
