/**
 * Admin API: list users with plan + credit balance snapshot.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { fetchAdminUserCycleSpend } from "../../../lib/server/api/adminUserCycleSpend";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { fetchCreditGrantSummaries } from "../../../lib/server/api/creditGrantSummary";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

const DEFAULT_PER_PAGE = 100;
const MAX_PER_PAGE = 200;
const SEARCH_SCAN_PER_PAGE = 200;
const MAX_SEARCH_SCAN_PAGES = 50;
const ENRICHMENT_CHUNK_SIZE = 200;
const ADMIN_USER_SORT_OPTIONS = [
  "default",
  "email_asc",
  "email_desc",
  "subscribed_first",
  "unsubscribed_first",
  "plan_tier",
  "renewal_soon",
  "renewal_latest",
  "spendable_low",
  "spendable_high",
  "empty_credits_first",
  "joined_newest",
  "joined_oldest",
] as const;

type AdminUserSortOption = (typeof ADMIN_USER_SORT_OPTIONS)[number];

type AdminUserRow = {
  id: string;
  email: string | null;
  planId: string | null;
  offerId: string | null;
  stripePriceId: string | null;
  contractSource: "stripe" | "internal_comp" | null;
  billingInterval: "month" | "year" | null;
  recurringPriceCents: number | null;
  monthlyCreditsCents: number | null;
  billingSource: "billing_profile" | "subscription_contract";
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  planRenewalAt: string | null;
  currentCycleSpentCredits: number;
  topUpPurchaseCount: number;
  topUpCreditsPurchased: number;
  recurringStorageAddonBytes: number;
  recurringStorageAddonPriceCents: number;
  credits: number;
  availableCredits: number;
  reservedCredits: number;
  spendableCredits: number;
  expiringCredits: number;
  nonExpiringCredits: number;
  nextExpiringCredits: number;
  nextExpiresAt: string | null;
  createdAt: string | null;
};

type BillingProfileRow = {
  user_id: string;
  plan_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
};

type BillingSubscriptionContractRow = {
  user_id: string;
  plan_id: string | null;
  offer_id: string | null;
  stripe_price_id: string | null;
  contract_source: "stripe" | "internal_comp" | null;
  billing_interval: "month" | "year" | null;
  recurring_price_cents: number | string | null;
  monthly_credits_cents: number | string | null;
  status: string | null;
  cancel_at_period_end: boolean | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

type CreditBalanceRow = {
  user_id: string;
  balance_cents: number | string | null;
};

type CreditTopUpRow = {
  user_id: string;
  change_cents: number | string | null;
};

type BillingSubscriptionStorageAddonRow = {
  user_id: string;
  storage_limit_bytes: number | string | null;
  quantity: number | string | null;
  recurring_price_cents: number | string | null;
};

type AuthUser = {
  id: string;
  email?: string | null;
  created_at?: string | null;
};

type AuthUserScanResult = {
  users: AuthUser[];
  total: number;
  limited: boolean;
};

const asPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};

const asSingleString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

const normalizeSearchQuery = (value: unknown): string =>
  asSingleString(value).trim().toLowerCase().slice(0, 80);

const normalizeSortOption = (value: unknown): AdminUserSortOption => {
  const option = asSingleString(value);
  return ADMIN_USER_SORT_OPTIONS.includes(option as AdminUserSortOption)
    ? (option as AdminUserSortOption)
    : "default";
};

const isSchemaCompatibilityError = (message: string) => {
  const text = message.toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache") ||
    text.includes("failed to parse select parameter") ||
    text.includes("column")
  );
};

const toFiniteCents = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
};

const toSortableTime = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const compareText = (left: string | null | undefined, right: string | null | undefined): number =>
  String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });

const planRank = (planId: string | null): number => {
  const normalized = String(planId ?? "").toLowerCase();
  if (!normalized || normalized === "free" || normalized === "baseline") return 0;
  if (normalized === "starter") return 1;
  if (normalized === "media") return 2;
  if (normalized === "studio" || normalized === "pro") return 3;
  if (normalized === "business" || normalized === "creative" || normalized === "creative_suite") {
    return 4;
  }
  return 5;
};

const hasActivePaidSubscription = (row: AdminUserRow): boolean => {
  if (row.contractSource === "internal_comp") return false;
  if (row.billingSource !== "subscription_contract") return false;
  if (row.planId === "free" || row.planId === "baseline" || !row.planId) return false;
  if (row.recurringPriceCents == null || row.recurringPriceCents <= 0) return false;

  const status = String(row.subscriptionStatus ?? "").toLowerCase();
  return row.cancelAtPeriodEnd || status === "active" || status === "trialing";
};

const compareNullableTime = (
  left: string | null | undefined,
  right: string | null | undefined,
  direction: "asc" | "desc"
): number => {
  const leftTime = toSortableTime(left);
  const rightTime = toSortableTime(right);
  if (leftTime == null && rightTime == null) return 0;
  if (leftTime == null) return 1;
  if (rightTime == null) return -1;
  return direction === "asc" ? leftTime - rightTime : rightTime - leftTime;
};

const sortAdminUserRows = (
  rows: AdminUserRow[],
  sortOption: AdminUserSortOption
): AdminUserRow[] => {
  const sorted = [...rows];
  sorted.sort((left, right) => {
    const emailTieBreaker = compareText(left.email ?? left.id, right.email ?? right.id);
    if (sortOption === "email_asc") return emailTieBreaker;
    if (sortOption === "email_desc") return -emailTieBreaker;
    if (sortOption === "subscribed_first" || sortOption === "unsubscribed_first") {
      const leftSubscribed = hasActivePaidSubscription(left) ? 1 : 0;
      const rightSubscribed = hasActivePaidSubscription(right) ? 1 : 0;
      const direction = sortOption === "subscribed_first" ? -1 : 1;
      return (leftSubscribed - rightSubscribed) * direction || emailTieBreaker;
    }
    if (sortOption === "plan_tier") {
      return planRank(left.planId) - planRank(right.planId) || emailTieBreaker;
    }
    if (sortOption === "renewal_soon") {
      return compareNullableTime(left.planRenewalAt, right.planRenewalAt, "asc") || emailTieBreaker;
    }
    if (sortOption === "renewal_latest") {
      return (
        compareNullableTime(left.planRenewalAt, right.planRenewalAt, "desc") || emailTieBreaker
      );
    }
    if (sortOption === "spendable_low") {
      return left.spendableCredits - right.spendableCredits || emailTieBreaker;
    }
    if (sortOption === "spendable_high") {
      return right.spendableCredits - left.spendableCredits || emailTieBreaker;
    }
    if (sortOption === "empty_credits_first") {
      const leftEmpty = left.spendableCredits <= 0 ? 1 : 0;
      const rightEmpty = right.spendableCredits <= 0 ? 1 : 0;
      return (
        rightEmpty - leftEmpty || left.spendableCredits - right.spendableCredits || emailTieBreaker
      );
    }
    if (sortOption === "joined_newest") {
      return compareNullableTime(left.createdAt, right.createdAt, "desc") || emailTieBreaker;
    }
    if (sortOption === "joined_oldest") {
      return compareNullableTime(left.createdAt, right.createdAt, "asc") || emailTieBreaker;
    }
    return 0;
  });
  return sorted;
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const listUsersPage = async (
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  page: number,
  perPage: number
): Promise<{
  users: AuthUser[];
  total: number;
  nextPage: number | null;
}> => {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page,
    perPage,
  });
  if (error) {
    throw new Error(error.message);
  }

  const users = Array.isArray(data?.users) ? (data.users as AuthUser[]) : [];
  const total = Number(data?.total ?? 0);
  const nextPage = typeof data?.nextPage === "number" ? data.nextPage : null;
  return { users, total, nextPage };
};

const scanAuthUsers = async (
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  search: string
): Promise<AuthUserScanResult> => {
  const users: AuthUser[] = [];
  let total = 0;
  let scanPage = 1;
  let hasNext = true;

  while (hasNext && scanPage <= MAX_SEARCH_SCAN_PAGES) {
    const scanResult = await listUsersPage(supabaseAdmin, scanPage, SEARCH_SCAN_PER_PAGE);
    total = Math.max(total, scanResult.total);
    if (!scanResult.users.length) {
      hasNext = false;
      break;
    }

    for (const user of scanResult.users) {
      if (!search) {
        users.push(user);
        continue;
      }
      const email = String(user.email ?? "").toLowerCase();
      const id = String(user.id ?? "").toLowerCase();
      if (email.includes(search) || id.includes(search)) {
        users.push(user);
      }
    }

    hasNext = scanResult.nextPage !== null && scanResult.nextPage > scanPage;
    scanPage += 1;
  }

  return {
    users,
    total: search ? users.length : total || users.length,
    limited: hasNext,
  };
};

const enrichAdminUserChunk = async (
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  authUsers: AuthUser[]
): Promise<AdminUserRow[]> => {
  const userIds = authUsers.map((user) => user.id);
  if (!userIds.length) return [];

  const [balancesResult, contractsResult, profilesResult, topUpsResult, storageAddonsResult] =
    await Promise.all([
      supabaseAdmin
        .from("ai_credit_balance")
        .select("user_id, balance_cents")
        .in("user_id", userIds),
      supabaseAdmin
        .from("billing_subscription_contracts")
        .select(
          "user_id, plan_id, offer_id, stripe_price_id, contract_source, billing_interval, recurring_price_cents, monthly_credits_cents, status, cancel_at_period_end, current_period_start, current_period_end"
        )
        .in("user_id", userIds)
        .is("ended_at", null),
      supabaseAdmin
        .from("billing_profiles")
        .select("user_id, plan_id, subscription_status, current_period_end")
        .in("user_id", userIds),
      supabaseAdmin
        .from("ai_credit_ledger")
        .select("user_id, change_cents")
        .in("user_id", userIds)
        .eq("source", "stripe_checkout")
        .gt("change_cents", 0),
      supabaseAdmin
        .from("billing_subscription_storage_addons")
        .select("user_id, storage_limit_bytes, quantity, recurring_price_cents")
        .in("user_id", userIds)
        .is("ended_at", null)
        .in("status", ["active", "trialing", "past_due"]),
    ]);
  const contractsCompatibilityError =
    contractsResult.error?.message && isSchemaCompatibilityError(contractsResult.error.message);
  const storageAddonsCompatibilityError =
    storageAddonsResult.error?.message &&
    isSchemaCompatibilityError(storageAddonsResult.error.message);
  if (
    balancesResult.error ||
    profilesResult.error ||
    topUpsResult.error ||
    (storageAddonsResult.error && !storageAddonsCompatibilityError) ||
    (contractsResult.error && !contractsCompatibilityError)
  ) {
    const detail = [
      balancesResult.error?.message,
      contractsResult.error?.message,
      profilesResult.error?.message,
      topUpsResult.error?.message,
      storageAddonsResult.error?.message,
    ]
      .filter(Boolean)
      .join(" | ");
    throw new Error(detail || "Failed to load admin user billing data.");
  }

  const balances = (balancesResult.data ?? []) as CreditBalanceRow[];
  const contracts = contractsCompatibilityError
    ? []
    : ((contractsResult.data ?? []) as BillingSubscriptionContractRow[]);
  const profiles = (profilesResult.data ?? []) as BillingProfileRow[];
  const topUps = (topUpsResult.data ?? []) as CreditTopUpRow[];
  const storageAddons = storageAddonsCompatibilityError
    ? []
    : ((storageAddonsResult.data ?? []) as BillingSubscriptionStorageAddonRow[]);
  const grantSummariesResult = await fetchCreditGrantSummaries(userIds);
  if (grantSummariesResult.error) {
    throw new Error(grantSummariesResult.error.message || "Failed to load credit grant summaries.");
  }

  const balanceByUser = new Map<string, number>(
    balances.map((row) => [row.user_id, Number(row.balance_cents ?? 0)])
  );
  const contractByUser = new Map<string, BillingSubscriptionContractRow>(
    contracts.map((row) => [row.user_id, row])
  );
  const profileByUser = new Map<string, BillingProfileRow>(
    profiles.map((row) => [row.user_id, row])
  );
  const topUpSummaryByUser = new Map<string, { purchaseCount: number; creditsPurchased: number }>();
  for (const row of topUps) {
    const creditsPurchased = Math.max(0, toFiniteCents(row.change_cents));
    if (creditsPurchased <= 0) continue;
    const current = topUpSummaryByUser.get(row.user_id) ?? {
      purchaseCount: 0,
      creditsPurchased: 0,
    };
    current.purchaseCount += 1;
    current.creditsPurchased += creditsPurchased;
    topUpSummaryByUser.set(row.user_id, current);
  }

  const recurringStorageByUser = new Map<string, { addonBytes: number; priceCents: number }>();
  for (const row of storageAddons) {
    const quantity = Math.max(1, toFiniteCents(row.quantity));
    const addonBytes = Math.max(0, toFiniteCents(row.storage_limit_bytes)) * quantity;
    const priceCents = Math.max(0, toFiniteCents(row.recurring_price_cents)) * quantity;
    if (addonBytes <= 0 && priceCents <= 0) continue;
    const current = recurringStorageByUser.get(row.user_id) ?? {
      addonBytes: 0,
      priceCents: 0,
    };
    current.addonBytes += addonBytes;
    current.priceCents += priceCents;
    recurringStorageByUser.set(row.user_id, current);
  }

  const cycleSpendResult = await fetchAdminUserCycleSpend({
    supabaseAdmin,
    userIds,
    contractByUser,
    profileByUser,
    isSchemaCompatibilityError,
  });
  if (cycleSpendResult.error) {
    throw new Error(cycleSpendResult.error.message);
  }
  const { spentByUser } = cycleSpendResult;

  return authUsers.map((user) => {
    const contract = contractByUser.get(user.id);
    const profile = profileByUser.get(user.id);
    const availableCredits = balanceByUser.get(user.id) ?? 0;
    const grantSummary = grantSummariesResult.summariesByUserId.get(user.id);
    if (!grantSummary) {
      throw new Error(`Credit grant summary missing for admin user ${user.id}.`);
    }
    const topUpSummary = topUpSummaryByUser.get(user.id);
    const recurringStorage = recurringStorageByUser.get(user.id);
    return {
      id: user.id,
      email: user.email ?? null,
      planId:
        (contract?.plan_id as string | undefined) ??
        (profile?.plan_id as string | undefined) ??
        null,
      offerId: (contract?.offer_id as string | undefined) ?? null,
      stripePriceId: (contract?.stripe_price_id as string | undefined) ?? null,
      contractSource: contract?.contract_source ?? null,
      billingInterval: contract?.billing_interval ?? null,
      recurringPriceCents:
        contract?.recurring_price_cents == null ? null : Number(contract.recurring_price_cents),
      monthlyCreditsCents:
        contract?.monthly_credits_cents == null ? null : Number(contract.monthly_credits_cents),
      billingSource: contract ? "subscription_contract" : "billing_profile",
      subscriptionStatus:
        (contract?.status as string | undefined) ??
        (profile?.subscription_status as string | undefined) ??
        null,
      cancelAtPeriodEnd: contract?.cancel_at_period_end === true,
      planRenewalAt:
        (contract?.current_period_end as string | undefined) ??
        (profile?.current_period_end as string | undefined) ??
        null,
      currentCycleSpentCredits: spentByUser.get(user.id) ?? 0,
      topUpPurchaseCount: topUpSummary?.purchaseCount ?? 0,
      topUpCreditsPurchased: topUpSummary?.creditsPurchased ?? 0,
      recurringStorageAddonBytes: recurringStorage?.addonBytes ?? 0,
      recurringStorageAddonPriceCents: recurringStorage?.priceCents ?? 0,
      credits: grantSummary.spendableCents,
      availableCredits,
      reservedCredits: grantSummary.reservedCents,
      spendableCredits: grantSummary.spendableCents,
      expiringCredits: grantSummary.expiringCents,
      nonExpiringCredits: grantSummary.nonExpiringCents,
      nextExpiringCredits: grantSummary.nextExpiringCents,
      nextExpiresAt: grantSummary.nextExpiresAt,
      createdAt: user.created_at ?? null,
    };
  });
};

const enrichAdminUsers = async (
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  authUsers: AuthUser[]
): Promise<AdminUserRow[]> => {
  const rows: AdminUserRow[] = [];
  for (const chunk of chunkArray(authUsers, ENRICHMENT_CHUNK_SIZE)) {
    rows.push(...(await enrichAdminUserChunk(supabaseAdmin, chunk)));
  }
  return rows;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/users.auth",
    });
    return res.status(500).json({ error: "Unable to load admin users." });
  }
  if (!adminUser) {
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const requestedPage = asPositiveInt(req.query.page, 1);
    const perPage = Math.min(MAX_PER_PAGE, asPositiveInt(req.query.perPage, DEFAULT_PER_PAGE));
    const search = normalizeSearchQuery(req.query.search);
    const sortOption = normalizeSortOption(req.query.sort);

    let pagedUsers: AuthUser[] = [];
    let totalCount = 0;
    let searchLimited = false;
    let allMatchedUsers: AuthUser[] | null = null;

    if (sortOption !== "default") {
      const scanResult = await scanAuthUsers(supabaseAdmin, search);
      searchLimited = scanResult.limited;
      const sortedRows = sortAdminUserRows(
        await enrichAdminUsers(supabaseAdmin, scanResult.users),
        sortOption
      );
      totalCount = sortedRows.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
      const page = totalCount > 0 ? Math.min(requestedPage, totalPages) : 1;
      const sliceStart = (page - 1) * perPage;
      const rows = sortedRows.slice(sliceStart, sliceStart + perPage);

      return res.status(200).json({
        users: rows,
        pagination: {
          page,
          perPage,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        search: {
          value: search || null,
          limited: searchLimited,
        },
        sort: {
          value: sortOption,
          limited: searchLimited,
        },
        reservationsSupported: true,
      });
    }

    if (search) {
      const matches: AuthUser[] = [];
      let scanPage = 1;
      let hasNext = true;

      while (hasNext && scanPage <= MAX_SEARCH_SCAN_PAGES) {
        const scanResult = await listUsersPage(supabaseAdmin, scanPage, SEARCH_SCAN_PER_PAGE);
        if (!scanResult.users.length) {
          hasNext = false;
          break;
        }

        for (const user of scanResult.users) {
          const email = String(user.email ?? "").toLowerCase();
          const id = String(user.id ?? "").toLowerCase();
          if (email.includes(search) || id.includes(search)) {
            matches.push(user);
          }
        }

        hasNext = scanResult.nextPage !== null && scanResult.nextPage > scanPage;
        scanPage += 1;
      }

      searchLimited = hasNext;
      allMatchedUsers = matches;
      totalCount = matches.length;
      const sliceStart = (requestedPage - 1) * perPage;
      pagedUsers = matches.slice(sliceStart, sliceStart + perPage);
    } else {
      const pageResult = await listUsersPage(supabaseAdmin, requestedPage, perPage);
      pagedUsers = pageResult.users;
      totalCount = pageResult.total > 0 ? pageResult.total : pagedUsers.length;
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    const page = totalCount > 0 ? Math.min(requestedPage, totalPages) : 1;
    if (page !== requestedPage) {
      if (search) {
        const matches = allMatchedUsers ?? [];
        const sliceStart = (page - 1) * perPage;
        pagedUsers = matches.slice(sliceStart, sliceStart + perPage);
      } else {
        const pageResult = await listUsersPage(supabaseAdmin, page, perPage);
        pagedUsers = pageResult.users;
      }
    }

    const userIds = pagedUsers.map((user) => user.id);
    if (!userIds.length) {
      return res.status(200).json({
        users: [],
        pagination: {
          page,
          perPage,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        search: {
          value: search || null,
          limited: searchLimited,
        },
        sort: {
          value: sortOption,
          limited: searchLimited,
        },
      });
    }

    const rows = await enrichAdminUsers(supabaseAdmin, pagedUsers);

    return res.status(200).json({
      users: rows,
      pagination: {
        page,
        perPage,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      search: {
        value: search || null,
        limited: searchLimited,
      },
      sort: {
        value: sortOption,
        limited: searchLimited,
      },
      reservationsSupported: true,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/users",
      user: adminUser,
      metadata: {
        page: typeof req.query.page === "string" ? req.query.page : null,
        per_page: typeof req.query.perPage === "string" ? req.query.perPage : null,
        search: typeof req.query.search === "string" ? req.query.search : null,
        sort: typeof req.query.sort === "string" ? req.query.sort : null,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load admin users.",
    });
  }
}
