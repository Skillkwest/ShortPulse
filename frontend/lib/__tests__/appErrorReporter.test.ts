import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportAppError, resetAppErrorReporterBackpressureForTests } from "../appErrorReporter";

const readCachedSupabaseAccessTokenMock = vi.fn();

vi.mock("../supabaseAccessTokenHints", () => ({
  readCachedSupabaseAccessToken: () => readCachedSupabaseAccessTokenMock(),
}));

vi.mock("../clientBreadcrumbs", () => ({
  getBreadcrumbsSnapshot: () => [],
}));

describe("appErrorReporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetAppErrorReporterBackpressureForTests();
    readCachedSupabaseAccessTokenMock.mockReturnValue("token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 202 }));
  });

  it("skips browser ResizeObserver loop notifications", async () => {
    await reportAppError({
      source: "client.runtime",
      scope: "app",
      severity: "high",
      message: "ResizeObserver loop completed with undelivered notifications.",
      route: "/ai-studio",
    });

    expect(readCachedSupabaseAccessTokenMock).not.toHaveBeenCalled();
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

    expect(readCachedSupabaseAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/log/client-error",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("dedupes repeated equivalent client reports before they hit ingest", async () => {
    const event = {
      source: "client.ai_studio.media_library_save_failure",
      scope: "generation" as const,
      severity: "medium" as const,
      message: "No media available to save.",
      route: "/ai-studio/project-1",
    };

    await reportAppError(event);
    await reportAppError(event);

    expect(readCachedSupabaseAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["telemetry.ai_studio.generate_clicked", "generate_clicked.generate"],
    ["telemetry.ai_studio.ui_error_banner", "Unable to load media."],
    ["telemetry.ai_studio.media_library_panel_error", "Unable to load media library."],
    ["telemetry.ai_studio.media_library_modal_error", "Unable to load media library."],
    ["telemetry.ai_studio.elements_media_library_error", "Unable to load elements media."],
  ])(
    "skips low-severity ai-studio telemetry before it reaches ingest: %s",
    async (source, message) => {
      await reportAppError({
        source,
        scope: "app",
        severity: "low",
        message,
        route: "/ai-studio",
      });

      expect(readCachedSupabaseAccessTokenMock).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it("keeps medium-severity ai-studio stability telemetry ingestible", async () => {
    await reportAppError({
      source: "telemetry.ai_studio.stability.pressure_level_changed",
      scope: "app",
      severity: "medium",
      message: "ai_studio_stability.pressure_level_changed",
      route: "/ai-studio",
    });

    expect(readCachedSupabaseAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/log/client-error",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("keeps distinct ai-studio pressure transitions ingestible inside the dedupe window", async () => {
    const baseEvent = {
      source: "telemetry.ai_studio.stability.pressure_level_changed",
      scope: "app" as const,
      severity: "medium" as const,
      route: "/ai-studio",
    };

    await reportAppError({
      ...baseEvent,
      message: "ai_studio_stability.pressure_level_changed.0_to_1",
    });
    await reportAppError({
      ...baseEvent,
      message: "ai_studio_stability.pressure_level_changed.1_to_2",
    });

    expect(readCachedSupabaseAccessTokenMock).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("backs off after client-error ingest is rate limited", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: vi.fn((name: string) => (name === "Retry-After" ? "120" : null)),
        },
      } as never)
      .mockResolvedValue({ ok: true, status: 202 } as never);

    await reportAppError({
      source: "client.runtime",
      scope: "app",
      severity: "high",
      message: "first failure",
      route: "/ai-studio",
    });
    await reportAppError({
      source: "client.runtime",
      scope: "app",
      severity: "high",
      message: "second distinct failure",
      route: "/ai-studio",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
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

    expect(readCachedSupabaseAccessTokenMock).not.toHaveBeenCalled();
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

    expect(readCachedSupabaseAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/log/client-error",
      expect.objectContaining({
        method: "POST",
      })
    );
  });
});
