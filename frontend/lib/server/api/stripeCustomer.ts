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

type EnsureStripeCustomerParams = {
  userId: string;
  email?: string | null;
  displayName?: string | null;
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

const normalizeEmail = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const normalizeDisplayName = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const isStripeCustomerMissingError = (message: unknown): boolean => {
  if (typeof message !== "string") return false;
  const normalized = message.toLowerCase();
  return normalized.includes("no such customer") || normalized.includes("does not exist");
};

const upsertStripeCustomerMapping = async ({
  userId,
  profile,
  stripeCustomerId,
}: {
  userId: string;
  profile: BillingProfileSnapshot | null;
  stripeCustomerId: string;
}) => {
  const supabaseAdmin = getSupabaseAdmin();
  const { error: upsertError } = await supabaseAdmin.from("billing_profiles").upsert(
    {
      user_id: userId,
      plan_id: profile?.plan_id ?? "free",
      subscription_status: profile?.subscription_status ?? "inactive",
      stripe_customer_id: stripeCustomerId,
    },
    { onConflict: "user_id" }
  );
  if (upsertError) {
    throw new Error(upsertError.message || "Failed to persist Stripe customer mapping.");
  }
};

/**
 * Resolves, creates, or updates the Stripe customer for the given user.
 * Existing mappings are reused and repaired when Stripe customer identity drifts.
 */
export const syncStripeCustomerForUser = async ({
  userId,
  email,
  displayName,
}: EnsureStripeCustomerParams): Promise<StripeCustomerSyncResult> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("billing_profiles")
    .select("stripe_customer_id, plan_id, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Failed to load billing profile.");
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedDisplayName = normalizeDisplayName(displayName);
  const profileSnapshot = (profile as BillingProfileSnapshot | null) ?? null;

  const createCustomer = async (): Promise<StripeCustomerSyncResult> => {
    const customer = await stripePostForm<StripeCustomerResponse>("/customers", {
      email: normalizedEmail ?? undefined,
      name: normalizedDisplayName ?? undefined,
      "metadata[user_id]": userId,
    });
    await upsertStripeCustomerMapping({
      userId,
      profile: profileSnapshot,
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

  if (!profileSnapshot?.stripe_customer_id) {
    return await createCustomer();
  }

  let existingCustomer: StripeCustomerResponse;
  try {
    existingCustomer = await stripeGet<StripeCustomerResponse>(
      `/customers/${profileSnapshot.stripe_customer_id}`
    );
  } catch (error) {
    if (error instanceof Error && isStripeCustomerMissingError(error.message)) {
      return await createCustomer();
    }
    throw error;
  }

  if (existingCustomer.deleted) {
    return await createCustomer();
  }

  const nextMetadataUserId = existingCustomer.metadata?.user_id ?? null;
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
