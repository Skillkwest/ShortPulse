import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import pulseStudioAgentHandler from "../../pages/api/ai/studio-agent-pulse";
import standardStudioAgentHandler from "../../pages/api/ai/studio-agent-standard";

const requireApiUserMock = vi.fn();
const runThinkerFormatterTurnMock = vi.fn();
const readAgentConversationCanonicalPromptMock = vi.fn();
const upsertAgentConversationCanonicalPromptMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveRuntimeSafetyProfileMock = vi.fn();
const resolveRuntimeCreatePulseBuiltInCatalogMock = vi.fn();
const resolveRequiredRuntimeAgentPromptMock = vi.fn();
let apiUserCounter = 0;

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../features/ai-agent/logic/studioAgentThinkerFormatter", () => ({
  runThinkerFormatterTurn: (...args: unknown[]) => runThinkerFormatterTurnMock(...args),
}));

vi.mock("../../lib/server/api/agentConversationState", async () => {
  const actual = await vi.importActual("../../lib/server/api/agentConversationState");
  return {
    ...(actual as object),
    readAgentConversationCanonicalPrompt: (...args: unknown[]) =>
      readAgentConversationCanonicalPromptMock(...args),
    upsertAgentConversationCanonicalPrompt: (...args: unknown[]) =>
      upsertAgentConversationCanonicalPromptMock(...args),
  };
});

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/agentSafetyPolicyControlPlane", () => ({
  resolveRuntimeSafetyProfile: (...args: unknown[]) => resolveRuntimeSafetyProfileMock(...args),
}));

vi.mock("../../lib/server/api/createPulseBuiltInControlPlane", () => ({
  resolveRuntimeCreatePulseBuiltInCatalog: (...args: unknown[]) =>
    resolveRuntimeCreatePulseBuiltInCatalogMock(...args),
}));

vi.mock("../../lib/server/api/runtimeAgentPromptControlPlane", () => ({
  resolveRequiredRuntimeAgentPrompt: (...args: unknown[]) =>
    resolveRequiredRuntimeAgentPromptMock(...args),
  RequiredRuntimeAgentPromptMissingError: class RequiredRuntimeAgentPromptMissingError extends Error {
    constructor(promptId: string) {
      super(`Runtime agent prompt ${promptId} is missing from the control plane.`);
      this.name = "RequiredRuntimeAgentPromptMissingError";
    }
  },
  RequiredRuntimeAgentPromptUnavailableError: class RequiredRuntimeAgentPromptUnavailableError extends Error {
    constructor(promptId: string) {
      super(`Runtime agent prompt ${promptId} requires a live control-plane connection.`);
      this.name = "RequiredRuntimeAgentPromptUnavailableError";
    }
  },
}));

const createMockResponse = () => {
  const headers = new Map<string, string>();
  const res: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
    getHeader: ReturnType<typeof vi.fn>;
  } = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
    getHeader: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.setHeader.mockImplementation((name: string, value: string) => {
    headers.set(name.toLowerCase(), value);
    return res;
  });
  res.getHeader.mockImplementation((name: string) => headers.get(name.toLowerCase()));
  return res;
};

const createBaseRequestBody = (
  clientSessionNamespace = "ai-studio:session-runtime-test::standard"
) => ({
  clientSessionKey: "session-runtime-test",
  clientSessionNamespace,
  messages: [{ role: "user", content: "Improve this prompt." }],
  context: {},
});

const createPulseRequestBody = () =>
  createBaseRequestBody("ai-studio:session-runtime-test::pulse:story_builder:pulse-session-test");

const createPulseContext = () => ({
  pulse: {
    presetId: "story_builder",
    label: "DFY Story Builder",
    instructions: "Guide the user toward a story-circle scene prompt.",
    runtimeMode: "workflow_gpt",
    activationMode: "activate_and_start",
    outputMode: "chat_reply",
    memoryPolicy: "session",
    source: "builtin",
  },
});

