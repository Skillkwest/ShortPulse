/**
 * Stripe customer sync helpers for billing entry routes and account/admin mutations.
 * Ensures every authenticated user has a durable Stripe customer id mapped in billing_profiles
 * and keeps basic identity fields aligned with Supabase auth.
 */
import { getSupabaseAdmin } from "./supabaseAdmin";
import { stripeGet, stripePostForm } from "./stripe";

type StripeCustomerResponse = {
  id: string;
  email?: string | null;
  name?: string | null;
  deleted?: boolean;
  metadata?: Record<string, string | null> | null;
};

export type StripeSubscriptionResponse = {
  id: string;
  customer?: string | { id?: string | null } | null;
  items?: {
    data?: Array<{
      id?: string | null;
      quantity?: number | null;
      price?: {
        id?: string | null;
      } | null;
    }>;
  };
};

type EnsureStripeCustomerParams = {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  allowMetadataRepair?: boolean;
};

export type StripeCustomerSyncResult = {
  stripeCustomerId: string;
  email: string | null;
  name: string | null;
  created: boolean;
  updated: boolean;
};

type BillingProfileSnapshot = {
  stripe_customer_id: string | null;
  plan_id: string | null;
  subscription_status: string | null;
};

type BillingContractSnapshot = {
  id: string;
  stripe_customer_id: string | null;
  plan_id: string | null;
  status: string | null;
  contract_source: "stripe" | "internal_comp" | null;
};

export class StripeCustomerOwnershipMismatchError extends Error {
  constructor(message = "Stripe customer ownership mismatch detected.") {
    super(message);
    this.name = "StripeCustomerOwnershipMismatchError";
  }
}

export class StripeSubscriptionOwnershipMismatchError extends Error {
  constructor(message = "Stripe subscription ownership mismatch detected.") {
    super(message);
    this.name = "StripeSubscriptionOwnershipMismatchError";
  }
}

const normalizeEmail = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const normalizeDisplayName = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const normalizeMetadataUserId = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const normalizeStripeCustomerId = (
  value: string | { id?: string | null } | null | undefined
): string | null => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (value && typeof value === "object") {
    const nested = typeof value.id === "string" ? value.id.trim() : "";
    return nested.length > 0 ? nested : null;
  }
  return null;
};

const isStripeCustomerMissingError = (message: unknown): boolean => {
  if (typeof message !== "string") return false;
  const normalized = message.toLowerCase();
  return normalized.includes("no such customer") || normalized.includes("does not exist");
};

const isStripeCustomerModeMismatchError = (message: unknown): boolean => {
  if (typeof message !== "string") return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("test mode") &&
    normalized.includes("live mode") &&
    (normalized.includes("no such customer") || normalized.includes("does not exist"))
  );
};

const resolveBillingPlanId = ({
  profile,
  contract,
}: {
  profile: BillingProfileSnapshot | null;
  contract: BillingContractSnapshot | null;
}) => contract?.plan_id ?? profile?.plan_id ?? "free";

const resolveBillingSubscriptionStatus = ({
  profile,
  contract,
}: {
  profile: BillingProfileSnapshot | null;
  contract: BillingContractSnapshot | null;
}) =>
  contract?.status ??
  profile?.subscription_status ??
  (contract?.contract_source === "internal_comp" ? "active" : "inactive");

const syncLocalStripeCustomerMapping = async ({
  userId,
  profile,
  contract,
  stripeCustomerId,
}: {
  userId: string;
  profile: BillingProfileSnapshot | null;
  contract: BillingContractSnapshot | null;
  stripeCustomerId: string;
}) => {
  const supabaseAdmin = getSupabaseAdmin();
  const nextPlanId = resolveBillingPlanId({ profile, contract });
  const nextSubscriptionStatus = resolveBillingSubscriptionStatus({ profile, contract });
  const { error: upsertError } = await supabaseAdmin.from("billing_profiles").upsert(
    {
      user_id: userId,
      plan_id: nextPlanId,
      subscription_status: nextSubscriptionStatus,
      stripe_customer_id: stripeCustomerId,
    },
    { onConflict: "user_id" }
  );
  if (upsertError) {
    throw new Error(upsertError.message || "Failed to persist Stripe customer mapping.");
  }

  if (contract && contract.stripe_customer_id !== stripeCustomerId) {
    const { error: contractUpdateError } = await supabaseAdmin
      .from("billing_subscription_contracts")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", contract.id);
    if (contractUpdateError) {
      throw new Error(contractUpdateError.message || "Failed to sync Stripe customer on contract.");
    }
  }
};

export const readVerifiedStripeCustomerForUser = async ({
  userId,
  stripeCustomerId,
  allowMetadataRepair = false,
}: {
  userId: string;
  stripeCustomerId: string;
  allowMetadataRepair?: boolean;
}): Promise<StripeCustomerResponse> => {
  const customer = await stripeGet<StripeCustomerResponse>(`/customers/${stripeCustomerId}`);
  if (customer.deleted) {
    return customer;
  }

  const metadataUserId = normalizeMetadataUserId(customer.metadata?.user_id ?? null);
  if (metadataUserId !== userId) {
    if (allowMetadataRepair && metadataUserId === null) {
      return customer;
    }
    throw new StripeCustomerOwnershipMismatchError(
      "Stripe customer ownership mismatch detected. Repair billing mapping before continuing."
    );
  }

  return customer;
};

