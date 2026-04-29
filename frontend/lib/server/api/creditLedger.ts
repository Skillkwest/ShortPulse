/**
 * Credit ledger insert helper for the canonical v2 ledger schema.
 */
import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

type LedgerInsertOptions = {
  userId: string;
  changeCents: number;
  reason: string;
  source?: string;
  sourceRef?: string | null;
  metadata?: JsonObject;
  createdBy?: string | null;
};

type LedgerInsertResult = {
  error: { message?: string; code?: string } | null;
  mode: "rich";
};

const normalizeLedgerError = (error: unknown): { message?: string; code?: string } | null => {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  return {
    message: typeof record.message === "string" ? record.message : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
  };
};

/**
 * Inserts into `ai_credit_ledger`.
 */
export const insertCreditLedgerEntry = async ({
  userId,
  changeCents,
  reason,
  source = "system",
  sourceRef = null,
  metadata = {},
  createdBy = null,
}: LedgerInsertOptions): Promise<LedgerInsertResult> => {
  const supabaseAdmin = getSupabaseAdmin();

  const richPayload = {
    user_id: userId,
    change_cents: changeCents,
    reason,
    source,
    source_ref: sourceRef,
    metadata,
    created_by: createdBy,
  };

  const { error: richError } = await supabaseAdmin.from("ai_credit_ledger").insert(richPayload);
  if (!richError) {
    return { error: null, mode: "rich" };
  }
  return { error: normalizeLedgerError(richError), mode: "rich" };
};
