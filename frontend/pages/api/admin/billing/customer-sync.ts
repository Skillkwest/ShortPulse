import type { NextApiRequest, NextApiResponse } from "next";
import { resolveAuthDisplayName } from "../../../../lib/server/api/accountIdentity";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { syncStripeCustomerForUser } from "../../../../lib/server/api/stripeCustomer";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type SyncRequestBody = {
  userId?: string;
};

type SyncResponse = {
  ok: true;
  stripeCustomerId: string;
  created: boolean;
  updated: boolean;
};

const asSingleString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string } | SyncResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const userId = asSingleString((req.body as SyncRequestBody | null)?.userId).trim();
  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const userResult = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userResult.error) {
      throw new Error(userResult.error.message || "Failed to load target user.");
    }
    const targetUser = userResult.data.user;
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const result = await syncStripeCustomerForUser({
      userId: targetUser.id,
      email: targetUser.email ?? null,
      displayName: resolveAuthDisplayName(targetUser),
      allowMetadataRepair: true,
    });

    return res.status(200).json({
      ok: true,
      stripeCustomerId: result.stripeCustomerId,
      created: result.created,
      updated: result.updated,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/billing/customer-sync",
      user: adminUser,
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to sync Stripe customer.",
    });
  }
}