export const readVerifiedStripeSubscriptionForUser = async ({
  userId,
  stripeSubscriptionId,
}: {
  userId: string;
  stripeSubscriptionId: string;
}): Promise<StripeSubscriptionResponse> => {
  const subscription = await stripeGet<StripeSubscriptionResponse>(
    `/subscriptions/${stripeSubscriptionId}`
  );
  const stripeCustomerId = normalizeStripeCustomerId(subscription.customer);
  if (!stripeCustomerId) {
    throw new StripeSubscriptionOwnershipMismatchError(
      "Stripe subscription ownership mismatch detected. Repair billing mapping before continuing."
    );
  }

  try {
    await readVerifiedStripeCustomerForUser({
      userId,
      stripeCustomerId,
    });
  } catch (error) {
    if (error instanceof StripeCustomerOwnershipMismatchError) {
      throw new StripeSubscriptionOwnershipMismatchError(
        "Stripe subscription ownership mismatch detected. Repair billing mapping before continuing."
      );
    }
    throw error;
  }

  return subscription;
};

/**
 * Resolves, creates, or updates the Stripe customer for the given user.
 * Existing mappings are reused and repaired when Stripe customer identity drifts.
 */
export const syncStripeCustomerForUser = async ({
  userId,
  email,
  displayName,
  allowMetadataRepair = false,
}: EnsureStripeCustomerParams): Promise<StripeCustomerSyncResult> => {
  const supabaseAdmin = getSupabaseAdmin();
  const [profileResult, contractResult] = await Promise.all([
    supabaseAdmin
      .from("billing_profiles")
      .select("stripe_customer_id, plan_id, subscription_status")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_subscription_contracts")
      .select("id, stripe_customer_id, plan_id, status, contract_source")
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw new Error(profileResult.error.message || "Failed to load billing profile.");
  }
  if (contractResult.error) {
    throw new Error(contractResult.error.message || "Failed to load billing contract.");
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedDisplayName = normalizeDisplayName(displayName);
  const profileSnapshot = (profileResult.data as BillingProfileSnapshot | null) ?? null;
  const contractSnapshot = (contractResult.data as BillingContractSnapshot | null) ?? null;
  const existingStripeCustomerId =
    profileSnapshot?.stripe_customer_id ?? contractSnapshot?.stripe_customer_id ?? null;

  const createCustomer = async (): Promise<StripeCustomerSyncResult> => {
    const customer = await stripePostForm<StripeCustomerResponse>("/customers", {
      email: normalizedEmail ?? undefined,
      name: normalizedDisplayName ?? undefined,
      "metadata[user_id]": userId,
    });
    await syncLocalStripeCustomerMapping({
      userId,
      profile: profileSnapshot,
      contract: contractSnapshot,
      stripeCustomerId: customer.id,
    });
    return {
      stripeCustomerId: customer.id,
      email: normalizeEmail(customer.email) ?? normalizedEmail,
      name: normalizeDisplayName(customer.name) ?? normalizedDisplayName,
      created: true,
      updated: false,
    };
  };

  if (!existingStripeCustomerId) {
    return await createCustomer();
  }

  let existingCustomer: StripeCustomerResponse;
  try {
    existingCustomer = await readVerifiedStripeCustomerForUser({
      userId,
      stripeCustomerId: existingStripeCustomerId,
      allowMetadataRepair,
    });
  } catch (error) {
    if (error instanceof Error && isStripeCustomerModeMismatchError(error.message)) {
      throw new Error(
        "Stripe customer mode mismatch detected. Verify the active Stripe environment before repairing this user."
      );
    }
    if (error instanceof StripeCustomerOwnershipMismatchError) {
      throw error;
    }
    if (error instanceof Error && isStripeCustomerMissingError(error.message)) {
      return await createCustomer();
    }
    throw error;
  }

  if (existingCustomer.deleted) {
    return await createCustomer();
  }

  const nextMetadataUserId = normalizeMetadataUserId(existingCustomer.metadata?.user_id ?? null);
  const updatePayload: Record<string, string> = {};
  const existingEmail = normalizeEmail(existingCustomer.email);
  const existingName = normalizeDisplayName(existingCustomer.name);

  if (normalizedEmail !== existingEmail) {
    updatePayload.email = normalizedEmail ?? "";
  }
  if (normalizedDisplayName !== existingName) {
    updatePayload.name = normalizedDisplayName ?? "";
  }
  if (nextMetadataUserId !== userId) {
    updatePayload["metadata[user_id]"] = userId;
  }

  if (Object.keys(updatePayload).length === 0) {
    await syncLocalStripeCustomerMapping({
      userId,
      profile: profileSnapshot,
      contract: contractSnapshot,
      stripeCustomerId: existingCustomer.id,
    });
    return {
      stripeCustomerId: existingCustomer.id,
      email: existingEmail,
      name: existingName,
      created: false,
      updated: false,
    };
  }

  const updatedCustomer = await stripePostForm<StripeCustomerResponse>(
    `/customers/${existingCustomer.id}`,
    updatePayload
  );

  await syncLocalStripeCustomerMapping({
    userId,
    profile: profileSnapshot,
    contract: contractSnapshot,
    stripeCustomerId: updatedCustomer.id,
  });

  return {
    stripeCustomerId: updatedCustomer.id,
    email: normalizeEmail(updatedCustomer.email) ?? normalizedEmail,
    name: normalizeDisplayName(updatedCustomer.name) ?? normalizedDisplayName,
    created: false,
    updated: true,
  };
};

/**
 * Backward-compatible helper for routes that only need the Stripe customer id.
 */
export const ensureStripeCustomerForUser = async (
  params: EnsureStripeCustomerParams
): Promise<string> => {
  const result = await syncStripeCustomerForUser(params);
  return result.stripeCustomerId;
};
