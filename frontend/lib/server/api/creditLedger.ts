/**
 * Credit ledger insert helper with legacy-schema compatibility fallback.
 * Tries the v2 schema first, then falls back to legacy `ref_id` shape when needed.
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

type LedgerInsertMode = "rich" | "legacy";

type LedgerInsertResult = {
  error: { message?: string; code?: string } | null;
  mode: LedgerInsertMode;
};

const normalizeLedgerError = (error: unknown): { message?: string; code?: string } | null => {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  return {
    message: typeof record.message === "string" ? record.message : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
  };
};

const isMissingLedgerColumnError = (error: { message?: string; code?: string } | null): boolean => {
  if (!error) return false;
  const code = String(error.code ?? "").toUpperCase();
  if (code === "42703" || code === "PGRST204") return true;

  const message = String(error.message ?? "");
  return (
    /column .*ai_credit_ledger.*does not exist/i.test(message) ||
    /could not find the '.*' column of 'ai_credit_ledger'/i.test(message)
  );
};

/**
 * Inserts into `ai_credit_ledger`, falling back to the legacy table shape if needed.
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
  const normalizedRichError = normalizeLedgerError(richError);
  if (!isMissingLedgerColumnError(normalizedRichError)) {
    return { error: normalizedRichError, mode: "rich" };
  }

  const legacyPayload = {
    user_id: userId,
    change_cents: changeCents,
    reason,
    ref_id: sourceRef,
  };
  const { error: legacyError } = await supabaseAdmin.from("ai_credit_ledger").insert(legacyPayload);
  return { error: normalizeLedgerError(legacyError), mode: "legacy" };
};
