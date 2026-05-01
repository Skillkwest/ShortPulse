import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportAppError } from "../appErrorReporter";

const readSupabaseAccessTokenMock = vi.fn();

vi.mock("../supabaseClient", () => ({
  readSupabaseAccessToken: () => readSupabaseAccessTokenMock(),
}));

vi.mock("../clientBreadcrumbs", () => ({
  getBreadcrumbsSnapshot: () => [],
}));

describe("appErrorReporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    readSupabaseAccessTokenMock.mockResolvedValue("token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("skips browser ResizeObserver loop notifications", async () => {
    await reportAppError({
      source: "client.runtime",
      scope: "app",
      severity: "high",
      message: "ResizeObserver loop completed with undelivered notifications.",
      route: "/ai-studio",
    });

    expect(readSupabaseAccessTokenMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports actionable runtime errors", async () => {
    await reportAppError({
      source: "client.runtime",
      scope: "app",
      severity: "high",
      message: "Cannot read properties of undefined",
      route: "/ai-studio",
    });

    expect(readSupabaseAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/log/client-error",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("skips non-ai-studio Fast Refresh reference misses in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await reportAppError({
      source: "client.runtime",
      scope: "app",
      severity: "high",
      message: "PricingCatalogSections is not defined",
      stack:
        "ReferenceError: PricingCatalogSections is not defined\nat Object.performReactRefresh (webpack:///react-refresh)\nat applyUpdate",
      route: "/admin/pricing",
    });

    expect(readSupabaseAccessTokenMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps ai-studio Fast Refresh reference misses visible in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await reportAppError({
      source: "client.runtime",
      scope: "app",
      severity: "high",
      message: "renderProperties is not defined",
      stack:
        "ReferenceError: renderProperties is not defined\nat Object.performReactRefresh (webpack:///react-refresh)\nat applyUpdate",
      route: "/ai-studio",
    });

    expect(readSupabaseAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/log/client-error",
      expect.objectContaining({
        method: "POST",
      })
    );
  });
});
