import { describe, expect, it } from "vitest";
import { shouldActivateExpertEditPresetRuntime } from "../expertEditPresetRuntimeActivation";

describe("shouldActivateExpertEditPresetRuntime", () => {
  it("activates the expert preset runtime for the standalone presets tool", () => {
    expect(shouldActivateExpertEditPresetRuntime("presets")).toBe(true);
  });

  it("keeps expert preset runtime disabled for unrelated tools", () => {
    expect(shouldActivateExpertEditPresetRuntime("sound")).toBe(false);
  });
});
