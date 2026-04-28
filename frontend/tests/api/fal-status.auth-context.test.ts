/**
 * Verifies Fal status polling ownership checks with token-first auth.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/fal/seedream-status";

const resolveProviderRequestOwnershipMock = vi.fn();
const logGenerationFailureMock = vi.fn();

vi.mock("../../lib/server/api/generationBilling", () => ({
  resolveProviderRequestOwnership: (...args: unknown[]) =>
    resolveProviderRequestOwnershipMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const mockFetchResponse = ({
  status,
  body,
}: {
  status: number;
  body: Record<string, unknown>;
}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

describe("POST /api/fal/seedream-status middleware auth-context ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SHORTPULSE_TRUST_PROXY_AUTH_HEADERS = "false";
  });

  it("keeps ownership enforcement with middleware-authenticated user context", async () => {
    resolveProviderRequestOwnershipMock.mockResolvedValue("forbidden");
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        status: 200,
        body: { id: "user-ctx" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      url: "/api/fal/seedream-status",
      headers: {
        authorization: "Bearer valid-token",
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "user-ctx",
        "x-shortpulse-user-app-metadata": encodeURIComponent("{}"),
        "x-shortpulse-user-user-metadata": encodeURIComponent("{}"),
      },
      body: { requestId: "foreign-request-id" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(resolveProviderRequestOwnershipMock).toHaveBeenCalledWith({
      userId: "user-ctx",
      providerRequestId: "foreign-request-id",
    });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still proxies status when middleware-authenticated ownership is confirmed", async () => {
    resolveProviderRequestOwnershipMock.mockResolvedValue("owned");
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        status: 200,
        body: { id: "user-ctx" },
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        status: 200,
        body: { status: "processing" },
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        status: 404,
        body: { error: "Not found" },
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        status: 404,
        body: { error: "Not found" },
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        status: 404,
        body: { error: "Not found" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      url: "/api/fal/seedream-status",
      headers: {
        authorization: "Bearer valid-token",
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "user-ctx",
        "x-shortpulse-user-app-metadata": encodeURIComponent("{}"),
        "x-shortpulse-user-user-metadata": encodeURIComponent("{}"),
      },
      body: { requestId: "owned-request-id" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(resolveProviderRequestOwnershipMock).toHaveBeenCalledWith({
      userId: "user-ctx",
      providerRequestId: "owned-request-id",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processing",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "running",
          isTerminal: false,
          providerState: "processing",
          queueState: "dispatched",
          statusLabel: "Processing...",
        }),
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("treats retryable 405/non-JSON result probes as transient and keeps polling payload", async () => {
    resolveProviderRequestOwnershipMock.mockResolvedValue("owned");
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        status: 200,
        body: { id: "user-ctx" },
      })
    );
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        status: 200,
        body: { status: "completed" },
      })
    );
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 405,
      text: async () => "<html>Method Not Allowed</html>",
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 405,
      text: async () => "<html>Method Not Allowed</html>",
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 405,
      text: async () => "<html>Method Not Allowed</html>",
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      url: "/api/fal/seedream-status",
      headers: {
        authorization: "Bearer valid-token",
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "user-ctx",
        "x-shortpulse-user-app-metadata": encodeURIComponent("{}"),
        "x-shortpulse-user-user-metadata": encodeURIComponent("{}"),
      },
      body: { requestId: "owned-request-id" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "running",
          isTerminal: false,
          providerState: "completed",
          recoveryPending: true,
          queueState: "dispatched",
          statusLabel: "Processing...",
        }),
      })
    );
    expect(logGenerationFailureMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
