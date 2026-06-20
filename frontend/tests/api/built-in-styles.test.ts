import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/ai/built-in-styles";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveRuntimeBuiltInStyleCatalogMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/builtInStyleControlPlane", () => ({
  isAuthoritativeBuiltInStyleCatalogResolution: (resolution: {
    source?: string;
    degraded?: boolean;
  }) => resolution.source === "control_plane" && resolution.degraded !== true,
  resolveRuntimeBuiltInStyleCatalog: (...args: unknown[]) =>
    resolveRuntimeBuiltInStyleCatalogMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/ai/built-in-styles", () => {
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

  it("logs auth verifier exceptions before loading the catalog", async () => {
    const authError = new Error("auth verifier unavailable");
    requireApiUserMock.mockRejectedValueOnce(authError);

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(resolveRuntimeBuiltInStyleCatalogMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "api/ai/built-in-styles.auth",
      scope: "app",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to load built-in Styles." });
  });

  it("returns the active built-in Styles catalog", async () => {
    resolveRuntimeBuiltInStyleCatalogMock.mockResolvedValue({
      styleDefinitions: [
        {
          styleId: "cinematic",
          title: "Cinematic",
          stylePrompt: "cinematic prompt",
          previewImageUrl: "/Styles/Cinematic.png",
          referenceImageName: null,
          schemaVersion: 1,
        },
      ],
      source: "control_plane",
      updatedAt: "2026-06-10T18:00:00.000Z",
      updatedByEmail: "admin@example.com",
      degraded: false,
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(resolveRuntimeBuiltInStyleCatalogMock).toHaveBeenCalledWith({ bypassCache: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      styleDefinitions: [
        {
          styleId: "cinematic",
          title: "Cinematic",
          stylePrompt: "cinematic prompt",
          previewImageUrl: "/Styles/Cinematic.png",
          referenceImageName: null,
          schemaVersion: 1,
        },
      ],
      source: "control_plane",
      updatedAt: "2026-06-10T18:00:00.000Z",
      updatedByEmail: "admin@example.com",
      degraded: false,
    });
  });

  it("fails closed when runtime resolution returns seeded fallback styles", async () => {
    resolveRuntimeBuiltInStyleCatalogMock.mockResolvedValue({
      styleDefinitions: [
        {
          styleId: "photorealistic",
          title: "Photorealistic",
          stylePrompt: "legacy prompt",
          previewImageUrl: "/Styles/Photoreal.png",
          referenceImageName: null,
          schemaVersion: 1,
        },
      ],
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
      error: "Built-in Styles are temporarily unavailable. Reload and try again.",
      source: "seed",
      degraded: true,
    });
  });
});