const resetRuntimeTestState = () => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-key";
  process.env.STUDIO_AGENT_ENABLED = "true";
  process.env.STUDIO_AGENT_SERVER_VISION_ENABLED = "false";
  delete process.env.STUDIO_AGENT_PULSE_MODEL;
  process.env.STUDIO_AGENT_SAFETY_POSTPROCESS_ENABLED = "true";
  process.env.STUDIO_AGENT_SAFETY_DEBUG = "false";
  process.env.STUDIO_AGENT_TIMEOUT_MS = String(20000);
  delete process.env.STUDIO_AGENT_VISION_TIMEOUT_MS;
  delete process.env.STUDIO_AGENT_TURN_TIMEOUT_MS;
  delete process.env.STUDIO_AGENT_PULSE_TURN_TIMEOUT_MS;
  delete process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED;
  delete process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES;
  delete process.env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT;

  requireApiUserMock.mockImplementation(async () => {
    apiUserCounter += 1;
    return { id: `user-${apiUserCounter}`, email: "user@example.com" };
  });
  resolveRuntimeSafetyProfileMock.mockResolvedValue({
    profileId: "prod_safe_v1",
    policyVersion: 1,
    source: "env",
  });
  resolveRuntimeCreatePulseBuiltInCatalogMock.mockResolvedValue({
    builtInDefinitions: [
      {
        presetId: "story_builder",
        label: "DFY Story Builder",
        description: "Guided story-circle workflow for scene plans and final image prompts.",
        starterAssistantMessage:
          "**Step 1 — Upload your characters.** Please upload 1–3+ character images.",
        workflowStageHints: [
          "Upload Characters",
          "Plot Seed",
          "Runtime",
          "Scene Review",
          "Image Prompts",
          "Dialogue Story",
        ],
        artifactTarget: "image_prompt",
        systemInstructions: "SERVER STORY BUILDER INSTRUCTIONS",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        outputMode: "chat_reply",
        memoryPolicy: "session",
      },
    ],
    source: "control_plane",
    updatedAt: "2026-05-05T18:00:00.000Z",
    updatedByEmail: "admin@example.com",
  });
  readAgentConversationCanonicalPromptMock.mockResolvedValue(null);
  upsertAgentConversationCanonicalPromptMock.mockResolvedValue("saved prompt");
  resolveRequiredRuntimeAgentPromptMock.mockResolvedValue({
    promptId: "STUDIO_AGENT_SYSTEM",
    promptBody: "Standard control-plane instructions.",
    updatedAt: "2026-05-05T18:00:00.000Z",
    updatedByEmail: "admin@example.com",
    source: "control_plane",
  });
  runThinkerFormatterTurnMock.mockResolvedValue({
    ok: true,
    result: {
      parsed: {
        message: "What story should we build first?",
        actions: undefined,
      },
      nextCanonical: null,
      semanticStatus: "needs_input",
      usage: {},
    },
  });
  vi.stubGlobal("fetch", vi.fn());
};

