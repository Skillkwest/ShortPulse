import type { PostgrestError } from "@supabase/supabase-js";

export const BILLING_CONTRACT_SOURCE_STRIPE = "stripe" as const;
export const BILLING_CONTRACT_SOURCE_INTERNAL_COMP = "internal_comp" as const;
export const BILLING_INTERVAL_MONTH = "month" as const;
export const BILLING_INTERVAL_YEAR = "year" as const;
export type BillingInterval = typeof BILLING_INTERVAL_MONTH | typeof BILLING_INTERVAL_YEAR;

export type BillingContractSource =
  | typeof BILLING_CONTRACT_SOURCE_STRIPE
  | typeof BILLING_CONTRACT_SOURCE_INTERNAL_COMP;

export const INTERNAL_COMP_PLAN_IDS = ["media", "studio", "business"] as const;

export type InternalCompPlanId = (typeof INTERNAL_COMP_PLAN_IDS)[number];

export const INTERNAL_COMP_INITIAL_GRANT_SOURCE = "internal_contract_initial";
export const INTERNAL_COMP_CHANGE_GRANT_SOURCE = "internal_contract_change";
export const INTERNAL_COMP_RENEWAL_GRANT_SOURCE = "internal_contract_renewal";
export const ANNUAL_CONTRACT_MONTHLY_GRANT_SOURCE = "annual_contract_monthly_allocation";

export const isInternalCompPlanId = (value: string): value is InternalCompPlanId =>
  INTERNAL_COMP_PLAN_IDS.includes(value as InternalCompPlanId);

export const buildInternalCompOfferId = (planId: InternalCompPlanId): string =>
  `${planId}__internal_comp`;

export const addMonthsUtc = (input: Date, months: number): Date => {
  const next = new Date(input.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

export const isUniqueViolationError = (error: PostgrestError | { code?: string } | null): boolean =>
  String(error?.code ?? "").toUpperCase() === "23505";

export const buildInternalCompGrantRef = (params: {
  userId: string;
  periodStartIso: string;
  planId: string;
  kind: "initial" | "change";
}): string =>
  `internal_comp:${params.kind}:${params.userId}:${params.periodStartIso}:${params.planId}`;

export const buildInternalCompRenewalRef = (params: {
  contractId: string;
  periodStartIso: string;
}): string => `internal_comp:renewal:${params.contractId}:${params.periodStartIso}`;

export const buildAnnualContractMonthlyGrantRef = (params: {
  contractId: string;
  grantAtIso: string;
}): string => `annual_contract:monthly_grant:${params.contractId}:${params.grantAtIso}`;
