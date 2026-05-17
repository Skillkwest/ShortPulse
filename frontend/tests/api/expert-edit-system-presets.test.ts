import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/ai/expert-edit-system-presets";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveRuntimeExpertEditSystemPresetCatalogMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/expertEditSystemPresetControlPlane", () => ({
  resolveRuntimeExpertEditSystemPresetCatalog: (...args: unknown[]) =>
    resolveRuntimeExpertEditSystemPresetCatalogMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/ai/expert-edit-system-presets", () => {
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

  it("returns the active Edit system preset catalog", async () => {
    resolveRuntimeExpertEditSystemPresetCatalogMock.mockResolvedValue({
      presetDefinitions: [{ presetId: "style_test", label: "Style Test" }],
      source: "control_plane",
      updatedAt: "2026-05-05T18:00:00.000Z",
      updatedByEmail: "admin@example.com",
      degraded: false,
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      presetDefinitions: [{ presetId: "style_test", label: "Style Test" }],
      source: "control_plane",
      updatedAt: "2026-05-05T18:00:00.000Z",
      updatedByEmail: "admin@example.com",
      degraded: false,
    });
  });

  it("returns degraded seed fallback metadata when runtime resolution fails soft", async () => {
    resolveRuntimeExpertEditSystemPresetCatalogMock.mockResolvedValue({
      presetDefinitions: [{ presetId: "style_test", label: "Style Test" }],
      source: "seed",
      updatedAt: null,
      updatedByEmail: null,
      degraded: true,
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      presetDefinitions: [{ presetId: "style_test", label: "Style Test" }],
      source: "seed",
      updatedAt: null,
      updatedByEmail: null,
      degraded: true,
    });
  });
});
