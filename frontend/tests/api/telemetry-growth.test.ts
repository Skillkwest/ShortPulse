import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/telemetry/growth";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const getOptionalApiUserMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const upsertGrowthAttributionIdentityMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  getOptionalApiUser: (...args: unknown[]) => getOptionalApiUserMock(...args),
  getOptionalApiUserResult: async (...args: unknown[]) => ({
    user: await getOptionalApiUserMock(...args),
    authVerificationUnavailable: false,
  }),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

vi.mock("../../lib/server/api/growthTelemetry", async () => {
  const actual = await vi.importActual("../../lib/server/api/growthTelemetry");
  return {
    ...actual,
    upsertGrowthAttributionIdentity: (...args: unknown[]) =>
      upsertGrowthAttributionIdentityMock(...args),
  };
});

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/telemetry/growth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    getOptionalApiUserMock.mockResolvedValue(null);
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: null });
    upsertGrowthAttributionIdentityMock.mockResolvedValue(undefined);
  });

  it("rejects unsupported sources", async () => {
    const req = { method: "POST", body: { source: "telemetry.invalid" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(writeAppErrorLogMock).not.toHaveBeenCalled();
  });

  it("accepts anonymous marketing telemetry and stitches attribution inputs", async () => {
    const req = {
      method: "POST",
      body: {
        source: "telemetry.marketing.page_view",
        eventName: "page_view",
        metadata: { page_name: "landing" },
        attribution: {
          anonymousId: "anon_123",
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "spring_launch",
          landingPath: "/landing?utm_source=google",
          referrerHost: "www.google.com",
        },
      },
      headers: {
        "user-agent": "ua-test",
        host: "localhost:3000",
        "x-vercel-id": "iad1::growth",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(upsertGrowthAttributionIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.marketing.page_view",
        attribution: expect.objectContaining({
          anonymousId: "anon_123",
          utmSource: "google",
        }),
      })
    );
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.marketing.page_view",
        metadata: expect.objectContaining({
          telemetry_family: "marketing_funnel",
          event_name: "page_view",
          anonymous_id: "anon_123",
          page_name: "landing",
          user_agent: "ua-test",
          host: "localhost:3000",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it("bounds caller metadata before logging", async () => {
    const req = {
      method: "POST",
      body: {
        source: "telemetry.marketing.page_view",
        eventName: "page_view",
        metadata: {
          page_name: "landing",
          nested: { expensive: true },
          long_value: "x".repeat(400),
          telemetry_version: "caller-value",
        },
      },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          page_name: "landing",
          long_value: "x".repeat(240),
          telemetry_version: 1,
        }),
      })
    );
    const metadata = writeAppErrorLogMock.mock.calls[0]?.[0]?.metadata as Record<string, unknown>;
    expect(metadata.nested).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it("rate limits repeated requests from the same client", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const req = {
      method: "POST",
      body: {
        source: "telemetry.marketing.page_view",
        eventName: "page_view",
      },
      headers: {
        "x-forwarded-for": "203.0.113.10",
      },
    };

    for (let index = 0; index < 120; index += 1) {
      await handler(req as never, createMockResponse() as never);
    }

    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "60");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many requests",
      retryAfterSeconds: 60,
    });
    nowSpy.mockRestore();
  });

  it("attaches authenticated user context when present", async () => {
    getOptionalApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    const req = {
      method: "POST",
      body: {
        source: "telemetry.billing.pricing_viewed",
        eventName: "pricing_viewed",
        attribution: {
          anonymousId: "anon_456",
        },
      },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.billing.pricing_viewed",
        userId: "user-1",
        userEmail: "user@example.com",
        metadata: expect.objectContaining({
          telemetry_family: "billing_funnel",
        }),
      })
    );
  });
});
