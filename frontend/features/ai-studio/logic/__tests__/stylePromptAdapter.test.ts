import { describe, expect, it } from "vitest";
import {
  appendStylePromptToSubmission,
  isStylePromptFamilyAdapterEnabled,
  resolveStylePromptModelFamily,
} from "../stylePromptAdapter";

describe("stylePromptAdapter", () => {
  it("resolves Nano Banana family from model runtime metadata", () => {
    expect(resolveStylePromptModelFamily("fal-ai/nano-banana-2/edit")).toBe("nano_banana");
    expect(resolveStylePromptModelFamily("fal-ai/nano-banana-pro/edit")).toBe("nano_banana");
    expect(resolveStylePromptModelFamily("fal-ai/nano-banana-2/edit")).toBe("nano_banana");
  });

  it("resolves Seedream family from model runtime metadata", () => {
    expect(resolveStylePromptModelFamily("fal-ai/bytedance/seedream/v4.5/edit")).toBe("seedream");
    expect(resolveStylePromptModelFamily("fal-ai/bytedance/seedream/v5/lite/edit")).toBe(
      "seedream"
    );
  });

  it("falls back to generic family for unknown models", () => {
    expect(resolveStylePromptModelFamily("legacy/removed-model")).toBe("generic");
    expect(resolveStylePromptModelFamily("unknown/model")).toBe("generic");
    expect(resolveStylePromptModelFamily(null)).toBe("generic");
  });

  it("keeps models without explicit style prompt family metadata on generic phrasing", () => {
    expect(resolveStylePromptModelFamily("kie-ai/gpt-image-2-text-to-image")).toBe("generic");
    expect(resolveStylePromptModelFamily("kie-ai/gpt-image-2-image-to-image")).toBe("generic");
    expect(resolveStylePromptModelFamily("kie-ai/seedance-2")).toBe("generic");
  });

  it("appends family-adapted line for Nano Banana models", () => {
    const compiled = appendStylePromptToSubmission({
      tool: "edit",
      submissionPrompt: "Refine image",
      selectedStylePrompt: "sunset editorial grade",
      modelId: "fal-ai/nano-banana-pro/edit",
      adapterEnabled: true,
    });

    expect(compiled).toBe(
      "Refine image\n\nVisual style reference (treatment only): sunset editorial grade. Preserve subject identity and base composition."
    );
  });

  it("returns style-only text when submission prompt is empty", () => {
    const compiled = appendStylePromptToSubmission({
      tool: "create",
      submissionPrompt: "   ",
      selectedStylePrompt: "soft analog film look",
      modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      adapterEnabled: true,
    });

    expect(compiled).toBe(
      "Visual style reference: soft analog film look. Emphasize cohesive palette, lighting mood, and surface texture."
    );
  });

  it("keeps byte-equivalent legacy output when adapter is disabled", () => {
    const compiled = appendStylePromptToSubmission({
      tool: "edit",
      submissionPrompt: "Refine image",
      selectedStylePrompt: "  moody studio  lighting  ",
      modelId: "fal-ai/nano-banana-2/edit",
      adapterEnabled: false,
    });

    expect(compiled).toBe("Refine image\n\nVisual style reference: moody studio lighting");
  });

  it("appends style for video tools", () => {
    const compiled = appendStylePromptToSubmission({
      tool: "video",
      submissionPrompt: "Animate this shot",
      selectedStylePrompt: "cinematic",
      modelId: "kie-ai/kling-3.0",
      adapterEnabled: true,
    });

    expect(compiled).toBe("Animate this shot\n\nVisual style reference: cinematic");
  });

  it("does not append style for non-style tools", () => {
    const compiled = appendStylePromptToSubmission({
      tool: "sound",
      submissionPrompt: "Generate a riser",
      selectedStylePrompt: "cinematic",
      modelId: "unknown/model",
      adapterEnabled: true,
    });

    expect(compiled).toBe("Generate a riser");
  });

  it("treats only explicit false as disabled flag value", () => {
    expect(isStylePromptFamilyAdapterEnabled(undefined)).toBe(true);
    expect(isStylePromptFamilyAdapterEnabled("true")).toBe(true);
    expect(isStylePromptFamilyAdapterEnabled("false")).toBe(false);
    expect(isStylePromptFamilyAdapterEnabled("FALSE")).toBe(true);
  });
});
