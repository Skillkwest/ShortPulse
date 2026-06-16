import { describe, expect, it } from "vitest";
import {
  SHORTPULSE_PRODUCTION_APP_ORIGIN,
  validateGuardedVercelFlag,
  validatePublicOriginPair,
  validateDeployedPublicOrigin,
} from "../../../scripts/lib/vercel_env_contract.mjs";

describe("vercel env contract public origin validation", () => {
  it("rejects loopback preview origins", () => {
    expect(
      validateDeployedPublicOrigin({
        environment: "preview",
        key: "APP_BASE_URL",
        value: "http://localhost:3000",
      })
    ).toContain("APP_BASE_URL must be an https URL for preview.");
  });

  it("requires the canonical production auth origin", () => {
    expect(
      validateDeployedPublicOrigin({
        environment: "production",
        key: "APP_BASE_URL",
        value: "https://preview.shortpulse.test",
      })
    ).toContain(`APP_BASE_URL must resolve to ${SHORTPULSE_PRODUCTION_APP_ORIGIN} for production.`);
  });

  it("accepts the canonical production auth origin", () => {
    expect(
      validateDeployedPublicOrigin({
        environment: "production",
        key: "APP_BASE_URL",
        value: SHORTPULSE_PRODUCTION_APP_ORIGIN,
      })
    ).toEqual([]);
  });

  it("rejects split public-origin values when both are configured", () => {
    expect(
      validatePublicOriginPair({
        appBaseUrl: "https://www.shortpulse.ai",
        publicApiBaseUrl: "https://preview.shortpulse.test",
        environment: "production",
      })
    ).toContain(
      "APP_BASE_URL and SHORTPULSE_PUBLIC_API_BASE_URL must match for production when both are configured."
    );
  });

  it("rejects production public signup being explicitly enabled", () => {
    expect(
      validateGuardedVercelFlag({
        environment: "production",
        key: "NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED",
        value: "true",
      })
    ).toContain(
      "NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED must not resolve to true in production because public signup must remain closed during the pre-launch production window."
    );
  });

  it("allows non-production public signup smoke-test flags", () => {
    expect(
      validateGuardedVercelFlag({
        environment: "preview",
        key: "NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED",
        value: "true",
      })
    ).toEqual([]);
  });
});
