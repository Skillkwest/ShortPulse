import React from "react";
import { render } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { projectReferenceGridMediaOutput } from "../../logic/referenceGridMediaOutput";
import { useReferenceGridCardRenderController } from "../useReferenceGridCardRenderController";

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput =>
  ({
    id: "video-1",
    prompt: "Prompt",
    mode: "video",
    aspect: "9:16",
    model: "Model",
    status: "ready",
    timestamp: "Now",
    taskState: "success",
    previewUrl: "blob:local-video-1",
    previewStoragePath: null,
    fullStoragePath: null,
    ...overrides,
  }) as StudioOutput;

describe("useReferenceGridCardRenderController", () => {
  it("keeps the loading spinner visible for dormant local video references pending persistence", () => {
    const output = createOutput();
    const visibleCard = {
      item: projectReferenceGridMediaOutput(output),
      authorityTier: "preview-only" as const,
      cardPreviewUrl: "blob:local-video-1",
      isVideoPreview: true,
      isImagePreview: false,
      isPriorityHydration: false,
      imageSrc: undefined,
    };

    const { result } = renderHook(() =>
      useReferenceGridCardRenderController({
        activeOutputId: null,
        visibleOutputById: { [output.id]: output },
        autoplayEnabledIdSet: new Set<string>(),
        linkedPromptReferenceIdSet: new Set<string>(),
        loadingCardIdSet: new Set<string>([output.id]),
        generationLoadingCardIdSet: new Set<string>(),
        hydrationLoadingCardIdSet: new Set<string>(),
        perfDegradeLevel: 0,
        visibleCardItems: [visibleCard],
        curatedVisibleCardItems: [],
        visibleQuickSlotIdSet: new Set<string>(),
        onSelectOutput: vi.fn(),
        onOpenDetails: vi.fn(),
        onCardDragStart: vi.fn(),
        onCardDragEnd: vi.fn(),
        onCuratedSectionDragOver: vi.fn(),
        onCuratedCardDrop: vi.fn(),
        onCuratedSectionDragEnter: vi.fn(),
        onCuratedSectionDragLeave: vi.fn(),
        onCuratedCardKeyboardReorder: vi.fn(),
        registerVideoNode: vi.fn(),
        markLoaded: vi.fn(),
        onAutoplayStarted: vi.fn(),
        onAutoplayStopped: vi.fn(),
      })
    );

    const { container } = render(<>{result.current.allRefsCardNodes}</>);
    expect(container.querySelector(".reference-loading")).not.toBeNull();
    expect(container.querySelector(".reference-spinner")).not.toBeNull();
  });
});
