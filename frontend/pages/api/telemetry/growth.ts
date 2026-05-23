/**
 * Public/admin-safe growth telemetry ingest.
 * Records allowlisted funnel events and anonymous attribution context.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getOptionalApiUserResult } from "../../../lib/server/api/auth";
import { writeAppErrorLog } from "../../../lib/server/api/appErrorLogs";
import {
  growthTelemetryFamilyForSource,
  isAllowedGrowthTelemetrySource,
  sanitizeGrowthAttributionSnapshot,
  upsertGrowthAttributionIdentity,
} from "../../../lib/server/api/growthTelemetry";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";

type GrowthTelemetryRequest = {
  source?: string;
  eventName?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string | null;
  attribution?: Record<string, unknown>;
};

const GROWTH_TELEMETRY_RATE_LIMIT = {
  keyPrefix: "telemetry:growth",
  maxRequests: 120,
  windowMs: 60_000,
};
const MAX_METADATA_KEYS = 20;
const MAX_METADATA_KEY_LENGTH = 80;
const MAX_METADATA_STRING_LENGTH = 240;

const normalizeText = (value: unknown, maxLength = 160): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  return trimmed.slice(0, maxLength);
};

const sanitizeMetadataValue = (value: unknown): string | number | boolean | null | undefined => {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return normalizeText(value, MAX_METADATA_STRING_LENGTH) ?? undefined;
};

const sanitizeGrowthMetadata = (
  metadata: unknown
): Record<string, string | number | boolean | null> => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [rawKey, rawValue] of Object.entries(metadata).slice(0, MAX_METADATA_KEYS)) {
    const key = normalizeText(rawKey, MAX_METADATA_KEY_LENGTH);
    if (!key) continue;
    const value = sanitizeMetadataValue(rawValue);
    if (value === undefined) continue;
    sanitized[key] = value;
  }
  return sanitized;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!enforceApiRateLimit(req, res, GROWTH_TELEMETRY_RATE_LIMIT)) return;

  try {
    const payload = (
      typeof req.body === "object" && req.body ? req.body : {}
    ) as GrowthTelemetryRequest;
    if (!isAllowedGrowthTelemetrySource(payload.source)) {
      return res.status(400).json({ error: "Unsupported growth telemetry source." });
    }

    const { user, authVerificationUnavailable } = await getOptionalApiUserResult(req);
    const occurredAt = normalizeText(payload.occurredAt, 80) ?? new Date().toISOString();
    const attribution = sanitizeGrowthAttributionSnapshot(payload.attribution);
    const metadata = sanitizeGrowthMetadata(payload.metadata);

    if (attribution.anonymousId) {
      await upsertGrowthAttributionIdentity({
        attribution,
        userId: user?.id ?? null,
        occurredAt,
        source: payload.source,
      });
    }

    const writeResult = await writeAppErrorLog({
      source: payload.source,
      scope: "app",
      severity: "low",
      message: normalizeText(payload.eventName, 120) ?? "growth_event",
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      metadata: {
        ...metadata,
        telemetry_family: growthTelemetryFamilyForSource(payload.source),
        telemetry_version: 1,
        event_name: normalizeText(payload.eventName, 120),
        anonymous_id: attribution.anonymousId,
        utm_source: attribution.utmSource,
        utm_medium: attribution.utmMedium,
        utm_campaign: attribution.utmCampaign,
        landing_path: attribution.landingPath,
        referrer_host: attribution.referrerHost,
        request_auth_verification_unavailable: authVerificationUnavailable || undefined,
        user_agent: req.headers["user-agent"] ?? null,
        host: req.headers.host ?? null,
        vercel_id: req.headers["x-vercel-id"] ?? null,
      },
      occurredAt,
    });

    return res.status(202).json({
      logged: writeResult.ok && !writeResult.skipped,
      skipped: writeResult.skipped,
      id: writeResult.id,
    });
  } catch (error) {
    try {
      await writeAppErrorLog({
        source: "telemetry.growth.ingest_failed",
        scope: "app",
        severity: "medium",
        message: "Growth telemetry ingest failed.",
        metadata: {
          route_label: "telemetry/growth",
          request_method: req.method ?? null,
          error_message: error instanceof Error ? error.message : String(error),
        },
      });
    } catch {
      // Avoid cascading failures from the telemetry sink itself.
    }
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Growth telemetry ingest failed.",
    });
  }
}
