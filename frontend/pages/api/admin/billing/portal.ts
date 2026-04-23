import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { getCanonicalAppBaseUrl, stripePostForm } from "../../../../lib/server/api/stripe";
import { ensureStripeCustomerForUser } from "../../../../lib/server/api/stripeCustomer";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type StripePortalSession = { id: string; url: string };

type PortalRequestBody = {
  userId?: string;
};

const asSingleString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(501).json({ error: "Stripe is not configured on the server yet." });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const normalizedUserId = asSingleString((req.body as PortalRequestBody | null)?.userId).trim();
  if (!normalizedUserId) {
    return res.status(400).json({ error: "userId is required." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const userResult = await supabaseAdmin.auth.admin.getUserById(normalizedUserId);
    if (userResult.error) {
      throw new Error(userResult.error.message || "Failed to load target user.");
    }
    const targetUser = userResult.data.user;
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const stripeCustomerId = await ensureStripeCustomerForUser({
      userId: targetUser.id,
      email: targetUser.email ?? null,
    });

    const session = await stripePostForm<StripePortalSession>("/billing_portal/sessions", {
      customer: stripeCustomerId,
      return_url: `${getCanonicalAppBaseUrl()}/admin`,
    });

    return res.status(200).json({ portalUrl: session.url });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/billing/portal",
      user: adminUser,
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to create Stripe billing session.",
    });
  }
}
