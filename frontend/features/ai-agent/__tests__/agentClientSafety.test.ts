import { afterEach, describe, expect, it } from "vitest";
import type { AgentApiContext } from "../../../prefabs/agent";
import {
  SAFETY_REFUSAL_MESSAGE,
  isClientDevAbsoluteZeroEnabled,
  isClientInputPrecheckEnabled,
  resolveClientSafetyModality,
  resolveClientSafetyProfileId,
  resolveSafetyRefusalText,
} from "../agentClientSafety";

describe("agentClientSafety", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED;
    delete process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_PROFILE_ACTIVE;
    delete process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED;
  });

  it("recognizes the canonical refusal message across string and structured error input", () => {
    expect(resolveSafetyRefusalText(SAFETY_REFUSAL_MESSAGE)).toBe(SAFETY_REFUSAL_MESSAGE);
    expect(resolveSafetyRefusalText({ message: SAFETY_REFUSAL_MESSAGE })).toBe(
      SAFETY_REFUSAL_MESSAGE
    );
    expect(resolveSafetyRefusalText("Something else")).toBeNull();
  });

  it("resolves client safety modality from explicit mode and media context", () => {
    expect(resolveClientSafetyModality({ mode: "video" } as AgentApiContext)).toBe("video");
    expect(resolveClientSafetyModality({ mode: "image" } as AgentApiContext)).toBe("image");
    expect(
      resolveClientSafetyModality({
        media: [{ id: "img-1", kind: "image", url: "https://cdn.test/image.png" }],
      })
    ).toBe("image");
    expect(resolveClientSafetyModality(undefined)).toBe("text");
  });

  it("reads client safety env flags with the expected defaults", () => {
    expect(isClientInputPrecheckEnabled()).toBe(true);
    expect(resolveClientSafetyProfileId()).toBeNull();
    expect(isClientDevAbsoluteZeroEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED = "false";
    process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_PROFILE_ACTIVE = "prod_safe_v1";
    process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED = "true";

    expect(isClientInputPrecheckEnabled()).toBe(false);
    expect(resolveClientSafetyProfileId()).toBe("prod_safe_v1");
    expect(isClientDevAbsoluteZeroEnabled()).toBe(true);
  });
});
