/**
 * Admin API: user health diagnostics for generation and credit-drain analysis.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  asLookupMode,
  asPositiveInt,
  asSingleString,
  DEFAULT_DEEP_LOOKBACK_DAYS,
  MAX_DEEP_LOOKBACK_DAYS,
  type DeepLookupMode as LookupMode,
} from "../../../lib/server/adminUserHealth/deep";
import { loadAdminHealthSnapshot } from "../../../lib/server/adminUserHealth/snapshot";

type AdminHealthRequest = {
  lookup: string;
  lookupMode?: LookupMode;
  lookbackDays?: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string } | unknown>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const body = (req.body ?? {}) as Partial<AdminHealthRequest>;
  const lookup = asSingleString(body.lookup).trim();
  const lookupMode = asLookupMode(body.lookupMode);
  const lookbackDays = Math.min(
    MAX_DEEP_LOOKBACK_DAYS,
    asPositiveInt(body.lookbackDays, DEFAULT_DEEP_LOOKBACK_DAYS)
  );

  if (!lookup) {
    return res.status(400).json({ error: "lookup is required." });
  }

  try {
    const response = await loadAdminHealthSnapshot({
      lookup,
      lookupMode,
      lookbackDays,
    });

    return res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "User not found.") {
      return res.status(404).json({ error: message });
    }

    await logApiRouteException({
      req,
      routeLabel: "admin/user-health",
      error,
      metadata: {
        lookup,
        lookup_mode: lookupMode,
        lookback_days: lookbackDays,
      },
      user: adminUser,
    });
    return res.status(500).json({
      error: message || "Failed to run user health diagnostics.",
    });
  }
}
