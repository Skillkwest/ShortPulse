/**
 * Browser-side growth telemetry helper.
 * Supports anonymous attribution capture plus optional authenticated stitching.
 */
import { readSupabaseAccessToken } from "./supabaseClient";

export const GROWTH_TELEMETRY_STORAGE_KEY = "sp_growth_anonymous_id";
export const GROWTH_TELEMETRY_ENDPOINT = "/api/telemetry/growth";

export const GROWTH_TELEMETRY_VERSION = 1;

export const GROWTH_MARKETING_PAGE_VIEW_SOURCE = "telemetry.marketing.page_view";
export const GROWTH_MARKETING_CTA_CLICKED_SOURCE = "telemetry.marketing.cta_clicked";
export const GROWTH_AUTH_SIGNUP_SUBMITTED_SOURCE = "telemetry.auth.signup_submitted";
export const GROWTH_AUTH_SIGNUP_COMPLETED_SOURCE = "telemetry.auth.signup_completed";
export const GROWTH_BILLING_PRICING_VIEWED_SOURCE = "telemetry.billing.pricing_viewed";
export const GROWTH_BILLING_UPGRADE_CLICKED_SOURCE = "telemetry.billing.upgrade_clicked";

type JsonObject = Record<string, unknown>;

type GrowthTelemetrySource =
  | typeof GROWTH_MARKETING_PAGE_VIEW_SOURCE
  | typeof GROWTH_MARKETING_CTA_CLICKED_SOURCE
  | typeof GROWTH_AUTH_SIGNUP_SUBMITTED_SOURCE
  | typeof GROWTH_AUTH_SIGNUP_COMPLETED_SOURCE
  | typeof GROWTH_BILLING_PRICING_VIEWED_SOURCE
  | typeof GROWTH_BILLING_UPGRADE_CLICKED_SOURCE;

type GrowthAttributionPayload = {
  anonymousId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPath: string | null;
  referrerHost: string | null;
};

type ReportGrowthTelemetryInput = {
  source: GrowthTelemetrySource;
  eventName: string;
  metadata?: JsonObject;
  occurredAt?: string | null;
};

const normalizeText = (value: unknown, maxLength = 160): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  return trimmed.slice(0, maxLength);
};

const parseReferrerHost = (): string | null => {
  if (typeof document === "undefined") return null;
  const referrer = normalizeText(document.referrer, 600);
  if (!referrer) return null;
  try {
    return normalizeText(new URL(referrer).host, 160);
  } catch {
    return null;
  }
};

const generateAnonymousId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `growth_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const getGrowthAnonymousId = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const existing = normalizeText(window.localStorage.getItem(GROWTH_TELEMETRY_STORAGE_KEY), 120);
    if (existing) return existing;
    const generated = generateAnonymousId();
    window.localStorage.setItem(GROWTH_TELEMETRY_STORAGE_KEY, generated);
    return generated;
  } catch {
    return null;
  }
};

const readGrowthAttributionPayload = (): GrowthAttributionPayload => {
  if (typeof window === "undefined") {
    return {
      anonymousId: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      landingPath: null,
      referrerHost: null,
    };
  }

  try {
    const url = new URL(window.location.href);
    return {
      anonymousId: getGrowthAnonymousId(),
      utmSource: normalizeText(url.searchParams.get("utm_source"), 120),
      utmMedium: normalizeText(url.searchParams.get("utm_medium"), 120),
      utmCampaign: normalizeText(url.searchParams.get("utm_campaign"), 160),
      landingPath: normalizeText(`${url.pathname}${url.search}`, 300),
      referrerHost: parseReferrerHost(),
    };
  } catch {
    return {
      anonymousId: getGrowthAnonymousId(),
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      landingPath: null,
      referrerHost: parseReferrerHost(),
    };
  }
};

const readOptionalAccessToken = async (): Promise<string | null> => {
  try {
    return await readSupabaseAccessToken();
  } catch {
    return null;
  }
};

export const reportGrowthTelemetry = async ({
  source,
  eventName,
  metadata,
  occurredAt = null,
}: ReportGrowthTelemetryInput): Promise<void> => {
  if (typeof window === "undefined" || typeof fetch !== "function") return;

  try {
    const attribution = readGrowthAttributionPayload();
    const accessToken = await readOptionalAccessToken();
    await fetch(GROWTH_TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        source,
        eventName,
        metadata: {
          telemetry_version: GROWTH_TELEMETRY_VERSION,
          ...(metadata ?? {}),
        },
        occurredAt,
        attribution,
      }),
      keepalive: true,
      credentials: "same-origin",
    });
  } catch {
    // Growth telemetry is best-effort and must never block the product flow.
  }
};

export const trackMarketingPageView = (pageName: string, metadata?: JsonObject): void => {
  void reportGrowthTelemetry({
    source: GROWTH_MARKETING_PAGE_VIEW_SOURCE,
    eventName: "page_view",
    metadata: {
      page_name: normalizeText(pageName, 80),
      ...(metadata ?? {}),
    },
  });
};

export const trackMarketingCtaClicked = (ctaId: string, metadata?: JsonObject): void => {
  void reportGrowthTelemetry({
    source: GROWTH_MARKETING_CTA_CLICKED_SOURCE,
    eventName: "cta_clicked",
    metadata: {
      cta_id: normalizeText(ctaId, 120),
      ...(metadata ?? {}),
    },
  });
};

export const trackSignupSubmitted = (metadata?: JsonObject): void => {
  void reportGrowthTelemetry({
    source: GROWTH_AUTH_SIGNUP_SUBMITTED_SOURCE,
    eventName: "signup_submitted",
    metadata,
  });
};

export const trackSignupCompleted = (metadata?: JsonObject): void => {
  void reportGrowthTelemetry({
    source: GROWTH_AUTH_SIGNUP_COMPLETED_SOURCE,
    eventName: "signup_completed",
    metadata,
  });
};

export const trackBillingPricingViewed = (metadata?: JsonObject): void => {
  void reportGrowthTelemetry({
    source: GROWTH_BILLING_PRICING_VIEWED_SOURCE,
    eventName: "pricing_viewed",
    metadata,
  });
};

export const trackBillingUpgradeClicked = (metadata?: JsonObject): void => {
  void reportGrowthTelemetry({
    source: GROWTH_BILLING_UPGRADE_CLICKED_SOURCE,
    eventName: "upgrade_clicked",
    metadata,
  });
};
