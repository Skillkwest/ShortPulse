/**
 * Stripe customer bootstrap helper for billing entry routes.
 * Ensures every authenticated user has a durable Stripe customer id mapped in billing_profiles.
 */
import { getSupabaseAdmin } from "./supabaseAdmin";
import { stripePostForm } from "./stripe";

type StripeCustomerResponse = { id: string };

type EnsureStripeCustomerParams = {
  userId: string;
  email?: string | null;
};

/**
 * Resolves or creates a Stripe customer id for the given user.
 * If missing, it creates the Stripe customer and upserts billing_profiles in one path.
 */
export const ensureStripeCustomerForUser = async ({
  userId,
  email,
}: EnsureStripeCustomerParams): Promise<string> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("billing_profiles")
    .select("stripe_customer_id, plan_id, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Failed to load billing profile.");
  }
  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await stripePostForm<StripeCustomerResponse>("/customers", {
    email: email ?? undefined,
    "metadata[user_id]": userId,
  });

  const { error: upsertError } = await supabaseAdmin.from("billing_profiles").upsert(
    {
      user_id: userId,
      plan_id: profile?.plan_id ?? "free",
      subscription_status: profile?.subscription_status ?? "inactive",
      stripe_customer_id: customer.id,
    },
    { onConflict: "user_id" }
  );
  if (upsertError) {
    throw new Error(upsertError.message || "Failed to persist Stripe customer mapping.");
  }

  return customer.id;
};
