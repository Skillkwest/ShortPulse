/**
 * Creates a short-lived, paid-plan signup intent for Supabase Auth creation gates.
 * The intent is not an entitlement; Stripe checkout remains the paid-plan authority.
 */
import { createHash } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  isPublicSignupEnabled,
  resolvePaidSignupPricingSelection,
  resolveSignupNextPath,
} from "../../../lib/authRedirects";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit, resolveApiClientIp } from "../../../lib/server/api/rateLimit";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type SignupIntentResponse =
  | {
      ok: true;
      expiresAt: string;
    }
  | {
      error: string;
    };

type ActiveOfferRow = {
  id: string;
  recurring_price_cents: number;
  stripe_price_id: string | null;
};

const SIGNUP_INTENT_TTL_MINUTES = 30;
const MAX_EMAIL_LENGTH = 320;
const MAX_NEXT_PATH_LENGTH = 600;

const hashValue = (value: string): string => createHash("sha256").update(value).digest("hex");

const readStringBodyField = (body: unknown, field: string): string | null => {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
};

const normalizeSignupEmail = (value: string | null): string | null => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized || normalized.length > MAX_EMAIL_LENGTH) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
};

const loadActivePaidAcquisitionOffer = async (
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  planId: string,
  billingInterval: string
): Promise<ActiveOfferRow | null> => {
  const result = await supabaseAdmin
    .from("billing_plan_offers")
    .select("id, recurring_price_cents, stripe_price_id")
    .eq("plan_id", planId)
    .eq("billing_interval", billingInterval)
    .eq("acquisition_enabled", true)
    .eq("is_active", true)
    .is("effective_end_at", null)
    .order("effective_start_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (result.error) {
    throw new Error(result.error.message || "Unable to verify the selected plan.");
  }

  const row = ((result.data ?? []) as ActiveOfferRow[])[0] ?? null;
  if (!row || row.recurring_price_cents <= 0 || !row.stripe_price_id?.trim()) {
    return null;
  }
  return row;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SignupIntentResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isPublicSignupEnabled()) {
    return res.status(403).json({ error: "Account creation is temporarily closed." });
  }

  if (
    !enforceApiRateLimit(req, res, {
      keyPrefix: "auth.signup-intent",
      maxRequests: 20,
      windowMs: 15 * 60 * 1000,
    })
  ) {
    return;
  }

  const email = normalizeSignupEmail(readStringBodyField(req.body, "email"));
  const rawNextPath = readStringBodyField(req.body, "nextPath")?.trim() ?? "";
  if (!email) {
    return res.status(400).json({ error: "Enter a valid email before creating an account." });
  }
  if (!rawNextPath || rawNextPath.length > MAX_NEXT_PATH_LENGTH) {
    return res.status(400).json({ error: "Choose a paid plan before creating an account." });
  }

  const signupNextPath = resolveSignupNextPath(rawNextPath);
  const selection = signupNextPath ? resolvePaidSignupPricingSelection(signupNextPath) : null;
  if (!signupNextPath || !selection) {
    return res.status(400).json({ error: "Choose a paid plan before creating an account." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const offer = await loadActivePaidAcquisitionOffer(
      supabaseAdmin,
      selection.planId,
      selection.billingInterval
    );
    if (!offer) {
      return res.status(409).json({ error: "The selected plan is not currently available." });
    }

    const expiresAt = new Date(Date.now() + SIGNUP_INTENT_TTL_MINUTES * 60 * 1000).toISOString();
    const insertResult = await supabaseAdmin.from("signup_intents").insert({
      email_hash: hashValue(email),
      plan_id: selection.planId,
      billing_interval: selection.billingInterval,
      pricing_intent: selection.pricingIntent,
      next_path: signupNextPath,
      offer_id: offer.id,
      expires_at: expiresAt,
      created_ip_hash: hashValue(resolveApiClientIp(req)),
      user_agent_hash: hashValue(String(req.headers["user-agent"] ?? "")),
    });

    if (insertResult.error) {
      throw new Error(insertResult.error.message || "Unable to create signup intent.");
    }

    return res.status(200).json({ ok: true, expiresAt });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api.auth.signup-intent",
    });
    return res.status(500).json({
      error: "Unable to prepare account creation right now.",
    });
  }
}
