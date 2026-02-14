import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/fal/status";

const requireApiUserMock = vi.fn();
const resolveProviderRequestOwnershipMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/generationBilling", () => ({
  captureSucceededGenerationByProviderRequest: vi.fn(),
  resolveProviderRequestOwnership: (...args: unknown[]) =>
    resolveProviderRequestOwnershipMock(...args),
  settleFailedGenerationByProviderRequest: vi.fn(),
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
  text: async () => JSON.stringify(body),
});

describe("POST /api/fal/status ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-key";
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("returns 403 when request ownership cannot be proven", async () => {
    resolveProviderRequestOwnershipMock.mockResolvedValue("unknown");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      body: { requestId: "mystery-request-id" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies status when ownership is confirmed", async () => {
    resolveProviderRequestOwnershipMock.mockResolvedValue("owned");
    const fetchMock = vi.fn();
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
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      body: { requestId: "owned-request-id" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: "processing" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