describe("AI Studio Create agent runtime boundaries", () => {
  beforeEach(() => {
    resetRuntimeTestState();
  });

  it("rejects Pulse runtime fields on the Standard route before provider execution", async () => {
    const req = {
      method: "POST",
      body: {
        ...createPulseRequestBody(),
        context: createPulseContext(),
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
  });

  it("rejects runtimeMode pulse on the Standard route", async () => {
    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(),
        runtimeMode: "pulse",
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects canonicalPrompt on the Standard route", async () => {
    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(),
        canonicalPrompt: "stale hidden continuity",
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects Pulse session namespaces on the Standard route", async () => {
    const req = {
      method: "POST",
      body: createPulseRequestBody(),
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
  });

  it("returns a Standard-only response without workflowSession", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Premium product hero prompt",
            },
          },
        ],
      }),
    });
    const req = { method: "POST", body: createBaseRequestBody() };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"role":"system"'),
      })
    );
    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        message: "Premium product hero prompt",
        canonicalPrompt: null,
        outcome_class: "success_message",
      })
    );
    expect(payload).not.toHaveProperty("workflowSession");
  });

  it("fails closed when the Standard runtime prompt is missing", async () => {
    const missingPromptError = new Error(
      "Runtime agent prompt STUDIO_AGENT_SYSTEM is missing from the control plane."
    );
    missingPromptError.name = "RequiredRuntimeAgentPromptMissingError";
    resolveRequiredRuntimeAgentPromptMock.mockRejectedValue(missingPromptError);
    const req = { method: "POST", body: createBaseRequestBody() };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(fetch).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Runtime agent prompt STUDIO_AGENT_SYSTEM is missing from the control plane.",
      })
    );
  });

  it("requires Pulse context on the Pulse route", async () => {
    const req = { method: "POST", body: createBaseRequestBody() };
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
  });

  it("rejects runtimeMode standard on the Pulse route", async () => {
    const req = {
      method: "POST",
      body: {
        ...createPulseRequestBody(),
        context: createPulseContext(),
        runtimeMode: "standard",
      },
    };
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects inbound canonical prompts on the Pulse route", async () => {
    const req = {
      method: "POST",
      body: {
        ...createPulseRequestBody(),
        context: createPulseContext(),
        canonicalPrompt: "Standard prompt memory must not seed Pulse.",
      },
    };
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
  });

  it("rejects Pulse session namespaces from a different preset", async () => {
    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(
          "ai-studio:session-runtime-test::pulse:other_preset:pulse-session-test"
        ),
        context: createPulseContext(),
      },
    };
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
  });

  it("strips generic last-assistant context before Pulse provider execution", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: "needs_input",
                message: "What story should we build first?",
                actions: null,
              }),
            },
          },
        ],
      }),
    });
    const req = {
      method: "POST",
      body: {
        ...createPulseRequestBody(),
        context: {
          ...createPulseContext(),
          lastAssistantMessage: "Standard assistant memory must not enter Pulse.",
        },
      },
    };
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const serializedRequest = requestInit?.body ?? "";
    expect(serializedRequest).not.toContain("Standard assistant memory must not enter Pulse.");
  });

  it("rejects Pulse workflow sessions from a different preset", async () => {
    const req = {
      method: "POST",
      body: {
        ...createPulseRequestBody(),
        context: {
          ...createPulseContext(),
          pulse: {
            ...createPulseContext().pulse,
            workflowSession: {
              presetId: "other_preset",
              status: "awaiting_input",
              currentStepIndex: 2,
              currentStepLabel: "Mismatched",
              currentStepPrompt: "This should not steer DFY Story Builder.",
              collectedInputs: ["stale input"],
              lastArtifact: null,
            },
          },
        },
      },
    };
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
  });

  it("rejects retired Pulse preset ids at the route boundary", async () => {
    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(
          "ai-studio:session-runtime-test::pulse:product_hero:pulse-session-test"
        ),
        context: {
          pulse: {
            ...createPulseContext().pulse,
            presetId: "product_hero",
          },
        },
      },
    };
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
  });

  it("runs Pulse through the Pulse runtime", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: "needs_input",
                message: "What story should we build first?",
                actions: null,
              }),
            },
          },
        ],
      }),
    });
    const req = {
      method: "POST",
      body: {
        ...createPulseRequestBody(),
        context: createPulseContext(),
      },
    };
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const requestPayload = requestInit?.body
      ? (JSON.parse(requestInit.body) as { messages?: Array<{ content?: string }> })
      : null;
    expect(JSON.stringify(requestPayload?.messages ?? [])).toContain("ACTIVE PULSE PROFILE");
    expect(JSON.stringify(requestPayload?.messages ?? [])).not.toContain(
      "You are a professional prompt writer for image generation."
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        message: "What story should we build first?",
        outcome_class: "success_message",
        workflowSession: expect.objectContaining({
          presetId: "story_builder",
          status: "awaiting_input",
        }),
      })
    );
  });

  it("overrides built-in Pulse instructions from the server control plane", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: "needs_input",
                message: "What story should we build first?",
                actions: null,
              }),
            },
          },
        ],
      }),
    });
    const req = {
      method: "POST",
      body: {
        ...createPulseRequestBody(),
        context: {
          pulse: {
            ...createPulseContext().pulse,
            instructions: "CLIENT OVERRIDE SHOULD NOT WIN",
            label: "Client Drifted Label",
            source: "builtin",
          },
        },
      },
    };
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const serializedRequest = requestInit?.body ?? "";
    expect(serializedRequest).toContain("SERVER STORY BUILDER INSTRUCTIONS");
    expect(serializedRequest).not.toContain("CLIENT OVERRIDE SHOULD NOT WIN");
    expect(serializedRequest).not.toContain("Client Drifted Label");
  });

  it("fails closed when a built-in Pulse request does not match the server catalog", async () => {
    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(
          "ai-studio:session-runtime-test::pulse:missing_builtin:pulse-session-test"
        ),
        context: {
          pulse: {
            presetId: "missing_builtin",
            label: "Missing Built-in",
            instructions: "CLIENT BUILT-IN OVERRIDE SHOULD NOT RUN",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      },
    };
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(fetch).not.toHaveBeenCalled();
    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        code: "PULSE_PRESET_UNAVAILABLE",
      })
    );
  });

  it("rejects custom Pulse requests that collide with a server-owned built-in preset id", async () => {
    const req = {
      method: "POST",
      body: {
        ...createPulseRequestBody(),
        context: {
          pulse: {
            ...createPulseContext().pulse,
            source: "custom",
          },
        },
      },
    };
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(fetch).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        code: "PULSE_PRESET_SOURCE_MISMATCH",
      })
    );
  });

  it("does not read or write generic canonical prompt persistence from Pulse", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: "prompt",
                message: "Premium product hero prompt",
                actions: { applyPrompt: "Premium product hero prompt" },
              }),
            },
          },
        ],
      }),
    });
    const req = {
      method: "POST",
      body: {
        ...createPulseRequestBody(),
        conversationId: "pulse-conversation",
        context: createPulseContext(),
      },
    };
    const res = createMockResponse();

    await pulseStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(readAgentConversationCanonicalPromptMock).not.toHaveBeenCalled();
    expect(upsertAgentConversationCanonicalPromptMock).not.toHaveBeenCalled();
  });

  it("keeps route execution out of the removed generic page module", () => {
    const repoRoot = path.resolve(__dirname, "../..");
    const genericRoutePath = path.join(repoRoot, `pages/api/ai/${"studio-agent"}.ts`);
    const standardRoute = readFileSync(
      path.join(repoRoot, "pages/api/ai/studio-agent-standard.ts"),
      "utf8"
    );
    const pulseRoute = readFileSync(
      path.join(repoRoot, "pages/api/ai/studio-agent-pulse.ts"),
      "utf8"
    );

    expect(existsSync(genericRoutePath)).toBe(false);
    expect(standardRoute).toContain("standardStudioAgentRuntime/runtime");
    expect(pulseRoute).toContain("pulseStudioAgentRuntime/runtime");
    expect(standardRoute).not.toContain("./studio-agent");
    expect(pulseRoute).not.toContain("./studio-agent");
  });

  it("keeps Pulse runtime out of generic canonical prompt persistence", () => {
    const repoRoot = path.resolve(__dirname, "../..");
    const pulseRuntime = readFileSync(
      path.join(repoRoot, "features/agent-runtime/pulseStudioAgentRuntime/runtime.ts"),
      "utf8"
    );

    expect(pulseRuntime).not.toContain("readStudioAgentCanonicalPrompt");
    expect(pulseRuntime).not.toContain("incomingCanonical");
    expect(pulseRuntime).not.toContain("STUDIO_AGENT_SYSTEM");
    expect(pulseRuntime).toContain("STUDIO_AGENT_WORKFLOW_SYSTEM prompt missing");
    expect(pulseRuntime).toContain("canonicalDbEnabled: false");
    expect(pulseRuntime).toContain("ai/studio-agent-pulse");
    expect(pulseRuntime).toContain("studio-agent-pulse");
    const pulseCoordinator = readFileSync(
      path.join(repoRoot, "features/agent-runtime/pulseStudioAgentRuntime/coordinator.ts"),
      "utf8"
    );
    expect(pulseCoordinator).not.toContain("lastAssistantMessage");
  });

  it("keeps the coordinator owned by the Pulse runtime tree", () => {
    const repoRoot = path.resolve(__dirname, "../..");
    const sharedCoordinatorPath = path.join(
      repoRoot,
      "features/agent-runtime/studioAgentCoordinator.ts"
    );
    const pulseCoordinatorPath = path.join(
      repoRoot,
      "features/agent-runtime/pulseStudioAgentRuntime/coordinator.ts"
    );
    const standardRuntime = readFileSync(
      path.join(repoRoot, "features/agent-runtime/standardStudioAgentRuntime/runtime.ts"),
      "utf8"
    );
    const pulseRuntime = readFileSync(
      path.join(repoRoot, "features/agent-runtime/pulseStudioAgentRuntime/runtime.ts"),
      "utf8"
    );

    expect(existsSync(sharedCoordinatorPath)).toBe(false);
    expect(existsSync(pulseCoordinatorPath)).toBe(true);
    expect(standardRuntime).not.toContain("coordinator");
    expect(pulseRuntime).toContain("./coordinator");
  });
});
