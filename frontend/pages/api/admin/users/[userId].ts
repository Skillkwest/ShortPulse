import type { NextApiRequest, NextApiResponse } from "next";
import type {
  AdminDeleteUserRequest,
  AdminDeleteUserResponse,
} from "../../../../features/admin/types";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asSingleString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string } | AdminDeleteUserResponse>
) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
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
