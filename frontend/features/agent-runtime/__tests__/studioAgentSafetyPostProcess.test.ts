import { describe, expect, it } from "vitest";
import { postProcessStudioAgentSafetyText } from "../studioAgentSafetyPostProcess";

describe("studioAgentSafetyPostProcess", () => {
  it("passes safe text through unchanged", async () => {
    const result = await postProcessStudioAgentSafetyText({
      text: "A portrait of a person in a tailored suit at golden hour.",
      route: "studio-agent",
      flow: "TEXT_ONLY",
      source: "model_output",
      mode: "enforce",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "pass",
        text: "A portrait of a person in a tailored suit at golden hour.",
        fallbackUsed: false,
      })
    );
    expect(result.decision?.action).toBe("allow");
  });

  it("rewrites mild explicit language to safe-for-work wording", async () => {
    const result = await postProcessStudioAgentSafetyText({
      text: "A sexy portrait of a topless model in lingerie.",
      route: "studio-agent",
      flow: "MIXED",
      source: "model_output",
      mode: "enforce",
    });

    expect(result.outcome).toBe("rewritten");
    expect(result.fallbackUsed).toBe(true);
    expect(result.text.toLowerCase()).not.toContain("sexy");
    expect(result.text.toLowerCase()).not.toContain("topless");
    expect(result.text.toLowerCase()).not.toContain("lingerie");
  });

  it("maps severe explicit content directly to refusal", async () => {
    const result = await postProcessStudioAgentSafetyText({
      text: "Graphic sexual intercourse with explicit anatomy details.",
      route: "studio-agent",
      flow: "MIXED",
      source: "model_output",
      mode: "enforce",
    });

    expect(result.outcome).toBe("refusal");
    expect(result.text).toBe("I cannot describe this.");
    expect(result.decision?.hardFloorViolation).toBe(false);
  });

  it("uses deterministic fallback rewrite when external rewrite times out", async () => {
    const result = await postProcessStudioAgentSafetyText({
      text: "A sensual portrait with revealing outfit.",
      route: "studio-agent",
      flow: "MIXED",
      source: "model_output",
      mode: "enforce",
      rewriteTimeoutMs: 1,
      rewrite: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "delayed rewrite";
      },
    });

    expect(result.outcome).toBe("rewritten");
    expect(result.text.toLowerCase()).not.toContain("sensual");
    expect(result.text.toLowerCase()).not.toContain("revealing outfit");
    expect(result.fallbackUsed).toBe(true);
  });

  it("bypasses safety processing when feature flag is disabled", async () => {
    const result = await postProcessStudioAgentSafetyText({
      text: "A sexy portrait with provocative styling.",
      route: "studio-agent",
      flow: "MIXED",
      source: "model_output",
      mode: "off",
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "pass",
        text: "A sexy portrait with provocative styling.",
        fallbackUsed: false,
      })
    );
    expect(result.decision).toBeUndefined();
  });

  it("allows explicit text in development when absolute-zero mode is enabled", async () => {
    const result = await postProcessStudioAgentSafetyText({
      text: "Graphic sexual intercourse with explicit anatomy details.",
      route: "studio-agent",
      flow: "TEXT_ONLY",
      source: "model_output",
      mode: "enforce",
      environment: "development",
      devAbsoluteZeroEnabled: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        outcome: "pass",
        text: "Graphic sexual intercourse with explicit anatomy details.",
        fallbackUsed: false,
      })
    );
    expect(result.decision?.source).toBe("absolute_zero");
  });

  it("flags production hard-floor incidents for rollback execution path", async () => {
    const result = await postProcessStudioAgentSafetyText({
      text: "Graphic sexual intercourse with explicit anatomy details.",
      route: "studio-agent",
      flow: "TEXT_ONLY",
      source: "model_output",
      mode: "enforce",
      environment: "production",
      profileId: "staging_lenient",
    });

    expect(result.outcome).toBe("refusal");
    expect(result.decision).toEqual(
      expect.objectContaining({
        action: "refuse",
        source: "hard_floor",
        hardFloorViolation: true,
      })
    );
  });
});
