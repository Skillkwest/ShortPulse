/**
 * Admin API: fleet user-health snapshots and findings.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { readAdminUserHealthFleetReport } from "../../../lib/server/adminUserHealth/fleet";
import type { FleetRiskBand } from "../../../lib/server/adminUserHealth/types";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 100;

const asString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

const asPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};

const asSeverityFilter = (value: unknown): "all" | "critical" | "warning" | "info" => {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === "critical" || normalized === "warning" || normalized === "info") {
    return normalized;
  }
  return "all";
};

const asRiskBandFilter = (value: unknown): "all" | FleetRiskBand => {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return "all";
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
      routeLabel: "admin/user-health-fleet.auth",
      error,
    });
    return res.status(500).json({ error: "Unable to load fleet health report." });
  }
  if (!adminUser) return;

  const page = asPositiveInt(req.query.page, DEFAULT_PAGE);
  const perPage = Math.min(MAX_PER_PAGE, asPositiveInt(req.query.perPage, DEFAULT_PER_PAGE));
  const severity = asSeverityFilter(req.query.severity);
  const findingCode = asString(req.query.findingCode).trim();
  const riskBand = asRiskBandFilter(req.query.riskBand);
  const search = asString(req.query.search).trim();
  const runId = asString(req.query.runId).trim() || null;

  try {
    const report = await readAdminUserHealthFleetReport({
      runId,
      page,
      perPage,
      severity,
      findingCode,
      riskBand,
      search,
    });

    return res.status(200).json({
      run: report.run,
      summary: report.summary,
      snapshots: report.snapshots,
      pagination: report.pagination,
      health: report.health,
      filters: {
        runId,
        severity,
        findingCode,
        riskBand,
        search,
      },
    });
  } catch (error) {
    await logApiRouteException({
      req,
      routeLabel: "admin/user-health-fleet",
      error,
      user: adminUser,
      metadata: {
        page,
        per_page: perPage,
        severity,
        finding_code: findingCode || null,
        risk_band: riskBand,
        search: search || null,
        run_id: runId,
      },
    });

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load fleet health report.",
    });
  }
}
