import { describe, expect, it } from "vitest";
import {
  shouldApplySessionAgentHydrationToRuntime,
  type CreateRuntimeAgentHydrationPayload,
} from "../sessionAgentHydrationBoundary";

const makePayload = (expertCreateMode: "standard" | "pulse"): CreateRuntimeAgentHydrationPayload =>
  ({
    workspace: {
      expertCreateMode,
    },
    agent: {},
    agentRuntimes: {},
  }) as CreateRuntimeAgentHydrationPayload;

describe("sessionAgentHydrationBoundary", () => {
  it("applies Standard snapshot agent state only to the Standard runtime", () => {
    const payload = makePayload("standard");

    expect(shouldApplySessionAgentHydrationToRuntime(payload, "standard")).toBe(true);
    expect(shouldApplySessionAgentHydrationToRuntime(payload, "pulse")).toBe(false);
  });

  it("applies Pulse snapshot agent state only to the Pulse runtime", () => {
    const payload = makePayload("pulse");

    expect(shouldApplySessionAgentHydrationToRuntime(payload, "pulse")).toBe(true);
    expect(shouldApplySessionAgentHydrationToRuntime(payload, "standard")).toBe(false);
  });
});
