/**
 * Authenticated account billing summary route.
 * Resolves current plan presentation and media-storage quota behind the app API boundary.
 */
import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { buildPlanView, normalizePlanId } from "../../../features/billing/catalog";
import type { MediaStorageQuotaSummary } from "../../../features/billing/storage";
import { CUSTOMER_CREDIT_ACTIVITY_SOURCES } from "../../../features/profile/profilePageModel";
import { CURRENT_BILLABLE_STORAGE_ADDON_STATUSES } from "../../../lib/billing/storageAddonEligibility";
import type { AuthenticatedApiUser } from "../../../lib/server/api/auth";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { parseBearerToken } from "../../../lib/server/api/authTokenVerifier";
import { loadBillingCatalogSnapshot } from "../../../lib/server/api/billingCatalog";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type CurrentSubscriptionContractRow = {
  plan_id: string | null;
  monthly_credits_cents: number | null;
};

type BillingProfilePlanRow = {
  plan_id: string | null;
};

type PrefetchedRow<T> = {
  data: T | null;
};

type ProfileBillingState = {
  billingProfile: ProfileBillingProfileRow | null;
  billingContract: ProfileBillingContractRow | null;
  billingActivity: ProfileBillingLedgerRow[];
  activeStorageAddons: ProfileBillingStorageAddon[];
};

type ProfileBillingProfileRow = {
  plan_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type ProfileBillingContractRow = {
  id: string;
  plan_id: string | null;
  offer_id: string | null;
  billing_interval: "month" | "year" | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  contract_source: "stripe" | "internal_comp" | null;
  recurring_price_cents: number;
  monthly_credits_cents: number;
  storage_limit_bytes: number;
  max_concurrent_generations?: number | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  started_at: string | null;
  ended_at: string | null;
};

type ProfileBillingLedgerRow = {
  id: string;
  change_cents: number;
  reason: string;
  source: string | null;
  source_ref: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ProfileBillingStorageAddonRow = {
  id: string | null;
  storage_addon_id: string | null;
  offer_id: string | null;
  stripe_subscription_item_id: string | null;
  storage_limit_bytes: number | string | null;
  quantity: number | string | null;
  recurring_price_cents: number | string | null;
  status: string | null;
};

type ProfileBillingStorageAddon = {
  id: string;
  storageAddonId: string;
  offerId: string | null;
  stripeSubscriptionItemId: string | null;
  storageLimitBytes: number;
  quantity: number;
  recurringPriceCents: number;
  status: string | null;
};

type QuotaRpcRow = {
  used_bytes: number | string | null;
  base_limit_bytes: number | string | null;
  addon_limit_bytes: number | string | null;
  total_limit_bytes: number | string | null;
  remaining_bytes: number | string | null;
  is_over_limit: boolean | null;
};

const BILLING_PROFILE_PLAN_COLUMNS = "plan_id";
const PROFILE_BILLING_PROFILE_COLUMNS =
  "plan_id, subscription_status, current_period_end, stripe_customer_id, stripe_subscription_id";
const CURRENT_SUBSCRIPTION_CONTRACT_SUMMARY_COLUMNS = "plan_id, monthly_credits_cents";
const PROFILE_BILLING_CONTRACT_COLUMNS =
  "id, plan_id, offer_id, billing_interval, stripe_subscription_id, stripe_price_id, contract_source, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, max_concurrent_generations, status, current_period_start, current_period_end, cancel_at_period_end, started_at, ended_at";

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeCreditCents = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
};

const shouldIncludeProfileState = (req: NextApiRequest): boolean => {
  const value = req.query.includeProfileState;
  if (Array.isArray(value)) return value.includes("1") || value.includes("true");
  return value === "1" || value === "true";
};

const normalizeStorageAddonRow = (
  row: ProfileBillingStorageAddonRow
): ProfileBillingStorageAddon | null => {
  const id = typeof row.id === "string" ? row.id : "";
  const storageAddonId = typeof row.storage_addon_id === "string" ? row.storage_addon_id : "";
  if (!id || !storageAddonId) return null;
  return {
    id,
    storageAddonId,
    offerId: typeof row.offer_id === "string" ? row.offer_id : null,
    stripeSubscriptionItemId:
      typeof row.stripe_subscription_item_id === "string" ? row.stripe_subscription_item_id : null,
    storageLimitBytes: Math.max(0, toNumber(row.storage_limit_bytes)),
    quantity: Math.max(1, toNumber(row.quantity) || 1),
    recurringPriceCents: Math.max(0, toNumber(row.recurring_price_cents)),
    status: typeof row.status === "string" ? row.status : null,
  };
};

const logProfileStateError = async ({
  req,
  user,
  routeLabel,
  error,
}: {
  req: NextApiRequest;
  user: AuthenticatedApiUser;
  routeLabel: string;
  error: unknown;
}) => {
  await logApiRouteException({
    req,
    user,
    routeLabel,
    error,
  });
};

const createQuotaSummaryFromRow = (
  row: QuotaRpcRow,
  fallbackTotalLimitBytes: number
): MediaStorageQuotaSummary => {
  const totalLimitBytes = Math.max(0, toNumber(row.total_limit_bytes) || fallbackTotalLimitBytes);
  const usedBytes = Math.max(0, toNumber(row.used_bytes));
  return {
    usedBytes,
    baseLimitBytes: Math.max(0, toNumber(row.base_limit_bytes)),
    addonLimitBytes: Math.max(0, toNumber(row.addon_limit_bytes)),
    totalLimitBytes,
    remainingBytes: Math.max(0, toNumber(row.remaining_bytes)),
    isOverLimit: row.is_over_limit === true,
  };
};

const loadQuotaSummary = async ({
  bearerToken,
  fallbackTotalLimitBytes,
}: {
  bearerToken: string;
  fallbackTotalLimitBytes: number;
}): Promise<MediaStorageQuotaSummary | null> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  });
  const { data, error } = await supabaseUserClient.rpc("get_media_storage_quota_summary");
  if (error) {
    throw new Error(error.message || "Unable to load media storage quota summary.");
  }

  const row = Array.isArray(data) ? ((data[0] ?? null) as QuotaRpcRow | null) : null;
  if (!row) return null;
  return createQuotaSummaryFromRow(row, fallbackTotalLimitBytes);
};

