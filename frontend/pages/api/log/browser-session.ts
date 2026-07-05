/**
 * Browser session-health ingest endpoint.
 * Records authenticated tab/session lifecycle, freeze, and crash-adjacent evidence.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  recordBrowserSessionEvent,
  type BrowserSessionEventRequest,
} from "../../../lib/server/api/browserCrashSessions";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";

const BROWSER_SESSION_RATE_LIMIT = {
  keyPrefix: "log-browser-session",
  maxRequests: 180,
  windowMs: 5 * 60 * 1000,
} as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.log.browser-session.auth",
    });
    return res.status(500).json({ error: "Browser session log ingestion failed." });
  }
  if (!user) return;

  if (
    !enforceApiRateLimit(req, res, {
      ...BROWSER_SESSION_RATE_LIMIT,
      keyPrefix: `${BROWSER_SESSION_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const payload = (
      typeof req.body === "object" && req.body ? req.body : {}
    ) as BrowserSessionEventRequest;
    const result = await recordBrowserSessionEvent({ req, user, payload });
    return res.status(202).json({ logged: true, ...result });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.log.browser-session.write",
      user,
    });
    return res.status(500).json({ error: "Browser session log ingestion failed." });
  }
}
