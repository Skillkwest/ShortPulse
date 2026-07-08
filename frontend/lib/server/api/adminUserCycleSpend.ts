/**
 * Admin support helpers for current-period credit spend snapshots.
 */
import type { getSupabaseAdmin } from "./supabaseAdmin";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

export type AdminUserCycleSpendContract = {
  user_id: string;
  current_period_start: string | null;
  current_period_end: string | null;
};

export type AdminUserCycleSpendProfile = {
  user_id: string;
  current_period_end: string | null;
};

type CreditGrantAllocationSpendRow = {
  user_id: string;
  ledger_id: string | null;
  amount_cents: number | string | null;
  allocation_status: string | null;
  allocation_source: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CreditLedgerSpendRow = {
  id: string | null;
  user_id: string;
  change_cents: number | string | null;
  created_at: string | null;
};

type CycleSpendWindow = {
  startMs: number;
  endMs: number | null;
};

type FetchAdminUserCycleSpendOptions = {
  supabaseAdmin: SupabaseAdminClient;
  userIds: string[];
  contractByUser: ReadonlyMap<string, AdminUserCycleSpendContract>;
  profileByUser: ReadonlyMap<string, AdminUserCycleSpendProfile>;
  isSchemaCompatibilityError: (message: string) => boolean;
  nowMs?: number;
};

type FetchAdminUserCycleSpendResult = {
  spentByUser: Map<string, number>;
  error: { message: string } | null;
};

const LEGACY_GENERATION_SPEND_SOURCE = "generation_charge";
const NON_USER_SPEND_ALLOCATION_SOURCES = new Set(["admin_adjustment", "credit_expiration"]);

const toFiniteCents = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
};

const parseDateMs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const getUtcMonthStartMs = (ms: number): number => {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
};

const subtractOneUtcMonthMs = (ms: number): number => {
  const date = new Date(ms);
  const targetMonthStart = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() - 1,
    1,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  );
  const target = new Date(targetMonthStart);
  const targetLastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), targetLastDay));
  return target.getTime();
};

const getCycleSpendWindow = ({
  contract,
  profile,
  nowMs,
}: {
  contract: AdminUserCycleSpendContract | undefined;
  profile: AdminUserCycleSpendProfile | undefined;
  nowMs: number;
}): CycleSpendWindow => {
  const contractStartMs = parseDateMs(contract?.current_period_start);
  if (contractStartMs !== null) {
    const contractEndMs = parseDateMs(contract?.current_period_end);
    return {
      startMs: contractStartMs,
      endMs: contractEndMs !== null && contractEndMs > contractStartMs ? contractEndMs : null,
    };
  }

  const profileEndMs = parseDateMs(profile?.current_period_end);
  if (profileEndMs !== null && profileEndMs > nowMs) {
    return {
      startMs: subtractOneUtcMonthMs(profileEndMs),
      endMs: profileEndMs,
    };
  }

  return {
    startMs: getUtcMonthStartMs(nowMs),
    endMs: null,
  };
};

const isWithinWindow = (valueMs: number | null, window: CycleSpendWindow): boolean => {
  if (valueMs === null) return false;
  if (valueMs < window.startMs) return false;
  return window.endMs === null || valueMs < window.endMs;
};

const isUserSpendAllocation = (row: CreditGrantAllocationSpendRow): boolean => {
  const status = row.allocation_status;
  if (status === "captured") return true;
  if (status !== "debited") return false;
  const source = String(row.allocation_source ?? "").trim();
  return !NON_USER_SPEND_ALLOCATION_SOURCES.has(source);
};

/**
 * Fetches current-cycle credit spend for admin user rows.
 *
 * The canonical source is `ai_credit_grant_allocations`: captured reservation
 * allocations and direct debit allocations identify real consumed credits.
 * Legacy `ai_credit_ledger` generation charges are added only when they are not
 * already represented by a grant allocation ledger id.
 */
export const fetchAdminUserCycleSpend = async ({
  supabaseAdmin,
  userIds,
  contractByUser,
  profileByUser,
  isSchemaCompatibilityError,
  nowMs = Date.now(),
}: FetchAdminUserCycleSpendOptions): Promise<FetchAdminUserCycleSpendResult> => {
  const spentByUser = new Map<string, number>();
  if (!userIds.length) return { spentByUser, error: null };

  const windowsByUser = new Map<string, CycleSpendWindow>(
    userIds.map((userId) => [
      userId,
      getCycleSpendWindow({
        contract: contractByUser.get(userId),
        profile: profileByUser.get(userId),
        nowMs,
      }),
    ])
  );
  const earliestSpendStart = new Date(
    Math.min(...Array.from(windowsByUser.values()).map((window) => window.startMs))
  ).toISOString();
  const allocationLedgerIds = new Set<string>();

  const allocationResult = await supabaseAdmin
    .from("ai_credit_grant_allocations")
    .select(
      "user_id, ledger_id, amount_cents, allocation_status, allocation_source, created_at, updated_at"
    )
    .in("user_id", userIds)
    .in("allocation_status", ["captured", "debited"])
    .gte("updated_at", earliestSpendStart);

  if (allocationResult.error) {
    if (!isSchemaCompatibilityError(allocationResult.error.message ?? "")) {
      return {
        spentByUser,
        error: allocationResult.error.message
          ? { message: allocationResult.error.message }
          : { message: "Failed to load admin user grant allocation spend." },
      };
    }
  } else {
    const allocationRows = (allocationResult.data ?? []) as CreditGrantAllocationSpendRow[];
    for (const row of allocationRows) {
      if (!isUserSpendAllocation(row)) continue;
      const window = windowsByUser.get(row.user_id);
      if (!window) continue;
      const spendAtMs = parseDateMs(row.updated_at) ?? parseDateMs(row.created_at);
      if (!isWithinWindow(spendAtMs, window)) continue;
      const amount = Math.max(0, toFiniteCents(row.amount_cents));
      if (amount <= 0) continue;
      if (row.ledger_id) allocationLedgerIds.add(row.ledger_id);
      spentByUser.set(row.user_id, (spentByUser.get(row.user_id) ?? 0) + amount);
    }
  }

  const ledgerResult = await supabaseAdmin
    .from("ai_credit_ledger")
    .select("id, user_id, change_cents, created_at")
    .in("user_id", userIds)
    .eq("source", LEGACY_GENERATION_SPEND_SOURCE)
    .lt("change_cents", 0)
    .gte("created_at", earliestSpendStart);

  if (ledgerResult.error) {
    return {
      spentByUser,
      error: ledgerResult.error.message
        ? { message: ledgerResult.error.message }
        : { message: "Failed to load admin user cycle spend." },
    };
  }

  const ledgerRows = (ledgerResult.data ?? []) as CreditLedgerSpendRow[];
  for (const row of ledgerRows) {
    if (row.id && allocationLedgerIds.has(row.id)) continue;
    const window = windowsByUser.get(row.user_id);
    if (!window) continue;
    const spendAtMs = parseDateMs(row.created_at);
    if (!isWithinWindow(spendAtMs, window)) continue;
    const amount = Math.abs(toFiniteCents(row.change_cents));
    if (amount <= 0) continue;
    spentByUser.set(row.user_id, (spentByUser.get(row.user_id) ?? 0) + amount);
  }

  return { spentByUser, error: null };
};
