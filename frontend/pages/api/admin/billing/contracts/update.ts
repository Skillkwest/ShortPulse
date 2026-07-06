import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import {
  addMonthsUtc,
  BILLING_CONTRACT_SOURCE_INTERNAL_COMP,
  buildInternalCompGrantRef,
  buildInternalCompOfferId,
  INTERNAL_COMP_CHANGE_GRANT_SOURCE,
  INTERNAL_COMP_INITIAL_GRANT_SOURCE,
  isInternalCompPlanId,
  isUniqueViolationError,
} from "../../../../../lib/server/api/billingContracts";
import { resolveDefaultPlanConcurrencyLimit } from "../../../../../lib/billing/planConcurrency";
import { grantAccountCredits } from "../../../../../lib/server/api/creditLedger";
import { getSupabaseAdmin } from "../../../../../lib/server/api/supabaseAdmin";

type ContractAction = "grant_internal_comp" | "revoke_internal_comp";

type UpdateBillingContractRequest = {
  userId?: string;
  action?: ContractAction;
  planId?: string;
  grantReason?: string;
  allowStripeTakeover?: boolean;
};

type BillingProfileRow = {
  user_id: string;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
};

type BillingContractRow = {
  id: string;
  plan_id: string | null;
  offer_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  recurring_price_cents: number | string | null;
  monthly_credits_cents: number | string | null;
  storage_limit_bytes: number | string | null;
  max_concurrent_generations: number | string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  contract_source: string | null;
};

type BillingOfferRow = {
  id: string;
  plan_id: string;
  recurring_price_cents: number | string;
  monthly_credits_cents: number | string;
  storage_limit_bytes: number | string;
  max_concurrent_generations: number | string | null;
};

const DEFAULT_GRANT_REASON = "Admin internal comp override";
const SUBSCRIPTION_CREDIT_LIFESPAN_DAYS = 60;

const resolveSubscriptionCreditExpiresAt = () =>
  new Date(Date.now() + SUBSCRIPTION_CREDIT_LIFESPAN_DAYS * 24 * 60 * 60 * 1000).toISOString();

const asSingleString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

