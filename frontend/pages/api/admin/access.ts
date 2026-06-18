/**
 * Admin API: lightweight access check endpoint for admin surface gating.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser, resolveAdminAccessVia } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";

type AdminAccessResponse =
  | {
      ok: true;
      isAdmin: true;
      accessVia: "role";
      user: {
        id: string;
        email: string | null;
      };
    }
  | {
      ok: true;
      isAdmin: false;
      accessVia: "none";
    };

type AdminAccessErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminAccessResponse | AdminAccessErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/admin/access.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Failed to verify admin access." });
  }
  if (!user) return;

  try {
    const accessVia = resolveAdminAccessVia(user);
    if (accessVia === "none") {
      return res.status(403).json({
        ok: true,
        isAdmin: false,
        accessVia: "none",
      });
    }

    return res.status(200).json({
      ok: true,
      isAdmin: true,
      accessVia,
      user: {
        id: user.id,
        email: user.email ?? null,
      },
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/admin/access",
      metadata: {
        source: "api.admin.access",
        message: "Failed to resolve admin access.",
      },
    });
    return res.status(500).json({ error: "Failed to verify admin access." });
  }
}
