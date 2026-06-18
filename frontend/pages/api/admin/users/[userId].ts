import type { NextApiRequest, NextApiResponse } from "next";
import type {
  AdminDeleteUserRequest,
  AdminDeleteUserResponse,
} from "../../../../features/admin/types";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEDIA_LIBRARY_BUCKET = "media_library";
const USER_FOOTPRINT_TABLES = [
  {
    table: "billing_subscription_contracts",
    label: "billing subscription contract rows",
  },
  { table: "ai_credit_ledger", label: "credit ledger rows" },
  { table: "ai_credit_reservations", label: "credit reservation rows" },
  { table: "ai_generations", label: "generation rows" },
  { table: "media_files", label: "media rows" },
  { table: "projects", label: "project rows" },
  { table: "user_owned_custom_voices", label: "custom voice ownership rows" },
] as const;

const asSingleString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

const readUserRowCount = async (
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  userId: string
): Promise<{ count: number; errorMessage: string | null }> => {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return {
    count: typeof count === "number" ? count : 0,
    errorMessage: error?.message ?? null,
  };
};

const loadDeletionBlockers = async (
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<string[]> => {
  const blockers: string[] = [];
  const [profileResult, balanceResult, storageResult, ...countResults] = await Promise.all([
    supabaseAdmin
      .from("billing_profiles")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("ai_credit_balance")
      .select("balance_cents")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin.storage.from(MEDIA_LIBRARY_BUCKET).list(userId, { limit: 1 }),
    ...USER_FOOTPRINT_TABLES.map(({ table }) => readUserRowCount(supabaseAdmin, table, userId)),
  ]);

  if (profileResult.error) {
    blockers.push("billing profile could not be verified");
  } else if (profileResult.data?.stripe_customer_id || profileResult.data?.stripe_subscription_id) {
    blockers.push("Stripe-linked billing profile exists");
  }

  if (balanceResult.error) {
    blockers.push("credit balance could not be verified");
  } else if (Number(balanceResult.data?.balance_cents ?? 0) !== 0) {
    blockers.push("non-zero credit balance exists");
  }

  if (storageResult.error) {
    blockers.push("storage prefix could not be verified");
  } else if (Array.isArray(storageResult.data) && storageResult.data.length > 0) {
    blockers.push("storage objects exist under the user's media namespace");
  }

  for (let index = 0; index < USER_FOOTPRINT_TABLES.length; index += 1) {
    const result = countResults[index];
    const { label } = USER_FOOTPRINT_TABLES[index]!;
    if (!result || result.errorMessage) {
      blockers.push(`${label} could not be verified`);
      continue;
    }
    if (result.count > 0) {
      blockers.push(`${label} exist`);
    }
  }

  return blockers;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string; blockers?: string[] } | AdminDeleteUserResponse>
) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin.users.delete.auth",
    });
    return res.status(500).json({ error: "Failed to delete user." });
  }
  if (!adminUser) {
    return;
  }

  const userId = asSingleString(req.query.userId).trim();
  if (!isUuid(userId)) {
    return res.status(400).json({ error: "A valid user id is required." });
  }

  if (userId === adminUser.id) {
    return res.status(400).json({ error: "You cannot delete the currently signed-in admin." });
  }

  const payload =
    req.body && typeof req.body === "object" ? (req.body as Partial<AdminDeleteUserRequest>) : {};
  const confirmationText = String(payload.confirmationText ?? "").trim();

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const userResult = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userResult.error) {
      throw new Error(userResult.error.message || "Failed to load the target user.");
    }

    const targetUser = userResult.data.user;
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const expectedConfirmation = String(targetUser.email ?? targetUser.id ?? "").trim();
    if (!expectedConfirmation) {
      return res.status(400).json({ error: "This user cannot be confirmed for deletion." });
    }

    if (confirmationText !== expectedConfirmation) {
      return res.status(400).json({
        error: `Type ${expectedConfirmation} exactly to confirm deletion.`,
      });
    }

    const blockers = await loadDeletionBlockers(supabaseAdmin, userId);
    if (blockers.length > 0) {
      return res.status(409).json({
        error:
          "User deletion blocked until billing, credits, media, projects, voices, and storage are reviewed.",
        blockers,
      });
    }

    const deleteResult = await supabaseAdmin.auth.admin.deleteUser(userId, false);
    if (deleteResult.error) {
      throw new Error(deleteResult.error.message || "Failed to delete user.");
    }

    return res.status(200).json({
      ok: true,
      userId,
      email: targetUser.email ?? null,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin.users.delete",
      user: adminUser,
      metadata: {
        target_user_id: userId,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to delete user.",
    });
  }
}
