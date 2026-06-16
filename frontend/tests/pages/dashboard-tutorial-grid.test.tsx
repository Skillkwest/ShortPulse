/**
 * Dashboard tutorial grid tests for poster-first media loading behavior.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DashboardTutorialGrid,
  type DashboardTutorial,
} from "../../features/dashboard/components/DashboardTutorialGrid";

vi.mock("next/image", () => ({
  default: ({ alt = "", ...rest }: { alt?: string } & Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={String(rest.className ?? "")}
      loading={rest.loading === "eager" ? "eager" : "lazy"}
      src={String(rest.src ?? "")}
    />
  ),
}));

vi.mock("../../features/dashboard/components/DashboardTutorialModal", () => ({
  DashboardTutorialModal: ({ tutorial }: { tutorial: DashboardTutorial }) => (
    <div role="dialog" aria-label={tutorial.title} />
  ),
}));

const buildVideoTutorial = (index: number): DashboardTutorial => ({
  id: `tutorial-${index}`,
  title: `Tutorial ${index}`,
  youtubeUrl: "https://www.youtube.com/watch?v=abc123",
  thumbnailUrl: `https://cdn.example.com/tutorial-${index}.mp4`,
  thumbnailMediaType: "video",
  thumbnailPosterUrl: `https://cdn.example.com/tutorial-${index}.jpg`,
  thumbnailAlt: `Tutorial ${index} preview`,
  displayOrder: index,
});

const setReducedMotion = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const renderGrid = (
  tutorials: DashboardTutorial[],
  props: Partial<
    Omit<ComponentProps<typeof DashboardTutorialGrid>, "launchHref" | "tutorials">
  > = {}
) =>
  render(
    <DashboardTutorialGrid
      tutorials={tutorials}
      launchHref="/ai-studio"
      initialAutoPlayDelayMs={0}
      {...props}
    />
  );

const waitForTutorialAutoPlayStagger = async (delayMs = 900) => {
  await act(async () => {
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, delayMs);
    });
  });
};

const mockDashboardTutorialIntersectionObserver = () => {
  const observers: Array<{
    callback: IntersectionObserverCallback;
    elements: Set<Element>;
    observer: IntersectionObserver;
  }> = [];

  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];
    private readonly elements = new Set<Element>();

    constructor(callback: IntersectionObserverCallback) {
      const observer = this as IntersectionObserver;
      observers.push({ callback, elements: this.elements, observer });
    }

    disconnect = () => {
      this.elements.clear();
    };

    observe = (element: Element) => {
      this.elements.add(element);
    };

    takeRecords = () => [];

    unobserve = (element: Element) => {
      this.elements.delete(element);
    };
  }

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

  return {
    emit(
      entriesForIndex: (
        index: number
      ) => Pick<DOMRectReadOnly, "bottom" | "height" | "top"> & { isIntersecting?: boolean }
    ) {
      const videos = Array.from(document.querySelectorAll("video"));
      act(() => {
        observers.forEach(({ callback, elements, observer }) => {
          const entries = Array.from(elements).map((element) => {
            const index = videos.indexOf(element as HTMLVideoElement);
            const rect = entriesForIndex(index);
            return {
              boundingClientRect: rect,
              isIntersecting: rect.isIntersecting ?? true,
            } as IntersectionObserverEntry;
          });
          callback(entries, observer);
        });
      });
    },
    observedCount() {
      return observers.reduce((count, observer) => count + observer.elements.size, 0);
    },
  };
};

describe("DashboardTutorialGrid media loading", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses one batched window scroll listener for thumbnail viewport refresh", async () => {
    setReducedMotion(false);
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid(Array.from({ length: 6 }, (_, index) => buildVideoTutorial(index + 1)));

    await waitFor(() => {
      expect(observer.observedCount()).toBe(6);
    });

    const scrollListenerCalls = addEventListenerSpy.mock.calls.filter(
      ([eventName]) => eventName === "scroll"
    );
    expect(scrollListenerCalls).toHaveLength(1);
  });

  it("keeps thumbnail videos playing during scroll", async () => {
    setReducedMotion(false);
    const pauseSpy = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid(Array.from({ length: 3 }, (_, index) => buildVideoTutorial(index + 1)));

    await waitFor(() => {
      expect(observer.observedCount()).toBe(3);
    });

    observer.emit(() => ({ top: 120, bottom: 360, height: 240 }));

    await waitFor(() => {
      expect(document.querySelectorAll("video[src]")).toHaveLength(3);
    });

    pauseSpy.mockClear();
    fireEvent.scroll(window);
    expect(pauseSpy).not.toHaveBeenCalled();

    fireEvent.scroll(window);
    fireEvent.scroll(window);

    expect(pauseSpy).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 930);
      });
    });

    pauseSpy.mockClear();
    fireEvent.scroll(window);
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it("batches scroll-burst thumbnail measurements into animation frames", async () => {
    setReducedMotion(false);
    const rectSpy = vi
      .spyOn(HTMLVideoElement.prototype, "getBoundingClientRect")
      .mockImplementation(
        () =>
          ({
            bottom: 360,
            height: 240,
            left: 0,
            right: 240,
            toJSON: () => ({}),
            top: 120,
            width: 240,
            x: 0,
            y: 120,
          }) as DOMRect
      );
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid(Array.from({ length: 3 }, (_, index) => buildVideoTutorial(index + 1)));

    await waitFor(() => {
      expect(observer.observedCount()).toBe(3);
    });

    fireEvent.scroll(window);
    fireEvent.scroll(window);
    fireEvent.scroll(window);

    expect(rectSpy).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 70);
      });
    });

    expect(rectSpy).toHaveBeenCalledTimes(3);

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 860);
      });
    });

    expect(rectSpy).toHaveBeenCalledTimes(6);
  });

  it("keeps loaded visible thumbnails warm through scroll", async () => {
    setReducedMotion(false);
    const pauseSpy = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.resolve());
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid([buildVideoTutorial(1)]);

    await waitFor(() => {
      expect(observer.observedCount()).toBe(1);
    });

    observer.emit(() => ({ top: 120, bottom: 360, height: 240 }));

    const video = document.querySelector("video");
    await waitFor(() => {
      expect(video).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    });
    fireEvent.loadedData(video as HTMLVideoElement);
    expect(video).toHaveAttribute("loop");
    expect(document.querySelector('img[src="https://cdn.example.com/tutorial-1.jpg"]')).toBeNull();

    pauseSpy.mockClear();
    playSpy.mockClear();
    fireEvent.scroll(window);

    expect(pauseSpy).not.toHaveBeenCalled();
    expect(video).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    expect(video).not.toHaveAttribute("data-dashboard-scroll-paused");

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 930);
      });
    });

    await waitFor(() => {
      expect(video).toHaveAttribute("loop");
    });
    expect(video).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    expect(video).not.toHaveAttribute("data-dashboard-scroll-paused");
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("does not replay a thumbnail that is already moving", async () => {
    setReducedMotion(false);
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.resolve());
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid([buildVideoTutorial(1)]);

    await waitFor(() => {
      expect(observer.observedCount()).toBe(1);
    });

    observer.emit(() => ({ top: 120, bottom: 360, height: 240 }));

    const video = document.querySelector("video") as HTMLVideoElement;
    await waitFor(() => {
      expect(video).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    });
    fireEvent.loadedData(video);

    await waitFor(() => {
      expect(playSpy).toHaveBeenCalled();
    });
    playSpy.mockClear();
    Object.defineProperty(video, "paused", { configurable: true, value: false });
    Object.defineProperty(video, "ended", { configurable: true, value: false });
    Object.defineProperty(video, "readyState", { configurable: true, value: 4 });

    fireEvent.canPlay(video);

    expect(playSpy).not.toHaveBeenCalled();
  });

  it("autoplays every visible public-home thumbnail by default", async () => {
    setReducedMotion(false);
    renderGrid(Array.from({ length: 6 }, (_, index) => buildVideoTutorial(index + 1)));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tutorial 1: open tutorial" })).toBeInTheDocument();
    });

    const videos = document.querySelectorAll("video");
    expect(videos).toHaveLength(6);
    await waitFor(() => {
      expect(videos[0]).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    });
    await waitForTutorialAutoPlayStagger();
    expect(videos[4]).toHaveAttribute("src", "https://cdn.example.com/tutorial-5.mp4");
    expect(videos[5]).toHaveAttribute("src", "https://cdn.example.com/tutorial-6.mp4");
    expect(videos[5]).toHaveAttribute("poster", "https://cdn.example.com/tutorial-6.jpg");
    expect(videos[5]).toHaveAttribute("preload", "auto");
    expect(document.querySelector('img[src="https://cdn.example.com/tutorial-6.jpg"]')).toBeNull();
  });

  it("honors an explicit active video budget and wakes a user-engaged poster thumbnail", async () => {
    setReducedMotion(false);
    renderGrid(
      Array.from({ length: 6 }, (_, index) => buildVideoTutorial(index + 1)),
      {
        maxSimultaneousVideos: 5,
      }
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tutorial 1: open tutorial" })).toBeInTheDocument();
    });

    const videos = document.querySelectorAll("video");
    expect(videos).toHaveLength(6);
    await waitFor(() => {
      expect(videos[0]).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    });
    await waitForTutorialAutoPlayStagger();
    expect(videos[4]).toHaveAttribute("src", "https://cdn.example.com/tutorial-5.mp4");
    expect(videos[5]).not.toHaveAttribute("src");
    expect(videos[5]).not.toHaveAttribute("poster");
    expect(videos[5]).toHaveAttribute("preload", "none");
    expect(
      document.querySelector('img[src="https://cdn.example.com/tutorial-6.jpg"]')
    ).toBeInTheDocument();

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Tutorial 6: open tutorial" }));
    expect(videos[5]).toHaveAttribute("src", "https://cdn.example.com/tutorial-6.mp4");
    expect(videos[5]).toHaveAttribute("poster", "https://cdn.example.com/tutorial-6.jpg");
    expect(videos[5]).toHaveAttribute("preload", "auto");
  });

  it("prioritizes actually visible thumbnails over near offscreen thumbnails", async () => {
    setReducedMotion(false);
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid(Array.from({ length: 10 }, (_, index) => buildVideoTutorial(index + 1)));

    await waitFor(() => {
      expect(observer.observedCount()).toBe(10);
    });

    observer.emit((index) =>
      index < 5 ? { top: 120, bottom: 360, height: 240 } : { top: 760, bottom: 1000, height: 240 }
    );

    const videos = document.querySelectorAll("video");
    await waitFor(() => {
      expect(videos[0]).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    });
    await waitForTutorialAutoPlayStagger();
    expect(videos[0]).not.toHaveAttribute("data-playing");
    fireEvent.loadedData(videos[0]);
    expect(videos[0]).toHaveAttribute("data-playing", "true");
    expect(videos[4]).toHaveAttribute("src", "https://cdn.example.com/tutorial-5.mp4");
    expect(videos[5]).not.toHaveAttribute("src");
    expect(videos[9]).not.toHaveAttribute("src");
  });

  it("starts playback with the earliest visible thumbnails before lower visible rows", async () => {
    setReducedMotion(false);
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid(
      Array.from({ length: 6 }, (_, index) => buildVideoTutorial(index + 1)),
      {
        autoPlayBudget: 6,
        maxSimultaneousVideos: 3,
      }
    );

    await waitFor(() => {
      expect(observer.observedCount()).toBe(6);
    });

    observer.emit((index) =>
      index < 3 ? { top: 120, bottom: 360, height: 240 } : { top: 390, bottom: 630, height: 240 }
    );

    const videos = document.querySelectorAll("video");
    await waitFor(() => {
      expect(videos[0]).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    });
    await waitForTutorialAutoPlayStagger(520);
    expect(videos[1]).toHaveAttribute("src", "https://cdn.example.com/tutorial-2.mp4");
    expect(videos[2]).toHaveAttribute("src", "https://cdn.example.com/tutorial-3.mp4");
    expect(videos[3]).not.toHaveAttribute("src");
    expect(videos[4]).not.toHaveAttribute("src");
    expect(videos[5]).not.toHaveAttribute("src");
  });

  it("keeps the top visible row first even when lower rows have more visible pixels", async () => {
    setReducedMotion(false);
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid(
      Array.from({ length: 6 }, (_, index) => buildVideoTutorial(index + 1)),
      {
        autoPlayBudget: 6,
        maxSimultaneousVideos: 3,
      }
    );

    await waitFor(() => {
      expect(observer.observedCount()).toBe(6);
    });

    observer.emit((index) =>
      index < 3 ? { top: -40, bottom: 200, height: 240 } : { top: 220, bottom: 460, height: 240 }
    );

    const videos = document.querySelectorAll("video");
    await waitFor(() => {
      expect(videos[0]).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    });
    await waitForTutorialAutoPlayStagger(520);
    expect(videos[1]).toHaveAttribute("src", "https://cdn.example.com/tutorial-2.mp4");
    expect(videos[2]).toHaveAttribute("src", "https://cdn.example.com/tutorial-3.mp4");
    expect(videos[3]).not.toHaveAttribute("src");
    expect(videos[4]).not.toHaveAttribute("src");
    expect(videos[5]).not.toHaveAttribute("src");
  });

  it("rotates visible thumbnails through a larger candidate pool while keeping playback capped", async () => {
    setReducedMotion(false);
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid(
      Array.from({ length: 6 }, (_, index) => buildVideoTutorial(index + 1)),
      {
        autoPlayBudget: 6,
        maxSimultaneousVideos: 3,
      }
    );

    await waitFor(() => {
      expect(observer.observedCount()).toBe(6);
    });

    observer.emit(() => ({ top: 120, bottom: 360, height: 240 }));

    const videos = document.querySelectorAll("video");
    await waitFor(() => {
      expect(videos[0]).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    });
    await waitForTutorialAutoPlayStagger(520);
    fireEvent.loadedData(videos[0]);
    fireEvent.loadedData(videos[1]);
    fireEvent.loadedData(videos[2]);
    expect(videos[0]).toHaveAttribute("data-playing", "true");
    expect(videos[2]).toHaveAttribute("loop");
    expect(videos[3]).not.toHaveAttribute("loop");
    expect(videos[5]).not.toHaveAttribute("loop");

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 5300);
      });
    });

    await waitFor(() => {
      expect(videos[3]).toHaveAttribute("loop");
    });
    await waitForTutorialAutoPlayStagger(520);
    expect(videos[0]).not.toHaveAttribute("data-playing");
    expect(videos[5]).toHaveAttribute("loop");
    expect(videos[0]).not.toHaveAttribute("loop");
    expect(videos[2]).not.toHaveAttribute("loop");

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 850);
      });
    });

    await waitFor(() => {
      expect(videos[0]).not.toHaveAttribute("src");
      expect(videos[2]).not.toHaveAttribute("src");
    });
    expect(videos[3]).toHaveAttribute("src", "https://cdn.example.com/tutorial-4.mp4");
  }, 10000);

  it("keeps the initial visible playback set stable when rotation is disabled", async () => {
    setReducedMotion(false);
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid(
      Array.from({ length: 6 }, (_, index) => buildVideoTutorial(index + 1)),
      {
        autoPlayBudget: 6,
        enablePlaybackRotation: false,
        maxSimultaneousVideos: 3,
      }
    );

    await waitFor(() => {
      expect(observer.observedCount()).toBe(6);
    });

    observer.emit(() => ({ top: 120, bottom: 360, height: 240 }));

    const videos = document.querySelectorAll("video");
    await waitFor(() => {
      expect(videos[0]).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    });
    await waitForTutorialAutoPlayStagger(520);
    expect(videos[0]).toHaveAttribute("loop");
    expect(videos[1]).toHaveAttribute("loop");
    expect(videos[2]).toHaveAttribute("loop");
    expect(videos[3]).not.toHaveAttribute("loop");

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 5300);
      });
    });

    expect(videos[0]).toHaveAttribute("loop");
    expect(videos[1]).toHaveAttribute("loop");
    expect(videos[2]).toHaveAttribute("loop");
    expect(videos[3]).not.toHaveAttribute("loop");
    expect(videos[5]).not.toHaveAttribute("loop");
  }, 10000);

  it("restarts rotation from the earliest visible thumbnails after the viewport candidate set changes", async () => {
    setReducedMotion(false);
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid(
      Array.from({ length: 9 }, (_, index) => buildVideoTutorial(index + 1)),
      {
        autoPlayBudget: 9,
        maxSimultaneousVideos: 3,
      }
    );

    await waitFor(() => {
      expect(observer.observedCount()).toBe(9);
    });

    observer.emit(() => ({ top: 120, bottom: 360, height: 240 }));

    const videos = document.querySelectorAll("video");
    await waitFor(() => {
      expect(videos[0]).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    });
    await waitForTutorialAutoPlayStagger(520);

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 5300);
      });
    });

    await waitFor(() => {
      expect(videos[3]).toHaveAttribute("loop");
    });
    await waitForTutorialAutoPlayStagger(520);
    expect(videos[5]).toHaveAttribute("loop");
    expect(videos[6]).not.toHaveAttribute("loop");

    observer.emit((index) =>
      index < 3
        ? { top: -320, bottom: -80, height: 240, isIntersecting: false }
        : { top: 120 + (index - 3) * 28, bottom: 360 + (index - 3) * 28, height: 240 }
    );

    await waitForTutorialAutoPlayStagger(520);
    expect(videos[3]).toHaveAttribute("loop");
    expect(videos[4]).toHaveAttribute("loop");
    expect(videos[5]).toHaveAttribute("loop");
    expect(videos[6]).not.toHaveAttribute("loop");
    expect(videos[8]).not.toHaveAttribute("loop");
  }, 10000);

  it("delays idle video source release after thumbnails leave the viewport", async () => {
    setReducedMotion(false);
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid([buildVideoTutorial(1)]);

    await waitFor(() => {
      expect(observer.observedCount()).toBe(1);
    });

    observer.emit(() => ({ top: 120, bottom: 360, height: 240, isIntersecting: true }));

    const video = document.querySelector("video");
    await waitFor(() => {
      expect(video).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
    });

    fireEvent.loadedData(video as HTMLVideoElement);
    observer.emit(() => ({ top: 1400, bottom: 1640, height: 240, isIntersecting: false }));

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 900);
      });
    });

    expect(video).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 900);
      });
    });

    await waitFor(() => {
      expect(video).not.toHaveAttribute("src");
    });
    expect(video).not.toHaveAttribute("poster");
    expect(video).toHaveAttribute("preload", "none");
  });

  it("staggers idle video source release across thumbnails", async () => {
    setReducedMotion(false);
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid(Array.from({ length: 2 }, (_, index) => buildVideoTutorial(index + 1)));

    await waitFor(() => {
      expect(observer.observedCount()).toBe(2);
    });

    observer.emit(() => ({ top: 120, bottom: 360, height: 240, isIntersecting: true }));

    const videos = document.querySelectorAll("video");
    await waitFor(() => {
      expect(videos[0]).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
      expect(videos[1]).toHaveAttribute("src", "https://cdn.example.com/tutorial-2.mp4");
    });

    fireEvent.loadedData(videos[0]);
    fireEvent.loadedData(videos[1]);
    observer.emit(() => ({ top: 1400, bottom: 1640, height: 240, isIntersecting: false }));

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 1650);
      });
    });

    expect(videos[0]).not.toHaveAttribute("src");
    expect(videos[1]).toHaveAttribute("src", "https://cdn.example.com/tutorial-2.mp4");

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 120);
      });
    });

    expect(videos[1]).not.toHaveAttribute("src");
  });

  it("keeps all video thumbnails poster-first when reduced motion is requested", async () => {
    setReducedMotion(true);
    renderGrid(Array.from({ length: 2 }, (_, index) => buildVideoTutorial(index + 1)));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tutorial 1: open tutorial" })).toBeInTheDocument();
    });

    document.querySelectorAll("video").forEach((video) => {
      expect(video).not.toHaveAttribute("src");
      expect(video).not.toHaveAttribute("poster");
      expect(video).toHaveAttribute("preload", "none");
    });
    expect(document.querySelectorAll(".dashboard-tutorial-thumbnail-image")).toHaveLength(2);
  });

  it("renders a poster for every public-home video thumbnail in the initial grid", async () => {
    setReducedMotion(false);
    const observer = mockDashboardTutorialIntersectionObserver();
    renderGrid(Array.from({ length: 15 }, (_, index) => buildVideoTutorial(index + 1)));

    await waitFor(() => {
      expect(observer.observedCount()).toBe(15);
    });

    expect(document.querySelectorAll(".dashboard-tutorial-thumbnail-image")).toHaveLength(15);
    expect(
      document.querySelector('img[src="https://cdn.example.com/tutorial-15.jpg"]')
    ).toBeInTheDocument();

    observer.emit((index) =>
      index < 12
        ? { top: 120, bottom: 360, height: 240 }
        : { top: window.innerHeight + 20, bottom: window.innerHeight + 260, height: 240 }
    );

    expect(document.querySelectorAll(".dashboard-tutorial-thumbnail-image")).toHaveLength(15);
    expect(
      document.querySelector('img[src="https://cdn.example.com/tutorial-15.jpg"]')
    ).toBeInTheDocument();
  });
});
