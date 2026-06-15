import crypto from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCanonicalAppBaseUrl, verifyStripeWebhookSignature } from "../../lib/server/api/stripe";

const signHeader = (timestampSeconds: number, rawBody: string, webhookSecret: string): string => {
  const payload = `${timestampSeconds}.${rawBody}`;
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload, "utf8")
    .digest("hex");
  return `t=${timestampSeconds},v1=${signature}`;
};

describe("stripe utils", () => {
  afterEach(() => {
    delete process.env.APP_BASE_URL;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS;
    vi.unstubAllEnvs();
  });

  it("returns canonical origin for APP_BASE_URL", () => {
    process.env.APP_BASE_URL = "https://app.shortpulse.test/base/path";
    expect(getCanonicalAppBaseUrl()).toBe("https://app.shortpulse.test");
  });

  it("falls back to localhost in non-production environments when APP_BASE_URL is unset", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(getCanonicalAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("verifies valid Stripe signatures and rejects stale signatures", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "stripe_webhook_test_secret";
    process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS = "300";

    const rawBody = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });
    const nowSeconds = Math.floor(Date.now() / 1000);

    const validHeader = signHeader(nowSeconds, rawBody, process.env.STRIPE_WEBHOOK_SECRET);
    expect(verifyStripeWebhookSignature(rawBody, validHeader)).toBe(true);

    const staleHeader = signHeader(nowSeconds - 3600, rawBody, process.env.STRIPE_WEBHOOK_SECRET);
    expect(verifyStripeWebhookSignature(rawBody, staleHeader)).toBe(false);
  });
});
