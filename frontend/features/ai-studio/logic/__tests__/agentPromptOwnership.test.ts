/**
 * Agent prompt ownership logic tests.
 * Ensures prompt source badges and staged prompt behavior remain deterministic.
 */
import {
  getStagedAgentPrompt,
  removeAspectRatioLanguage,
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

  it("strips aspect-ratio language from prompts", () => {
    expect(
      removeAspectRatioLanguage(
        "A lively dog in a park, with dynamic energy and warmth filling the vertical 9:16 frame."
      )
    ).toBe("A lively dog in a park, with dynamic energy and warmth filling the frame.");
    expect(normalizePromptText("cinematic portrait, aspect ratio 16:9")).toBe(
      "cinematic portrait,"
    );
  });
});
