import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaDurationBadge } from "../MediaDurationBadge";

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

    await act(async () => {
      createdMediaElements[0]?.listeners.loadedmetadata?.(new Event("loadedmetadata"));
    });

    expect(createdMediaElements).toHaveLength(3);
  });
});
