import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GROWTH_TELEMETRY_ENDPOINT,
  GROWTH_MARKETING_PAGE_VIEW_SOURCE,
  reportGrowthTelemetry,
} from "../growthTelemetry";

const readCachedSupabaseAccessTokenMock = vi.fn();

vi.mock("../supabaseAccessTokenHints", () => ({
  readCachedSupabaseAccessToken: () => readCachedSupabaseAccessTokenMock(),
}));

describe("growthTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readCachedSupabaseAccessTokenMock.mockReturnValue("token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal("crypto", {
      randomUUID: () => "growth-anon-id",
    } as Crypto);
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard?utm_source=ad");
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://example.com/article",
    });
  });

  it("reads the cached token lazily and includes auth when available", async () => {
    await reportGrowthTelemetry({
      source: GROWTH_MARKETING_PAGE_VIEW_SOURCE,
      eventName: "page_view",
      metadata: { page_name: "dashboard" },
    });

    expect(readCachedSupabaseAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      GROWTH_TELEMETRY_ENDPOINT,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        }),
      })
    );
  });

  it("omits auth headers when no cached token is available", async () => {
    readCachedSupabaseAccessTokenMock.mockReturnValue(null);

    await reportGrowthTelemetry({
      source: GROWTH_MARKETING_PAGE_VIEW_SOURCE,
      eventName: "page_view",
      metadata: { page_name: "dashboard" },
    });

    expect(readCachedSupabaseAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      GROWTH_TELEMETRY_ENDPOINT,
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.anything(),
        }),
      })
    );
  });
});
