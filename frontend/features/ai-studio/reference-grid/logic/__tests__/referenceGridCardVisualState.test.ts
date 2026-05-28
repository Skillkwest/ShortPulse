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

  it("keeps generated rows loading until preview media renders", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({
        taskState: "running",
        mediaSource: "generated",
        previewUrl: "https://cdn.test/generated-preview.png",
      }),
      cardPreviewUrl: "https://cdn.test/generated-preview.png",
      isLoaded: false,
      decodeBudgetEnabled: false,
      isImagePreview: true,
      isPriorityHydration: false,
      imageSrc: "https://cdn.test/generated-preview.png",
    });

    expect(state.isGenerationLoading).toBe(true);
    expect(state.isMediaHydrating).toBe(false);
    expect(state.loadingVisual).toBe("spinner");
  });

  it("does not keep rendered generated rows in any loading visual state", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({
        taskState: "running",
        mediaSource: "generated",
        previewUrl: "https://cdn.test/generated-preview.png",
      }),
      cardPreviewUrl: "https://cdn.test/generated-preview.png",
      isLoaded: true,
      decodeBudgetEnabled: false,
      isImagePreview: true,
      isPriorityHydration: false,
      imageSrc: "https://cdn.test/generated-preview.png",
    });

    expect(state.isGenerationLoading).toBe(false);
    expect(state.isMediaHydrating).toBe(false);
    expect(state.loadingVisual).toBe("none");
  });

  it("uses spinner visual for local video references pending durable persistence", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({
        mode: "video",
        taskState: "success",
        previewUrl: "blob:local-video-1",
        previewStoragePath: null,
        fullStoragePath: null,
      }),
      cardPreviewUrl: "blob:local-video-1",
      isLoaded: true,
      decodeBudgetEnabled: true,
      isImagePreview: false,
      isPriorityHydration: false,
    });

    expect(state.isGenerationLoading).toBe(false);
    expect(state.isLocalVideoPersistenceLoading).toBe(true);
    expect(state.isMediaHydrating).toBe(false);
    expect(state.loadingVisual).toBe("spinner");
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

  it("does not keep preview-only generated successes in generation loading state", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({
        taskState: "success",
        mediaSource: "generated",
      }),
      cardPreviewUrl: "https://provider.example.com/generated-preview.png",
      isLoaded: true,
      decodeBudgetEnabled: true,
      isImagePreview: true,
      isPriorityHydration: false,
      imageSrc: "https://provider.example.com/generated-preview.png",
    });

    expect(state.isGenerationLoading).toBe(false);
    expect(state.loadingVisual).toBe("none");
  });

  it("uses hydration visual for generated successes waiting to render", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({
        taskState: "success",
        mediaSource: "generated",
      }),
      cardPreviewUrl: "https://provider.example.com/generated-preview.png",
      isLoaded: false,
      decodeBudgetEnabled: true,
      isImagePreview: true,
      isPriorityHydration: false,
      imageSrc: "https://provider.example.com/generated-preview.png",
    });

    expect(state.isGenerationLoading).toBe(false);
    expect(state.isMediaHydrating).toBe(true);
    expect(state.loadingVisual).toBe("hydrating");
  });
});
