import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readSupabaseAccessTokenMock = vi.fn();
const reportAppErrorMock = vi.fn();
const addBreadcrumbMock = vi.fn();
const redactUrlForTelemetryMock = vi.fn((value: string) => value);

vi.mock("../../lib/supabaseClient", () => ({
  readSupabaseAccessToken: () => readSupabaseAccessTokenMock(),
}));

vi.mock("../../lib/appErrorReporter", () => ({
  reportAppError: (payload: unknown) => reportAppErrorMock(payload),
}));

vi.mock("../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: (payload: unknown) => addBreadcrumbMock(payload),
  redactUrlForTelemetry: (value: string) => redactUrlForTelemetryMock(value),
}));

import { fetchWithAuth } from "../../lib/authenticatedFetch";

describe("fetchWithAuth telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    readSupabaseAccessTokenMock.mockResolvedValue("token-123");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not report expected admin auth failures (401)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 401 }));

    const response = await fetchWithAuth("/api/admin/error-events?page=1&limit=50", {
      method: "GET",
    });

    expect(response.status).toBe(401);
    expect(reportAppErrorMock).not.toHaveBeenCalled();
    expect(addBreadcrumbMock).toHaveBeenCalledTimes(1);
  });

  it("still reports admin server failures (500)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));

    const response = await fetchWithAuth("/api/admin/error-events?page=1&limit=50", {
      method: "GET",
    });

    expect(response.status).toBe(500);
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.api_response",
        statusCode: 500,
        severity: "medium",
      })
    );
  });

  it("continues reporting 401 failures for non-admin routes", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 401 }));

    const response = await fetchWithAuth("/api/media/resolve-previews", {
      method: "POST",
    });

    expect(response.status).toBe(401);
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.api_response",
        endpoint: "/api/media/resolve-previews",
        statusCode: 401,
        severity: "low",
      })
    );
  });

  it("retries opt-in network failures once before logging an incident", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const response = await fetchWithAuth("/api/pricing/model-policy", {
      method: "GET",
      shortpulseRetryNetworkOnce: true,
    });

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reportAppErrorMock).not.toHaveBeenCalled();
    expect(addBreadcrumbMock).toHaveBeenCalledTimes(1);
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "fetch",
      })
    );
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/pricing/model-policy",
      expect.not.objectContaining({
        shortpulseRetryNetworkOnce: true,
      })
    );
  });

  it("reports an opt-in network failure once when the retry also fails", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockRejectedValueOnce(new Error("still down"));

    await expect(
      fetchWithAuth("/api/pricing/model-policy", {
        method: "GET",
        shortpulseRetryNetworkOnce: true,
      })
    ).rejects.toThrow("still down");

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(reportAppErrorMock).toHaveBeenCalledTimes(1);
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.api_network",
        endpoint: "/api/pricing/model-policy",
        message: "still down",
      })
    );
  });
});
