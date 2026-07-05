import { describe, expect, it } from "vitest";
import {
  resolveStandardCreatePrimaryCostCredits,
  shouldRejectSavedPulseChatRestoreActivation,
} from "../useAiStudioCreatePanelRuntime";

describe("resolveStandardCreatePrimaryCostCredits", () => {
  it("uses the prompt-reference generate cost for create text mode", () => {
    expect(
      resolveStandardCreatePrimaryCostCredits({
        mode: "text",
        currentCostCredits: 1,
        promptReferenceGenerateCostCredits: 7,
      })
    ).toBe(7);
  });

  it("falls back to the current cost when prompt-reference credits are unavailable", () => {
    expect(
      resolveStandardCreatePrimaryCostCredits({
        mode: "text",
        currentCostCredits: 1,
        promptReferenceGenerateCostCredits: null,
      })
    ).toBe(1);
  });

  it("keeps the current cost for non-text modes", () => {
    expect(
      resolveStandardCreatePrimaryCostCredits({
        mode: "image",
        currentCostCredits: 7,
        promptReferenceGenerateCostCredits: 9,
      })
    ).toBe(7);
  });
});

describe("shouldRejectSavedPulseChatRestoreActivation", () => {
  it("rejects when the Pulse runtime handler fails closed without activating a session", () => {
    expect(shouldRejectSavedPulseChatRestoreActivation(null)).toBe(true);
  });

  it("allows explicit session ids and void-compatible handler results", () => {
    expect(shouldRejectSavedPulseChatRestoreActivation("pulse-session-saved")).toBe(false);
    expect(shouldRejectSavedPulseChatRestoreActivation(undefined)).toBe(false);
  });
});
