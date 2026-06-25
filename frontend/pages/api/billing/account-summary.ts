/**
 * Authenticated account billing summary route.
 * Resolves current plan presentation and media-storage quota behind the app API boundary.
 */
import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import { buildPlanView, normalizePlanId } from "../../../features/billing/catalog";
import type { MediaStorageQuotaSummary } from "../../../features/billing/storage";
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

type QuotaRpcRow = {
  used_bytes: number | string | null;
  base_limit_bytes: number | string | null;
  addon_limit_bytes: number | string | null;
  total_limit_bytes: number | string | null;
  remaining_bytes: number | string | null;
  is_over_limit: boolean | null;
};

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
    const [billingContractResponse, billingProfileResponse, billingCatalog] = await Promise.all([
      supabaseAdmin
        .from("billing_subscription_contracts")
        .select("plan_id, monthly_credits_cents")
        .eq("user_id", user.id)
        .is("ended_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.from("billing_profiles").select("plan_id").eq("user_id", user.id).maybeSingle(),
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

    const contractRow = billingContractResponse.data as CurrentSubscriptionContractRow | null;
    const profileRow = billingProfileResponse.data as BillingProfilePlanRow | null;
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
