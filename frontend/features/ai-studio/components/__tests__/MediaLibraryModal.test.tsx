/**
 * MediaLibraryModal rendering tests.
 * Verifies media cards reserve stable aspect-ratio placeholders before preview URLs are hydrated.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaLibraryModal } from "../MediaLibraryModal";
import { ensureSupabaseClient } from "../../../../lib/supabaseClient";

type MediaRow = {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  source?: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
};

const mockMediaRows: MediaRow[] = [];
const {
  mockFetchWithAuth,
  mockResolveMediaDirectPreviewUrls,
  mockResolveMediaSigningStoragePaths,
  mockGetSignedMediaUrl,
  mockGetSignedMediaUrlsBatch,
} = vi.hoisted(() => ({
  mockFetchWithAuth: vi.fn(async () => ({ ok: false, json: async () => ({}) })),
  mockResolveMediaDirectPreviewUrls: vi.fn((...args: unknown[]) => {
    void args;
    return [] as string[];
  }),
  mockResolveMediaSigningStoragePaths: vi.fn((...args: unknown[]) => {
    void args;
    return [] as string[];
  }),
  mockGetSignedMediaUrl: vi.fn(async (...args: unknown[]) => {
    void args;
    return null as string | null;
  }),
  mockGetSignedMediaUrlsBatch: vi.fn(async () => new Map<string, string>()),
}));

vi.mock("../../../../lib/mediaPerfTelemetry", () => ({
  createMediaPerfTimer: () => () => undefined,
  logMediaPerf: vi.fn(),
}));

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: mockFetchWithAuth,
}));

vi.mock("../../../../lib/mediaPreviewPath", () => ({
  resolveMediaDirectPreviewUrls: mockResolveMediaDirectPreviewUrls,
  resolveMediaSigningStoragePaths: mockResolveMediaSigningStoragePaths,
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: mockGetSignedMediaUrl,
  getSignedMediaUrlsBatch: mockGetSignedMediaUrlsBatch,
}));

vi.mock("../../../media-library/logic/mediaLibraryFeatureFlags", () => ({
  MEDIA_LIST_API_ENABLED: false,
  MEDIA_LIBRARY_VIRTUALIZATION_ENABLED: false,
  MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED: false,
  MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED: true,
}));

vi.mock("../../../media-library/logic/mediaListApi", () => ({
  fetchMediaListPage: vi.fn(async () => null),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: vi.fn(),
}));

const ensureSupabaseClientMock = vi.mocked(ensureSupabaseClient);

const createSupabaseClientMock = (options?: {
  mediaLimitImpl?: () => Promise<{ data: MediaRow[]; error: null }>;
}) => {
  const mediaQueryBuilder = {
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi
      .fn()
      .mockImplementation(
        options?.mediaLimitImpl ?? (async () => ({ data: mockMediaRows, error: null }))
      ),
    lt: vi.fn().mockReturnThis(),
  };

  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: "user-1" } } },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "media_files") {
        return {
          select: vi.fn(() => mediaQueryBuilder),
        };
      }
      if (table === "media_prompts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn(async () => ({ data: [], error: null })),
              }),
            }),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
};

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("MediaLibraryModal", () => {
  beforeEach(() => {
    mockMediaRows.length = 0;
    ensureSupabaseClientMock.mockReset();
    ensureSupabaseClientMock.mockImplementation(() => createSupabaseClientMock() as never);
    mockFetchWithAuth.mockClear();
    mockResolveMediaDirectPreviewUrls.mockClear();
    mockResolveMediaSigningStoragePaths.mockReset();
    mockResolveMediaSigningStoragePaths.mockImplementation(() => []);
    mockGetSignedMediaUrl.mockClear();
    mockGetSignedMediaUrlsBatch.mockReset();
    mockGetSignedMediaUrlsBatch.mockImplementation(async () => new Map<string, string>());
    if (!window.matchMedia) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies metadata-derived aspect ratio to unloaded media placeholders", async () => {
    mockMediaRows.push({
      id: "media-1",
      filename: "forest.png",
      storage_path: "user-1/upload/forest.png",
      file_type: "image/png",
      source: "upload",
      created_at: "2026-02-14T00:00:00.000Z",
      metadata: {
        dimensions: { width: "1200", height: "800" },
      },
    });

    const { container } = render(
      <MediaLibraryModal
        isOpen
        onClose={() => undefined}
        onSelectMedia={() => undefined}
        onSelectPrompt={() => undefined}
      />
    );

    await waitFor(() => {
      const placeholder = container.querySelector(".media-thumb.placeholder");
      expect(placeholder).toBeTruthy();
      expect((placeholder as HTMLDivElement).style.aspectRatio).toBe("1.5");
    });
  });

  it("shows blocking loading state on initial empty media fetch", async () => {
    const deferred = createDeferred<{ data: MediaRow[]; error: null }>();
    ensureSupabaseClientMock.mockImplementation(
      () =>
        createSupabaseClientMock({
          mediaLimitImpl: () => deferred.promise,
        }) as never
    );

    render(
      <MediaLibraryModal
        isOpen
        onClose={() => undefined}
        onSelectMedia={() => undefined}
        onSelectPrompt={() => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Loading media library…")).toBeTruthy();
    });
    expect(screen.queryByText("Refreshing media…")).toBeNull();

    deferred.resolve({
      data: [],
      error: null,
    });
    await waitFor(() => {
      expect(screen.queryByText("Loading media library…")).toBeNull();
    });
  });

  it("does not stay stuck loading after close/reopen while initial fetch is unresolved", async () => {
    const firstDeferred = createDeferred<{ data: MediaRow[]; error: null }>();
    const reopenRow: MediaRow = {
      id: "media-reopen-1",
      filename: "reopen.png",
      storage_path: "user-1/upload/reopen.png",
      file_type: "image/png",
      source: "upload",
      created_at: "2026-02-14T00:00:00.000Z",
      metadata: {
        dimensions: { width: "1200", height: "800" },
      },
    };
    let mediaFetchCount = 0;
    ensureSupabaseClientMock.mockImplementation(
      () =>
        createSupabaseClientMock({
          mediaLimitImpl: async () => {
            mediaFetchCount += 1;
            if (mediaFetchCount === 1) return firstDeferred.promise;
            return { data: [reopenRow], error: null };
          },
        }) as never
    );

    const { container, rerender } = render(
      <MediaLibraryModal
        isOpen
        onClose={() => undefined}
        onSelectMedia={() => undefined}
        onSelectPrompt={() => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Loading media library…")).toBeTruthy();
    });

    rerender(
      <MediaLibraryModal
        isOpen={false}
        onClose={() => undefined}
        onSelectMedia={() => undefined}
        onSelectPrompt={() => undefined}
      />
    );
    rerender(
      <MediaLibraryModal
        isOpen
        onClose={() => undefined}
        onSelectMedia={() => undefined}
        onSelectPrompt={() => undefined}
      />
    );

    await waitFor(() => {
      expect(container.querySelector("[data-media-id='media-reopen-1']")).toBeTruthy();
    });
    expect(mediaFetchCount).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Loading media library…")).toBeNull();
  });

  it("keeps media cards visible during unresolved stale refresh without blocking loader", async () => {
    let nowMs = Date.parse("2026-03-02T00:00:00.000Z");
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => nowMs);
    try {
      const staleRow: MediaRow = {
        id: "media-stale-1",
        filename: "stale.png",
        storage_path: "user-1/upload/stale.png",
        file_type: "image/png",
        source: "upload",
        created_at: "2026-02-14T00:00:00.000Z",
        metadata: {
          dimensions: { width: "1200", height: "800" },
        },
      };
      mockResolveMediaSigningStoragePaths.mockImplementation(() => ["user-1/upload/stale.png"]);
      let fetchCount = 0;
      const deferred = createDeferred<{ data: MediaRow[]; error: null }>();
      ensureSupabaseClientMock.mockImplementation(
        () =>
          createSupabaseClientMock({
            mediaLimitImpl: async () => {
              fetchCount += 1;
              if (fetchCount === 1) {
                return { data: [staleRow], error: null };
              }
              return deferred.promise;
            },
          }) as never
      );

      const { container, rerender } = render(
        <MediaLibraryModal
          isOpen
          onClose={() => undefined}
          onSelectMedia={() => undefined}
          onSelectPrompt={() => undefined}
        />
      );

      await waitFor(() => {
        expect(container.querySelector("[data-media-id='media-stale-1']")).toBeTruthy();
      });

      nowMs = Date.parse("2026-03-02T00:01:05.000Z");
      rerender(
        <MediaLibraryModal
          isOpen={false}
          onClose={() => undefined}
          onSelectMedia={() => undefined}
          onSelectPrompt={() => undefined}
        />
      );
      rerender(
        <MediaLibraryModal
          isOpen
          onClose={() => undefined}
          onSelectMedia={() => undefined}
          onSelectPrompt={() => undefined}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Refreshing media…")).toBeTruthy();
      });
      expect(container.querySelector("[data-media-id='media-stale-1']")).toBeTruthy();
      expect(screen.queryByText("Loading media library…")).toBeNull();

      deferred.resolve({ data: [staleRow], error: null });
      await waitFor(() => {
        expect(screen.queryByText("Refreshing media…")).toBeNull();
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("caps unresolved preview signing retries to avoid continuous render churn", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      mockMediaRows.push({
        id: "media-retry-1",
        filename: "retry.png",
        storage_path: "user-1/upload/retry.png",
        file_type: "image/png",
        source: "upload",
        created_at: "2026-02-14T00:00:00.000Z",
        metadata: {
          dimensions: { width: "1024", height: "1024" },
        },
      });
      mockResolveMediaSigningStoragePaths.mockImplementation(() => ["user-1/upload/retry.png"]);
      mockGetSignedMediaUrlsBatch.mockImplementation(async () => new Map<string, string>());

      render(
        <MediaLibraryModal
          isOpen
          onClose={() => undefined}
          onSelectMedia={() => undefined}
          onSelectPrompt={() => undefined}
        />
      );

      await waitFor(() => {
        expect(mockGetSignedMediaUrlsBatch).toHaveBeenCalledTimes(3);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });
      expect(mockGetSignedMediaUrlsBatch).toHaveBeenCalledTimes(3);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("falls back to direct source URL when optimizer preview errors in modal cards", async () => {
    const sourceUrl = "https://signed.example.com/forest.png?token=abc123";
    const optimizerUrl = `/_next/image?url=${encodeURIComponent(sourceUrl)}&w=750&q=70`;
    mockMediaRows.push({
      id: "media-optimizer-fallback-1",
      filename: "forest.png",
      storage_path: "user-1/upload/forest.png",
      file_type: "image/png",
      source: "upload",
      created_at: "2026-02-14T00:00:00.000Z",
      metadata: {
        dimensions: { width: "1200", height: "800" },
      },
    });
    mockResolveMediaSigningStoragePaths.mockImplementation(() => ["user-1/upload/forest.png"]);
    mockGetSignedMediaUrlsBatch.mockImplementation(
      async () => new Map<string, string>([["user-1/upload/forest.png", optimizerUrl]])
    );
    mockGetSignedMediaUrl.mockImplementation(async () => sourceUrl);

    const { container } = render(
      <MediaLibraryModal
        isOpen
        onClose={() => undefined}
        onSelectMedia={() => undefined}
        onSelectPrompt={() => undefined}
      />
    );

    await waitFor(() => {
      const image = container.querySelector(".media-thumb") as HTMLImageElement | null;
      expect(image).toBeTruthy();
      expect(image?.getAttribute("src")).toBe(optimizerUrl);
    });

    const image = container.querySelector(".media-thumb") as HTMLImageElement;
    fireEvent.error(image);

    await waitFor(() => {
      const nextImage = container.querySelector(".media-thumb") as HTMLImageElement | null;
      expect(nextImage).toBeTruthy();
      expect(nextImage?.getAttribute("src")).toBe(sourceUrl);
    });
  });

  it.each([
    {
      tabLabel: "Uploaded Images",
      row: {
        id: "media-uploaded-image",
        filename: "image.png",
        storage_path: "user-1/upload/image.png",
        file_type: "image/png",
        source: "upload",
      },
    },
    {
      tabLabel: "Uploaded Videos",
      row: {
        id: "media-uploaded-video",
        filename: "video.mp4",
        storage_path: "user-1/upload/video.mp4",
        file_type: "video/mp4",
        source: "upload",
      },
    },
    {
      tabLabel: "AI Studio Generations",
      row: {
        id: "media-ai-generation",
        filename: "generation.png",
        storage_path: "user-1/ai_studio/generation.png",
        file_type: "image/png",
        source: "ai_studio",
      },
    },
    {
      tabLabel: "Private",
      row: {
        id: "media-private",
        filename: "private.png",
        storage_path: "user-1/private/private.png",
        file_type: "image/png",
        source: "private_upload",
      },
    },
  ])("applies signing retry cap on $tabLabel tab", async ({ tabLabel, row }) => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      mockMediaRows.push({
        ...row,
        created_at: "2026-02-14T00:00:00.000Z",
        metadata: {
          dimensions: { width: "1024", height: "1024" },
        },
      });
      mockResolveMediaSigningStoragePaths.mockImplementation(() => [row.storage_path]);
      mockGetSignedMediaUrlsBatch.mockImplementation(async () => new Map<string, string>());

      render(
        <MediaLibraryModal
          isOpen
          onClose={() => undefined}
          onSelectMedia={() => undefined}
          onSelectPrompt={() => undefined}
        />
      );

      if (tabLabel !== "Uploaded Images") {
        fireEvent.click(screen.getByRole("tab", { name: tabLabel }));
      }

      await waitFor(() => {
        expect(mockGetSignedMediaUrlsBatch).toHaveBeenCalledTimes(3);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });
      expect(mockGetSignedMediaUrlsBatch).toHaveBeenCalledTimes(3);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does not run media signing on Saved Prompts tab", async () => {
    mockMediaRows.length = 0;
    render(
      <MediaLibraryModal
        isOpen
        onClose={() => undefined}
        onSelectMedia={() => undefined}
        onSelectPrompt={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Saved Prompts" }));
    await waitFor(() => {
      expect(screen.getByText("No saved prompts yet.")).toBeTruthy();
    });
    expect(mockGetSignedMediaUrlsBatch).not.toHaveBeenCalled();
  });

  it("passes metadata prompt text when selecting media", async () => {
    mockMediaRows.push({
      id: "media-prompt-1",
      filename: "forest.png",
      storage_path: "user-1/upload/forest.png",
      file_type: "image/png",
      source: "upload",
      created_at: "2026-02-14T00:00:00.000Z",
      metadata: {
        prompt: "Golden-hour beach portrait with soft shadows.",
      },
    });
    mockResolveMediaSigningStoragePaths.mockImplementation(() => ["user-1/upload/forest.png"]);
    mockGetSignedMediaUrlsBatch.mockImplementation(
      async () =>
        new Map<string, string>([
          ["user-1/upload/forest.png", "https://signed.example.com/forest.png"],
        ])
    );
    mockGetSignedMediaUrl.mockImplementation(async () => "https://signed.example.com/forest.png");
    const onSelectMedia = vi.fn();

    const { container } = render(
      <MediaLibraryModal
        isOpen
        onClose={() => undefined}
        onSelectMedia={onSelectMedia}
        onSelectPrompt={() => undefined}
      />
    );

    await waitFor(() => {
      expect(container.querySelector("[data-media-id='media-prompt-1']")).toBeTruthy();
    });
    fireEvent.click(
      container.querySelector("[data-media-id='media-prompt-1']") as HTMLButtonElement
    );

    await waitFor(() => {
      expect(onSelectMedia).toHaveBeenCalledTimes(1);
    });
    expect(onSelectMedia.mock.calls[0]?.[0]).toMatchObject({
      id: "media-prompt-1",
      filename: "forest.png",
      promptText: "Golden-hour beach portrait with soft shadows.",
    });
  });

  it("prefers canonical storage path when selecting media", async () => {
    mockMediaRows.push({
      id: "media-prefer-full-1",
      filename: "portrait.png",
      storage_path: "user-1/upload/portrait.png",
      thumb_variant_path: "user-1/upload/portrait-thumb.png",
      file_type: "image/png",
      source: "upload",
      created_at: "2026-02-14T00:00:00.000Z",
      metadata: {
        prompt: "Portrait reference",
      },
    });
    mockResolveMediaSigningStoragePaths.mockImplementation(() => [
      "user-1/upload/portrait-thumb.png",
      "user-1/upload/portrait.png",
    ]);
    mockGetSignedMediaUrlsBatch.mockImplementation(
      async () =>
        new Map<string, string>([
          ["user-1/upload/portrait-thumb.png", "https://signed.example.com/portrait-thumb.png"],
          ["user-1/upload/portrait.png", "https://signed.example.com/portrait-full.png"],
        ])
    );
    mockGetSignedMediaUrl.mockImplementation(async (input: unknown) => {
      const storagePath =
        input && typeof input === "object" && "storagePath" in input
          ? String((input as { storagePath: string }).storagePath)
          : "";
      if (storagePath.endsWith("portrait.png")) {
        return "https://signed.example.com/portrait-full.png";
      }
      if (storagePath.endsWith("portrait-thumb.png")) {
        return "https://signed.example.com/portrait-thumb.png";
      }
      return null;
    });
    const onSelectMedia = vi.fn();

    const { container } = render(
      <MediaLibraryModal
        isOpen
        onClose={() => undefined}
        onSelectMedia={onSelectMedia}
        onSelectPrompt={() => undefined}
      />
    );

    await waitFor(() => {
      expect(container.querySelector("[data-media-id='media-prefer-full-1']")).toBeTruthy();
    });
    fireEvent.click(
      container.querySelector("[data-media-id='media-prefer-full-1']") as HTMLButtonElement
    );

    await waitFor(() => {
      expect(onSelectMedia).toHaveBeenCalledTimes(1);
    });

    const selectedPayload = onSelectMedia.mock.calls[0]?.[0];
    expect(selectedPayload).toMatchObject({
      id: "media-prefer-full-1",
      url: "https://signed.example.com/portrait-full.png",
      fullUrl: "https://signed.example.com/portrait-full.png",
      previewStoragePath: "user-1/upload/portrait-thumb.png",
      fullStoragePath: "user-1/upload/portrait.png",
    });
    expect([
      "https://signed.example.com/portrait-thumb.png",
      "https://signed.example.com/portrait-full.png",
    ]).toContain(selectedPayload?.previewUrl);
  });
});
