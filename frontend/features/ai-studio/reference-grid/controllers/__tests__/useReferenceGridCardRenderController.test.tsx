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

  it("suppresses loading visuals for failed local video references", () => {
    const output = createOutput({
      taskState: "fail",
      timestamp: "Failed",
      errorMessage: "Generation failed",
    });
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
    expect(container.querySelector(".reference-fail-overlay")).not.toBeNull();
    expect(container.querySelector(".reference-loading")).toBeNull();
    expect(container.querySelector(".reference-spinner")).toBeNull();
  });

  it("uses signed full video result urls as the hover source for poster-backed video cards", () => {
    const output = createOutput({
      previewUrl: "https://signed.test/video-poster.jpg",
      previewPosterUrl: "https://signed.test/video-poster.jpg",
      resultUrls: ["https://signed.test/video-full.mp4"],
      previewStoragePath: "user-1/variants/videos/video-1/poster_720.jpg",
      previewPosterStoragePath: "user-1/variants/videos/video-1/poster_720.jpg",
      fullStoragePath: "user-1/generations/videos/video-1.mp4",
    });
    const visibleCard = {
      item: projectReferenceGridMediaOutput(output),
      authorityTier: "reusable" as const,
      cardPreviewUrl: "https://signed.test/video-poster.jpg",
      isVideoPreview: false,
      isImagePreview: true,
      isPriorityHydration: true,
      imageSrc: "https://signed.test/video-poster.jpg",
    };

    const { result } = renderHook(() =>
      useReferenceGridCardRenderController({
        activeOutputId: null,
        visibleOutputById: { [output.id]: output },
        autoplayEnabledIdSet: new Set<string>(),
        linkedPromptReferenceIdSet: new Set<string>(),
        loadingCardIdSet: new Set<string>(),
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
    const posterImage = container.querySelector(
      ".reference-card-image--poster"
    ) as HTMLImageElement | null;
    const hoverVideo = container.querySelector(".reference-card-video") as HTMLVideoElement | null;

    expect(posterImage).not.toBeNull();
    expect(posterImage?.getAttribute("src")).toBe("https://signed.test/video-poster.jpg");
    expect(hoverVideo).not.toBeNull();
    expect(hoverVideo?.getAttribute("src")).toBe("https://signed.test/video-full.mp4");
  });

  it("uses the resolved card preview as the source for posterless generated videos", () => {
    const output = createOutput({
      previewUrl: "https://tempfile.example.com/generated-video.mp4",
      resultUrls: ["https://tempfile.example.com/generated-video.mp4"],
      mediaSource: "generated",
      previewPosterUrl: null,
      previewPosterStoragePath: null,
    });
    const visibleCard = {
      item: projectReferenceGridMediaOutput(output),
      authorityTier: "tracked" as const,
      cardPreviewUrl: "https://tempfile.example.com/generated-video.mp4",
      isVideoPreview: true,
      isImagePreview: false,
      isPriorityHydration: true,
      imageSrc: undefined,
    };

    const { result } = renderHook(() =>
      useReferenceGridCardRenderController({
        activeOutputId: output.id,
        visibleOutputById: { [output.id]: output },
        autoplayEnabledIdSet: new Set<string>(),
        linkedPromptReferenceIdSet: new Set<string>(),
        loadingCardIdSet: new Set<string>(),
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
    const hoverVideo = container.querySelector(".reference-card-video") as HTMLVideoElement | null;
    const hoverSource = hoverVideo?.querySelector("source");

    expect(hoverVideo).not.toBeNull();
    expect(hoverVideo?.getAttribute("src")).toBe(
      "https://tempfile.example.com/generated-video.mp4"
    );
    expect(hoverVideo?.getAttribute("preload")).toBe("auto");
    expect(hoverSource?.getAttribute("src")).toBe(
      "https://tempfile.example.com/generated-video.mp4"
    );
  });
});
