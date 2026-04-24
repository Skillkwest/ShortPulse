/**
 * Prompt target routing tests.
 * Ensures Edit prompt input remains isolated from agent apply behavior.
 */
import { describe, expect, it } from "vitest";
import {
  isEditPromptTool,
  isReferencePromptTool,
  shouldApplyAgentPromptToSharedPrompt,
} from "../promptTargeting";

describe("promptTargeting", () => {
  it("identifies reference-prompt tools", () => {
    expect(isReferencePromptTool("edit")).toBe(true);
    expect(isReferencePromptTool("image")).toBe(true);
    expect(isReferencePromptTool("video")).toBe(true);
    expect(isReferencePromptTool("kling")).toBe(true);
    expect(isReferencePromptTool("text")).toBe(false);
  });

  it("keeps edit/image prompts isolated from shared agent apply behavior", () => {
    expect(isEditPromptTool("edit")).toBe(true);
    expect(isEditPromptTool("image")).toBe(true);
    expect(shouldApplyAgentPromptToSharedPrompt("edit")).toBe(false);
    expect(shouldApplyAgentPromptToSharedPrompt("image")).toBe(false);
  });

  it("still allows shared prompt updates for non-edit tools", () => {
    expect(shouldApplyAgentPromptToSharedPrompt("text")).toBe(true);
    expect(shouldApplyAgentPromptToSharedPrompt("create")).toBe(true);
    expect(shouldApplyAgentPromptToSharedPrompt("video")).toBe(true);
    expect(shouldApplyAgentPromptToSharedPrompt(null)).toBe(true);
  });

  it("blocks shared prompt updates while a Pulse session is active", () => {
    expect(shouldApplyAgentPromptToSharedPrompt("create", { hasActivePulse: true })).toBe(false);
    expect(shouldApplyAgentPromptToSharedPrompt("text", { hasActivePulse: true })).toBe(false);
  });
});
