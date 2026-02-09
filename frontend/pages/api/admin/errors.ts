/**
 * Admin API: fetch grouped app error incidents for operator triage.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../_utils/auth";
import { getSupabaseAdmin } from "../_utils/supabaseAdmin";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const asPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};

const asFilterValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
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
    const limit = Math.min(MAX_LIMIT, asPositiveInt(req.query.limit, DEFAULT_LIMIT));
    const status = asFilterValue(req.query.status);
    const severity = asFilterValue(req.query.severity);
    const source = asFilterValue(req.query.source);

    let query = supabaseAdmin
      .from("app_error_logs")
      .select(
        "id, source, scope, severity, status, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, first_seen_at, last_seen_at, occurrences_count",
      )
      .order("last_seen_at", { ascending: false })
      .limit(limit);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (severity && severity !== "all") {
      query = query.eq("severity", severity);
    }
    if (source && source !== "all") {
      query = query.eq("source", source);
    }

    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [logsResult, openCountResult, highSeverityOpenResult, last24hResult] = await Promise.all([
      query,
      supabaseAdmin.from("app_error_logs").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabaseAdmin
        .from("app_error_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("severity", "high"),
      supabaseAdmin.from("app_error_logs").select("id", { count: "exact", head: true }).gte("last_seen_at", sinceIso),
    ]);

    if (logsResult.error) {
      return res.status(500).json({ error: logsResult.error.message });
    }

    return res.status(200).json({
      errors: logsResult.data ?? [],
      summary: {
        openCount: Number(openCountResult.count ?? 0),
        highSeverityOpenCount: Number(highSeverityOpenResult.count ?? 0),
        last24hCount: Number(last24hResult.count ?? 0),
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load admin errors.",
    });
  }
}
