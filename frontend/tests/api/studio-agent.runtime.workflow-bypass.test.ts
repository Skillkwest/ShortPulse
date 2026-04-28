import { beforeEach, describe, expect, it, vi } from "vitest";
import studioAgentHandler from "./studio-agent.runtime.test-support";
import {
  createMockResponse,
  extractTelemetryPaths,
  extractTelemetryPayloads,
  readAgentConversationCanonicalPromptMock,
  resetStudioAgentRuntimeTestState,
  runThinkerFormatterTurnMock,
  upsertAgentConversationCanonicalPromptMock,
} from "./studio-agent.runtime.test-support";

describe("POST /api/ai/studio-agent runtime hardening", () => {
  beforeEach(resetStudioAgentRuntimeTestState);

  it("bypasses agent orchestration and calls OpenAI directly when the direct bypass toggle is enabled", async () => {
    process.env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED = "true";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Direct OpenAI reply" } }],
      }),
    });

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-direct-bypass",
        messages: [{ role: "user", content: "talk to the raw model" }],
        context: {},
        directOpenAiBypass: true,
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
    expect(readAgentConversationCanonicalPromptMock).not.toHaveBeenCalled();
    expect(upsertAgentConversationCanonicalPromptMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const payload = requestInit?.body
      ? (JSON.parse(requestInit.body) as {
          model?: string;
          messages?: Array<{ role: string; content: string }>;
        })
      : null;
    expect(payload?.model).toBe("gpt-5.4");
    expect(payload?.messages).toEqual([
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining(
          "You are a professional prompt writer for image generation."
        ),
      }),
      { role: "user", content: "talk to the raw model" },
    ]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Direct OpenAI reply",
        actions: expect.objectContaining({ applyPrompt: "Direct OpenAI reply" }),
        outcome_class: "success_prompt",
      })
    );
    const directBypassTelemetry = extractTelemetryPayloads(infoSpy).find(
      (payload) => payload.path === "direct_openai_bypass"
    );
    expect(directBypassTelemetry).toEqual(
      expect.objectContaining({
        latency_ms_stage: expect.objectContaining({
          direct_bypass_input_precheck: expect.any(Number),
          direct_openai_roundtrip: expect.any(Number),
        }),
      })
    );
    infoSpy.mockRestore();
  });

  it("forces Standard runtime through direct OpenAI and strips passive leaked media context", async () => {
    process.env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED = "true";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello. How can I help?" } }],
      }),
    });

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-standard-direct-only",
        runtimeMode: "standard",
        messages: [{ role: "user", content: "hello" }],
        context: {
          modeHint: "chat",
          focusedSource: "image",
          focusedReferenceId: "pulse-image",
          selectedReferenceIds: ["pulse-image"],
          media: [
            {
              id: "pulse-image",
              kind: "image",
              url: "https://example.com/pulse-image.jpg",
            },
          ],
          pulse: {
            presetId: "video_prompt_magic",
            label: "Video Prompt Magic",
            instructions: "Ask the user guided video prompt questions.",
            source: "builtin",
          },
        },
        directOpenAiBypass: false,
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
    expect(readAgentConversationCanonicalPromptMock).not.toHaveBeenCalled();
    expect(upsertAgentConversationCanonicalPromptMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const payload = requestInit?.body
      ? (JSON.parse(requestInit.body) as {
          messages?: Array<{ role: string; content: unknown }>;
        })
      : null;
    expect(JSON.stringify(payload?.messages)).not.toContain("image_url");
    expect(JSON.stringify(payload?.messages)).not.toContain("ACTIVE PULSE PROFILE");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Hello. How can I help?",
        outcome_class: "success_prompt",
      })
    );
  });

  it("does not let Standard runtime fall back to legacy orchestration when direct OpenAI is disabled", async () => {
    process.env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED = "false";

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-standard-direct-disabled",
        runtimeMode: "standard",
        messages: [{ role: "user", content: "hello" }],
        context: {},
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "AGENT_DISABLED",
        message: expect.stringContaining("Standard mode requires the direct OpenAI route"),
      })
    );
  });

  it("sends attached images to the direct bypass as multimodal user content", async () => {
    process.env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED = "true";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Detailed image prompt" } }],
      }),
    });

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-direct-bypass-vision",
        messages: [{ role: "user", content: "Describe this image." }],
        context: {
          media: [
            {
              id: "img-1",
              kind: "image",
              url: "https://example.com/reference-image.jpg",
            },
          ],
        },
        directOpenAiBypass: true,
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(runThinkerFormatterTurnMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const payload = requestInit?.body
      ? (JSON.parse(requestInit.body) as {
          messages?: Array<{
            role: string;
            content:
              | string
              | Array<
                  | { type: "text"; text: string }
                  | {
                      type: "image_url";
                      image_url: { url: string; detail?: "high" | "low" | "auto" };
                    }
                >;
          }>;
        })
      : null;

    expect(payload?.messages?.[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "Describe this image." },
        {
          type: "image_url",
          image_url: {
            url: "https://example.com/reference-image.jpg",
            detail: "high",
          },
        },
      ],
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Detailed image prompt",
        actions: expect.objectContaining({ applyPrompt: "Detailed image prompt" }),
      })
    );
  });

  it("retries workflow pulse direct bypass without media when the image URL is rejected", async () => {
    process.env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED = "true";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "invalid image_url: could not download image",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "What should the subject do in the clip?" } }],
        }),
      });

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-direct-bypass-workflow-image-retry",
        messages: [{ role: "user", content: " " }],
        context: {
          media: [
            {
              id: "img-1",
              kind: "image",
              url: "https://example.com/expired-reference-image.jpg",
            },
          ],
          pulse: {
            presetId: "video_prompt_magic",
            label: "Video Prompt Magic",
            instructions: "Ask the user guided video prompt questions.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your image to get the process started :)",
            workflowStageHints: ["Image Gate", "Camera Motion", "Action Selection"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
            workflowSession: {
              presetId: "video_prompt_magic",
              status: "running",
              currentStepIndex: 2,
              currentStepLabel: "Camera Motion",
              currentStepPrompt: "Which camera motion should you use?",
              collectedInputs: ["Uploaded image attached"],
              lastArtifact: null,
            },
          },
        },
        directOpenAiBypass: true,
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(2);
    const retryInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[1] as
      | { body?: string }
      | undefined;
    const retryPayload = retryInit?.body
      ? (JSON.parse(retryInit.body) as {
          messages?: Array<{ role: string; content: unknown }>;
        })
      : null;
    expect(JSON.stringify(retryPayload?.messages)).toContain(
      "vision provider could not read the image URL"
    );
    expect(JSON.stringify(retryPayload?.messages)).not.toContain("image_url");
    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = res.json.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(responseBody).toEqual(
      expect.objectContaining({
        message: "What should the subject do in the clip?",
        actions: undefined,
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
        workflowSession: expect.objectContaining({
          presetId: "video_prompt_magic",
          status: "awaiting_input",
          currentStepIndex: 3,
          currentStepLabel: "Action Selection",
        }),
      })
    );
    const directBypassTelemetry = extractTelemetryPayloads(infoSpy).find(
      (payload) => payload.path === "direct_openai_bypass"
    );
    expect(directBypassTelemetry).toEqual(
      expect.objectContaining({
        retry_used: true,
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
      })
    );
    infoSpy.mockRestore();
  });

  it("does not text-only retry workflow pulse image safety failures", async () => {
    process.env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED = "true";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "image blocked by content policy",
    });

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-direct-bypass-workflow-image-safety",
        messages: [{ role: "user", content: " " }],
        context: {
          media: [
            {
              id: "img-1",
              kind: "image",
              url: "https://example.com/reference-image.jpg",
            },
          ],
          pulse: {
            presetId: "video_prompt_magic",
            label: "Video Prompt Magic",
            instructions: "Ask the user guided video prompt questions.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your image to get the process started :)",
            workflowStageHints: ["Image Gate", "Camera Motion", "Action Selection"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
            workflowSession: {
              presetId: "video_prompt_magic",
              status: "running",
              currentStepIndex: 2,
              currentStepLabel: "Camera Motion",
              currentStepPrompt: "Which camera motion should you use?",
              collectedInputs: ["Uploaded image attached"],
              lastArtifact: null,
            },
          },
        },
        directOpenAiBypass: true,
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "I can't process that request right now. Please try again.",
        outcome_class: "fallback_infra",
      })
    );
  });

  it("injects Pulse runtime instructions into the direct bypass system messages", async () => {
    process.env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED = "true";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Pulse-aware reply" } }],
      }),
    });

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-direct-bypass-pulse",
        messages: [{ role: "user", content: "Make this feel more premium." }],
        context: {
          pulse: {
            presetId: "product_hero",
            label: "Product Hero",
            instructions:
              "Treat the product as the hero subject with premium lighting and polished detail.",
            source: "builtin",
          },
        },
        directOpenAiBypass: true,
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    const requestInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    const payload = requestInit?.body
      ? (JSON.parse(requestInit.body) as {
          messages?: Array<{ role: string; content: string }>;
        })
      : null;

    expect(payload?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("Return only JSON with this exact shape"),
        }),
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("ACTIVE PULSE PROFILE"),
        }),
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("preset_id: product_hero"),
        }),
      ])
    );
  });

  it("returns success_message for workflow pulse non-bypass turns without applyPrompt", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "needs_input",
                  message:
                    "Which camera motion should I use? Pick one from the list below OR type any camera motion you want.",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-workflow-pulse-orchestration",
        messages: [
          {
            role: "user",
            content: 'Pulse "Video Prompt Magic" was just activated.',
          },
        ],
        context: {
          references: [
            {
              id: "img-1",
              kind: "image",
              caption: "portrait reference",
              promptSnippet: null,
            },
          ],
          selectedReferenceIds: ["img-1"],
          pulse: {
            presetId: "image",
            label: "Video Prompt Magic",
            instructions: "Run the guided single-shot workflow.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your image to get the process started :)",
            workflowStageHints: [
              "Image Gate",
              "Camera Motion",
              "Action Selection",
              "Dialogue",
              "Final Prompt",
            ],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Which camera motion should I use? Pick one from the list below OR type any camera motion you want.",
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
        actions: undefined,
        workflowSession: expect.objectContaining({
          presetId: "image",
          status: "awaiting_input",
          currentStepIndex: null,
          currentStepLabel: null,
          currentStepPrompt:
            "Which camera motion should I use? Pick one from the list below OR type any camera motion you want.",
          collectedInputs: [],
          lastArtifact: null,
        }),
      })
    );
    expect(extractTelemetryPaths(infoSpy)).not.toContain("direct_openai_bypass");
    infoSpy.mockRestore();
  });

  it("returns success_message for the built-in story builder workflow pulse through the api route", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "needs_input",
                  message:
                    "Step 2 - Basic plot. Share a 1-2 sentence plot idea, or pick one of these suggestions.",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-story-builder-workflow",
        messages: [
          {
            role: "user",
            content: 'Pulse "Story Builder" was just activated.',
          },
        ],
        context: {
          pulse: {
            presetId: "story_builder",
            label: "Story Builder",
            description: "Guided story-circle workflow for scene plans and final image prompts.",
            instructions:
              "Run the Story Circle scene-prompt workflow one step at a time and end Step 4 by asking for scene edits or approval.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage:
              "Step 1 - Upload your characters. Please upload 1-3+ character images. Optional: add quick notes (roles, relationships, must-have traits, do-not-include).",
            workflowStageHints: [
              "Upload Characters",
              "Plot Seed",
              "Runtime",
              "Scene Review",
              "Image Prompts",
              "Dialogue Story",
            ],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Step 2 - Basic plot. Share a 1-2 sentence plot idea, or pick one of these suggestions.",
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
        actions: undefined,
        workflowSession: expect.objectContaining({
          presetId: "story_builder",
          status: "awaiting_input",
          currentStepIndex: 2,
          currentStepLabel: "Plot Seed",
          currentStepPrompt:
            "Step 2 - Basic plot. Share a 1-2 sentence plot idea, or pick one of these suggestions.",
          collectedInputs: [],
          lastArtifact: null,
        }),
      })
    );
    expect(extractTelemetryPaths(infoSpy)).not.toContain("direct_openai_bypass");
    infoSpy.mockRestore();
  });

  it("carries workflow session state across story builder turns and returns the next named stage", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "needs_input",
                  message:
                    "Step 3 - How long should it be? Choose 1 min, 5 min, 10 min, or 20 min (or custom).",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-story-builder-progression",
        messages: [
          {
            role: "user",
            content: "A knight enters a cursed forest to recover a relic.",
          },
        ],
        context: {
          pulse: {
            presetId: "story_builder",
            label: "Story Builder",
            description: "Guided story-circle workflow for scene plans and final image prompts.",
            instructions:
              "Run the Story Circle scene-prompt workflow one step at a time and end Step 4 by asking for scene edits or approval.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage:
              "Step 1 - Upload your characters. Please upload 1-3+ character images. Optional: add quick notes (roles, relationships, must-have traits, do-not-include).",
            workflowStageHints: [
              "Upload Characters",
              "Plot Seed",
              "Runtime",
              "Scene Review",
              "Image Prompts",
              "Dialogue Story",
            ],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
            workflowSession: {
              presetId: "story_builder",
              status: "running",
              currentStepIndex: 2,
              currentStepLabel: "Plot Seed",
              currentStepPrompt:
                "Step 2 - Basic plot. Share a 1-2 sentence plot idea, or pick one of these suggestions.",
              collectedInputs: [
                "grimdark tone",
                "A knight enters a cursed forest to recover a relic.",
              ],
              lastArtifact: null,
            },
          },
        },
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Step 3 - How long should it be? Choose 1 min, 5 min, 10 min, or 20 min (or custom).",
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
        actions: undefined,
        workflowSession: expect.objectContaining({
          presetId: "story_builder",
          status: "awaiting_input",
          currentStepIndex: 3,
          currentStepLabel: "Runtime",
          currentStepPrompt:
            "Step 3 - How long should it be? Choose 1 min, 5 min, 10 min, or 20 min (or custom).",
          collectedInputs: ["grimdark tone", "A knight enters a cursed forest to recover a relic."],
          lastArtifact: null,
        }),
      })
    );
    expect(extractTelemetryPaths(infoSpy)).not.toContain("direct_openai_bypass");
    infoSpy.mockRestore();
  });

  it("appends the latest user answer server-side when the incoming workflow session is stale", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "needs_input",
                  message:
                    "Step 3 - How long should it be? Choose 1 min, 5 min, 10 min, or 20 min (or custom).",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-story-builder-stale-client-session",
        messages: [
          {
            role: "user",
            content: "A knight enters a cursed forest to recover a relic.",
          },
        ],
        context: {
          pulse: {
            presetId: "story_builder",
            label: "Story Builder",
            description: "Guided story-circle workflow for scene plans and final image prompts.",
            instructions:
              "Run the Story Circle scene-prompt workflow one step at a time and end Step 4 by asking for scene edits or approval.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage:
              "Step 1 - Upload your characters. Please upload 1-3+ character images. Optional: add quick notes (roles, relationships, must-have traits, do-not-include).",
            workflowStageHints: [
              "Upload Characters",
              "Plot Seed",
              "Runtime",
              "Scene Review",
              "Image Prompts",
              "Dialogue Story",
            ],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
            workflowSession: {
              presetId: "story_builder",
              status: "running",
              currentStepIndex: 2,
              currentStepLabel: "Plot Seed",
              currentStepPrompt:
                "Step 2 - Basic plot. Share a 1-2 sentence plot idea, or pick one of these suggestions.",
              collectedInputs: ["grimdark tone"],
              lastArtifact: null,
            },
          },
        },
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowSession: expect.objectContaining({
          presetId: "story_builder",
          status: "awaiting_input",
          currentStepIndex: 3,
          currentStepLabel: "Runtime",
          collectedInputs: ["grimdark tone", "A knight enters a cursed forest to recover a relic."],
        }),
      })
    );
    expect(extractTelemetryPaths(infoSpy)).not.toContain("direct_openai_bypass");
    infoSpy.mockRestore();
  });

  it("marks chat-reply workflow pulses completed when the route returns a ready final artifact", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "ready",
                  message:
                    "Scene 1: A grimdark knight stands at the cursed forest edge beneath cold moonlight.",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-story-builder-complete",
        messages: [{ role: "user", content: "looks good" }],
        context: {
          pulse: {
            presetId: "story_builder",
            label: "Story Builder",
            description: "Guided story-circle workflow for scene plans and final image prompts.",
            instructions:
              "Run the Story Circle scene-prompt workflow one step at a time and end Step 4 by asking for scene edits or approval.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage:
              "Step 1 - Upload your characters. Please upload 1-3+ character images. Optional: add quick notes (roles, relationships, must-have traits, do-not-include).",
            workflowStageHints: [
              "Upload Characters",
              "Plot Seed",
              "Runtime",
              "Scene Review",
              "Image Prompts",
              "Dialogue Story",
            ],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
            workflowSession: {
              presetId: "story_builder",
              status: "running",
              currentStepIndex: 5,
              currentStepLabel: "Image Prompts",
              currentStepPrompt: "Step 6 - Image Prompts (Final; Scene-Labeled Only).",
              collectedInputs: [
                "grimdark",
                "A knight enters a cursed forest",
                "5 min",
                "looks good",
              ],
              lastArtifact: null,
            },
          },
        },
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Scene 1: A grimdark knight stands at the cursed forest edge beneath cold moonlight.",
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
        actions: undefined,
        workflowSession: expect.objectContaining({
          presetId: "story_builder",
          status: "completed",
          collectedInputs: ["grimdark", "A knight enters a cursed forest", "5 min", "looks good"],
          lastArtifact:
            "Scene 1: A grimdark knight stands at the cursed forest edge beneath cold moonlight.",
          finalArtifactSource: "chat_reply",
        }),
      })
    );
    expect(extractTelemetryPaths(infoSpy)).not.toContain("direct_openai_bypass");
    infoSpy.mockRestore();
  });

  it("returns message-only workflow pulse steps from the direct bypass without synthesizing applyPrompt", async () => {
    process.env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED = "true";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: "needs_input",
                message: "Upload your image to get the process started :)",
              }),
            },
          },
        ],
      }),
    });

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-direct-bypass-workflow-pulse",
        messages: [{ role: "user", content: 'Pulse "Video Prompt Magic" was just activated.' }],
        context: {
          pulse: {
            presetId: "image",
            label: "Video Prompt Magic",
            instructions: "Run the guided single-shot workflow.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage: "Upload your image to get the process started :)",
            workflowStageHints: [
              "Image Gate",
              "Camera Motion",
              "Action Selection",
              "Dialogue",
              "Final Prompt",
            ],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
          },
        },
        directOpenAiBypass: true,
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = res.json.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(responseBody).toEqual(
      expect.objectContaining({
        message: "Upload your image to get the process started:)",
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
        workflowSession: expect.objectContaining({
          presetId: "image",
          status: "awaiting_input",
          currentStepIndex: 1,
          currentStepLabel: "Image Gate",
          currentStepPrompt: "Upload your image to get the process started:)",
          collectedInputs: [],
          lastArtifact: null,
        }),
      })
    );
    expect(responseBody?.actions).toBeUndefined();
    const directBypassTelemetry = extractTelemetryPayloads(infoSpy).find(
      (payload) => payload.path === "direct_openai_bypass"
    );
    expect(directBypassTelemetry).toEqual(
      expect.objectContaining({
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
      })
    );
    infoSpy.mockRestore();
  });

  it("marks direct-bypass chat-reply workflow pulses completed when the model returns a ready final artifact", async () => {
    process.env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED = "true";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: "ready",
                message:
                  "TITLE: Moonlit Forest Escape\nSTYLE: grimdark fantasy, cold moonlight, wet stone, drifting mist",
              }),
            },
          },
        ],
      }),
    });

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-direct-bypass-workflow-complete",
        messages: [{ role: "user", content: "Looks good, give me the final prompt." }],
        context: {
          pulse: {
            presetId: "multi_sequence_video",
            label: "Multi Sequence Video Prompt",
            instructions: "Run the multi-shot storyboard workflow.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage:
              "Step 1 - Upload: Please upload the image you want to base the scene on.",
            workflowStageHints: ["Image Intake", "Action", "Dialog", "Storyboard", "Final Prompt"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
            workflowSession: {
              presetId: "multi_sequence_video",
              status: "running",
              currentStepIndex: 4,
              currentStepLabel: "Storyboard",
              currentStepPrompt:
                "Great. I'll craft a 4-12 cut scene sequence and deliver a single, copy-paste prompt for your video model.",
              collectedInputs: ["forest still", "The knight flees through the ruins", "n/a"],
              lastArtifact: null,
            },
          },
        },
        directOpenAiBypass: true,
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = res.json.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(responseBody).toEqual(
      expect.objectContaining({
        message:
          "TITLE: Moonlit Forest Escape\nSTYLE: grimdark fantasy, cold moonlight, wet stone, drifting mist",
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
        workflowSession: expect.objectContaining({
          presetId: "multi_sequence_video",
          status: "completed",
          collectedInputs: [
            "forest still",
            "The knight flees through the ruins",
            "n/a",
            "Looks good, give me the final prompt.",
          ],
          lastArtifact:
            "TITLE: Moonlit Forest Escape\nSTYLE: grimdark fantasy, cold moonlight, wet stone, drifting mist",
          finalArtifactSource: "chat_reply",
        }),
      })
    );
    expect(responseBody?.actions).toBeUndefined();
    const directBypassTelemetry = extractTelemetryPayloads(infoSpy).find(
      (payload) => payload.path === "direct_openai_bypass"
    );
    expect(directBypassTelemetry).toEqual(
      expect.objectContaining({
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
      })
    );
    infoSpy.mockRestore();
  });

  it("returns plain text direct-bypass workflow pulse replies instead of infra fallback", async () => {
    process.env.STUDIO_AGENT_DIRECT_OPENAI_BYPASS_ENABLED = "true";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "TITLE: Moonlit Forest Escape\nSTYLE: grimdark fantasy, cold moonlight, wet stone, drifting mist",
            },
          },
        ],
      }),
    });

    const req = {
      method: "POST",
      body: {
        clientSessionKey: "session-direct-bypass-workflow-invalid-contract",
        messages: [{ role: "user", content: "Looks good, give me the final prompt." }],
        context: {
          pulse: {
            presetId: "multi_sequence_video",
            label: "Multi Sequence Video Prompt",
            instructions: "Run the multi-shot storyboard workflow.",
            runtimeMode: "workflow_gpt",
            activationMode: "activate_and_start",
            starterAssistantMessage:
              "Step 1 - Upload: Please upload the image you want to base the scene on.",
            workflowStageHints: ["Image Intake", "Action", "Dialog", "Storyboard", "Final Prompt"],
            outputMode: "chat_reply",
            memoryPolicy: "session",
            source: "builtin",
            workflowSession: {
              presetId: "multi_sequence_video",
              status: "running",
              currentStepIndex: 4,
              currentStepLabel: "Storyboard",
              currentStepPrompt:
                "Great. I'll craft a 4-12 cut scene sequence and deliver a single, copy-paste prompt for your video model.",
              collectedInputs: ["forest still", "The knight flees through the ruins", "n/a"],
              lastArtifact: null,
            },
          },
        },
        directOpenAiBypass: true,
      },
    };
    const res = createMockResponse();

    await studioAgentHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = res.json.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(responseBody).toEqual(
      expect.objectContaining({
        message:
          "TITLE: Moonlit Forest Escape\nSTYLE: grimdark fantasy, cold moonlight, wet stone, drifting mist",
        actions: undefined,
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
        workflowSession: expect.objectContaining({
          presetId: "multi_sequence_video",
          status: "awaiting_input",
          currentStepIndex: 5,
          currentStepLabel: "Final Prompt",
          currentStepPrompt:
            "TITLE: Moonlit Forest Escape\nSTYLE: grimdark fantasy, cold moonlight, wet stone, drifting mist",
          collectedInputs: [
            "forest still",
            "The knight flees through the ruins",
            "n/a",
            "Looks good, give me the final prompt.",
          ],
        }),
      })
    );
    const directBypassTelemetry = extractTelemetryPayloads(infoSpy).find(
      (payload) => payload.path === "direct_openai_bypass"
    );
    expect(directBypassTelemetry).toEqual(
      expect.objectContaining({
        outcome_class: "success_message",
        reason_code: "SUCCESS_MESSAGE",
      })
    );
    infoSpy.mockRestore();
  });
});