const asCents = (value: number | string | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

const asDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/billing/contracts/update.auth",
    });
    return res.status(500).json({
      error: "Billing contract update failed.",
    });
  }
  if (!adminUser) return;

  const {
    userId,
    action,
    planId: rawPlanId,
    grantReason,
    allowStripeTakeover,
  } = (req.body ?? {}) as UpdateBillingContractRequest;

  const normalizedUserId = asSingleString(userId).trim();
  const normalizedPlanId = asSingleString(rawPlanId).trim().toLowerCase();
  const normalizedReason = asSingleString(grantReason).trim() || DEFAULT_GRANT_REASON;

  if (!normalizedUserId) {
    return res.status(400).json({ error: "userId is required." });
  }
  if (action !== "grant_internal_comp" && action !== "revoke_internal_comp") {
    return res.status(400).json({ error: "A valid action is required." });
  }
  if (action === "grant_internal_comp" && !isInternalCompPlanId(normalizedPlanId)) {
    return res.status(400).json({ error: "planId must be media, studio, or business." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const userResult = await supabaseAdmin.auth.admin.getUserById(normalizedUserId);
    if (userResult.error) {
      throw new Error(userResult.error.message || "Failed to load target user.");
    }
    if (!userResult.data.user) {
      return res.status(404).json({ error: "User not found." });
    }

    const [profileResult, contractResult] = await Promise.all([
      supabaseAdmin
        .from("billing_profiles")
        .select(
          "user_id, plan_id, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end"
        )
        .eq("user_id", normalizedUserId)
        .maybeSingle(),
      supabaseAdmin
        .from("billing_subscription_contracts")
        .select(
          "id, plan_id, offer_id, stripe_customer_id, stripe_subscription_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, max_concurrent_generations, status, current_period_start, current_period_end, contract_source"
        )
        .eq("user_id", normalizedUserId)
        .is("ended_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileResult.error || contractResult.error) {
      throw new Error(
        [profileResult.error?.message, contractResult.error?.message].filter(Boolean).join(" | ") ||
          "Failed to load current billing state."
      );
    }

    const billingProfile = (profileResult.data as BillingProfileRow | null) ?? null;
    const currentContract = (contractResult.data as BillingContractRow | null) ?? null;
    const hasStripeLink = Boolean(
      currentContract?.stripe_subscription_id || billingProfile?.stripe_subscription_id
    );

    if (hasStripeLink && !allowStripeTakeover) {
      return res.status(409).json({
        error:
          "This account is still linked to a Stripe subscription. Handle Stripe first, then retry with the advanced Stripe cleanup option if you intentionally want ShortPulse to clear the saved Stripe link.",
        code: "stripe_takeover_required",
      });
    }

    const preservedStripeCustomerId =
      billingProfile?.stripe_customer_id ?? currentContract?.stripe_customer_id ?? null;

    if (action === "revoke_internal_comp") {
      if (currentContract?.contract_source !== BILLING_CONTRACT_SOURCE_INTERNAL_COMP) {
        return res.status(400).json({ error: "This account is not currently payment exempt." });
      }

      const nowIso = new Date().toISOString();
      const { error: endContractError } = await supabaseAdmin
        .from("billing_subscription_contracts")
        .update({
          ended_at: nowIso,
          status: "inactive",
          updated_by_user_id: adminUser.id,
        })
        .eq("id", currentContract.id);
      if (endContractError) {
        throw new Error(endContractError.message || "Failed to remove payment-exempt access.");
      }

      const { error: profileUpsertError } = await supabaseAdmin.from("billing_profiles").upsert(
        {
          user_id: normalizedUserId,
          plan_id: "free",
          stripe_customer_id: preservedStripeCustomerId,
          stripe_subscription_id: null,
          subscription_status: "inactive",
          current_period_end: null,
        },
        {
          onConflict: "user_id",
        }
      );
      if (profileUpsertError) {
        throw new Error(
          profileUpsertError.message || "Failed to return the account to baseline access."
        );
      }

      return res.status(200).json({
        ok: true,
        action: "revoked_internal_comp",
        userId: normalizedUserId,
        planId: "free",
        creditsGrantedCents: 0,
      });
    }

    const effectivePlanId = normalizedPlanId as Parameters<typeof buildInternalCompOfferId>[0];
    const internalOfferId = buildInternalCompOfferId(effectivePlanId);
    const offerResult = await supabaseAdmin
      .from("billing_plan_offers")
      .select(
        "id, plan_id, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, max_concurrent_generations"
      )
      .eq("id", internalOfferId)
      .maybeSingle();
    if (offerResult.error) {
      throw new Error(offerResult.error.message || "Failed to load the payment-exempt plan.");
    }

    const offer = (offerResult.data as BillingOfferRow | null) ?? null;
    if (!offer) {
      return res.status(500).json({
        error: `Missing payment-exempt offer for plan ${effectivePlanId}.`,
      });
    }
    const nextMonthlyCredits = asCents(offer.monthly_credits_cents);
    const nextStorageLimitBytes = asCents(offer.storage_limit_bytes);
    const nextMaxConcurrentGenerations = asCents(
      offer.max_concurrent_generations ?? resolveDefaultPlanConcurrencyLimit(effectivePlanId)
    );

    if (
      currentContract?.contract_source === BILLING_CONTRACT_SOURCE_INTERNAL_COMP &&
      currentContract.plan_id === effectivePlanId &&
      currentContract.status === "active" &&
      asCents(currentContract.monthly_credits_cents) === nextMonthlyCredits &&
      asCents(currentContract.storage_limit_bytes) === nextStorageLimitBytes &&
      asCents(currentContract.max_concurrent_generations) === nextMaxConcurrentGenerations
    ) {
      return res.status(200).json({
        ok: true,
        action: "unchanged_internal_comp",
        userId: normalizedUserId,
        planId: effectivePlanId,
        creditsGrantedCents: 0,
        currentPeriodEnd: currentContract.current_period_end,
      });
    }

    const now = new Date();
    const previousInternalPeriodStart =
      currentContract?.contract_source === BILLING_CONTRACT_SOURCE_INTERNAL_COMP
        ? asDate(currentContract.current_period_start)
        : null;
    const previousInternalPeriodEnd =
      currentContract?.contract_source === BILLING_CONTRACT_SOURCE_INTERNAL_COMP
        ? asDate(currentContract.current_period_end)
        : null;
    const carryForwardPeriod =
      previousInternalPeriodStart &&
      previousInternalPeriodEnd &&
      previousInternalPeriodEnd.getTime() > now.getTime();

    const currentPeriodStart = carryForwardPeriod ? previousInternalPeriodStart : now;
    const currentPeriodEnd = carryForwardPeriod ? previousInternalPeriodEnd : addMonthsUtc(now, 1);
    const previousInternalMonthlyCredits = carryForwardPeriod
      ? asCents(currentContract?.monthly_credits_cents)
      : 0;
    const creditsGrantedCents = Math.max(0, nextMonthlyCredits - previousInternalMonthlyCredits);
    const grantKind = previousInternalMonthlyCredits > 0 ? "change" : "initial";
    const grantSource =
      previousInternalMonthlyCredits > 0
        ? INTERNAL_COMP_CHANGE_GRANT_SOURCE
        : INTERNAL_COMP_INITIAL_GRANT_SOURCE;
    const grantSourceRef = buildInternalCompGrantRef({
      userId: normalizedUserId,
      periodStartIso: currentPeriodStart.toISOString(),
      planId: effectivePlanId,
      kind: grantKind,
    });

    if (currentContract) {
      const { error: endExistingContractError } = await supabaseAdmin
        .from("billing_subscription_contracts")
        .update({
          ended_at: now.toISOString(),
          status: "inactive",
          updated_by_user_id: adminUser.id,
        })
        .eq("id", currentContract.id);
      if (endExistingContractError) {
        throw new Error(endExistingContractError.message || "Failed to close current contract.");
      }
    }

    const { error: insertContractError } = await supabaseAdmin
      .from("billing_subscription_contracts")
      .insert({
        user_id: normalizedUserId,
        plan_id: effectivePlanId,
        offer_id: offer.id,
        stripe_customer_id: preservedStripeCustomerId,
        stripe_subscription_id: null,
        stripe_price_id: null,
        recurring_price_cents: asCents(offer.recurring_price_cents),
        monthly_credits_cents: nextMonthlyCredits,
        storage_limit_bytes: nextStorageLimitBytes,
        max_concurrent_generations: nextMaxConcurrentGenerations,
        status: "active",
        current_period_start: currentPeriodStart.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        cancel_at_period_end: false,
        started_at: now.toISOString(),
        contract_source: BILLING_CONTRACT_SOURCE_INTERNAL_COMP,
        granted_by_user_id: adminUser.id,
        grant_reason: normalizedReason,
        updated_by_user_id: adminUser.id,
      });
    if (insertContractError) {
      throw new Error(insertContractError.message || "Failed to save payment-exempt access.");
    }

    const { error: profileUpsertError } = await supabaseAdmin.from("billing_profiles").upsert(
      {
        user_id: normalizedUserId,
        plan_id: effectivePlanId,
        stripe_customer_id: preservedStripeCustomerId,
        stripe_subscription_id: null,
        subscription_status: "active",
        current_period_end: currentPeriodEnd.toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );
    if (profileUpsertError) {
      throw new Error(profileUpsertError.message || "Failed to update billing profile.");
    }

    if (creditsGrantedCents > 0) {
      const ledgerResult = await grantAccountCredits({
        userId: normalizedUserId,
        amountCents: creditsGrantedCents,
        reason:
          grantKind === "change"
            ? `Payment-exempt plan changed to ${effectivePlanId}`
            : `Payment-exempt access granted for ${effectivePlanId}`,
        source: grantSource,
        sourceRef: grantSourceRef,
        creditKind: "subscription_allocation",
        expiresAt: resolveSubscriptionCreditExpiresAt(),
        metadata: {
          admin_user_id: adminUser.id,
          admin_email: adminUser.email ?? null,
          contract_source: BILLING_CONTRACT_SOURCE_INTERNAL_COMP,
          grant_reason: normalizedReason,
          plan_id: effectivePlanId,
          period_start: currentPeriodStart.toISOString(),
          period_end: currentPeriodEnd.toISOString(),
        },
        createdBy: adminUser.id,
      });

      if (ledgerResult.error && !isUniqueViolationError(ledgerResult.error)) {
        throw new Error(
          ledgerResult.error.message || "Failed to seed credits for the payment-exempt plan."
        );
      }
    }

    return res.status(200).json({
      ok: true,
      action: "granted_internal_comp",
      userId: normalizedUserId,
      planId: effectivePlanId,
      creditsGrantedCents,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/billing/contracts/update",
      user: adminUser,
      metadata: {
        target_user_id: normalizedUserId,
        action,
        plan_id: normalizedPlanId || null,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Billing contract update failed.",
    });
  }
}
