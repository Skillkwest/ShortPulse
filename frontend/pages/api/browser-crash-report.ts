/**
 * Browser Reporting API crash endpoint.
 * Chrome can deliver this after a renderer crash, so it cannot depend on bearer auth.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../lib/server/api/appErrorLogs";
import { recordBrowserCrashReports } from "../../lib/server/api/browserCrashSessions";
import { enforceApiRateLimit } from "../../lib/server/api/rateLimit";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "64kb",
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (
    !enforceApiRateLimit(req, res, {
      keyPrefix: "browser-crash-report",
      maxRequests: 60,
      windowMs: 5 * 60 * 1000,
    })
  ) {
    return;
  }

  try {
    const result = await recordBrowserCrashReports({ payload: req.body });
    return res.status(202).json({ ok: true, ...result });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/browser-crash-report.ingest",
    });
    return res.status(500).json({ error: "Unable to record browser crash report." });
  }
}
