/**
 * Admin API: list users with plan + credit balance snapshot.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

const DEFAULT_PER_PAGE = 100;
const MAX_PER_PAGE = 200;
const SEARCH_SCAN_PER_PAGE = 200;
const MAX_SEARCH_SCAN_PAGES = 50;

type AdminUserRow = {
  id: string;
  email: string | null;
  planId: string | null;
  offerId: string | null;
  stripePriceId: string | null;
  contractSource: "stripe" | "internal_comp" | null;
  recurringPriceCents: number | null;
  monthlyCreditsCents: number | null;
  billingSource: "billing_profile" | "subscription_contract";
  subscriptionStatus: string | null;
  credits: number;
  availableCredits: number;
  reservedCredits: number;
  spendableCredits: number;
  createdAt: string | null;
};

type BillingProfileRow = {
  user_id: string;
  plan_id: string | null;
  subscription_status: string | null;
};

type BillingSubscriptionContractRow = {
  user_id: string;
  plan_id: string | null;
  offer_id: string | null;
  stripe_price_id: string | null;
  contract_source: "stripe" | "internal_comp" | null;
  recurring_price_cents: number | string | null;
  monthly_credits_cents: number | string | null;
  status: string | null;
};

type CreditBalanceRow = {
  user_id: string;
  balance_cents: number | string | null;
};

type CreditReservationRow = {
  user_id: string;
  amount_cents: number | string | null;
};

type AuthUser = {
  id: string;
  email?: string | null;
  created_at?: string | null;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const requestedPage = asPositiveInt(req.query.page, 1);
    const perPage = Math.min(MAX_PER_PAGE, asPositiveInt(req.query.perPage, DEFAULT_PER_PAGE));
    const search = normalizeSearchQuery(req.query.search);

    let pagedUsers: AuthUser[] = [];
    let totalCount = 0;
    let searchLimited = false;
    let allMatchedUsers: AuthUser[] | null = null;

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
      });
    }

    const [balancesResult, contractsResult, profilesResult, reservationsResult] = await Promise.all(
      [
        supabaseAdmin
          .from("ai_credit_balance")
          .select("user_id, balance_cents")
          .in("user_id", userIds),
        supabaseAdmin
          .from("billing_subscription_contracts")
          .select(
            "user_id, plan_id, offer_id, stripe_price_id, contract_source, recurring_price_cents, monthly_credits_cents, status"
          )
          .in("user_id", userIds)
          .is("ended_at", null),
        supabaseAdmin
          .from("billing_profiles")
          .select("user_id, plan_id, subscription_status")
          .in("user_id", userIds),
        supabaseAdmin
          .from("ai_credit_reservations")
          .select("user_id, amount_cents")
          .in("user_id", userIds)
          .eq("status", "reserved"),
      ]
    );
    const contractsCompatibilityError =
      contractsResult.error?.message && isSchemaCompatibilityError(contractsResult.error.message);
    if (
      balancesResult.error ||
      profilesResult.error ||
      (contractsResult.error && !contractsCompatibilityError)
    ) {
      const detail = [
        balancesResult.error?.message,
        contractsResult.error?.message,
        profilesResult.error?.message,
      ]
        .filter(Boolean)
        .join(" | ");
      return res.status(500).json({ error: detail || "Failed to load admin user billing data." });
    }

    const balances = (balancesResult.data ?? []) as CreditBalanceRow[];
    const contracts = contractsCompatibilityError
      ? []
      : ((contractsResult.data ?? []) as BillingSubscriptionContractRow[]);
    const profiles = (profilesResult.data ?? []) as BillingProfileRow[];
    const reservationError = reservationsResult.error?.message ?? null;
    const reservationsSupported = !reservationError;
    if (reservationError && !isSchemaCompatibilityError(reservationError)) {
      return res.status(500).json({ error: reservationError || "Failed to load reservations." });
    }
    const reservations = reservationError
      ? []
      : ((reservationsResult.data ?? []) as CreditReservationRow[]);

    const balanceByUser = new Map<string, number>(
      balances.map((row) => [row.user_id, Number(row.balance_cents ?? 0)])
    );
    const contractByUser = new Map<string, BillingSubscriptionContractRow>(
      contracts.map((row) => [row.user_id, row])
    );
    const profileByUser = new Map<string, BillingProfileRow>(
      profiles.map((row) => [row.user_id, row])
    );
    const reservedByUser = new Map<string, number>();
    for (const row of reservations) {
      const existing = reservedByUser.get(row.user_id) ?? 0;
      reservedByUser.set(row.user_id, existing + Math.abs(Number(row.amount_cents ?? 0)));
    }

    const rows: AdminUserRow[] = pagedUsers.map((user) => {
      const contract = contractByUser.get(user.id);
      const profile = profileByUser.get(user.id);
      const availableCredits = balanceByUser.get(user.id) ?? 0;
      const reservedCredits = reservedByUser.get(user.id) ?? 0;
      const spendableCredits = Math.max(0, availableCredits - reservedCredits);
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
        recurringPriceCents:
          contract?.recurring_price_cents == null ? null : Number(contract.recurring_price_cents),
        monthlyCreditsCents:
          contract?.monthly_credits_cents == null ? null : Number(contract.monthly_credits_cents),
        billingSource: contract ? "subscription_contract" : "billing_profile",
        subscriptionStatus:
          (contract?.status as string | undefined) ??
          (profile?.subscription_status as string | undefined) ??
          null,
        credits: spendableCredits,
        availableCredits,
        reservedCredits,
        spendableCredits,
        createdAt: user.created_at ?? null,
      };
    });

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
      reservationsSupported,
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
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load admin users.",
    });
  }
}
