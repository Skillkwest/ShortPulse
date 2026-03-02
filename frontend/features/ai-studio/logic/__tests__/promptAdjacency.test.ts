import { describe, expect, it } from "vitest";
import {
  normalizeAgentOutputGenerateRequest,
  resolveChatOffCreatePrompt,
} from "../promptAdjacency";

describe("promptAdjacency", () => {
  describe("resolveChatOffCreatePrompt", () => {
    it("prefers trimmed agent input when present", () => {
      expect(
        resolveChatOffCreatePrompt({
          agentInput: "  composer prompt  ",
          sharedPrompt: "shared fallback",
          allowSharedPromptFallback: true,
        })
      ).toBe("composer prompt");
    });

    it("falls back to shared prompt when configured", () => {
      expect(
        resolveChatOffCreatePrompt({
          agentInput: "   ",
          sharedPrompt: "  fallback prompt  ",
          allowSharedPromptFallback: true,
        })
      ).toBe("fallback prompt");
    });

    it("returns null when fallback is disabled and agent input is empty", () => {
      expect(
        resolveChatOffCreatePrompt({
          agentInput: "   ",
          sharedPrompt: "fallback prompt",
          allowSharedPromptFallback: false,
        })
      ).toBeNull();
    });
  });

  describe("normalizeAgentOutputGenerateRequest", () => {
    it("normalizes legacy string input into a history-source request", () => {
      expect(normalizeAgentOutputGenerateRequest("  polished output prompt  ")).toEqual({
        messageId: "legacy-agent-output",
        prompt: "polished output prompt",
        source: "history",
      });
    });

    it("normalizes structured input and trims message id", () => {
      expect(
        normalizeAgentOutputGenerateRequest({
          messageId: "  msg-1  ",
          prompt: "  cinematic scene  ",
          source: "staged",
        })
      ).toEqual({
        messageId: "msg-1",
        prompt: "cinematic scene",
        source: "staged",
      });
    });

    it("defaults unknown runtime source values to history", () => {
      const request = normalizeAgentOutputGenerateRequest({
        messageId: "msg-2",
        prompt: "prompt",
        source: "unknown-source",
      } as unknown as { messageId: string; prompt: string; source: "history" | "staged" });

      expect(request).toEqual({
        messageId: "msg-2",
        prompt: "prompt",
        source: "history",
      });
    });

    it("returns null for missing prompt or message id", () => {
      expect(
        normalizeAgentOutputGenerateRequest({
          messageId: "msg-3",
          prompt: "   ",
          source: "history",
        })
      ).toBeNull();
      expect(
        normalizeAgentOutputGenerateRequest({
          messageId: "   ",
          prompt: "prompt",
          source: "history",
        })
      ).toBeNull();
    });
  });
});
