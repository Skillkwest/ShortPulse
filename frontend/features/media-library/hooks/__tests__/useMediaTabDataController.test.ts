import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaTabDataController } from "../useMediaTabDataController";
import { resolveMediaSigningStoragePaths } from "../../../../lib/mediaPreviewPath";
import { ensureSupabaseClient } from "../../../../lib/supabaseClient";
import {
  createMediaTabCacheState,
  createMediaTabRequestState,
} from "../../logic/mediaLibraryPageHelpers";

vi.mock("../../../../lib/mediaPreviewPath", () => ({
  resolveMediaSigningStoragePaths: vi.fn(),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: vi.fn(),
}));

const resolveMediaSigningStoragePathsMock = vi.mocked(resolveMediaSigningStoragePaths);
const ensureSupabaseClientMock = vi.mocked(ensureSupabaseClient);

type Row = {
  id: string;
  filename: string;
  storage_path: string;
  source?: string | null;
  file_type: string;
  created_at: string;
  signedUrl?: string;
  preview_storage_path?: string;
};

type Prompt = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: string;
  source: string;
  created_at: string;
  updated_at: string;
};

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: "row-1",
  filename: "asset.png",
  storage_path: "user-1/images/asset.png",
  file_type: "image/png",
  source: "upload",
  created_at: "2026-02-14T00:00:00.000Z",
  ...overrides,
});

const createMediaClient = (rows: Row[]) => {
  const queryBuilder = {
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({ data: rows, error: null })),
    lt: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  };

  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            user: {
              id: "user-1",
            },
          },
        },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "media_files") {
        return {
          select: vi.fn(() => queryBuilder),
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
};

describe("useMediaTabDataController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveMediaSigningStoragePathsMock.mockImplementation(
      (row: { storage_path?: string | null }) => [row.storage_path ?? ""]
    );
  });

  it("syncs active cache rows when visible rows mutate", () => {
    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([
        makeRow({ id: "dog", filename: "dog.png", storage_path: "user-1/images/dog.png" }),
        makeRow({ id: "cat", filename: "cat.png", storage_path: "user-1/images/cat.png" }),
      ]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          rows: [
            makeRow({ id: "cat", filename: "cat.png", storage_path: "user-1/images/cat.png" }),
          ],
          query: "cat",
          loaded: true,
          loadedAtMs: Date.now(),
        };
        return cache;
      });
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("saved_prompts");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "cat",
        activeMediaTab: "uploaded_images",
        activeTab: "saved_prompts",
        activeTabRef,
        cacheTtlMs: 30_000,
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
        tabData,
      };
    });

    act(() => {
      result.current.tabData.updateVisibleRows((prev) => [
        ...prev,
        makeRow({ id: "new", filename: "new-cat.png", storage_path: "user-1/images/new-cat.png" }),
      ]);
    });

    expect(result.current.files.map((row) => row.id)).toEqual(["dog", "cat", "new"]);
    expect(result.current.mediaTabCache.uploaded_images.rows.map((row) => row.id)).toEqual([
      "cat",
      "new",
    ]);
  });

  it("marks non-active tab caches stale", () => {
    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          loadedAtMs: 1,
          loaded: true,
        };
        cache.uploaded_videos = {
          ...cache.uploaded_videos,
          loadedAtMs: 2,
          loaded: true,
        };
        cache.private = {
          ...cache.private,
          loadedAtMs: 3,
          loaded: true,
        };
        cache.ai_generations = {
          ...cache.ai_generations,
          loadedAtMs: 4,
          loaded: true,
        };
        return cache;
      });
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("saved_prompts");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.private,
        activeMediaQuery: "",
        activeMediaTab: "private",
        activeTab: "saved_prompts",
        activeTabRef,
        cacheTtlMs: 30_000,
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
        tabData,
      };
    });

    act(() => {
      result.current.tabData.markInactiveMediaCachesStale("private");
    });

    expect(result.current.mediaTabCache.private.loadedAtMs).toBe(3);
    expect(result.current.mediaTabCache.uploaded_images.loadedAtMs).toBeNull();
    expect(result.current.mediaTabCache.uploaded_videos.loadedAtMs).toBeNull();
    expect(result.current.mediaTabCache.ai_generations.loadedAtMs).toBeNull();
  });

  it("fetches a media page and normalizes preview fields", async () => {
    const supabaseClient = createMediaClient([
      makeRow({
        id: "row-fetch",
        filename: "fresh.png",
        storage_path: "user-1/images/fresh.png",
        source: undefined,
      }),
    ]);
    ensureSupabaseClientMock.mockReturnValue(supabaseClient as never);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          loaded: true,
          loadedAtMs: Date.now(),
          query: "",
        };
        return cache;
      });
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "",
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        activeTabRef,
        cacheTtlMs: 30_000,
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        currentUserIdRef,
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
        tabData,
      };
    });

    await act(async () => {
      await result.current.tabData.fetchMediaTabPage("uploaded_images", {
        query: "",
        reset: true,
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0]).toMatchObject({
      id: "row-fetch",
      preview_storage_path: "user-1/images/fresh.png",
      source: "upload",
    });
    expect(result.current.currentUserIdRef.current).toBe("user-1");
  });
});
