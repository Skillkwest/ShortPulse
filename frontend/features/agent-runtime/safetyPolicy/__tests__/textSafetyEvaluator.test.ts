import { describe, expect, it } from "vitest";
import {
  evaluateStudioAgentSafetyText,
  rewriteStudioAgentSafetyTextDeterministic,
} from "../textSafetyEvaluator";

describe("textSafetyEvaluator", () => {
  it("passes safe text with allow decision", () => {
    const result = evaluateStudioAgentSafetyText({
      text: "A portrait of a person in a tailored suit at golden hour.",
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
    });

    expect(result.decision).toEqual(
      expect.objectContaining({
        action: "allow",
        category: "safe",
      })
    );
  });

  it("classifies suggestive text as rewrite under prod profile", () => {
    const result = evaluateStudioAgentSafetyText({
      text: "A sexy portrait of a topless model in lingerie.",
      modality: "image",
      environment: "production",
      profileId: "prod_safe_v1",
    });

    expect(result.decision).toEqual(
      expect.objectContaining({
        action: "rewrite",
        category: "sexual_suggestive",
      })
    );
  });

  it("classifies explicit text as refusal", () => {
    const result = evaluateStudioAgentSafetyText({
      text: "Graphic sexual intercourse with explicit anatomy details.",
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
    });

    expect(result.decision).toEqual(
      expect.objectContaining({
        action: "refuse",
        category: "sexual_explicit",
      })
    );
  });

  it("allows explicit text in development with absolute-zero", () => {
    const result = evaluateStudioAgentSafetyText({
      text: "Graphic sexual intercourse with explicit anatomy details.",
      modality: "text",
      environment: "development",
      profileId: "prod_safe_v1",
      devAbsoluteZeroEnabled: true,
    });

    expect(result.decision).toEqual(
      expect.objectContaining({
        action: "allow",
        source: "absolute_zero",
      })
    );
  });

  it("enforces hard-floor refusal in production even for lenient profile", () => {
    const result = evaluateStudioAgentSafetyText({
      text: "Graphic sexual intercourse with explicit anatomy details.",
      modality: "image",
      environment: "production",
      profileId: "staging_lenient",
    });

    expect(result.decision).toEqual(
      expect.objectContaining({
        action: "refuse",
        source: "hard_floor",
        hardFloorViolation: true,
      })
    );
  });

  it("deterministically rewrites suggestive language to safe wording", () => {
    const rewritten = rewriteStudioAgentSafetyTextDeterministic(
      "A sexy topless portrait with revealing outfit."
    );
    const lowered = rewritten.toLowerCase();

    expect(lowered).not.toContain("sexy");
    expect(lowered).not.toContain("topless");
    expect(lowered).not.toContain("revealing outfit");
  });
});
