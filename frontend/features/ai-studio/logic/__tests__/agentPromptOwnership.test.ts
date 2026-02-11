/**
 * Agent prompt ownership logic tests.
 * Ensures prompt source badges and staged prompt behavior remain deterministic.
 */
import {
  getStagedAgentPrompt,
  normalizePromptText,
  resolvePromptSourceBadge,
} from "../agentPromptOwnership";

describe("agentPromptOwnership", () => {
  it("normalizes prompt text and rejects blank values", () => {
    expect(normalizePromptText("  cinematic portrait  ")).toBe("cinematic portrait");
    expect(normalizePromptText("   ")).toBeNull();
    expect(normalizePromptText(null)).toBeNull();
  });

  it("maps prompt origin to source badges", () => {
    expect(resolvePromptSourceBadge("agent")).toBe("agent");
    expect(resolvePromptSourceBadge("manual")).toBe("manual");
    expect(resolvePromptSourceBadge("reference")).toBe("reference");
  });

  it("shows staged prompt only when agent output is primary", () => {
    expect(getStagedAgentPrompt("agent", "  dusk city skyline  ")).toBe("dusk city skyline");
    expect(getStagedAgentPrompt("manual", "dusk city skyline")).toBeNull();
    expect(getStagedAgentPrompt("reference", "dusk city skyline")).toBeNull();
  });

  it("drops staged prompt when agent output is blank", () => {
    expect(getStagedAgentPrompt("agent", "   ")).toBeNull();
  });
});
