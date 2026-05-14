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

type GrowthTelemetryRequest = {
  source?: string;
  eventName?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string | null;
  attribution?: Record<string, unknown>;
};

const normalizeText = (value: unknown, maxLength = 160): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  return trimmed.slice(0, maxLength);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
        ...((payload.metadata ?? {}) as Record<string, unknown>),
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
