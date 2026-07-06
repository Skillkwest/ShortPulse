import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  addMonthsUtc,
  ANNUAL_CONTRACT_MONTHLY_GRANT_SOURCE,
  BILLING_CONTRACT_SOURCE_INTERNAL_COMP,
  BILLING_CONTRACT_SOURCE_STRIPE,
  BILLING_INTERVAL_YEAR,
  buildAnnualContractMonthlyGrantRef,
  buildInternalCompRenewalRef,
  INTERNAL_COMP_RENEWAL_GRANT_SOURCE,
  isUniqueViolationError,
} from "../../../../lib/server/api/billingContracts";
import { grantAccountCredits } from "../../../../lib/server/api/creditLedger";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type BillingContractRow = {
  id: string;
  user_id: string;
  plan_id: string | null;
  stripe_customer_id: string | null;
  monthly_credits_cents: number | string | null;
  billing_interval: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  last_credit_grant_at: string | null;
  next_credit_grant_at: string | null;
  status: string | null;
  contract_source: string | null;
};

const secureCompare = (left: string, right: string): boolean => {
  try {
    return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
  } catch {
    return false;
  }
};

const readHeader = (req: NextApiRequest, name: string): string | null => {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return typeof raw === "string" ? raw : null;
};

const readBearerToken = (req: NextApiRequest): string | null => {
  const authHeader = readHeader(req, "authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.trim().toLowerCase() !== "bearer") return null;
  const trimmed = token.trim();
  return trimmed.length ? trimmed : null;
};

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
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

const isRenewalRunnerEnabled = (): boolean =>
  parseBooleanEnv(process.env.SHORTPULSE_INTERNAL_BILLING_RENEWALS_ENABLED, false);

const isDuplicateGrantResult = (ledgerResult: {
  error?: { code?: string; message?: string } | null;
  status?: string | null;
}): boolean =>
  ledgerResult.status === "duplicate" || isUniqueViolationError(ledgerResult.error ?? null);

const SUBSCRIPTION_CREDIT_LIFESPAN_DAYS = 60;

const resolveSubscriptionCreditExpiresAt = () =>
  new Date(Date.now() + SUBSCRIPTION_CREDIT_LIFESPAN_DAYS * 24 * 60 * 60 * 1000).toISOString();

const readBatchSize = (): number => {
  const parsed = Number(process.env.SHORTPULSE_INTERNAL_BILLING_RENEWAL_BATCH_SIZE ?? 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(500, Math.trunc(parsed)));
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isRenewalRunnerEnabled()) {
    return res.status(404).json({ error: "Not found" });
  }

  const headerSecret = readHeader(req, "x-shortpulse-cron-secret");
  const bearerToken = readBearerToken(req);
  const expectedSecrets = [
    process.env.SHORTPULSE_INTERNAL_BILLING_RENEWALS_CRON_SECRET,
    process.env.CRON_SECRET,
  ]
    .map((value) => value?.trim() ?? null)
    .filter((value): value is string => Boolean(value));

  const isAuthorized =
    expectedSecrets.length > 0 &&
    expectedSecrets.some((expected) => {
      const headerMatches = headerSecret !== null && secureCompare(headerSecret, expected);
      const bearerMatches = bearerToken !== null && secureCompare(bearerToken, expected);
      return headerMatches || bearerMatches;
    });

  if (!isAuthorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = new Date();
    const supabaseAdmin = getSupabaseAdmin();
    const batchSize = readBatchSize();
    const contractsResult = await supabaseAdmin
      .from("billing_subscription_contracts")
      .select(
        "id, user_id, plan_id, stripe_customer_id, monthly_credits_cents, billing_interval, current_period_start, current_period_end, last_credit_grant_at, next_credit_grant_at, status, contract_source"
      )
      .eq("contract_source", BILLING_CONTRACT_SOURCE_INTERNAL_COMP)
      .eq("status", "active")
      .is("ended_at", null)
      .order("current_period_end", { ascending: true })
      .limit(batchSize);

    if (contractsResult.error) {
      throw new Error(contractsResult.error.message || "Failed to load internal comp contracts.");
    }

    const contracts = (contractsResult.data ?? []) as BillingContractRow[];
    let dueContracts = 0;
    let advancedContracts = 0;
    let grantsAttempted = 0;
    let grantsInserted = 0;
    let duplicateGrants = 0;
    let annualDueContracts = 0;
    let annualAdvancedContracts = 0;
    const skippedMissingPeriod: string[] = [];
    const errors: Array<{ contractId: string; message: string }> = [];

    for (const contract of contracts) {
      const currentPeriodStart = asDate(contract.current_period_start);
      const currentPeriodEnd = asDate(contract.current_period_end);
      if (!currentPeriodStart || !currentPeriodEnd) {
        skippedMissingPeriod.push(contract.id);
        continue;
      }
      if (currentPeriodEnd.getTime() > now.getTime()) continue;

      dueContracts += 1;
      let periodStart = new Date(currentPeriodStart.getTime());
      let periodEnd = new Date(currentPeriodEnd.getTime());
      let periodsAdvanced = 0;

      while (periodEnd.getTime() <= now.getTime()) {
        const sourceRef = buildInternalCompRenewalRef({
          contractId: contract.id,
          periodStartIso: periodStart.toISOString(),
        });
        grantsAttempted += 1;
        const ledgerResult = await grantAccountCredits({
          userId: contract.user_id,
          amountCents: asCents(contract.monthly_credits_cents),
          reason: `Internal comp monthly renewal for ${contract.plan_id ?? "unknown plan"}`,
          source: INTERNAL_COMP_RENEWAL_GRANT_SOURCE,
          sourceRef,
          creditKind: "subscription_allocation",
          expiresAt: resolveSubscriptionCreditExpiresAt(),
          metadata: {
            contract_id: contract.id,
            contract_source: contract.contract_source,
            plan_id: contract.plan_id,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
          },
          createdBy: null,
        });

        if (ledgerResult.error && !isUniqueViolationError(ledgerResult.error)) {
          errors.push({
            contractId: contract.id,
            message: ledgerResult.error.message || "Renewal grant failed.",
          });
          break;
        }

        if (isDuplicateGrantResult(ledgerResult)) {
          duplicateGrants += 1;
        } else {
          grantsInserted += 1;
        }

        periodStart = new Date(periodEnd.getTime());
        periodEnd = addMonthsUtc(periodEnd, 1);
        periodsAdvanced += 1;
      }

      if (!periodsAdvanced) continue;

      const contractUpdate = await supabaseAdmin
        .from("billing_subscription_contracts")
        .update({
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_by_user_id: null,
        })
        .eq("id", contract.id);
      if (contractUpdate.error) {
        errors.push({
          contractId: contract.id,
          message: contractUpdate.error.message || "Failed to advance contract period.",
        });
        continue;
      }

      const profileUpdate = await supabaseAdmin.from("billing_profiles").upsert(
        {
          user_id: contract.user_id,
          plan_id: contract.plan_id ?? "free",
          stripe_customer_id: contract.stripe_customer_id,
          stripe_subscription_id: null,
          subscription_status: "active",
          current_period_end: periodEnd.toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );
      if (profileUpdate.error) {
        errors.push({
          contractId: contract.id,
          message: profileUpdate.error.message || "Failed to advance billing profile period.",
        });
        continue;
      }

      advancedContracts += 1;
    }

    const annualContractsResult = await supabaseAdmin
      .from("billing_subscription_contracts")
      .select(
        "id, user_id, plan_id, stripe_customer_id, monthly_credits_cents, billing_interval, current_period_start, current_period_end, last_credit_grant_at, next_credit_grant_at, status, contract_source"
      )
      .eq("contract_source", BILLING_CONTRACT_SOURCE_STRIPE)
      .eq("billing_interval", BILLING_INTERVAL_YEAR)
      .eq("status", "active")
      .is("ended_at", null)
      .not("next_credit_grant_at", "is", null)
      .lte("next_credit_grant_at", now.toISOString())
      .order("next_credit_grant_at", { ascending: true })
      .limit(batchSize);

    if (annualContractsResult.error) {
      throw new Error(
        annualContractsResult.error.message || "Failed to load annual billing contracts."
      );
    }

    const annualContracts = (annualContractsResult.data ?? []) as BillingContractRow[];
    for (const contract of annualContracts) {
      const currentPeriodEnd = asDate(contract.current_period_end);
      const nextCreditGrantAt = asDate(contract.next_credit_grant_at);
      if (!currentPeriodEnd || !nextCreditGrantAt) {
        skippedMissingPeriod.push(contract.id);
        continue;
      }

      annualDueContracts += 1;
      let nextGrantAt = new Date(nextCreditGrantAt.getTime());
      let grantsAppliedForContract = 0;

      while (
        nextGrantAt.getTime() <= now.getTime() &&
        nextGrantAt.getTime() < currentPeriodEnd.getTime()
      ) {
        const sourceRef = buildAnnualContractMonthlyGrantRef({
          contractId: contract.id,
          grantAtIso: nextGrantAt.toISOString(),
        });
        grantsAttempted += 1;
        const ledgerResult = await grantAccountCredits({
          userId: contract.user_id,
          amountCents: asCents(contract.monthly_credits_cents),
          reason: `Annual monthly credit allocation for ${contract.plan_id ?? "unknown plan"}`,
          source: ANNUAL_CONTRACT_MONTHLY_GRANT_SOURCE,
          sourceRef,
          creditKind: "subscription_allocation",
          expiresAt: resolveSubscriptionCreditExpiresAt(),
          metadata: {
            contract_id: contract.id,
            contract_source: contract.contract_source,
            plan_id: contract.plan_id,
            billing_interval: contract.billing_interval,
            grant_at: nextGrantAt.toISOString(),
            current_period_end: currentPeriodEnd.toISOString(),
          },
          createdBy: null,
        });

        if (ledgerResult.error && !isUniqueViolationError(ledgerResult.error)) {
          errors.push({
            contractId: contract.id,
            message: ledgerResult.error.message || "Annual monthly allocation failed.",
          });
          break;
        }

        if (isDuplicateGrantResult(ledgerResult)) {
          duplicateGrants += 1;
        } else {
          grantsInserted += 1;
        }

        nextGrantAt = addMonthsUtc(nextGrantAt, 1);
        grantsAppliedForContract += 1;
      }

      if (!grantsAppliedForContract) {
        continue;
      }

      const nextScheduledGrant =
        nextGrantAt.getTime() < currentPeriodEnd.getTime() ? nextGrantAt.toISOString() : null;
      const lastGrantAt = addMonthsUtc(nextGrantAt, -1).toISOString();
      const updateResult = await supabaseAdmin
        .from("billing_subscription_contracts")
        .update({
          last_credit_grant_at: lastGrantAt,
          next_credit_grant_at: nextScheduledGrant,
          updated_by_user_id: null,
        })
        .eq("id", contract.id);

      if (updateResult.error) {
        errors.push({
          contractId: contract.id,
          message:
            updateResult.error.message || "Failed to advance annual credit allocation cursor.",
        });
        continue;
      }

      annualAdvancedContracts += 1;
    }

    return res.status(errors.length > 0 ? 207 : 200).json({
      ok: errors.length === 0,
      scannedContracts: contracts.length,
      scannedAnnualContracts: annualContractsResult.data?.length ?? 0,
      dueContracts,
      advancedContracts,
      annualDueContracts,
      annualAdvancedContracts,
      grantsAttempted,
      grantsInserted,
      duplicateGrants,
      skippedMissingPeriod,
      errors,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      routeLabel: "internal/billing-contract-renewals/run",
      error,
      metadata: {
        enabled: isRenewalRunnerEnabled(),
      },
    });

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal billing renewal run failed.",
    });
  }
}
