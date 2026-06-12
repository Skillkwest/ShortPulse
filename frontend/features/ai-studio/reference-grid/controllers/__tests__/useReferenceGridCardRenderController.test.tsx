import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { __resetExclusiveSoundPlaybackForTests } from "../../../components/shared/exclusiveSoundPlayback";
import { projectReferenceGridMediaOutput } from "../../logic/referenceGridMediaOutput";
import { useReferenceGridCardRenderController } from "../useReferenceGridCardRenderController";
import { useReferenceGridSingleAudioPlaybackController } from "../useReferenceGridSingleAudioPlaybackController";

const playMock = vi.fn();
const pauseMock = vi.fn();

const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => {
  playMock();
  return Promise.resolve();
});
vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {
  pauseMock();
});

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
  beforeEach(() => {
    __resetExclusiveSoundPlaybackForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const createAudioControllerStub = () => ({
    requestPlay: vi.fn(),
    markPlaying: vi.fn(),
    clearActivePlayer: vi.fn(),
  });

  it("keeps duplicate quick-slot and all-refs audio players mutually exclusive", () => {
    playMock.mockClear();
    pauseMock.mockClear();
    const output = createOutput({
      id: "audio-1",
      mode: "audio",
      previewUrl: "https://example.com/audio-1.mp3",
    });
    const visibleCard = {
      item: projectReferenceGridMediaOutput(output),
      authorityTier: "reusable" as const,
      cardPreviewUrl: "https://example.com/audio-1.mp3",
      isVideoPreview: false,
      isImagePreview: false,
      isAudioPreview: true,
      isPriorityHydration: true,
      imageSrc: undefined,
    };

    const { result } = renderHook(() => {
      const audioPlaybackController = useReferenceGridSingleAudioPlaybackController();
      return useReferenceGridCardRenderController({
        activeOutputId: null,
        visibleOutputById: { [output.id]: output },
        autoplayEnabledIdSet: new Set<string>(),
        linkedPromptReferenceIdSet: new Set<string>(),
        loadingCardIdSet: new Set<string>(),
        generationLoadingCardIdSet: new Set<string>(),
        hydrationLoadingCardIdSet: new Set<string>(),
        perfDegradeLevel: 0,
        visibleCardItems: [visibleCard],
        curatedVisibleCardItems: [visibleCard],
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
        audioPlaybackController,
      });
    });

    const { container } = render(
      <>
        {result.current.curatedCardNodes}
        {result.current.allRefsCardNodes}
      </>
    );

    const playButtons = container.querySelectorAll(".reference-card-audio-play");
    const audioNodes = container.querySelectorAll(".reference-card-audio");
    expect(playButtons).toHaveLength(2);
    expect(audioNodes).toHaveLength(2);

    playMock.mockClear();
    pauseMock.mockClear();

    act(() => {
      (playButtons[0] as HTMLButtonElement).click();
      audioNodes[0]?.dispatchEvent(new Event("play"));
      (playButtons[1] as HTMLButtonElement).click();
    });

    expect(playMock).toHaveBeenCalledTimes(2);
    expect(pauseMock).toHaveBeenCalledTimes(1);
  });

  it("rejects supabase render-image audio cover art before rendering the player background", () => {
    const output = createOutput({
      id: "audio-cover-1",
      mode: "audio",
      previewUrl: "https://example.com/audio-cover-1.mp3",
      companionArtUrl:
        "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/render/image/sign/media_library/u/a/audio-cover.png?token=abc123",
    });
    const visibleCard = {
      item: projectReferenceGridMediaOutput(output),
      authorityTier: "reusable" as const,
      cardPreviewUrl: "https://example.com/audio-cover-1.mp3",
      isVideoPreview: false,
      isImagePreview: false,
      isAudioPreview: true,
      isPriorityHydration: true,
      previewQualityBand: "compact" as const,
      targetLongEdgePx: 320,
      imageSrc: undefined,
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
        perfDegradeLevel: 2,
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
        audioPlaybackController: createAudioControllerStub(),
      })
    );

    const { container } = render(<>{result.current.allRefsCardNodes}</>);
    const audioShell = container.querySelector(".reference-card-audio-shell") as HTMLElement | null;

    expect(audioShell?.getAttribute("style") ?? "").not.toContain("/storage/v1/render/image/");
    expect(audioShell?.getAttribute("style") ?? "").not.toContain("quality=28");
  });

  it("keeps supabase signed-object audio cover art on the original direct route", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://jwmcytzyhcvacjwqtynn.supabase.co");
    const companionArtUrl =
      "https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/object/sign/media_library/u/a/audio-cover.png?token=abc123";
    const output = createOutput({
      id: "audio-cover-2",
      mode: "audio",
      previewUrl: "https://example.com/audio-cover-2.mp3",
      companionArtUrl,
    });
    const visibleCard = {
      item: projectReferenceGridMediaOutput(output),
      authorityTier: "reusable" as const,
      cardPreviewUrl: "https://example.com/audio-cover-2.mp3",
      isVideoPreview: false,
      isImagePreview: false,
      isAudioPreview: true,
      isPriorityHydration: true,
      previewQualityBand: "compact" as const,
      targetLongEdgePx: 320,
      imageSrc: undefined,
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
        perfDegradeLevel: 2,
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
        audioPlaybackController: createAudioControllerStub(),
      })
    );

    const { container } = render(<>{result.current.allRefsCardNodes}</>);
    const audioShell = container.querySelector(".reference-card-audio-shell") as HTMLElement | null;
    const backgroundStyle = audioShell?.getAttribute("style") ?? "";

    expect(backgroundStyle).toContain(encodeURI(companionArtUrl));
    expect(backgroundStyle).not.toContain("/_next/image?url=");
  });

  it("clears active ownership after audio playback ends", () => {
    playMock.mockClear();
    pauseMock.mockClear();
    const output = createOutput({
      id: "audio-1",
      mode: "audio",
      previewUrl: "https://example.com/audio-1.mp3",
    });
    const secondOutput = createOutput({
      id: "audio-2",
      mode: "audio",
      previewUrl: "https://example.com/audio-2.mp3",
    });
    const visibleCards = [output, secondOutput].map((item) => ({
      item: projectReferenceGridMediaOutput(item),
      authorityTier: "reusable" as const,
      cardPreviewUrl: item.previewUrl ?? null,
      isVideoPreview: false,
      isImagePreview: false,
      isAudioPreview: true,
      isPriorityHydration: true,
      imageSrc: undefined,
    }));

    const { result } = renderHook(() => {
      const audioPlaybackController = useReferenceGridSingleAudioPlaybackController();
      return useReferenceGridCardRenderController({
        activeOutputId: null,
        visibleOutputById: { [output.id]: output, [secondOutput.id]: secondOutput },
        autoplayEnabledIdSet: new Set<string>(),
        linkedPromptReferenceIdSet: new Set<string>(),
        loadingCardIdSet: new Set<string>(),
        generationLoadingCardIdSet: new Set<string>(),
        hydrationLoadingCardIdSet: new Set<string>(),
        perfDegradeLevel: 0,
        visibleCardItems: visibleCards,
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
        audioPlaybackController,
      });
    });

    const { container } = render(<>{result.current.allRefsCardNodes}</>);
    const playButtons = container.querySelectorAll(".reference-card-audio-play");
    const audioNodes = container.querySelectorAll(".reference-card-audio");

    act(() => {
      (playButtons[0] as HTMLButtonElement).click();
      audioNodes[0]?.dispatchEvent(new Event("play"));
      audioNodes[0]?.dispatchEvent(new Event("ended"));
    });

    pauseMock.mockClear();
    playMock.mockClear();

    act(() => {
      (playButtons[1] as HTMLButtonElement).click();
    });

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(pauseMock).toHaveBeenCalledTimes(0);
  });

  it("does not leave stale active ownership when playback is rejected", async () => {
    playMock.mockClear();
    pauseMock.mockClear();
    playSpy.mockImplementationOnce(() => {
      playMock();
      return Promise.reject(new Error("blocked"));
    });
    const output = createOutput({
      id: "audio-1",
      mode: "audio",
      previewUrl: "https://example.com/audio-1.mp3",
    });
    const secondOutput = createOutput({
      id: "audio-2",
      mode: "audio",
      previewUrl: "https://example.com/audio-2.mp3",
    });
    const visibleCards = [output, secondOutput].map((item) => ({
      item: projectReferenceGridMediaOutput(item),
      authorityTier: "reusable" as const,
      cardPreviewUrl: item.previewUrl ?? null,
      isVideoPreview: false,
      isImagePreview: false,
      isAudioPreview: true,
      isPriorityHydration: true,
      imageSrc: undefined,
    }));

    const { result } = renderHook(() => {
      const audioPlaybackController = useReferenceGridSingleAudioPlaybackController();
      return useReferenceGridCardRenderController({
        activeOutputId: null,
        visibleOutputById: { [output.id]: output, [secondOutput.id]: secondOutput },
        autoplayEnabledIdSet: new Set<string>(),
        linkedPromptReferenceIdSet: new Set<string>(),
        loadingCardIdSet: new Set<string>(),
        generationLoadingCardIdSet: new Set<string>(),
        hydrationLoadingCardIdSet: new Set<string>(),
        perfDegradeLevel: 0,
        visibleCardItems: visibleCards,
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
        audioPlaybackController,
      });
    });

    const { container } = render(<>{result.current.allRefsCardNodes}</>);
    const playButtons = container.querySelectorAll(".reference-card-audio-play");

    await act(async () => {
      (playButtons[0] as HTMLButtonElement).click();
      await Promise.resolve();
    });

    pauseMock.mockClear();
    playMock.mockClear();

    act(() => {
      (playButtons[1] as HTMLButtonElement).click();
    });

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(pauseMock).toHaveBeenCalledTimes(0);
  });

  it("keeps rapid audio handoffs mutually exclusive before the first play event lands", () => {
    playMock.mockClear();
    pauseMock.mockClear();
    const output = createOutput({
      id: "audio-1",
      mode: "audio",
      previewUrl: "https://example.com/audio-1.mp3",
    });
    const secondOutput = createOutput({
      id: "audio-2",
      mode: "audio",
      previewUrl: "https://example.com/audio-2.mp3",
    });
    const visibleCards = [output, secondOutput].map((item) => ({
      item: projectReferenceGridMediaOutput(item),
      authorityTier: "reusable" as const,
      cardPreviewUrl: item.previewUrl ?? null,
      isVideoPreview: false,
      isImagePreview: false,
      isAudioPreview: true,
      isPriorityHydration: true,
      imageSrc: undefined,
    }));

    const { result } = renderHook(() => {
      const audioPlaybackController = useReferenceGridSingleAudioPlaybackController();
      return useReferenceGridCardRenderController({
        activeOutputId: null,
        visibleOutputById: { [output.id]: output, [secondOutput.id]: secondOutput },
        autoplayEnabledIdSet: new Set<string>(),
        linkedPromptReferenceIdSet: new Set<string>(),
        loadingCardIdSet: new Set<string>(),
        generationLoadingCardIdSet: new Set<string>(),
        hydrationLoadingCardIdSet: new Set<string>(),
        perfDegradeLevel: 0,
        visibleCardItems: visibleCards,
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
        audioPlaybackController,
      });
    });

    const { container } = render(<>{result.current.allRefsCardNodes}</>);
    const playButtons = container.querySelectorAll(".reference-card-audio-play");
    const audioNodes = container.querySelectorAll(".reference-card-audio");

    playMock.mockClear();
    pauseMock.mockClear();

    act(() => {
      (playButtons[0] as HTMLButtonElement).click();
      (playButtons[1] as HTMLButtonElement).click();
      audioNodes[0]?.dispatchEvent(new Event("play"));
      audioNodes[1]?.dispatchEvent(new Event("play"));
    });

    expect(playMock).toHaveBeenCalledTimes(2);
    expect(pauseMock).toHaveBeenCalledTimes(2);
  });

  it("clears active ownership when an active audio player errors", () => {
    playMock.mockClear();
    pauseMock.mockClear();
    const output = createOutput({
      id: "audio-1",
      mode: "audio",
      previewUrl: "https://example.com/audio-1.mp3",
    });
    const secondOutput = createOutput({
      id: "audio-2",
      mode: "audio",
      previewUrl: "https://example.com/audio-2.mp3",
    });
    const visibleCards = [output, secondOutput].map((item) => ({
      item: projectReferenceGridMediaOutput(item),
      authorityTier: "reusable" as const,
      cardPreviewUrl: item.previewUrl ?? null,
      isVideoPreview: false,
      isImagePreview: false,
      isAudioPreview: true,
      isPriorityHydration: true,
      imageSrc: undefined,
    }));

    const { result } = renderHook(() => {
      const audioPlaybackController = useReferenceGridSingleAudioPlaybackController();
      return useReferenceGridCardRenderController({
        activeOutputId: null,
        visibleOutputById: { [output.id]: output, [secondOutput.id]: secondOutput },
        autoplayEnabledIdSet: new Set<string>(),
        linkedPromptReferenceIdSet: new Set<string>(),
        loadingCardIdSet: new Set<string>(),
        generationLoadingCardIdSet: new Set<string>(),
        hydrationLoadingCardIdSet: new Set<string>(),
        perfDegradeLevel: 0,
        visibleCardItems: visibleCards,
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
        audioPlaybackController,
      });
    });

    const { container } = render(<>{result.current.allRefsCardNodes}</>);
    const playButtons = container.querySelectorAll(".reference-card-audio-play");
    const audioNodes = container.querySelectorAll(".reference-card-audio");

    act(() => {
      (playButtons[0] as HTMLButtonElement).click();
      audioNodes[0]?.dispatchEvent(new Event("play"));
      audioNodes[0]?.dispatchEvent(new Event("error"));
    });

    pauseMock.mockClear();
    playMock.mockClear();

    act(() => {
      (playButtons[1] as HTMLButtonElement).click();
    });

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(pauseMock).toHaveBeenCalledTimes(0);
  });

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
        audioPlaybackController: createAudioControllerStub(),
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
        audioPlaybackController: createAudioControllerStub(),
      })
    );

    const { container } = render(<>{result.current.allRefsCardNodes}</>);
    expect(container.querySelector(".reference-fail-overlay")).not.toBeNull();
    expect(container.querySelector(".reference-loading")).toBeNull();
    expect(container.querySelector(".reference-spinner")).toBeNull();
  });

  it("keeps full-aspect contain-preview mode available without rendering duplicate images", () => {
    const output = createOutput({
      id: "image-1",
      mode: "image",
      previewUrl: "https://signed.test/reference-image.png",
      previewStoragePath: "user-1/variants/images/image-1/preview.png",
      fullStoragePath: "user-1/generations/images/image-1.png",
    });
    const visibleCard = {
      item: projectReferenceGridMediaOutput(output),
      authorityTier: "reusable" as const,
      cardPreviewUrl: "https://signed.test/reference-image.png",
      isVideoPreview: false,
      isImagePreview: true,
      isPriorityHydration: true,
      imageSrc: "https://signed.test/reference-image.png",
    };

    const { result } = renderHook(() =>
      useReferenceGridCardRenderController({
        activeOutputId: "some-other-output",
        visibleOutputById: { [output.id]: output },
        autoplayEnabledIdSet: new Set<string>(),
        linkedPromptReferenceIdSet: new Set<string>(),
        loadingCardIdSet: new Set<string>(),
        generationLoadingCardIdSet: new Set<string>(),
        hydrationLoadingCardIdSet: new Set<string>(),
        perfDegradeLevel: 2,
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
        audioPlaybackController: createAudioControllerStub(),
      })
    );

    const { container } = render(<>{result.current.allRefsCardNodes}</>);
    expect(
      container.querySelector(".reference-card")?.classList.contains("has-contain-preview")
    ).toBe(true);
    expect(container.querySelector(".reference-card-image--contain")).toBeNull();
    expect(container.querySelectorAll(".reference-card-image")).toHaveLength(1);
  });

  it("passes hydrated image dimensions through composer drag artifacts", () => {
    const output = createOutput({
      id: "image-dimensions-1",
      mode: "image",
      previewUrl: "https://signed.test/reference-image.png",
      previewStoragePath: "user-1/variants/images/image-1/preview.png",
      fullStoragePath: "user-1/generations/images/image-1.png",
      width: 1536,
      height: 1024,
    });
    const onCardDragStart = vi.fn();
    const visibleCard = {
      item: projectReferenceGridMediaOutput(output),
      authorityTier: "reusable" as const,
      cardPreviewUrl: "https://signed.test/reference-image.png",
      dragDisplayArtifactUrl: "blob:reference-image-card-artifact",
      dragDisplayArtifactKind: "blob" as const,
      isVideoPreview: false,
      isImagePreview: true,
      isPriorityHydration: true,
      imageSrc: "https://signed.test/reference-image.png",
    };

    const { result } = renderHook(() =>
      useReferenceGridCardRenderController({
        activeOutputId: "some-other-output",
        visibleOutputById: { [output.id]: output },
        autoplayEnabledIdSet: new Set<string>(),
        linkedPromptReferenceIdSet: new Set<string>(),
        loadingCardIdSet: new Set<string>(),
        generationLoadingCardIdSet: new Set<string>(),
        hydrationLoadingCardIdSet: new Set<string>(),
        perfDegradeLevel: 2,
        visibleCardItems: [visibleCard],
        curatedVisibleCardItems: [],
        visibleQuickSlotIdSet: new Set<string>(),
        onSelectOutput: vi.fn(),
        onOpenDetails: vi.fn(),
        onCardDragStart,
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
        audioPlaybackController: createAudioControllerStub(),
      })
    );

    const { container } = render(<>{result.current.allRefsCardNodes}</>);
    const card = container.querySelector(".reference-card") as HTMLElement | null;
    expect(card).not.toBeNull();
    fireEvent.dragStart(card as HTMLElement);

    expect(onCardDragStart.mock.calls[0]?.[3]).toMatchObject({
      displayArtifactUrl: "blob:reference-image-card-artifact",
      width: 1536,
      height: 1024,
    });
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
        audioPlaybackController: createAudioControllerStub(),
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

  it("uses the resolved fallback video url when poster-backed cards have no raw hover source", () => {
    const output = createOutput({
      previewUrl: "https://signed.test/video-poster.jpg",
      previewPosterUrl: "https://signed.test/video-poster.jpg",
      resultUrls: [],
      previewStoragePath: "user-1/variants/videos/video-2/poster_720.jpg",
      previewPosterStoragePath: "user-1/variants/videos/video-2/poster_720.jpg",
      fullStoragePath: "user-1/generations/videos/video-2.mp4",
    });
    const visibleCard = {
      item: projectReferenceGridMediaOutput(output),
      authorityTier: "reusable" as const,
      cardPreviewUrl: "https://signed.test/video-poster.jpg",
      fallbackUrl: "https://signed.test/video-2-full.mp4",
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
        audioPlaybackController: createAudioControllerStub(),
      })
    );

    const { container } = render(<>{result.current.allRefsCardNodes}</>);
    const hoverVideo = container.querySelector(".reference-card-video") as HTMLVideoElement | null;

    expect(hoverVideo).not.toBeNull();
    expect(hoverVideo?.getAttribute("src")).toBe("https://signed.test/video-2-full.mp4");
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
        audioPlaybackController: createAudioControllerStub(),
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

  it("does not crash when the audio playback controller is unexpectedly missing", () => {
    const output = createOutput({
      id: "audio-missing-controller",
      mode: "audio",
      previewUrl: "https://example.com/audio-missing-controller.mp3",
    });
    const visibleCard = {
      item: projectReferenceGridMediaOutput(output),
      authorityTier: "reusable" as const,
      cardPreviewUrl: output.previewUrl ?? null,
      isVideoPreview: false,
      isImagePreview: false,
      isAudioPreview: true,
      isPriorityHydration: true,
      imageSrc: undefined,
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
        audioPlaybackController: undefined as unknown as ReturnType<
          typeof useReferenceGridSingleAudioPlaybackController
        >,
      })
    );

    const { container } = render(<>{result.current.allRefsCardNodes}</>);
    expect(container.querySelector(".reference-card-audio")).not.toBeNull();
  });
});
