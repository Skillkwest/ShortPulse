import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaDurationBadge, readMediaDurationProbeWorkload } from "../MediaDurationBadge";

type FakeMediaElement = {
  preload: string;
  src: string;
  duration: number;
  load: ReturnType<typeof vi.fn>;
  removeAttribute: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  listeners: Record<string, EventListener>;
};

const createFakeMediaElement = (): FakeMediaElement => {
  const fakeMedia: FakeMediaElement = {
    preload: "",
    src: "",
    duration: 12,
    listeners: {},
    load: vi.fn(),
    removeAttribute: vi.fn((name: string) => {
      if (name === "src") fakeMedia.src = "";
    }),
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      fakeMedia.listeners[type] = listener;
    }),
    removeEventListener: vi.fn((type: string) => {
      delete fakeMedia.listeners[type];
    }),
  };
  return fakeMedia;
};

const resolveLoadedMetadata = async (fakeMedia: FakeMediaElement | undefined) => {
  await act(async () => {
    fakeMedia?.listeners.loadedmetadata?.(new Event("loadedmetadata"));
  });
};

describe("MediaDurationBadge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("limits hidden media duration probes to the shared concurrency budget", async () => {
    const actualCreateElement = document.createElement.bind(document);
    const createdMediaElements: FakeMediaElement[] = [];

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "audio" || tagName === "video") {
        const fakeMedia = createFakeMediaElement();
        createdMediaElements.push(fakeMedia);
        return fakeMedia as unknown as HTMLElement;
      }
      return actualCreateElement(tagName);
    });

    render(
      <>
        {[0, 1, 2, 3].map((index) => (
          <MediaDurationBadge
            key={index}
            mediaKind="video"
            mediaUrl={`https://media.test/video-${index}.mp4`}
          />
        ))}
      </>
    );

    expect(createdMediaElements).toHaveLength(2);

    await resolveLoadedMetadata(createdMediaElements[0]);

    expect(createdMediaElements).toHaveLength(3);
    await resolveLoadedMetadata(createdMediaElements[1]);
    await resolveLoadedMetadata(createdMediaElements[2]);
    await resolveLoadedMetadata(createdMediaElements[3]);
  });

  it("times out stalled hidden duration probes and continues queued probes", async () => {
    vi.useFakeTimers();
    try {
      const actualCreateElement = document.createElement.bind(document);
      const createdMediaElements: FakeMediaElement[] = [];

      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        if (tagName === "audio" || tagName === "video") {
          const fakeMedia = createFakeMediaElement();
          createdMediaElements.push(fakeMedia);
          return fakeMedia as unknown as HTMLElement;
        }
        return actualCreateElement(tagName);
      });

      render(
        <>
          {[0, 1, 2].map((index) => (
            <MediaDurationBadge
              key={index}
              mediaKind="video"
              mediaUrl={`https://media.test/stalled-video-${index}.mp4`}
            />
          ))}
        </>
      );

      expect(createdMediaElements).toHaveLength(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(8_000);
      });

      expect(createdMediaElements).toHaveLength(3);
      expect(createdMediaElements[0]?.removeAttribute).toHaveBeenCalledWith("src");
      expect(createdMediaElements[1]?.removeAttribute).toHaveBeenCalledWith("src");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(8_000);
      });

      expect(createdMediaElements[2]?.removeAttribute).toHaveBeenCalledWith("src");
    } finally {
      vi.useRealTimers();
    }
  });

  it("dedupes in-flight probes for matching media URLs", () => {
    const actualCreateElement = document.createElement.bind(document);
    const createdMediaElements: FakeMediaElement[] = [];

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "audio" || tagName === "video") {
        const fakeMedia = createFakeMediaElement();
        createdMediaElements.push(fakeMedia);
        return fakeMedia as unknown as HTMLElement;
      }
      return actualCreateElement(tagName);
    });

    render(
      <>
        <MediaDurationBadge mediaKind="video" mediaUrl="https://media.test/shared-video.mp4" />
        <MediaDurationBadge mediaKind="video" mediaUrl="https://media.test/shared-video.mp4" />
      </>
    );

    expect(createdMediaElements).toHaveLength(1);
  });

  it("keeps a shared probe until its final consumer unmounts", () => {
    const actualCreateElement = document.createElement.bind(document);
    const createdMediaElements: FakeMediaElement[] = [];

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "audio" || tagName === "video") {
        const fakeMedia = createFakeMediaElement();
        createdMediaElements.push(fakeMedia);
        return fakeMedia as unknown as HTMLElement;
      }
      return actualCreateElement(tagName);
    });

    const first = render(
      <MediaDurationBadge mediaKind="video" mediaUrl="https://media.test/shared-ref.mp4" />
    );
    const second = render(
      <MediaDurationBadge mediaKind="video" mediaUrl="https://media.test/shared-ref.mp4" />
    );

    expect(readMediaDurationProbeWorkload().inflightCount).toBe(1);
    first.unmount();
    expect(readMediaDurationProbeWorkload().inflightCount).toBe(1);
    second.unmount();
    expect(readMediaDurationProbeWorkload()).toMatchObject({ inflightCount: 0, queuedCount: 0 });
    expect(createdMediaElements[0]?.removeAttribute).toHaveBeenCalledWith("src");
  });

  it("bounds queued probes and retires all work when cards unmount", async () => {
    const actualCreateElement = document.createElement.bind(document);
    const createdMediaElements: FakeMediaElement[] = [];

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "audio" || tagName === "video") {
        const fakeMedia = createFakeMediaElement();
        createdMediaElements.push(fakeMedia);
        return fakeMedia as unknown as HTMLElement;
      }
      return actualCreateElement(tagName);
    });

    const rendered = render(
      <>
        {Array.from({ length: 100 }, (_, index) => (
          <MediaDurationBadge
            key={index}
            mediaKind="video"
            mediaUrl={`https://media.test/bounded-${index}.mp4`}
          />
        ))}
      </>
    );

    expect(createdMediaElements).toHaveLength(2);
    expect(readMediaDurationProbeWorkload()).toMatchObject({
      inflightCount: 2,
      queuedCount: 64,
    });

    rendered.unmount();
    await act(async () => Promise.resolve());
    expect(readMediaDurationProbeWorkload()).toMatchObject({ inflightCount: 0, queuedCount: 0 });
    expect(createdMediaElements).toHaveLength(2);
  });

  it("reuses explicit duration metadata without probing the same URL later", () => {
    const actualCreateElement = document.createElement.bind(document);
    const createdMediaElements: FakeMediaElement[] = [];

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "audio" || tagName === "video") {
        const fakeMedia = createFakeMediaElement();
        createdMediaElements.push(fakeMedia);
        return fakeMedia as unknown as HTMLElement;
      }
      return actualCreateElement(tagName);
    });

    const mediaUrl = "https://media.test/cached-duration.mp4";
    const { rerender } = render(
      <MediaDurationBadge mediaKind="video" mediaUrl={mediaUrl} durationMs={42_000} />
    );

    act(() => {
      rerender(<MediaDurationBadge mediaKind="video" mediaUrl={mediaUrl} />);
    });

    expect(createdMediaElements).toHaveLength(0);
    expect(screen.getByText("0:42")).toBeInTheDocument();
  });

  it("can suppress hidden duration probes while still rendering explicit durations", () => {
    const actualCreateElement = document.createElement.bind(document);
    const createdMediaElements: FakeMediaElement[] = [];

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "audio" || tagName === "video") {
        const fakeMedia = createFakeMediaElement();
        createdMediaElements.push(fakeMedia);
        return fakeMedia as unknown as HTMLElement;
      }
      return actualCreateElement(tagName);
    });

    const { rerender } = render(
      <MediaDurationBadge
        mediaKind="video"
        mediaUrl="https://media.test/suppressed-video.mp4"
        allowProbe={false}
      />
    );

    expect(createdMediaElements).toHaveLength(0);
    expect(screen.queryByText("0:12")).not.toBeInTheDocument();

    rerender(
      <MediaDurationBadge
        mediaKind="video"
        mediaUrl="https://media.test/suppressed-video.mp4"
        durationMs={12_000}
        allowProbe={false}
      />
    );

    expect(createdMediaElements).toHaveLength(0);
    expect(screen.getByText("0:12")).toBeInTheDocument();
  });

  it("keeps a resolved probed duration visible when probes are temporarily suspended", async () => {
    const actualCreateElement = document.createElement.bind(document);
    const createdMediaElements: FakeMediaElement[] = [];

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "audio" || tagName === "video") {
        const fakeMedia = createFakeMediaElement();
        createdMediaElements.push(fakeMedia);
        return fakeMedia as unknown as HTMLElement;
      }
      return actualCreateElement(tagName);
    });

    const mediaUrl = "https://media.test/temporarily-suspended-video.mp4";
    const { rerender } = render(<MediaDurationBadge mediaKind="video" mediaUrl={mediaUrl} />);

    await resolveLoadedMetadata(createdMediaElements[0]);

    expect(screen.getByText("0:12")).toBeInTheDocument();

    rerender(<MediaDurationBadge mediaKind="video" mediaUrl={mediaUrl} allowProbe={false} />);

    expect(createdMediaElements).toHaveLength(1);
    expect(screen.getByText("0:12")).toBeInTheDocument();

    rerender(
      <MediaDurationBadge
        mediaKind="video"
        mediaUrl="https://media.test/different-suspended-video.mp4"
        allowProbe={false}
      />
    );

    expect(screen.queryByText("0:12")).not.toBeInTheDocument();
  });
});
