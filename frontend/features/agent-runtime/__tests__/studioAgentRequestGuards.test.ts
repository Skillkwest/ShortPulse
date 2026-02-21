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
