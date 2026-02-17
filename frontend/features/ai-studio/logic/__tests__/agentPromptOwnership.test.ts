/**
 * Agent prompt ownership logic tests.
 * Ensures prompt source badges and staged prompt behavior remain deterministic.
 */
import {
  getStagedAgentPrompt,
  removeAspectRatioLanguage,
  normalizePromptText,
  sanitizeGenerationPromptText,
  resolvePromptSourceBadge,
} from "../agentPromptOwnership";

describe("agentPromptOwnership", () => {
  it("normalizes prompt text and rejects blank values", () => {
    expect(normalizePromptText("  cinematic portrait  ")).toBe("cinematic portrait");
    expect(
      normalizePromptText(
        "Ancient temple in jungle. The prompt now includes additional atmospheric detail."
      )
    ).toBe("Ancient temple in jungle.");
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
    expect(removeAspectRatioLanguage(undefined)).toBeNull();
  });

  it("removes metadata recap lines from generated prompts", () => {
    expect(
      sanitizeGenerationPromptText(
        "Ancient temple in jungle. The prompt now includes a woman in traditional attire."
      )
    ).toBe("Ancient temple in jungle.");
    expect(
      sanitizeGenerationPromptText(
        "Ancient temple in jungle.\n\nSummary: Transformed the prompt to depict an exterior scene."
      )
    ).toBe("Ancient temple in jungle.");
    expect(
      sanitizeGenerationPromptText(
        "Vivid embroidered clothing with jade jewelry. The Mayan garments have been described in detail, including patterns and colors."
      )
    ).toBe("Vivid embroidered clothing with jade jewelry.");
    expect(
      sanitizeGenerationPromptText(
        "Summary: Transformed the prompt to depict an exterior scene with richer detail."
      )
    ).toBeNull();
    expect(
      sanitizeGenerationPromptText(
        "Ancient temple in jungle, warm daylight and mossy stone. This version now includes stronger atmosphere and foliage depth."
      )
    ).toBe("Ancient temple in jungle, warm daylight and mossy stone.");
  });

  it("handles CRLF and strips metadata paragraphs after cleanup", () => {
    expect(
      sanitizeGenerationPromptText(
        "Golden hour portrait in jungle canopy.\r\n\r\nSummary: Updated the prompt with stronger atmosphere."
      )
    ).toBe("Golden hour portrait in jungle canopy.");
  });

  it("normalizes staged agent prompt using the same cleaning rules", () => {
    expect(getStagedAgentPrompt("agent", "  cinematic portrait, aspect ratio 9:16  ")).toBe(
      "cinematic portrait,"
    );
    expect(getStagedAgentPrompt("agent", null)).toBeNull();
  });
});
