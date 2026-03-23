import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import { resetAiStudioOutputStore, setAiStudioOutputStoreSnapshot } from "../aiStudioOutputStore";
import { useAiStudioPageOutputAdapters } from "../useAiStudioPageOutputAdapters";

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput =>
  ({
    id,
    prompt: `Prompt ${id}`,
    mode: "image",
    aspect: "9:16",
    model: "Seedream 4.5",
    status: "ready",
    timestamp: "now",
    taskState: "success",
    previewUrl: `https://example.com/${id}.png`,
    ...overrides,
  }) as StudioOutput;

describe("useAiStudioPageOutputAdapters", () => {
  beforeEach(() => {
    resetAiStudioOutputStore();
  });

  it("uses selector-store output ids and callbacks when the flags are enabled", () => {
    const activePending = makeOutput("pending", { taskState: "pending" });
    const archivedReady = makeOutput("archived");
    setAiStudioOutputStoreSnapshot({
      outputOrder: [activePending.id],
      outputById: { [activePending.id]: activePending },
      archivedOutputOrder: [archivedReady.id],
      archivedOutputById: { [archivedReady.id]: archivedReady },
    });

    const { result } = renderHook(() =>
      useAiStudioPageOutputAdapters({
        outputs: [],
        getOutputById: (id) => {
          if (id === activePending.id) return activePending;
          if (id === archivedReady.id) return archivedReady;
          return null;
        },
        referenceImageUrl: "https://example.com/reference.png",
        extraImageUrls: ["https://example.com/extra-1.png", null, null],
        outputSelectorStoreEnabled: true,
        selectorCallbacksEnabled: true,
      })
    );

    expect(result.current.inFlightOutputIds.has(activePending.id)).toBe(true);
    expect(result.current.findOutputById(archivedReady.id)).toBe(archivedReady);
    expect(result.current.resolvePanelOutputPreviewUrl(archivedReady.id)).toBe(
      archivedReady.previewUrl
    );
  });

  it("preserves the page fallback behavior when selector-store flags are disabled", () => {
    const activeRunning = makeOutput("running", { taskState: "running" });
    const archivedReady = makeOutput("archived");

    const { result } = renderHook(() =>
      useAiStudioPageOutputAdapters({
        outputs: [activeRunning],
        getOutputById: (id) => (id === archivedReady.id ? archivedReady : null),
        referenceImageUrl: "https://example.com/reference.png",
        extraImageUrls: [
          "https://example.com/extra-1.png",
          "https://example.com/extra-2.png",
          null,
        ],
        outputSelectorStoreEnabled: false,
        selectorCallbacksEnabled: false,
      })
    );

    expect(result.current.inFlightOutputIds.has(activeRunning.id)).toBe(true);
    expect(result.current.findOutputById(activeRunning.id)).toBe(activeRunning);
    expect(result.current.findOutputById(archivedReady.id)).toBeNull();
    expect(result.current.resolvePanelOutputPreviewUrl(activeRunning.id)).toBe(
      activeRunning.previewUrl
    );
    expect(result.current.resolvePanelOutputPreviewUrl(archivedReady.id)).toBeNull();
  });

  it("returns reference inputs only for edit/image workflows", () => {
    const { result } = renderHook(() =>
      useAiStudioPageOutputAdapters({
        outputs: [],
        getOutputById: () => null,
        referenceImageUrl: "https://example.com/reference.png",
        extraImageUrls: [
          "https://example.com/extra-1.png",
          "https://example.com/extra-2.png",
          null,
        ],
        outputSelectorStoreEnabled: true,
        selectorCallbacksEnabled: true,
      })
    );

    expect(result.current.resolveReferenceInputsForTool("edit")).toEqual({
      referenceImageUrl: "https://example.com/reference.png",
      extraImageUrls: ["https://example.com/extra-1.png", "https://example.com/extra-2.png", null],
    });
    expect(result.current.resolveReferenceInputsForTool("image")).toEqual({
      referenceImageUrl: "https://example.com/reference.png",
      extraImageUrls: ["https://example.com/extra-1.png", "https://example.com/extra-2.png", null],
    });
    expect(result.current.resolveReferenceInputsForTool("video")).toEqual({
      referenceImageUrl: null,
      extraImageUrls: [null, null, null],
    });
    expect(result.current.resolveReferenceInputsForTool("create")).toEqual({
      referenceImageUrl: null,
      extraImageUrls: [null, null, null],
    });
  });
});
