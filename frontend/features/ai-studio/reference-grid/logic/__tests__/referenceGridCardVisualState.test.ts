import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../../types";
import { classifyReferenceGridCardVisualState } from "../referenceGridCardVisualState";

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "Prompt",
  mode: "image",
  aspect: "9:16",
  model: "Model",
  status: "ready",
  timestamp: "Now",
  taskState: "pending",
  ...overrides,
});

describe("referenceGridCardVisualState", () => {
  it("uses spinner visual for generation loading states", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({ taskState: "running" }),
      cardPreviewUrl: null,
      isLoaded: false,
      decodeBudgetEnabled: true,
      isImagePreview: true,
      isPriorityHydration: true,
    });

    expect(state.isGenerationLoading).toBe(true);
    expect(state.loadingVisual).toBe("spinner");
  });

  it("uses hydration visual for decode lag after generation success", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({ taskState: "success" }),
      cardPreviewUrl: "https://cdn.test/image.png",
      isLoaded: false,
      decodeBudgetEnabled: false,
      isImagePreview: true,
      isPriorityHydration: false,
      imageSrc: "https://cdn.test/image.png",
    });

    expect(state.isGenerationLoading).toBe(false);
    expect(state.isMediaHydrating).toBe(true);
    expect(state.loadingVisual).toBe("hydrating");
  });

  it("does not mark failures as loading", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({ taskState: "fail" }),
      cardPreviewUrl: null,
      isLoaded: false,
      decodeBudgetEnabled: true,
      isImagePreview: true,
      isPriorityHydration: true,
    });

    expect(state.isFailing).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.loadingVisual).toBe("none");
  });
});
