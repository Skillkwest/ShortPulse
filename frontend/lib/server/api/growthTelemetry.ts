/**
 * Shared growth-telemetry helpers for anonymous attribution capture and
 * allowlisted funnel event ingestion.
 */
import { getSupabaseAdmin } from "./supabaseAdmin";

type JsonObject = Record<string, unknown>;

export type GrowthTelemetrySource =
  | "telemetry.marketing.page_view"
  | "telemetry.marketing.cta_clicked"
  | "telemetry.auth.signup_submitted"
  | "telemetry.auth.signup_completed"
  | "telemetry.billing.pricing_viewed"
  | "telemetry.billing.upgrade_clicked"
  | "telemetry.billing.checkout_started"
  | "telemetry.billing.checkout_completed";

export type GrowthAttributionSnapshot = {
  anonymousId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPath: string | null;
  referrerHost: string | null;
};

type UpsertGrowthAttributionIdentityParams = {
  attribution: GrowthAttributionSnapshot;
  userId?: string | null;
  occurredAt: string;
  source: GrowthTelemetrySource;
};

const ALLOWED_GROWTH_TELEMETRY_SOURCES = new Set<GrowthTelemetrySource>([
  "telemetry.marketing.page_view",
  "telemetry.marketing.cta_clicked",
  "telemetry.auth.signup_submitted",
  "telemetry.auth.signup_completed",
  "telemetry.billing.pricing_viewed",
  "telemetry.billing.upgrade_clicked",
  "telemetry.billing.checkout_started",
  "telemetry.billing.checkout_completed",
]);

const normalizeText = (value: unknown, maxLength = 160): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  return trimmed.slice(0, maxLength);
};

export const isAllowedGrowthTelemetrySource = (value: unknown): value is GrowthTelemetrySource => {
  return typeof value === "string" && ALLOWED_GROWTH_TELEMETRY_SOURCES.has(value as never);
};

export const growthTelemetryFamilyForSource = (source: GrowthTelemetrySource): string => {
  if (source.startsWith("telemetry.billing.")) return "billing_funnel";
  if (source.startsWith("telemetry.auth.")) return "growth_activation";
  return "marketing_funnel";
};

export const sanitizeGrowthAttributionSnapshot = (value: unknown): GrowthAttributionSnapshot => {
  const row = value && typeof value === "object" ? (value as JsonObject) : {};
  return {
    anonymousId: normalizeText(row.anonymousId, 120),
    utmSource: normalizeText(row.utmSource, 120),
    utmMedium: normalizeText(row.utmMedium, 120),
    utmCampaign: normalizeText(row.utmCampaign, 160),
    landingPath: normalizeText(row.landingPath, 300),
    referrerHost: normalizeText(row.referrerHost, 160),
  };
};

export const upsertGrowthAttributionIdentity = async ({
  attribution,
  userId = null,
  occurredAt,
  source,
}: UpsertGrowthAttributionIdentityParams): Promise<void> => {
  if (!attribution.anonymousId) return;

  const supabaseAdmin = getSupabaseAdmin();
  const findByAnonymous = supabaseAdmin
    .from("growth_attribution_identities")
    .select(
      "anonymous_id, user_id, first_utm_source, first_utm_medium, first_utm_campaign, first_landing_path, first_referrer_host, signup_submitted_at, signup_completed_at"
    )
    .eq("anonymous_id", attribution.anonymousId)
    .maybeSingle();

  const findByUser =
    userId &&
    supabaseAdmin
      .from("growth_attribution_identities")
      .select(
        "anonymous_id, user_id, first_utm_source, first_utm_medium, first_utm_campaign, first_landing_path, first_referrer_host, signup_submitted_at, signup_completed_at"
      )
      .eq("user_id", userId)
      .maybeSingle();

  const [anonymousResult, userResult] = await Promise.all([findByAnonymous, findByUser]);
  const existing =
    (userResult && userResult.data && typeof userResult.data === "object"
      ? userResult.data
      : null) ||
    (anonymousResult.data && typeof anonymousResult.data === "object"
      ? anonymousResult.data
      : null);

  const targetAnonymousId =
    normalizeText((existing as { anonymous_id?: unknown } | null)?.anonymous_id, 120) ??
    attribution.anonymousId;

  const isSignupSubmitted = source === "telemetry.auth.signup_submitted";
  const isSignupCompleted = source === "telemetry.auth.signup_completed";
  const existingUserId = normalizeText((existing as { user_id?: unknown } | null)?.user_id, 120);
  const nextUserId = existingUserId ?? userId ?? null;

  const basePayload = {
    user_id: nextUserId,
    last_seen_at: occurredAt,
    last_utm_source: attribution.utmSource,
    last_utm_medium: attribution.utmMedium,
    last_utm_campaign: attribution.utmCampaign,
    last_landing_path: attribution.landingPath,
    last_referrer_host: attribution.referrerHost,
    stitched_at: !existingUserId && nextUserId ? occurredAt : null,
    signup_submitted_at:
      normalizeText(
        (existing as { signup_submitted_at?: unknown } | null)?.signup_submitted_at,
        80
      ) ?? (isSignupSubmitted ? occurredAt : null),
    signup_completed_at:
      normalizeText(
        (existing as { signup_completed_at?: unknown } | null)?.signup_completed_at,
        80
      ) ?? (isSignupCompleted ? occurredAt : null),
  };

  if (existing) {
    const updatePayload = {
      ...basePayload,
      first_utm_source:
        normalizeText((existing as { first_utm_source?: unknown }).first_utm_source, 120) ??
        attribution.utmSource,
      first_utm_medium:
        normalizeText((existing as { first_utm_medium?: unknown }).first_utm_medium, 120) ??
        attribution.utmMedium,
      first_utm_campaign:
        normalizeText((existing as { first_utm_campaign?: unknown }).first_utm_campaign, 160) ??
        attribution.utmCampaign,
      first_landing_path:
        normalizeText((existing as { first_landing_path?: unknown }).first_landing_path, 300) ??
        attribution.landingPath,
      first_referrer_host:
        normalizeText((existing as { first_referrer_host?: unknown }).first_referrer_host, 160) ??
        attribution.referrerHost,
    };

    const { error } = await supabaseAdmin
      .from("growth_attribution_identities")
      .update(updatePayload)
      .eq("anonymous_id", targetAnonymousId);
    if (error) {
      throw new Error(error.message || "Failed to update growth attribution identity.");
    }
    return;
  }

  const { error } = await supabaseAdmin.from("growth_attribution_identities").insert({
    anonymous_id: targetAnonymousId,
    user_id: nextUserId,
    first_utm_source: attribution.utmSource,
    first_utm_medium: attribution.utmMedium,
    first_utm_campaign: attribution.utmCampaign,
    first_landing_path: attribution.landingPath,
    first_referrer_host: attribution.referrerHost,
    last_utm_source: attribution.utmSource,
    last_utm_medium: attribution.utmMedium,
    last_utm_campaign: attribution.utmCampaign,
    last_landing_path: attribution.landingPath,
    last_referrer_host: attribution.referrerHost,
    first_seen_at: occurredAt,
    last_seen_at: occurredAt,
    signup_submitted_at: isSignupSubmitted ? occurredAt : null,
    signup_completed_at: isSignupCompleted ? occurredAt : null,
    stitched_at: nextUserId ? occurredAt : null,
  });
  if (error) {
    throw new Error(error.message || "Failed to insert growth attribution identity.");
  }
};
