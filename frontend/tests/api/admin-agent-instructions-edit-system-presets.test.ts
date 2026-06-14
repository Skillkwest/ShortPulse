import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/agent-instructions/edit-system-presets";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveExpertEditSystemPresetCatalogForAdminMock = vi.fn();
const saveExpertEditSystemPresetCatalogMock = vi.fn();
const editPresetCatalogVersionMismatchError = new Error("stale");
editPresetCatalogVersionMismatchError.name = "ExpertEditSystemPresetCatalogVersionMismatchError";

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/expertEditSystemPresetControlPlane", () => ({
  ExpertEditSystemPresetCatalogVersionMismatchError: class ExpertEditSystemPresetCatalogVersionMismatchError extends Error {},
  resolveExpertEditSystemPresetCatalogForAdmin: (...args: unknown[]) =>
    resolveExpertEditSystemPresetCatalogForAdminMock(...args),
  saveExpertEditSystemPresetCatalog: (...args: unknown[]) =>
    saveExpertEditSystemPresetCatalogMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("admin edit system presets API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("returns the resolved preset catalog", async () => {
    resolveExpertEditSystemPresetCatalogForAdminMock.mockResolvedValue({
      presetDefinitions: [{ presetId: "selfie", label: "Selfie", prompt: "Prompt text" }],
      updatedAt: "2026-05-08T17:00:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
      degraded: false,
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      presetDefinitions: [{ presetId: "selfie", label: "Selfie", prompt: "Prompt text" }],
      updatedAt: "2026-05-08T17:00:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
      degraded: false,
    });
  });

  it("persists the edited preset catalog", async () => {
    saveExpertEditSystemPresetCatalogMock.mockResolvedValue({
      presetDefinitions: [{ presetId: "selfie", label: "Selfie", prompt: "Prompt text" }],
      updatedAt: "2026-05-08T17:05:00.000Z",
      updatedByUserId: "admin-1",
      updatedByEmail: "admin@example.com",
    });

    const req = {
      method: "PUT",
      body: {
        presetDefinitions: [{ presetId: "selfie", label: "Selfie", prompt: "Prompt text" }],
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveExpertEditSystemPresetCatalogMock).toHaveBeenCalledWith({
      presetDefinitions: [{ presetId: "selfie", label: "Selfie", prompt: "Prompt text" }],
      expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0");
    expect(res.json).toHaveBeenCalledWith({
      presetDefinitions: [{ presetId: "selfie", label: "Selfie", prompt: "Prompt text" }],
      updatedAt: "2026-05-08T17:05:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
      degraded: false,
    });
  });

  it("rejects saves that omit the expected updatedAt token", async () => {
    const req = {
      method: "PUT",
      body: {
        presetDefinitions: [{ presetId: "selfie", label: "Selfie", prompt: "Prompt text" }],
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveExpertEditSystemPresetCatalogMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "expectedUpdatedAt is required so non-live catalog content cannot overwrite live Edit presets.",
    });
  });

  it("rejects non-string expected updatedAt tokens", async () => {
    const req = {
      method: "PUT",
      body: {
        presetDefinitions: [{ presetId: "selfie", label: "Selfie", prompt: "Prompt text" }],
        expectedUpdatedAt: 123,
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveExpertEditSystemPresetCatalogMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "expectedUpdatedAt must be a string or null.",
    });
  });

  it("returns 409 when the stored Edit preset catalog is stale", async () => {
    saveExpertEditSystemPresetCatalogMock.mockRejectedValue(editPresetCatalogVersionMismatchError);

    const req = {
      method: "PUT",
      body: {
        presetDefinitions: [{ presetId: "selfie", label: "Selfie", prompt: "Prompt text" }],
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      code: "CATALOG_STALE",
      error: "The Edit preset catalog changed since you loaded it. Reload and try again.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });
});
