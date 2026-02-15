/**
 * MediaLibraryModal rendering tests.
 * Verifies media cards reserve stable aspect-ratio placeholders before preview URLs are hydrated.
 */
import { render, waitFor } from "@testing-library/react";
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

vi.mock("../../../../lib/mediaPerfTelemetry", () => ({
  createMediaPerfTimer: () => () => undefined,
  logMediaPerf: vi.fn(),
}));

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock("../../../../lib/mediaPreviewPath", () => ({
  resolveMediaDirectPreviewUrls: vi.fn(() => []),
  resolveMediaSigningStoragePaths: vi.fn(() => []),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: vi.fn(async () => null),
  getSignedMediaUrlsBatch: vi.fn(async () => new Map()),
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
});
