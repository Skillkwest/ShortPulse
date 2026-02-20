/**
 * Focused coverage for Media Library preview runtime extraction.
 * Verifies signed-url cache application and viewport visibility tracking behavior.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaPreviewRuntime } from "../useMediaPreviewRuntime";
import {
  createMediaTabCacheState,
  type MediaDataTab,
  type MediaTabCache,
} from "../../logic/mediaLibraryPageHelpers";
import type { MediaTab } from "../../logic/mediaMoveRouting";

type Row = {
  id: string;
  storage_path: string;
  file_type: "image" | "video" | string;
  created_at: string;
  source?: "upload" | "ai_studio" | string | null;
  signedUrl?: string;
};

type ObserverTrigger = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver
) => void;

let observeMock: ReturnType<typeof vi.fn>;
let unobserveMock: ReturnType<typeof vi.fn>;
let disconnectMock: ReturnType<typeof vi.fn>;
let triggerObserver: ObserverTrigger | null = null;
let originalIntersectionObserver: typeof globalThis.IntersectionObserver | undefined;

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: "row-1",
  storage_path: "user/images/row-1.png",
  file_type: "image",
  created_at: "2026-02-14T12:00:00.000Z",
  source: "upload",
  ...overrides,
});

const makeCacheState = (rows: Row[]): Record<MediaDataTab, MediaTabCache<Row>> => {
  const base = createMediaTabCacheState<Row>();
  return {
    ...base,
    uploaded_images: {
      ...base.uploaded_images,
      rows,
      loaded: true,
    },
  };
};

describe("useMediaPreviewRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observeMock = vi.fn();
    unobserveMock = vi.fn();
    disconnectMock = vi.fn();
    triggerObserver = null;
    originalIntersectionObserver = globalThis.IntersectionObserver;

    class MockIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "0px";
      readonly thresholds = [0];

      constructor(callback: ObserverTrigger) {
        triggerObserver = callback;
      }

      observe(target: Element): void {
        (observeMock as unknown as (node: Element) => void)(target);
      }

      unobserve(target: Element): void {
        (unobserveMock as unknown as (node: Element) => void)(target);
      }

      disconnect(): void {
        (disconnectMock as unknown as () => void)();
      }

      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }

    globalThis.IntersectionObserver = MockIntersectionObserver as typeof IntersectionObserver;
  });

  afterEach(() => {
    if (originalIntersectionObserver) {
      globalThis.IntersectionObserver = originalIntersectionObserver;
      return;
    }
    // @ts-expect-error restore for test runtime
    delete globalThis.IntersectionObserver;
  });

  it("applies signed URLs to cache rows, active rows, and focused row", async () => {
    const { result } = renderHook(() => {
      const row = makeRow();
      const [files, setFiles] = useState<Row[]>([row]);
      const [focusedFile, setFocusedFile] = useState<Row | null>(row);
      const [mediaTabCache, setMediaTabCache] = useState(() => makeCacheState([row]));

      const runtime = useMediaPreviewRuntime<Row>({
        activeMediaQuery: "",
        activeTab: "uploaded_images",
        setFiles,
        setFocusedFile,
        setMediaTabCache,
      });

      return {
        ...runtime,
        files,
        focusedFile,
        mediaTabCache,
      };
    });

    act(() => {
      result.current.applySignedUrlsToTab(
        "uploaded_images",
        new Map([["row-1", "https://signed"]])
      );
    });

    await waitFor(() => expect(result.current.files[0]?.signedUrl).toBe("https://signed"));
    expect(result.current.focusedFile?.signedUrl).toBe("https://signed");
    expect(result.current.mediaTabCache.uploaded_images.rows[0]?.signedUrl).toBe("https://signed");
  });

  it("tracks visible media ids through intersection observer updates", async () => {
    const { result } = renderHook(
      ({ activeTab }: { activeTab: MediaTab }) => {
        const [, setFiles] = useState<Row[]>([]);
        const [, setFocusedFile] = useState<Row | null>(null);
        const [, setMediaTabCache] = useState(() => makeCacheState([]));

        return useMediaPreviewRuntime<Row>({
          activeMediaQuery: "",
          activeTab,
          setFiles,
          setFocusedFile,
          setMediaTabCache,
        });
      },
      { initialProps: { activeTab: "uploaded_images" as MediaTab } }
    );

    expect(triggerObserver).not.toBeNull();
    const card = document.createElement("div");

    act(() => {
      result.current.getMediaCardRef("row-1")(card);
    });

    act(() => {
      triggerObserver?.(
        [{ isIntersecting: true, target: card } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    await waitFor(() => expect(result.current.visibleMediaVersion).toBe(1));
    expect(result.current.visibleMediaIdsRef.current.has("row-1")).toBe(true);

    act(() => {
      triggerObserver?.(
        [{ isIntersecting: false, target: card } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    await waitFor(() => expect(result.current.visibleMediaVersion).toBe(2));
    expect(result.current.visibleMediaIdsRef.current.has("row-1")).toBe(false);
    expect(observeMock).toHaveBeenCalledWith(card);
  });
});
