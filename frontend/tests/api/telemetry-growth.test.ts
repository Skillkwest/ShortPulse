import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/telemetry/growth";

const getOptionalApiUserMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const upsertGrowthAttributionIdentityMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  getOptionalApiUser: (...args: unknown[]) => getOptionalApiUserMock(...args),
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
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/telemetry/growth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
