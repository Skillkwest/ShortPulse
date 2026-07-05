/**
 * Admin browser crash-session API.
 * Returns account-linked browser freeze/crash session rows for the Crash Logs tab.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  fetchBrowserCrashSessions,
  type BrowserCrashSessionStatus,
} from "../../../lib/server/api/browserCrashSessions";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const STATUS_VALUES = new Set<BrowserCrashSessionStatus | "all">([
  "all",
  "active",
  "clean_closed",
  "possible_ungraceful_exit",
  "probable_freeze_or_crash",
  "confirmed_crash",
]);

const firstQueryValue = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const asPositiveInt = (value: string | string[] | undefined, fallback: number): number => {
  const parsed = Number.parseInt(firstQueryValue(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const asStatus = (value: string | string[] | undefined): BrowserCrashSessionStatus | "all" => {
  const normalized = firstQueryValue(value).trim();
  return STATUS_VALUES.has(normalized as BrowserCrashSessionStatus | "all")
    ? (normalized as BrowserCrashSessionStatus | "all")
    : "all";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/crashes.auth",
    });
    return res.status(500).json({ error: "Unable to load crash sessions." });
  }
  if (!adminUser) return;

  try {
    const page = asPositiveInt(req.query.page, 1);
    const limit = Math.min(MAX_LIMIT, asPositiveInt(req.query.limit, DEFAULT_LIMIT));
    const status = asStatus(req.query.status);
    const search = firstQueryValue(req.query.search).trim().slice(0, 120);
    const result = await fetchBrowserCrashSessions({ page, limit, status, search });
    return res.status(200).json(result);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/crashes.list",
      user: adminUser,
    });
    return res.status(500).json({ error: "Unable to load crash sessions." });
  }
}
