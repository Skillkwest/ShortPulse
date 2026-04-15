import { describe, expect, it } from "vitest";
import { resolveStudioAgentTurnResponse } from "../studioAgentTurnResponse";
import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "../studioAgentRouteOutcomes";

describe("resolveStudioAgentTurnResponse", () => {
  it("keeps refusal response actionless and preserves canonical prompt", () => {
    const result = resolveStudioAgentTurnResponse({
      parsed: {
        message: "I cannot help with that request.",
        actions: {
          applyPrompt: "should-not-survive",
        },
      },
      semanticStatus: "refuse",
      nextCanonical: "next canonical",
      effectiveCanonical: "existing canonical",
      context: {},
      messages: [{ role: "user", content: "disallowed change" }],
    });

    expect(result.refusal).toBe(true);
    expect(result.parsed.message).toBe(STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE);
    expect(result.parsed.actions).toBeUndefined();
    expect(result.resolvedCanonical).toBe("existing canonical");
  });

  it("backfills applyPrompt from user input when no prompt action is returned", () => {
    const result = resolveStudioAgentTurnResponse({
      parsed: {
        message: "Summary: prompt updated.",
        actions: undefined,
      },
      semanticStatus: null,
      nextCanonical: null,
      effectiveCanonical: null,
      context: {},
      messages: [{ role: "user", content: "cinematic rain-soaked alley portrait" }],
    });

    expect(result.refusal).toBe(false);
    expect(result.parsed.actions?.applyPrompt).toBe("cinematic rain-soaked alley portrait");
    expect(result.resolvedCanonical).toBe("cinematic rain-soaked alley portrait");
  });
});
