/**
 * Cron-authenticated media storage lifecycle dry-run route.
 * Reports aggregate storage lifecycle classes without returning raw object paths.
 */
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { readMediaStorageLifecycleRuntimeFlags } from "../../../../lib/server/api/mediaStorageLifecycleRuntimeFlags";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type JsonObject = Record<string, unknown>;

type LifecycleSummaryRow = {
  manifestAction: string;
  manifestReason: string;
  safePathClass: string;
  objectCount: number;
  objectsMissingSizeMetadata: number;
  totalMb: number;
  oldestObjectCreatedAt: string | null;
  newestObjectCreatedAt: string | null;
  youngestAgeDays: number | null;
  oldestAgeDays: number | null;
};

type LifecycleTotals = {
  objectCount: number;
  totalMb: number;
  deleteCandidateCount: number;
  deleteCandidateMb: number;
  manualReviewCount: number;
  manualReviewMb: number;
  integrityProblemCount: number;
  integrityProblemMb: number;
};

type LifecycleRunSuccessResponse = {
  ok: true;
  mode: "dry_run";
  triggerSource: "scheduled" | "manual";
  durationMs: number;
  cleanupTtlDays: number;
  totals: LifecycleTotals;
  rows: LifecycleSummaryRow[];
};

type LifecycleRunErrorResponse = {
  error: string;
  details?: string;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = asNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const secureCompare = (left: string, right: string): boolean => {
  try {
    return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
  } catch {
    return false;
  }
};

const readHeader = (req: NextApiRequest, name: string): string | null => {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return typeof raw === "string" ? raw : null;
};

const readBearerToken = (req: NextApiRequest): string | null => {
  const authorization = readHeader(req, "authorization");
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (!scheme || !token) return null;
  if (scheme.trim().toLowerCase() !== "bearer") return null;
  const normalized = token.trim();
  return normalized.length ? normalized : null;
};

const normalizeTriggerSource = (value: unknown): "scheduled" | "manual" =>
  value === "manual" ? "manual" : "scheduled";

const readTriggerSource = (req: NextApiRequest): "scheduled" | "manual" => {
  const headerValue = readHeader(req, "x-shortpulse-trigger-source");
  if (headerValue !== null) return normalizeTriggerSource(headerValue.trim().toLowerCase());

  const triggerSourceQuery = req.query?.triggerSource;
  const queryValue = Array.isArray(triggerSourceQuery) ? triggerSourceQuery[0] : triggerSourceQuery;
  if (typeof queryValue === "string")
    return normalizeTriggerSource(queryValue.trim().toLowerCase());

  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return normalizeTriggerSource((req.body as JsonObject).triggerSource);
  }
  return "scheduled";
};

const readMode = (req: NextApiRequest): "dry_run" | "unsupported" => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return "dry_run";
  const mode = asString((req.body as JsonObject).mode);
  if (!mode || mode === "dry_run") return "dry_run";
  return "unsupported";
};

const toSummaryRows = (value: unknown): LifecycleSummaryRow[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row): LifecycleSummaryRow | null => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      const record = row as JsonObject;
      const manifestAction = asString(record.manifest_action);
      const manifestReason = asString(record.manifest_reason);
      const safePathClass = asString(record.safe_path_class);
      if (!manifestAction || !manifestReason || !safePathClass) return null;
      return {
        manifestAction,
        manifestReason,
        safePathClass,
        objectCount: asNumber(record.object_count),
        objectsMissingSizeMetadata: asNumber(record.objects_missing_size_metadata),
        totalMb: asNumber(record.total_mb),
        oldestObjectCreatedAt: asString(record.oldest_object_created_at),
        newestObjectCreatedAt: asString(record.newest_object_created_at),
        youngestAgeDays: asNullableNumber(record.youngest_age_days),
        oldestAgeDays: asNullableNumber(record.oldest_age_days),
      };
    })
    .filter((row): row is LifecycleSummaryRow => Boolean(row));
};

const buildTotals = (rows: LifecycleSummaryRow[]): LifecycleTotals =>
  rows.reduce<LifecycleTotals>(
    (totals, row) => {
      totals.objectCount += row.objectCount;
      totals.totalMb += row.totalMb;
      if (row.manifestAction === "delete_candidate") {
        totals.deleteCandidateCount += row.objectCount;
        totals.deleteCandidateMb += row.totalMb;
      } else if (row.manifestAction === "manual_review_required") {
        totals.manualReviewCount += row.objectCount;
        totals.manualReviewMb += row.totalMb;
      } else if (row.manifestAction === "integrity_problem") {
        totals.integrityProblemCount += row.objectCount;
        totals.integrityProblemMb += row.totalMb;
      }
      return totals;
    },
    {
      objectCount: 0,
      totalMb: 0,
      deleteCandidateCount: 0,
      deleteCandidateMb: 0,
      manualReviewCount: 0,
      manualReviewMb: 0,
      integrityProblemCount: 0,
      integrityProblemMb: 0,
    }
  );

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LifecycleRunSuccessResponse | LifecycleRunErrorResponse>
) {
  const startedAt = Date.now();

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const flags = readMediaStorageLifecycleRuntimeFlags();
  if (!flags.enabled) {
    return res.status(404).json({ error: "Not found" });
  }

  if (readMode(req) !== "dry_run") {
    return res.status(400).json({
      error: "Unsupported lifecycle mode",
      details: "This route currently supports dry_run only.",
    });
  }

  const expectedSecrets = [flags.cronSecret, process.env.CRON_SECRET]
    .map((value) => value?.trim() ?? null)
    .filter((value): value is string => Boolean(value));

  if (expectedSecrets.length === 0) {
    return res.status(503).json({
      error: "Media storage lifecycle worker misconfigured",
      details: "Missing cron secret configuration",
    });
  }

  const providedHeaderSecret = readHeader(req, "x-shortpulse-cron-secret");
  const providedBearerToken = readBearerToken(req);
  const isAuthorized = expectedSecrets.some((expectedSecret) => {
    const headerMatches =
      providedHeaderSecret !== null && secureCompare(providedHeaderSecret, expectedSecret);
    const bearerMatches =
      providedBearerToken !== null && secureCompare(providedBearerToken, expectedSecret);
    return headerMatches || bearerMatches;
  });

  if (!isAuthorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data, error } = await getSupabaseAdmin().rpc("get_media_storage_lifecycle_summary", {
      p_cleanup_ttl_days: flags.cleanupTtlDays,
    });
    if (error) throw new Error(error.message || "Lifecycle summary failed.");

    const rows = toSummaryRows(data);
    return res.status(200).json({
      ok: true,
      mode: "dry_run",
      triggerSource: readTriggerSource(req),
      durationMs: Date.now() - startedAt,
      cleanupTtlDays: flags.cleanupTtlDays,
      totals: buildTotals(rows),
      rows,
    });
  } catch (error) {
    await logApiRouteException({
      routeLabel: "internal/media-storage-lifecycle/run",
      error,
      metadata: {
        cleanupTtlDays: flags.cleanupTtlDays,
      },
    });
    return res.status(500).json({
      error: "Media storage lifecycle dry run failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
