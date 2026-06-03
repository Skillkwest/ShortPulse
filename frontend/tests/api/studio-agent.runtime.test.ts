import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import pulseStudioAgentHandler from "../../pages/api/ai/studio-agent-pulse";
import standardStudioAgentHandler from "../../pages/api/ai/studio-agent-standard";
import { resolveStandardOpenAiExecutionProfile } from "../../features/agent-runtime/standardStudioAgentRuntime/runtime";

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
  isAuthoritativeCreatePulseBuiltInCatalogResolution: (resolution: {
    source?: string;
    degraded?: boolean;
  }) => resolution.source === "control_plane" && resolution.degraded !== true,
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

const createMixedStandardRequestBody = () => ({
  ...createBaseRequestBody(),
  context: {
    modeHint: "reference",
    focusedSource: "image",
    references: [
      {
        id: "reference-image-1",
        kind: "image",
        caption: "Crown reference",
      },
      {
        id: "reference-prompt-1",
        kind: "prompt",
        promptSnippet: "Describe the ring crown headdress.",
      },
    ],
    media: [
      {
        id: "reference-image-1",
        kind: "image",
        url: "https://example.com/reference-image.png",
        thumbnailAlt: "Reference image",
      },
    ],
  },
});

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
  delete process.env.STUDIO_AGENT_UPSTREAM_MAX_ATTEMPTS;
  delete process.env.STUDIO_AGENT_UPSTREAM_RETRY_BASE_MS;
  delete process.env.STUDIO_AGENT_UPSTREAM_RETRY_MAX_MS;
  delete process.env.STUDIO_AGENT_STANDARD_RESPONSES_ENABLED;
  delete process.env.STUDIO_AGENT_STANDARD_CHAT_FALLBACK_ENABLED;
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

  it("uses the vision execution profile for Standard mixed turns", () => {
    expect(
      resolveStandardOpenAiExecutionProfile({
        flow: "MIXED",
        openAiModel: "gpt-standard",
        openAiVisionModel: "gpt-vision",
        turnTimeoutMs: 20000,
        visionTimeoutMs: 20000,
        pulseTurnTimeoutMs: 45000,
      })
    ).toEqual({
      model: "gpt-vision",
      timeoutMs: 45000,
      imageDetail: "auto",
    });

    expect(
      resolveStandardOpenAiExecutionProfile({
        flow: "TEXT_ONLY",
        openAiModel: "gpt-standard",
        openAiVisionModel: "gpt-vision",
        turnTimeoutMs: 20000,
        visionTimeoutMs: 45000,
        pulseTurnTimeoutMs: 45000,
      })
    ).toEqual({
      model: "gpt-standard",
      timeoutMs: 20000,
      imageDetail: "high",
    });

    expect(
      resolveStandardOpenAiExecutionProfile({
        flow: "TEXT_ONLY",
        openAiModel: "gpt-standard",
        openAiVisionModel: "gpt-vision",
        turnTimeoutMs: 20000,
        visionTimeoutMs: 45000,
        pulseTurnTimeoutMs: 45000,
        textPayloadChars: 3000,
      })
    ).toEqual({
      model: "gpt-standard",
      timeoutMs: 45000,
      imageDetail: "high",
    });
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

  it("returns a Standard reusable-prompt response without workflowSession", async () => {
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
        actions: undefined,
        canonicalPrompt: null,
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
      })
    );
    expect(payload).not.toHaveProperty("workflowSession");
  });

  it("routes Standard through Responses transport when the Standard responses flag is enabled", async () => {
    process.env.STUDIO_AGENT_STANDARD_RESPONSES_ENABLED = "true";
    process.env.STUDIO_AGENT_STANDARD_CHAT_FALLBACK_ENABLED = "false";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "resp_standard_1",
          model: "gpt-5.5",
          output: [
            {
              content: [{ type: "output_text", text: "Responses transport prompt" }],
            },
          ],
          usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = { method: "POST", body: createBaseRequestBody() };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        body: expect.stringContaining('"input"'),
      })
    );
    const requestBody = JSON.parse(
      String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body ?? "{}")
    ) as {
      store?: boolean;
      previous_response_id?: string;
    };
    expect(requestBody.store).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        message: "Responses transport prompt",
        actions: undefined,
        canonicalPrompt: null,
        conversationState: {
          previousResponseId: "resp_standard_1",
        },
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
      })
    );
  });

  it("keeps explicit Standard prompt artifacts on the success_prompt lane", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                message: "Here is a stronger reusable prompt.",
                actions: {
                  applyPrompt: "A stronger reusable prompt with cleaner cinematic direction.",
                },
              }),
            },
          },
        ],
      }),
    });
    const req = { method: "POST", body: createBaseRequestBody() };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    const payload = res.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        message: "Here is a stronger reusable prompt.",
        actions: {
          applyPrompt: "A stronger reusable prompt with cleaner cinematic direction.",
        },
        canonicalPrompt: null,
        outcome_class: "success_prompt",
        reason_code: "SUCCESS_PROMPT",
      })
    );
  });

  it("passes Standard previous_response_id through the Responses transport when conversation state exists", async () => {
    process.env.STUDIO_AGENT_STANDARD_RESPONSES_ENABLED = "true";
    process.env.STUDIO_AGENT_STANDARD_CHAT_FALLBACK_ENABLED = "false";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "resp_standard_2",
          model: "gpt-5.5",
          output: [
            {
              content: [{ type: "output_text", text: "Stateful responses transport prompt" }],
            },
          ],
          usage: { input_tokens: 13, output_tokens: 9, total_tokens: 22 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(),
        conversationState: {
          previousResponseId: "resp_standard_1",
        },
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    const requestBody = JSON.parse(
      String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body ?? "{}")
    ) as {
      previous_response_id?: string;
      store?: boolean;
    };
    expect(requestBody.previous_response_id).toBe("resp_standard_1");
    expect(requestBody.store).toBe(true);
    const payload = res.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        message: "Stateful responses transport prompt",
        conversationState: {
          previousResponseId: "resp_standard_2",
        },
      })
    );
  });

  it("compacts Standard replay to session memory plus the latest user turn when Responses state is active without chat fallback", async () => {
    process.env.STUDIO_AGENT_STANDARD_RESPONSES_ENABLED = "true";
    process.env.STUDIO_AGENT_STANDARD_CHAT_FALLBACK_ENABLED = "false";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "resp_standard_compact_1",
          model: "gpt-5.5",
          output: [
            {
              content: [{ type: "output_text", text: "Compacted responses transport prompt" }],
            },
          ],
          usage: { input_tokens: 15, output_tokens: 9, total_tokens: 24 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-runtime-test",
        clientSessionNamespace: "ai-studio:session-runtime-test::standard",
        runtimeMode: "standard",
        conversationState: {
          previousResponseId: "resp_standard_prev",
        },
        messages: [
          {
            role: "assistant",
            content: [
              "Standard session memory:",
              "Latest user intent: Refine the product prompt.",
              "Next best action: Respond directly to the current task.",
            ].join("\n"),
          },
          { role: "user", content: "old user turn" },
          { role: "assistant", content: "old assistant reply" },
          { role: "user", content: "latest user turn" },
        ],
        context: {},
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    const requestBody = JSON.parse(
      String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body ?? "{}")
    ) as {
      input?: Array<{ role?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    expect(requestBody.input).toEqual([
      expect.objectContaining({ role: "system" }),
      expect.objectContaining({
        role: "assistant",
        content: [
          expect.objectContaining({
            type: "input_text",
            text: expect.stringContaining("Standard session memory:"),
          }),
        ],
      }),
      expect.objectContaining({
        role: "user",
        content: [
          expect.objectContaining({
            type: "input_text",
            text: "latest user turn",
          }),
        ],
      }),
    ]);
  });

  it("keeps richer Standard session-memory decisions in the compacted Responses lane for longer sessions", async () => {
    process.env.STUDIO_AGENT_STANDARD_RESPONSES_ENABLED = "true";
    process.env.STUDIO_AGENT_STANDARD_CHAT_FALLBACK_ENABLED = "false";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "resp_standard_long_1",
          model: "gpt-5.5",
          output: [
            {
              content: [{ type: "output_text", text: "Long-session responses transport prompt" }],
            },
          ],
          usage: { input_tokens: 19, output_tokens: 11, total_tokens: 30 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-runtime-test",
        clientSessionNamespace: "ai-studio:session-runtime-test::standard",
        runtimeMode: "standard",
        conversationState: {
          previousResponseId: "resp_standard_prev_long",
        },
        messages: [
          {
            role: "assistant",
            content: [
              "Standard session memory:",
              "Latest user intent: Adults 25-34.",
              "Latest reusable prompt artifact: Luxury skincare launch campaign with warm neutral palette and tactile product textures",
              "Earlier user goals to consider: Help me shape a premium skincare launch campaign for adults 25-34.",
              "Decisions carried forward: Answered follow-up: What audience should this target first? -> Adults 25-34. | Answered follow-up: Should copy be minimal? -> Yes. | Answered follow-up: Any color direction? -> Warm neutrals. | A reusable prompt is available. | The current prompt source is references.",
              "Next best action: Refine or generate from the accepted prompt.",
            ].join("\n"),
          },
          {
            role: "user",
            content: "Help me shape a premium skincare launch campaign for adults 25-34.",
          },
          { role: "assistant", content: "Should the tone feel more clinical or more luxurious?" },
          { role: "user", content: "More luxurious." },
          { role: "user", content: "Give me three darker options." },
        ],
        context: {
          modeHint: "chat",
        },
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    const requestBody = JSON.parse(
      String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body ?? "{}")
    ) as {
      input?: Array<{ role?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    expect(requestBody.input).toEqual([
      expect.objectContaining({ role: "system" }),
      expect.objectContaining({
        role: "assistant",
        content: [
          expect.objectContaining({
            type: "input_text",
            text: expect.stringContaining(
              "Answered follow-up: What audience should this target first? -> Adults 25-34."
            ),
          }),
        ],
      }),
      expect.objectContaining({
        role: "user",
        content: [
          expect.objectContaining({
            type: "input_text",
            text: "Give me three darker options.",
          }),
        ],
      }),
    ]);
    expect(JSON.stringify(requestBody.input ?? [])).not.toContain(
      "Should the tone feel more clinical or more luxurious?"
    );
    expect(JSON.stringify(requestBody.input ?? [])).not.toContain("More luxurious.");
  });

  it("appends the restrained Standard formatting guidance to the runtime system prompt", async () => {
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

    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const requestBody = JSON.parse(String(requestInit?.body ?? "{}")) as {
      messages?: Array<{ role?: string; content?: string }>;
    };
    const systemMessage = requestBody.messages?.find(
      (message) => message.role === "system"
    )?.content;

    expect(systemMessage).toContain("Prefer a calm, readable response shape");
    expect(systemMessage).toContain("Good shape examples:");
    expect(systemMessage).toContain("Bad shape examples:");
    expect(systemMessage).toContain("Avoid visual separators");
    expect(systemMessage).toContain("Pulse-style guided formatting");
  });

  it("adds compact Standard runtime context to the system prompt when Standard context is present", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Thanks, I used the Standard runtime context.",
            },
          },
        ],
      }),
    });
    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(),
        context: {
          activePrompt: "Golden-hour portrait with premium editorial styling.",
          modelId: "gpt-image-2",
          modeHint: "reference",
          focusedSource: "prompt",
          lastAssistantMessage: "Would you like this to feel softer or more dramatic?",
          references: [
            {
              id: "ref-prompt-1",
              kind: "prompt",
              promptSnippet: "Golden-hour portrait with soft rim light.",
            },
            {
              id: "ref-image-1",
              kind: "image",
              caption: "Editorial portrait reference",
            },
          ],
          selectedReferenceIds: ["ref-prompt-1"],
        },
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const requestBody = JSON.parse(String(requestInit?.body ?? "{}")) as {
      messages?: Array<{ role?: string; content?: string }>;
    };
    const systemMessage = requestBody.messages?.find(
      (message) => message.role === "system"
    )?.content;

    expect(systemMessage).toContain("Standard runtime context:");
    expect(systemMessage).toContain("Mode hint: reference");
    expect(systemMessage).toContain("Focused source:");
    expect(systemMessage).toContain(
      "Visible composer prompt: Golden-hour portrait with premium editorial styling."
    );
    expect(systemMessage).toContain(
      "Most recent assistant reply: Would you like this to feel softer or more dramatic?"
    );
    expect(systemMessage).toContain("Selected reference count: 1");
    expect(systemMessage).toContain("Prompt reference count: 1");
    expect(systemMessage).toContain("Image reference count: 1");
    expect(systemMessage).toContain("Current model id: gpt-image-2");
  });

  it("adds Standard reply-behavior guidance for follow-up and assistant-output-focused turns", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "I continued the prompt refinement.",
            },
          },
        ],
      }),
    });
    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(),
        messages: [{ role: "user", content: "Make it feel warmer and more premium." }],
        context: {
          activePrompt: "Premium editorial portrait in soft golden-hour light.",
          modeHint: "reference",
          focusedSource: "agent-output",
          lastAssistantMessage: "Would you like this to feel softer or more dramatic?",
        },
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const requestBody = JSON.parse(String(requestInit?.body ?? "{}")) as {
      messages?: Array<{ role?: string; content?: string }>;
    };
    const systemMessage = requestBody.messages?.find(
      (message) => message.role === "system"
    )?.content;

    expect(systemMessage).toContain("Standard reply behavior:");
    expect(systemMessage).toContain(
      "Use the conversation's Standard session memory to preserve active goals, constraints, and accepted prompt direction, but do not quote that memory block verbatim."
    );
    expect(systemMessage).toContain(
      "When the latest user turn already gives enough direction to continue, prefer a concrete refinement over another clarifying question."
    );
    expect(systemMessage).toContain(
      "The previous assistant turn ended with a question, but the latest user turn is a direct revision request. Apply that revision to the current direction instead of treating it like a short answer."
    );
    expect(systemMessage).toContain(
      "Reference mode is active. Use the referenced prompts or images when they are relevant"
    );
    expect(systemMessage).toContain(
      "The user is focused on prior assistant output. Build on that output directly instead of starting a new direction unless the latest user turn asks for one."
    );
    expect(systemMessage).toContain(
      "A visible composer prompt already exists. If you improve it, preserve its core intent unless the user asks to change direction."
    );
  });

  it("emits Standard telemetry with pre-openai stage latencies", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
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

    expect(infoSpy).toHaveBeenCalled();
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[1] ?? "{}")) as {
      trace_id?: string | null;
      latency_ms_stage?: Record<string, number>;
    };
    expect(typeof payload.trace_id).toBe("string");
    expect((payload.trace_id ?? "").length).toBeGreaterThan(0);
    expect(payload.latency_ms_stage).toEqual(
      expect.objectContaining({
        auth_verification: expect.any(Number),
        request_envelope: expect.any(Number),
        runtime_prompt_resolution: expect.any(Number),
        standard_openai_roundtrip: expect.any(Number),
      })
    );
    infoSpy.mockRestore();
  });

  it("records the Standard trace id in exception logs for upstream aborts", async () => {
    process.env.STUDIO_AGENT_PULSE_TURN_TIMEOUT_MS = String(45000);
    process.env.STUDIO_AGENT_UPSTREAM_RETRY_BASE_MS = "0";
    process.env.STUDIO_AGENT_UPSTREAM_RETRY_MAX_MS = "0";
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DOMException("aborted", "AbortError")
    );
    const req = { method: "POST", body: createMixedStandardRequestBody() };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "ai/studio-agent-standard",
        metadata: expect.objectContaining({
          trace_id: expect.any(String),
          conversation_id: "session-runtime-test",
          stage: "standard_openai",
          flow: "MIXED",
          execution_model: expect.any(String),
          execution_image_detail: "auto",
          effective_timeout_ms: 45000,
          configured_turn_timeout_ms: 20000,
          configured_vision_timeout_ms: 20000,
          configured_pulse_turn_timeout_ms: 45000,
          retry_count: 1,
          message_count: 1,
          text_payload_chars: expect.any(Number),
          latest_user_chars: expect.any(Number),
          prompt_reference_chars: expect.any(Number),
          prompt_reference_snippet_count: 1,
          reference_count: 2,
          image_reference_count: 1,
          prompt_reference_count: 1,
          media_count: 1,
          image_media_count: 1,
          mode_hint: "reference",
          focused_source: "image",
          stage_latency_ms: expect.objectContaining({
            auth_verification: expect.any(Number),
            request_envelope: expect.any(Number),
            runtime_prompt_resolution: expect.any(Number),
            standard_openai_roundtrip: expect.any(Number),
          }),
        }),
      })
    );
    const payload = res.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(typeof payload.traceId).toBe("string");
    expect(String(payload.traceId).length).toBeGreaterThan(0);
    expect(payload.detail).toBe("OpenAI request timed out");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("maps Standard provider refusals to the safety refusal contract", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "I cannot help with that request due to safety policy.",
            },
          },
        ],
      }),
    });
    const req = { method: "POST", body: createBaseRequestBody() };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        message: "I cannot describe this.",
        actions: undefined,
        outcome_class: "refusal_safety",
        reason_code: "SAFETY_OUTPUT_REFUSAL",
        canonicalPrompt: null,
      })
    );
  });

  it("does not collapse benign Standard image-attribute uncertainty into a safety refusal", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "I am not able to identify or guess that particular attribute from the image here. I can still help with other non-sensitive details from the image.",
            },
          },
        ],
      }),
    });
    const req = { method: "POST", body: createBaseRequestBody() };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        message:
          "I am not able to identify or guess that particular attribute from the image here. I can still help with other non-sensitive details from the image.",
        actions: undefined,
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
      })
    );
    expect(payload.outcome_class).not.toBe("refusal_safety");
  });

  it("keeps a harmless Standard image-attribute answer on the direct conversational lane", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Her top is black.",
            },
          },
        ],
      }),
    });
    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(),
        messages: [{ role: "user", content: "What color is her top?" }],
        context: {
          modeHint: "describe",
          focusedSource: "image",
          references: [{ id: "ref-image-1", kind: "image", caption: "Portrait reference" }],
        },
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        message: "Her top is black.",
        actions: undefined,
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
      })
    );
    expect(payload.outcome_class).not.toBe("refusal_safety");
  });

  it("keeps a simple Standard chat answer compact instead of converting it into a prompt artifact", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "It keeps the tone premium while making the visual direction easier to execute.",
            },
          },
        ],
      }),
    });
    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(),
        messages: [{ role: "user", content: "Summarize this in one sentence." }],
        context: {
          modeHint: "chat",
          lastAssistantMessage: "Here is the longer explanation of the current direction.",
        },
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        message: "It keeps the tone premium while making the visual direction easier to execute.",
        actions: undefined,
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
      })
    );
  });

  it("serializes explicit Standard prompt attachments into the latest user turn", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Thanks, I used the attached reference text.",
            },
          },
        ],
      }),
    });
    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(),
        context: {
          modeHint: "reference",
          references: [
            {
              id: "ref-prompt-1",
              kind: "prompt",
              promptSnippet: "Golden-hour portrait with soft rim light.",
            },
          ],
          selectedReferenceIds: ["ref-prompt-1"],
          focusedSource: "prompt",
          focusedReferenceId: "ref-prompt-1",
        },
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    const fetchBody = JSON.parse(
      String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body ?? "{}")
    ) as { messages?: Array<{ role: string; content: unknown }> };
    const latestUserMessage = [...(fetchBody.messages ?? [])]
      .reverse()
      .find((message) => message.role === "user");
    expect(latestUserMessage?.content).toBe(
      "Improve this prompt.\n\nAttached reference text:\n- Golden-hour portrait with soft rim light."
    );
  });
  it("does not duplicate exact-match Standard prompt attachments into the latest user turn", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Thanks, I used the prompt text once.",
            },
          },
        ],
      }),
    });
    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(),
        messages: [
          {
            role: "user",
            content: "Golden-hour portrait with soft rim light.",
          },
        ],
        context: {
          modeHint: "reference",
          references: [
            {
              id: "ref-prompt-1",
              kind: "prompt",
              promptSnippet: "Golden-hour portrait with soft rim light.",
            },
          ],
          selectedReferenceIds: ["ref-prompt-1"],
          focusedSource: "prompt",
          focusedReferenceId: "ref-prompt-1",
        },
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    const fetchBody = JSON.parse(
      String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body ?? "{}")
    ) as { messages?: Array<{ role: string; content: unknown }> };
    const latestUserMessage = [...(fetchBody.messages ?? [])]
      .reverse()
      .find((message) => message.role === "user");
    expect(latestUserMessage?.content).toBe("Golden-hour portrait with soft rim light.");
  });

  it("retries transient Standard upstream failures before succeeding", async () => {
    process.env.STUDIO_AGENT_UPSTREAM_RETRY_BASE_MS = "0";
    process.env.STUDIO_AGENT_UPSTREAM_RETRY_MAX_MS = "0";
    (fetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new DOMException("aborted", "AbortError"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Recovered after retry.",
              },
            },
          ],
        }),
      });
    const req = { method: "POST", body: createBaseRequestBody() };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Recovered after retry.",
        traceId: expect.any(String),
      })
    );
  });

  it("uses the Standard mixed-turn vision model profile for image attachments", async () => {
    process.env.OPENAI_MODEL = "gpt-standard";
    process.env.OPENAI_VISION_MODEL = "gpt-vision";
    process.env.STUDIO_AGENT_TURN_TIMEOUT_MS = "20000";
    process.env.STUDIO_AGENT_VISION_TIMEOUT_MS = "45000";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Cinematic image prompt",
            },
          },
        ],
      }),
    });
    const req = {
      method: "POST",
      body: {
        ...createBaseRequestBody(),
        context: {
          modeHint: "reference",
          media: [
            {
              id: "img-1",
              kind: "image",
              url: "https://cdn.test/reference.png",
              thumbnailAlt: "Reference image",
            },
          ],
        },
      },
    };
    const res = createMockResponse();

    await standardStudioAgentHandler(req as never, res as never);

    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const requestPayload = requestInit?.body
      ? (JSON.parse(requestInit.body) as {
          model?: string;
          messages?: Array<{ role: string; content: unknown }>;
        })
      : null;
    expect(requestPayload?.model).toBe("gpt-vision");
    const latestUserMessage = [...(requestPayload?.messages ?? [])]
      .reverse()
      .find((message) => message.role === "user");
    expect(latestUserMessage?.content).toEqual([
      { type: "text", text: "Improve this prompt." },
      {
        type: "image_url",
        image_url: {
          url: "https://cdn.test/reference.png",
          detail: "auto",
        },
      },
    ]);
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

  it("fails closed when the built-in Pulse catalog is not authoritative", async () => {
    resolveRuntimeCreatePulseBuiltInCatalogMock.mockResolvedValue({
      builtInDefinitions: [],
      source: "seed",
      updatedAt: null,
      updatedByEmail: null,
      degraded: true,
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

    expect(resolveRuntimeCreatePulseBuiltInCatalogMock).toHaveBeenCalledWith({ bypassCache: true });
    expect(res.status).toHaveBeenCalledWith(503);
    expect(fetch).not.toHaveBeenCalled();
    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        code: "PULSE_PRESET_CATALOG_UNAVAILABLE",
      })
    );
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
