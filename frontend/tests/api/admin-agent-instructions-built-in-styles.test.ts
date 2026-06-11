import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/agent-instructions/built-in-styles";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveBuiltInStyleCatalogForAdminMock = vi.fn();
const saveBuiltInStyleCatalogMock = vi.fn();
const MockBuiltInStyleCatalogVersionMismatchError = vi.hoisted(
  () =>
    class MockBuiltInStyleCatalogVersionMismatchError extends Error {
      constructor() {
        super("stale");
        this.name = "BuiltInStyleCatalogVersionMismatchError";
      }
    }
);

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/builtInStyleControlPlane", () => ({
  BuiltInStyleCatalogVersionMismatchError: MockBuiltInStyleCatalogVersionMismatchError,
  resolveBuiltInStyleCatalogForAdmin: (...args: unknown[]) =>
    resolveBuiltInStyleCatalogForAdminMock(...args),
  saveBuiltInStyleCatalog: (...args: unknown[]) => saveBuiltInStyleCatalogMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("admin built-in Styles API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("returns the resolved built-in Styles catalog", async () => {
    resolveBuiltInStyleCatalogForAdminMock.mockResolvedValue({
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
      updatedAt: "2026-06-10T18:00:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
      degraded: false,
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

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
      updatedAt: "2026-06-10T18:00:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
      degraded: false,
    });
  });

  it("persists the edited built-in Styles catalog", async () => {
    saveBuiltInStyleCatalogMock.mockResolvedValue({
      styleDefinitions: [
        {
          styleId: "cinematic",
          title: "Editorial Cinematic",
          stylePrompt: "cinematic prompt",
          previewImageUrl: "/Styles/Cinematic.png",
          referenceImageName: null,
          schemaVersion: 1,
        },
      ],
      updatedAt: "2026-06-10T18:05:00.000Z",
      updatedByUserId: "admin-1",
      updatedByEmail: "admin@example.com",
    });

    const req = {
      method: "PUT",
      body: {
        styleDefinitions: [
          {
            styleId: "cinematic",
            title: "Editorial Cinematic",
            stylePrompt: "cinematic prompt",
            previewImageUrl: "/Styles/Cinematic.png",
            schemaVersion: 1,
          },
        ],
        expectedUpdatedAt: "2026-06-10T18:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveBuiltInStyleCatalogMock).toHaveBeenCalledWith({
      styleDefinitions: [
        {
          styleId: "cinematic",
          title: "Editorial Cinematic",
          stylePrompt: "cinematic prompt",
          previewImageUrl: "/Styles/Cinematic.png",
          referenceImageName: null,
          schemaVersion: 1,
        },
      ],
      expectedUpdatedAt: "2026-06-10T18:00:00.000Z",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      styleDefinitions: [
        {
          styleId: "cinematic",
          title: "Editorial Cinematic",
          stylePrompt: "cinematic prompt",
          previewImageUrl: "/Styles/Cinematic.png",
          referenceImageName: null,
          schemaVersion: 1,
        },
      ],
      updatedAt: "2026-06-10T18:05:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
      degraded: false,
    });
  });

  it("rejects non-canonical built-in style ids", async () => {
    const req = {
      method: "PUT",
      body: {
        styleDefinitions: [
          {
            styleId: "Bad Style ID",
            title: "Bad Style ID",
            stylePrompt: "prompt",
            previewImageUrl: "/Styles/Bad.png",
            schemaVersion: 1,
          },
        ],
        expectedUpdatedAt: "2026-06-10T18:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveBuiltInStyleCatalogMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "Each built-in style must have a unique style id, title, style prompt, and preview image URL.",
    });
  });

  it("returns 409 when the stored built-in Styles catalog is stale", async () => {
    saveBuiltInStyleCatalogMock.mockRejectedValue(
      new MockBuiltInStyleCatalogVersionMismatchError()
    );

    const req = {
      method: "PUT",
      body: {
        styleDefinitions: [
          {
            styleId: "cinematic",
            title: "Cinematic",
            stylePrompt: "cinematic prompt",
            previewImageUrl: "/Styles/Cinematic.png",
            schemaVersion: 1,
          },
        ],
        expectedUpdatedAt: "2026-06-10T18:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      code: "CATALOG_STALE",
      error: "The built-in Styles catalog changed since you loaded it. Reload and try again.",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
  });
});
