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

  it("logs admin auth verifier exceptions before catalog access", async () => {
    const authError = new Error("auth verifier unavailable");
    requireAdminUserMock.mockRejectedValueOnce(authError);

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(resolveCreatePulseBuiltInCatalogForAdminMock).not.toHaveBeenCalled();
    expect(saveCreatePulseBuiltInCatalogMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "api/admin/agent-instructions/pulse-builtins.auth",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to load built-in guided workflows.",
    });
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

  it("infers backend metadata for an admin-authored Prompt Modifier built-in", async () => {
    const inferredPromptModifierDefinition: CreatePulseBuiltInPresetDefinition = {
      presetId: "prompt_modifier",
      label: "Prompt Modifier",
      description: "Built-in guided Pulse for Prompt Modifier.",
      starterAssistantMessage: "Tell me what you want Prompt Modifier to help with.",
      workflowStageHints: null,
      artifactTarget: "text_artifact",
      systemInstructions: "Ask for a source prompt, then return a cleaner version.",
      pulseKind: "guided_workflow",
      runtimeMode: "workflow_gpt",
      activationMode: "activate_and_start",
      outputMode: "chat_reply",
      memoryPolicy: "session",
      schemaVersion: 2,
    };
    saveCreatePulseBuiltInCatalogMock.mockResolvedValue({
      builtInDefinitions: [inferredPromptModifierDefinition],
      updatedAt: "2026-05-08T17:05:00.000Z",
      updatedByUserId: "admin-1",
      updatedByEmail: "admin@example.com",
    });

    const req = {
      method: "PUT",
      body: {
        builtInDefinitions: [
          {
            title: "Prompt Modifier",
            prompt: "Ask for a source prompt, then return a cleaner version.",
          },
        ],
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveCreatePulseBuiltInCatalogMock).toHaveBeenCalledWith({
      builtInDefinitions: [inferredPromptModifierDefinition],
      expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
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

  it("rejects built-in Pulse ids that are unsafe for runtime namespaces", async () => {
    const req = {
      method: "PUT",
      body: {
        builtInDefinitions: [
          {
            ...CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0],
            presetId: "Prompt Modifier",
          },
        ],
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveCreatePulseBuiltInCatalogMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining("must not contain spaces or colons"),
    });
  });

  it("rejects retired built-in Pulse ids before normalization can drop them", async () => {
    const req = {
      method: "PUT",
      body: {
        builtInDefinitions: [
          {
            ...CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0],
            presetId: "legacy_prompt_modifier",
          },
        ],
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveCreatePulseBuiltInCatalogMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        'Pulse preset id "legacy_prompt_modifier" is retired. Choose a new safe preset id for this built-in Pulse.',
    });
  });

  it("infers starter messages when the admin omits them", async () => {
    const promptWithStarter = [
      "You are a prompt assistant.",
      "",
      "Your first message must be exactly:",
      '"Paste the prompt you want me to improve."',
    ].join("\n");
    const inferredDefinition: CreatePulseBuiltInPresetDefinition = {
      presetId: "prompt_helper",
      label: "Prompt Helper",
      description: "Built-in guided Pulse for Prompt Helper.",
      starterAssistantMessage: "Paste the prompt you want me to improve.",
      workflowStageHints: null,
      artifactTarget: "text_artifact",
      systemInstructions: promptWithStarter,
      pulseKind: "guided_workflow",
      runtimeMode: "workflow_gpt",
      activationMode: "activate_and_start",
      outputMode: "chat_reply",
      memoryPolicy: "session",
      schemaVersion: 2,
    };
    saveCreatePulseBuiltInCatalogMock.mockResolvedValue({
      builtInDefinitions: [inferredDefinition],
      updatedAt: "2026-05-08T17:05:00.000Z",
      updatedByUserId: "admin-1",
      updatedByEmail: "admin@example.com",
    });

    const req = {
      method: "PUT",
      body: {
        builtInDefinitions: [
          {
            title: "Prompt Helper",
            prompt: promptWithStarter,
          },
        ],
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveCreatePulseBuiltInCatalogMock).toHaveBeenCalledWith({
      builtInDefinitions: [inferredDefinition],
      expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects non-guided built-in Pulse runtime contracts", async () => {
    const req = {
      method: "PUT",
      body: {
        builtInDefinitions: [
          {
            ...CREATE_PULSE_SEEDED_BUILT_IN_DEFINITIONS[0],
            pulseKind: "custom_gpt",
          },
        ],
        expectedUpdatedAt: "2026-05-08T17:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(saveCreatePulseBuiltInCatalogMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Pulse "image" must use pulseKind "guided_workflow".',
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
