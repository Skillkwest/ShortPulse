import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/ai/create-pulse-builtins";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveRuntimeCreatePulseBuiltInCatalogMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/createPulseBuiltInControlPlane", () => ({
  isAuthoritativeCreatePulseBuiltInCatalogResolution: (resolution: {
    source?: string;
    degraded?: boolean;
  }) => resolution.source === "control_plane" && resolution.degraded !== true,
  resolveRuntimeCreatePulseBuiltInCatalog: (...args: unknown[]) =>
    resolveRuntimeCreatePulseBuiltInCatalogMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/ai/create-pulse-builtins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
  });

  it("rejects unsupported methods", async () => {
    const req = { method: "POST" };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns the active built-in catalog", async () => {
    resolveRuntimeCreatePulseBuiltInCatalogMock.mockResolvedValue({
      builtInDefinitions: [{ presetId: "image", label: "Video Prompt Magic" }],
      source: "control_plane",
      updatedAt: "2026-05-05T18:00:00.000Z",
      updatedByEmail: "admin@example.com",
      degraded: false,
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(resolveRuntimeCreatePulseBuiltInCatalogMock).toHaveBeenCalledWith({ bypassCache: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      builtInDefinitions: [{ presetId: "image", label: "Video Prompt Magic" }],
      source: "control_plane",
      updatedAt: "2026-05-05T18:00:00.000Z",
      updatedByEmail: "admin@example.com",
      degraded: false,
    });
  });

  it("fails closed when runtime resolution returns degraded fallback metadata", async () => {
    resolveRuntimeCreatePulseBuiltInCatalogMock.mockResolvedValue({
      builtInDefinitions: [{ presetId: "image", label: "Video Prompt Magic" }],
      source: "seed",
      updatedAt: null,
      updatedByEmail: null,
      degraded: true,
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Create Pulse built-ins are temporarily unavailable. Reload and try again.",
      source: "seed",
      degraded: true,
    });
  });
});
