/**
 * Admin API: list users with plan + credit balance snapshot.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../_utils/auth";
import { logApiRouteException } from "../_utils/appErrorLogs";
import { getSupabaseAdmin } from "../_utils/supabaseAdmin";

type AdminUserRow = {
  id: string;
  email: string | null;
  planId: string | null;
  subscriptionStatus: string | null;
  credits: number;
  createdAt: string | null;
};

type BillingProfileRow = {
  user_id: string;
  plan_id: string | null;
  subscription_status: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const perPage = Math.min(200, Math.max(1, Number(req.query.perPage ?? 100)));

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (userError) {
      return res.status(500).json({ error: userError.message });
    }

    const users = userData?.users ?? [];
    const userIds = users.map((user) => user.id);
    if (!userIds.length) {
      return res.status(200).json({ users: [] });
    }

    const [{ data: balances }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("ai_credit_balance").select("user_id, balance_cents").in("user_id", userIds),
      supabaseAdmin.from("billing_profiles").select("user_id, plan_id, subscription_status").in("user_id", userIds),
    ]);

    const balanceByUser = new Map((balances ?? []).map((row) => [row.user_id as string, Number(row.balance_cents ?? 0)]));
    const profileByUser = new Map<string, BillingProfileRow>(
      ((profiles ?? []) as BillingProfileRow[]).map((row) => [row.user_id, row]),
    );

    const rows: AdminUserRow[] = users.map((user) => {
      const profile = profileByUser.get(user.id);
      return {
        id: user.id,
        email: user.email ?? null,
        planId: (profile?.plan_id as string | undefined) ?? null,
        subscriptionStatus: (profile?.subscription_status as string | undefined) ?? null,
        credits: balanceByUser.get(user.id) ?? 0,
        createdAt: user.created_at ?? null,
      };
    });

    return res.status(200).json({ users: rows });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/users",
      user: adminUser,
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load admin users.",
    });
  }
}
