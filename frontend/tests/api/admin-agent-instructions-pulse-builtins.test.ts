import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/agent-instructions/pulse-builtins";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const fetchActiveCreatePulseBuiltInCatalogMock = vi.fn();
const getSeededCreatePulseBuiltInDefinitionsMock = vi.fn();
const saveCreatePulseBuiltInCatalogMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/createPulseBuiltInControlPlane", () => ({
  fetchActiveCreatePulseBuiltInCatalog: (...args: unknown[]) =>
    fetchActiveCreatePulseBuiltInCatalogMock(...args),
  getSeededCreatePulseBuiltInDefinitions: (...args: unknown[]) =>
    getSeededCreatePulseBuiltInDefinitionsMock(...args),
  saveCreatePulseBuiltInCatalog: (...args: unknown[]) => saveCreatePulseBuiltInCatalogMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("admin Pulse built-ins API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    getSeededCreatePulseBuiltInDefinitionsMock.mockReturnValue([
      {
        presetId: "image",
        label: "Video Prompt Magic",
        description: "Seed description",
        starterAssistantMessage: "Upload",
        workflowStageHints: ["Image Gate"],
        artifactTarget: "video_prompt",
        systemInstructions: "Seed system",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        outputMode: "chat_reply",
        memoryPolicy: "session",
      },
    ]);
  });

  it("rejects unsupported methods", async () => {
    const req = { method: "DELETE" };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET, PUT");
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns seeded fallback when no stored row exists", async () => {
    fetchActiveCreatePulseBuiltInCatalogMock.mockResolvedValue(null);
    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      builtInDefinitions: expect.any(Array),
      updatedAt: null,
      updatedByEmail: null,
      source: "seed",
    });
  });

  it("persists the shared Pulse catalog", async () => {
    saveCreatePulseBuiltInCatalogMock.mockResolvedValue({
      builtInDefinitions: [
        {
          presetId: "image",
          label: "Global Prompt Director",
          description: "New description",
          starterAssistantMessage: "Upload",
          workflowStageHints: ["Image Gate"],
          artifactTarget: "video_prompt",
          systemInstructions: "New system",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
          outputMode: "chat_reply",
          memoryPolicy: "session",
        },
      ],
      updatedAt: "2026-05-05T18:05:00.000Z",
      updatedByUserId: "admin-1",
      updatedByEmail: "admin@example.com",
    });

    const req = {
      method: "PUT",
      body: {
        builtInDefinitions: [
          {
            presetId: "image",
            label: "Global Prompt Director",
            description: "New description",
            starterAssistantMessage: "Upload",
            workflowStageHints: ["Image Gate"],
            artifactTarget: "video_prompt",
            systemInstructions: "New system",
          },
        ],
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveCreatePulseBuiltInCatalogMock).toHaveBeenCalledWith({
      builtInDefinitions: [
        expect.objectContaining({
          presetId: "image",
          label: "Global Prompt Director",
        }),
      ],
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects malformed Pulse built-in payloads", async () => {
    const req = {
      method: "PUT",
      body: {
        builtInDefinitions: [
          { presetId: "", label: "Bad", description: "", systemInstructions: "" },
        ],
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
