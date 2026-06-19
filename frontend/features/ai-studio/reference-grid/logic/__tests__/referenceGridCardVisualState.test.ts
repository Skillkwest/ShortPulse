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

  it("uses spinner visual for local upload rows pending durable media", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({
        taskState: "pending",
        mediaSource: "upload",
        saveState: "saving",
        previewUrl: "blob:local-reference",
        localObjectUrl: "blob:local-reference",
      }),
      cardPreviewUrl: "blob:local-reference",
      isLoaded: false,
      decodeBudgetEnabled: false,
      isImagePreview: true,
      isPriorityHydration: true,
      imageSrc: "blob:local-reference",
    });

    expect(state.isGenerationLoading).toBe(true);
    expect(state.isMediaHydrating).toBe(false);
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

  it("keeps generated rows loading until preview media can render", () => {
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
    });

    expect(state.isGenerationLoading).toBe(true);
    expect(state.isMediaHydrating).toBe(false);
    expect(state.loadingVisual).toBe("spinner");
  });

  it("keeps live provider-task previews loading until terminal success", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({
        taskState: "running",
        mediaSource: "generated",
        submissionMode: "provider-task",
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

  it("treats durable generated media with stale running task state as media hydration", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({
        taskState: "running",
        mediaSource: "generated",
        previewStoragePath: "user-1/variants/images/out-1.webp",
        fullStoragePath: "user-1/generations/images/out-1.png",
        savedMediaIds: ["media-1"],
      }),
      cardPreviewUrl: null,
      isLoaded: false,
      decodeBudgetEnabled: true,
      isImagePreview: true,
      isPriorityHydration: true,
      isStorageSigningPending: true,
    });

    expect(state.isGenerationLoading).toBe(false);
    expect(state.isMediaHydrating).toBe(true);
    expect(state.loadingVisual).toBe("hydrating");
  });

  it("does not hydrate storage-backed rows forever after signing is no longer pending", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({
        taskState: "success",
        mediaSource: "library",
        previewStoragePath: "user-1/variants/images/media-1.webp",
        fullStoragePath: "user-1/generations/images/media-1.png",
        savedMediaIds: ["media-1"],
      }),
      cardPreviewUrl: null,
      isLoaded: false,
      decodeBudgetEnabled: true,
      isImagePreview: true,
      isPriorityHydration: true,
      isStorageSigningPending: false,
    });

    expect(state.isGenerationLoading).toBe(false);
    expect(state.isMediaHydrating).toBe(false);
    expect(state.loadingVisual).toBe("none");
  });

  it("does not hydrate saved-media-only rows until media-id recovery supplies a renderable url", () => {
    const state = classifyReferenceGridCardVisualState({
      item: createOutput({
        taskState: "success",
        mediaSource: "library",
        previewStoragePath: null,
        fullStoragePath: null,
        savedMediaIds: ["media-1"],
      }),
      cardPreviewUrl: null,
      isLoaded: false,
      decodeBudgetEnabled: true,
      isImagePreview: false,
      isPriorityHydration: true,
    });

    expect(state.isGenerationLoading).toBe(false);
    expect(state.isMediaHydrating).toBe(false);
    expect(state.loadingVisual).toBe("none");
  });

  it("does not keep non-provider generated rows loading after preview media can render", () => {
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

  it("does not use hydration visual for renderable generated successes", () => {
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
    expect(state.isMediaHydrating).toBe(false);
    expect(state.loadingVisual).toBe("none");
  });
});
