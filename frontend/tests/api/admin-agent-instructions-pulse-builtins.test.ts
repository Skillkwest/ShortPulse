import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/agent-instructions/pulse-builtins";
import {
  CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
  type CreatePulseBuiltInPresetDefinition,
} from "../../lib/model-runtime/createPulseBuiltIns";

const requireAdminUserMock = vi.hoisted(() => vi.fn());
const logApiRouteExceptionMock = vi.hoisted(() => vi.fn());
const resolveCreatePulseBuiltInCatalogForAdminMock = vi.hoisted(() => vi.fn());
const saveCreatePulseBuiltInCatalogMock = vi.hoisted(() => vi.fn());
const CreatePulseBuiltInCatalogVersionMismatchErrorMock = vi.hoisted(
  () =>
    class CreatePulseBuiltInCatalogVersionMismatchError extends Error {
      constructor() {
        super("Create Pulse built-in catalog changed since it was loaded.");
        this.name = "CreatePulseBuiltInCatalogVersionMismatchError";
      }
    }
);

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/createPulseBuiltInControlPlane", () => ({
  CreatePulseBuiltInCatalogVersionMismatchError: CreatePulseBuiltInCatalogVersionMismatchErrorMock,
  resolveCreatePulseBuiltInCatalogForAdmin: (...args: unknown[]) =>
    resolveCreatePulseBuiltInCatalogForAdminMock(...args),
  saveCreatePulseBuiltInCatalog: (...args: unknown[]) => saveCreatePulseBuiltInCatalogMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("admin pulse built-ins API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("returns the resolved Pulse catalog", async () => {
    resolveCreatePulseBuiltInCatalogForAdminMock.mockResolvedValue({
      builtInDefinitions: CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
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
      builtInDefinitions: CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
      updatedAt: "2026-05-08T17:00:00.000Z",
      updatedByEmail: "admin@example.com",
      source: "control_plane",
      degraded: false,
    });
  });

  it("surfaces degraded seeded fallback state on reads", async () => {
    resolveCreatePulseBuiltInCatalogForAdminMock.mockResolvedValue({
      builtInDefinitions: CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
      degraded: true,
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      builtInDefinitions: CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
      degraded: true,
    });
  });

  it("persists the edited global Pulse catalog with an expected updatedAt token", async () => {
    const nextDefinitions: readonly CreatePulseBuiltInPresetDefinition[] = [
      {
        ...CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0],
        label: "Global Prompt Director",
      },
    ];
    saveCreatePulseBuiltInCatalogMock.mockResolvedValue({
      builtInDefinitions: nextDefinitions,
      updatedAt: "2026-05-08T17:05:00.000Z",
      updatedByUserId: "admin-1",
      updatedByEmail: "admin@example.com",
    });

    const req = {
      method: "PUT",
      body: {
        builtInDefinitions: nextDefinitions,
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveCreatePulseBuiltInCatalogMock).toHaveBeenCalledWith({
      builtInDefinitions: nextDefinitions,
      expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0");
    expect(res.json).toHaveBeenCalledWith({
      builtInDefinitions: nextDefinitions,
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
        builtInDefinitions: CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveCreatePulseBuiltInCatalogMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "expectedUpdatedAt is required so non-live catalog content cannot overwrite live built-ins.",
    });
  });

  it("returns 409 when the stored catalog changed before save", async () => {
    saveCreatePulseBuiltInCatalogMock.mockRejectedValue(
      new CreatePulseBuiltInCatalogVersionMismatchErrorMock()
    );

    const req = {
      method: "PUT",
      body: {
        builtInDefinitions: CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS,
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "The global Pulse catalog changed. Reload the latest stored set and try again.",
      code: "CATALOG_STALE",
    });
  });
});
