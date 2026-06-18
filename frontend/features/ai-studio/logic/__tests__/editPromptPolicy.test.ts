import { describe, expect, it } from "vitest";
import {
  resolveEditPromptRequirement,
  shouldCheckPromptAtGenerationStart,
  shouldRequirePromptForEditModel,
} from "../editPromptPolicy";

describe("editPromptPolicy", () => {
  it("marks known edit models as prompt-required", () => {
    expect(resolveEditPromptRequirement("fal-ai/nano-banana-2/edit")).toBe("required");
    expect(resolveEditPromptRequirement("fal-ai/bytedance/seedream/v4.5/edit")).toBe("required");
    expect(resolveEditPromptRequirement("fal-ai/bytedance/seedream/v5/lite/edit")).toBe("required");
  });

  it("marks Bria background remove as prompt-optional", () => {
    expect(resolveEditPromptRequirement("fal-ai/bria/background/remove")).toBe("optional");
    expect(shouldRequirePromptForEditModel("fal-ai/bria/background/remove")).toBe(false);
  });

  it("treats unknown edit model ids as unknown and required-by-default", () => {
    expect(resolveEditPromptRequirement("fal-ai/unknown/edit")).toBe("unknown");
    expect(shouldRequirePromptForEditModel("fal-ai/unknown/edit")).toBe(true);
  });

  it("checks prompt at generation start for edit/image tools", () => {
    expect(
      shouldCheckPromptAtGenerationStart({
        tool: "edit",
        modelId: "fal-ai/nano-banana-2/edit",
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

  it("does not require prompt text for prompt-optional video lanes at generation start", () => {
    expect(
      shouldCheckPromptAtGenerationStart({
        tool: "video",
        modelId: "kie-ai/kling-3.0",
        videoReferenceMode: "motion",
      })
    ).toBe(false);

    expect(
      shouldCheckPromptAtGenerationStart({
        tool: "video",
        modelId: "fal-ai/bytedance/omnihuman/v1.5",
        videoReferenceMode: "lip-sync",
      })
    ).toBe(false);
  });
});
