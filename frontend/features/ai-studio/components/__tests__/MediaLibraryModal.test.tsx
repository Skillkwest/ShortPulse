/**
 * MediaLibraryModal rendering tests.
 * Verifies media cards reserve stable aspect-ratio placeholders before preview URLs are hydrated.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaLibraryModal } from "../MediaLibraryModal";

type MediaRow = {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  source?: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
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
  mockGetSignedMediaUrl: vi.fn(async () => null),
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

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: vi.fn(() => {
    const mediaQueryBuilder = {
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => ({ data: mockMediaRows, error: null })),
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
              order: vi.fn().mockReturnValue({
                order: vi.fn(async () => ({ data: [], error: null })),
              }),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
  }),
}));

describe("MediaLibraryModal", () => {
  beforeEach(() => {
    mockMediaRows.length = 0;
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

      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(mockGetSignedMediaUrlsBatch).toHaveBeenCalledTimes(3);
    } finally {
      warnSpy.mockRestore();
    }
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

      await new Promise((resolve) => setTimeout(resolve, 80));
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
});