const loadProfileBillingState = async ({
  req,
  user,
  supabaseAdmin,
  prefetchedBillingProfile,
  prefetchedBillingContract,
}: {
  req: NextApiRequest;
  user: AuthenticatedApiUser;
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  prefetchedBillingProfile?: PrefetchedRow<ProfileBillingProfileRow>;
  prefetchedBillingContract?: PrefetchedRow<ProfileBillingContractRow>;
}): Promise<ProfileBillingState> => {
  const [
    billingProfileResponse,
    billingContractResponse,
    billingActivityResponse,
    activeStorageAddonsResponse,
  ] = await Promise.all([
    prefetchedBillingProfile
      ? Promise.resolve({ data: prefetchedBillingProfile.data, error: null })
      : supabaseAdmin
          .from("billing_profiles")
          .select(PROFILE_BILLING_PROFILE_COLUMNS)
          .eq("user_id", user.id)
          .maybeSingle(),
    prefetchedBillingContract
      ? Promise.resolve({ data: prefetchedBillingContract.data, error: null })
      : supabaseAdmin
          .from("billing_subscription_contracts")
          .select(PROFILE_BILLING_CONTRACT_COLUMNS)
          .eq("user_id", user.id)
          .is("ended_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
    supabaseAdmin
      .from("ai_credit_ledger")
      .select("id, change_cents, reason, source, source_ref, metadata, created_at")
      .eq("user_id", user.id)
      .in("source", [...CUSTOMER_CREDIT_ACTIVITY_SOURCES])
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("billing_subscription_storage_addons")
      .select(
        "id, storage_addon_id, offer_id, stripe_subscription_item_id, storage_limit_bytes, quantity, recurring_price_cents, status"
      )
      .eq("user_id", user.id)
      .is("ended_at", null)
      .in("status", [...CURRENT_BILLABLE_STORAGE_ADDON_STATUSES]),
  ]);

  let billingProfile: ProfileBillingProfileRow | null = null;
  if (billingProfileResponse.error) {
    await logProfileStateError({
      req,
      user,
      routeLabel: "billing/account-summary.profile-state.profile",
      error: billingProfileResponse.error,
    });
  } else {
    billingProfile = (billingProfileResponse.data as ProfileBillingProfileRow | null) ?? null;
  }

  let billingContract: ProfileBillingContractRow | null = null;
  if (billingContractResponse.error) {
    await logProfileStateError({
      req,
      user,
      routeLabel: "billing/account-summary.profile-state.contract",
      error: billingContractResponse.error,
    });
  } else {
    billingContract = (billingContractResponse.data as ProfileBillingContractRow | null) ?? null;
  }

  let billingActivity: ProfileBillingLedgerRow[] = [];
  if (billingActivityResponse.error) {
    await logProfileStateError({
      req,
      user,
      routeLabel: "billing/account-summary.profile-state.activity",
      error: billingActivityResponse.error,
    });
  } else {
    billingActivity = Array.isArray(billingActivityResponse.data)
      ? (billingActivityResponse.data as ProfileBillingLedgerRow[])
      : [];
  }

  let activeStorageAddons: ProfileBillingStorageAddon[] = [];
  if (activeStorageAddonsResponse.error) {
    await logProfileStateError({
      req,
      user,
      routeLabel: "billing/account-summary.profile-state.storage-addons",
      error: activeStorageAddonsResponse.error,
    });
  } else {
    activeStorageAddons = Array.isArray(activeStorageAddonsResponse.data)
      ? (activeStorageAddonsResponse.data as ProfileBillingStorageAddonRow[])
          .map(normalizeStorageAddonRow)
          .filter((addon): addon is ProfileBillingStorageAddon => Boolean(addon))
      : [];
  }

  return {
    billingProfile,
    billingContract,
    billingActivity,
    activeStorageAddons,
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/account-summary.auth",
    });
    return res.status(500).json({
      error: "Unable to load billing account summary.",
    });
  }
  if (!user) {
    return;
  }

  try {
    const bearerToken = parseBearerToken(req.headers.authorization);
    const supabaseAdmin = getSupabaseAdmin();
    const includeProfileState = shouldIncludeProfileState(req);
    const billingContractSelectColumns = includeProfileState
      ? PROFILE_BILLING_CONTRACT_COLUMNS
      : CURRENT_SUBSCRIPTION_CONTRACT_SUMMARY_COLUMNS;
    const billingProfileSelectColumns = includeProfileState
      ? PROFILE_BILLING_PROFILE_COLUMNS
      : BILLING_PROFILE_PLAN_COLUMNS;
    const [billingContractResponse, billingProfileResponse, billingCatalog] = await Promise.all([
      supabaseAdmin
        .from("billing_subscription_contracts")
        .select(billingContractSelectColumns)
        .eq("user_id", user.id)
        .is("ended_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("billing_profiles")
        .select(billingProfileSelectColumns)
        .eq("user_id", user.id)
        .maybeSingle(),
      loadBillingCatalogSnapshot(supabaseAdmin),
    ]);

    if (billingContractResponse.error) {
      throw new Error(
        billingContractResponse.error.message || "Unable to load current billing contract."
      );
    }
    if (billingProfileResponse.error) {
      throw new Error(billingProfileResponse.error.message || "Unable to load billing profile.");
    }

    const contractRow = billingContractResponse.data as
      | (CurrentSubscriptionContractRow & Partial<ProfileBillingContractRow>)
      | null;
    const profileRow = billingProfileResponse.data as
      | (BillingProfilePlanRow & Partial<ProfileBillingProfileRow>)
      | null;
    const contractPlanId = contractRow?.plan_id ?? null;
    const contractMonthlyCreditsCents = normalizeCreditCents(
      contractRow?.monthly_credits_cents ?? null
    );
    const billingPlanId = profileRow?.plan_id ?? null;
    const normalizedPlanId = normalizePlanId(contractPlanId ?? billingPlanId ?? "free");
    const planView = buildPlanView({
      planId: normalizedPlanId,
      plans: billingCatalog.plans,
    });
    let quotaSummary: MediaStorageQuotaSummary | null = null;
    if (bearerToken) {
      try {
        quotaSummary = await loadQuotaSummary({
          bearerToken,
          fallbackTotalLimitBytes: planView.storageLimitBytes,
        });
      } catch (error) {
        await logApiRouteException({
          req,
          error,
          routeLabel: "billing/account-summary.quota",
          user,
        });
      }
    }
    const profileState = includeProfileState
      ? await loadProfileBillingState({
          req,
          user,
          supabaseAdmin,
          prefetchedBillingProfile: { data: profileRow as ProfileBillingProfileRow | null },
          prefetchedBillingContract: { data: contractRow as ProfileBillingContractRow | null },
        })
      : null;

    return res.status(200).json({
      userId: user.id,
      resolvedPlan: {
        id: planView.id,
        label: planView.displayName,
        className: planView.className,
        monthlyCreditsCents: contractMonthlyCreditsCents ?? planView.monthlyCreditsCents,
      },
      quotaStatus: quotaSummary ? "available" : "unavailable",
      quotaSummary,
      profileState,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/account-summary",
      user,
    });
    return res.status(500).json({
      error: "Unable to load billing account summary.",
    });
  }
}
