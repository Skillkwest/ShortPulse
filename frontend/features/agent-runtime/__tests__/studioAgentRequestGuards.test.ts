import { describe, expect, it } from "vitest";
import {
  STUDIO_AGENT_MAX_MEDIA,
  STUDIO_AGENT_MAX_MIXED_REQUEST_BYTES,
  STUDIO_AGENT_MAX_TEXT_REQUEST_BYTES,
  STUDIO_AGENT_RATE_LIMIT_MAX_REQUESTS,
  STUDIO_AGENT_SESSION_KEY_MAX_CHARS,
  isStudioAgentRateLimited,
  parseStudioAgentMessages,
  parseStudioAgentSessionKey,
  readStudioAgentRequestBodyBytes,
  resolveStudioAgentMaxRequestBytes,
  sanitizeStudioAgentContext,
} from "../studioAgentRequestGuards";

describe("studioAgentRequestGuards", () => {
  it("validates session key presence and max length", () => {
    expect(parseStudioAgentSessionKey("")).toEqual({
      ok: false,
      message: "clientSessionKey is required",
    });

    const tooLong = "x".repeat(STUDIO_AGENT_SESSION_KEY_MAX_CHARS + 1);
    expect(parseStudioAgentSessionKey(tooLong)).toEqual({
      ok: false,
      message: "clientSessionKey exceeds allowed length",
      details: { maxChars: STUDIO_AGENT_SESSION_KEY_MAX_CHARS },
    });

    expect(parseStudioAgentSessionKey("  session-1  ")).toEqual({
      ok: true,
      sessionKey: "session-1",
    });
  });

  it("enforces user/assistant-only roles and trims message history", () => {
    expect(parseStudioAgentMessages("not-array")).toEqual({
      ok: false,
      code: "MESSAGES_REQUIRED",
      message: "messages are required",
    });

    expect(parseStudioAgentMessages([{ role: "system", content: "bad-role" }])).toEqual({
      ok: false,
      code: "INVALID_MESSAGE_ROLE",
      message: "Only user and assistant roles are allowed",
      details: {
        index: 0,
        role: "system",
        allowedRoles: ["user", "assistant"],
      },
    });

    const manyMessages = Array.from({ length: 30 }, (_, index) => ({
      role: "user" as const,
      content: `message-${index + 1}`,
    }));
    const parsed = parseStudioAgentMessages(manyMessages);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.messages).toHaveLength(24);
    expect(parsed.messages[0]?.content).toBe("message-7");
    expect(parsed.messages[23]?.content).toBe("message-30");
  });

  it("sanitizes context and enforces media/reference caps", () => {
    const context = sanitizeStudioAgentContext({
      mode: "image",
      references: Array.from({ length: 30 }, (_, index) => ({
        id: `ref-${index + 1}`,
        kind: "image",
        caption: `caption-${index + 1}`,
        promptSnippet: `snippet-${index + 1}`,
      })),
      selectedReferenceIds: Array.from({ length: 12 }, (_, index) => `ref-${index + 1}`),
      media: [
        { id: "m-1", kind: "image", url: "https://example.com/1.png" },
        { id: "m-2", kind: "image", url: "http://example.com/2.png" },
        { id: "m-3", kind: "video", url: "https://example.com/3.mp4" },
        { id: "m-4", kind: "image", url: "https://example.com/4.png" },
        { id: "m-5", kind: "image", url: "https://example.com/5.png" },
        { id: "m-6", kind: "image", url: "https://example.com/6.png" },
      ],
    });

    expect(context.references).toHaveLength(24);
    expect(context.selectedReferenceIds).toHaveLength(8);
    expect(context.media).toHaveLength(STUDIO_AGENT_MAX_MEDIA);
    expect(context.media?.every((item) => item.url?.startsWith("https://"))).toBe(true);
    expect(context.media?.every((item) => item.kind === "image")).toBe(true);
  });

  it("normalizes legacy pulse runtime metadata to the guided Pulse contract", () => {
    const context = sanitizeStudioAgentContext({
      mode: "text",
      pulse: {
        presetId: " pulse_story ",
        label: " Story Builder ",
        instructions: " Keep the structure easy to follow. ",
        runtimeMode: "prompt_editor",
        activationMode: "activate_only",
        outputMode: "apply_prompt",
        source: "custom",
      },
    });

    expect(context.pulse).toEqual({
      presetId: "pulse_story",
      label: "Story Builder",
      description: null,
      instructions: "Keep the structure easy to follow.",
      runtimeMode: "workflow_gpt",
      activationMode: "activate_and_start",
      starterAssistantMessage: null,
      workflowStageHints: null,
      outputMode: "chat_reply",
      memoryPolicy: "session",
      source: "custom",
      workflowSession: null,
    });
  });

  it("preserves custom Pulse system instructions that look like prompt meta text", () => {
    const context = sanitizeStudioAgentContext({
      mode: "text",
      pulse: {
        presetId: "pulse_custom",
        label: "Custom Pulse",
        instructions:
          "This prompt should ask one product question first, then build the final ad concept.",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        outputMode: "chat_reply",
        source: "custom",
      },
    });

    expect(context.pulse?.instructions).toBe(
      "This prompt should ask one product question first, then build the final ad concept."
    );
  });

  it("drops Pulse workflow sessions that do not belong to the active Pulse preset", () => {
    const context = sanitizeStudioAgentContext({
      mode: "text",
      pulse: {
        presetId: "pulse_active",
        label: "Active Pulse",
        instructions: "Ask for details, then produce a final prompt.",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        outputMode: "chat_reply",
        source: "custom",
        workflowSession: {
          presetId: "pulse_stale",
          status: "completed",
          currentStepIndex: 3,
          currentStepLabel: "Final",
          currentStepPrompt: null,
          collectedInputs: ["stale answer"],
          lastArtifact: "stale artifact",
          finalArtifactSource: "chat_reply",
        },
      },
    });

    expect(context.pulse?.presetId).toBe("pulse_active");
    expect(context.pulse?.workflowSession).toBeNull();
  });

  it("strips Pulse and passive media context from Standard runtime requests", () => {
    const context = sanitizeStudioAgentContext(
      {
        mode: "image",
        modeHint: "chat",
        focusedSource: "image",
        focusedReferenceId: "leaked-pulse-image",
        selectedReferenceIds: ["leaked-pulse-image"],
        references: [
          {
            id: "leaked-pulse-image",
            kind: "image",
            promptSnippet: "Leaked Pulse image prompt",
          },
        ],
        media: [
          {
            id: "leaked-pulse-image",
            kind: "image",
            url: "https://example.com/leaked-pulse-image.png",
          },
        ],
        pulse: {
          presetId: " pulse_story ",
          label: " Story Builder ",
          instructions: " Keep the structure easy to follow. ",
        },
      },
      "standard"
    );

    expect(context.pulse).toBeNull();
    expect(context.references).toEqual([]);
    expect(context.media).toEqual([]);
    expect(context.selectedReferenceIds).toEqual([]);
    expect(context.focusedSource).toBe("agent-output");
    expect(context.focusedReferenceId).toBeNull();
  });

  it("keeps explicitly referenced Standard media context", () => {
    const context = sanitizeStudioAgentContext(
      {
        mode: "image",
        modeHint: "reference",
        focusedSource: "image",
        focusedReferenceId: "attached-image",
        selectedReferenceIds: ["attached-image"],
        media: [
          {
            id: "attached-image",
            kind: "image",
            url: "https://example.com/attached-image.png",
          },
        ],
      },
      "standard"
    );

    expect(context.media).toEqual([
      {
        id: "attached-image",
        kind: "image",
        url: "https://example.com/attached-image.png",
      },
    ]);
    expect(context.selectedReferenceIds).toEqual(["attached-image"]);
    expect(context.focusedSource).toBe("image");
    expect(context.focusedReferenceId).toBe("attached-image");
  });

  it("resolves request byte limits by payload shape", () => {
    expect(resolveStudioAgentMaxRequestBytes({ context: { media: [] } })).toBe(
      STUDIO_AGENT_MAX_TEXT_REQUEST_BYTES
    );
    expect(resolveStudioAgentMaxRequestBytes({ context: { media: [{ id: "m1" }] } })).toBe(
      STUDIO_AGENT_MAX_MIXED_REQUEST_BYTES
    );
  });

  it("returns body byte counts and rate limits per user window", () => {
    expect(readStudioAgentRequestBodyBytes({ a: "b" })).toBeGreaterThan(0);

    const userId = `rate-user-${Date.now()}`;
    for (let count = 0; count < STUDIO_AGENT_RATE_LIMIT_MAX_REQUESTS; count += 1) {
      expect(isStudioAgentRateLimited(userId)).toBe(false);
    }
    expect(isStudioAgentRateLimited(userId)).toBe(true);
  });
});
