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
  status?: string | null;
  ledgerId?: string | null;
  grantId?: string | null;
  message?: string | null;
};

type CreditGrantKind =
  | "subscription_allocation"
  | "paid_topup"
  | "admin_adjustment"
  | "legacy_balance";

type CreditGrantOptions = Omit<LedgerInsertOptions, "changeCents"> & {
  amountCents: number;
  creditKind: CreditGrantKind;
  expiresAt?: string | null;
};

type CreditDebitOptions = Omit<LedgerInsertOptions, "changeCents"> & {
  amountCents: number;
};

const normalizeLedgerError = (error: unknown): { message?: string; code?: string } | null => {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  return {
    message: typeof record.message === "string" ? record.message : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
  };
};

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const requireSourceRef = (sourceRef: string | null): { message: string } | null =>
  sourceRef && sourceRef.trim().length > 0 ? null : { message: "sourceRef is required." };

const normalizeRpcResult = (
  data: unknown
): Pick<LedgerInsertResult, "status" | "ledgerId" | "grantId" | "message"> => {
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object") {
    return {};
  }
  const record = row as Record<string, unknown>;
  return {
    status: asNullableString(record.status),
    ledgerId: asNullableString(record.ledger_id),
    grantId: asNullableString(record.grant_id),
    message: asNullableString(record.message),
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

/**
 * Grants credits through the canonical grant-lot RPC so expiry and spend order
 * metadata stay attached to the ledger grant atomically.
 */
export const grantAccountCredits = async ({
  userId,
  amountCents,
  reason,
  source = "system",
  sourceRef = null,
  creditKind,
  expiresAt = null,
  metadata = {},
  createdBy = null,
}: CreditGrantOptions): Promise<LedgerInsertResult> => {
  const sourceRefError = requireSourceRef(sourceRef);
  if (sourceRefError) {
    return { error: sourceRefError, mode: "rich" };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const rpcClient = supabaseAdmin as unknown as {
    rpc: (
      name: string,
      params: Record<string, unknown>
    ) => Promise<{ error: unknown; data: unknown }>;
  };

  const { error, data } = await rpcClient.rpc("grant_account_credits", {
    p_user_id: userId,
    p_amount_cents: amountCents,
    p_reason: reason,
    p_source: source,
    p_source_ref: sourceRef,
    p_credit_kind: creditKind,
    p_expires_at: expiresAt,
    p_metadata: metadata,
    p_created_by: createdBy,
  });

  return { error: normalizeLedgerError(error), mode: "rich", ...normalizeRpcResult(data) };
};

/**
 * Debits credits through the canonical grant-lot RPC so direct debits use the
 * same expiring-first order as generation reservations.
 */
export const debitAccountCredits = async ({
  userId,
  amountCents,
  reason,
  source = "system",
  sourceRef = null,
  metadata = {},
  createdBy = null,
}: CreditDebitOptions): Promise<LedgerInsertResult> => {
  const sourceRefError = requireSourceRef(sourceRef);
  if (sourceRefError) {
    return { error: sourceRefError, mode: "rich" };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const rpcClient = supabaseAdmin as unknown as {
    rpc: (
      name: string,
      params: Record<string, unknown>
    ) => Promise<{ error: unknown; data: unknown }>;
  };

  const { error, data } = await rpcClient.rpc("debit_account_credits", {
    p_user_id: userId,
    p_amount_cents: amountCents,
    p_reason: reason,
    p_source: source,
    p_source_ref: sourceRef,
    p_metadata: metadata,
    p_created_by: createdBy,
  });

  return { error: normalizeLedgerError(error), mode: "rich", ...normalizeRpcResult(data) };
};
