import { describe, expect, it } from "vitest";
import {
  resolveEditPromptRequirement,
  shouldCheckPromptAtGenerationStart,
  shouldRequirePromptForEditModel,
} from "../editPromptPolicy";

describe("editPromptPolicy", () => {
  it("marks known edit models as prompt-required", () => {
    expect(resolveEditPromptRequirement("fal-ai/nano-banana/edit")).toBe("required");
    expect(resolveEditPromptRequirement("fal/flux-2/edit")).toBe("required");
    expect(resolveEditPromptRequirement("fal-ai/bytedance/seedream/v5/lite/edit")).toBe("required");
  });

  it("treats unknown edit model ids as unknown and required-by-default", () => {
    expect(resolveEditPromptRequirement("fal-ai/unknown/edit")).toBe("unknown");
    expect(shouldRequirePromptForEditModel("fal-ai/unknown/edit")).toBe(true);
  });

  it("checks prompt at generation start for edit/image tools", () => {
    expect(
      shouldCheckPromptAtGenerationStart({
        tool: "edit",
        modelId: "fal-ai/nano-banana/edit",
      })
    ).toBe(true);

    expect(
      shouldCheckPromptAtGenerationStart({
        tool: "image",
        modelId: "fal-ai/unknown/edit",
      })
    ).toBe(true);
  });

  it("keeps prompt checking enabled for non-edit tools", () => {
    expect(
      shouldCheckPromptAtGenerationStart({
        tool: "create",
        modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      })
    ).toBe(true);
  });
});
