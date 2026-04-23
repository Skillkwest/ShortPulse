/**
 * Minimal Stripe REST helpers for Checkout/Portal/Webhook flows.
 * Keeps dependencies light while we bootstrap payment pipelines.
 */
import crypto from "crypto";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const DEFAULT_STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

type StripeFormValue = string | number | boolean | null | undefined;
type StripeFormPayload = Record<string, StripeFormValue>;

const toFormBody = (payload: StripeFormPayload): URLSearchParams => {
  const form = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    form.append(key, String(value));
  });
  return form;
};

export const getStripeSecretKey = (): string => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return key;
};

export const getCanonicalAppBaseUrl = (): string => {
  const configured = process.env.APP_BASE_URL?.trim();
  if (!configured) {
    if (process.env.NODE_ENV !== "production") {
      return "http://localhost:3000";
    }
    throw new Error("APP_BASE_URL is not configured.");
  }

  const url = new URL(configured);
  return url.origin;
};

/**
 * Calls Stripe REST API with form-encoded request bodies.
 */
export const stripePostForm = async <T>(path: string, payload: StripeFormPayload): Promise<T> => {
  const secretKey = getStripeSecretKey();
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: toFormBody(payload),
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    const message = data?.error?.message || `Stripe call failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
};

/**
 * Calls Stripe REST API with GET semantics and simple query parameters.
 */
export const stripeGet = async <T>(path: string, query?: StripeFormPayload): Promise<T> => {
  const secretKey = getStripeSecretKey();
  const queryString = query ? toFormBody(query).toString() : "";
  const url = `${STRIPE_API_BASE}${path}${queryString ? `?${queryString}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    const message = data?.error?.message || `Stripe call failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
};

const parseStripeSignature = (
  header: string
): { timestamp: string; signatures: string[] } | null => {
  const parts = header.split(",").map((part) => part.trim());
  let timestamp = "";
  const signatures: string[] = [];
  parts.forEach((part) => {
    const [key, value] = part.split("=");
    if (!key || !value) return;
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value);
  });
  if (!timestamp || !signatures.length) return null;
  return { timestamp, signatures };
};

/**
 * Verifies Stripe webhook signatures (`Stripe-Signature`) using HMAC SHA-256.
 */
export const verifyStripeWebhookSignature = (
  rawBody: string,
  signatureHeader: string | undefined
): boolean => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !signatureHeader) return false;

  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed) return false;
  const timestampSeconds = Number(parsed.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const toleranceSeconds = Number(
    process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS ?? DEFAULT_STRIPE_WEBHOOK_TOLERANCE_SECONDS
  );
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds <= 0) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    return false;
  }

  const signedPayload = `${parsed.timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload, "utf8")
    .digest("hex");

  return parsed.signatures.some((candidate) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate));
    } catch {
      return false;
    }
  });
};
