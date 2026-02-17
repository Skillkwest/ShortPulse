import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const reportAppErrorMock = vi.fn();
const addBreadcrumbMock = vi.fn();
const redactUrlForTelemetryMock = vi.fn((value: string) => value);

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseClient: () => ({
    auth: {
      getSession: () => getSessionMock(),
    },
  }),
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
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-123" } },
      error: null,
    });
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
});
