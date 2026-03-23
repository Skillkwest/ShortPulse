import { renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useMediaTabActiveViewSync } from "../useMediaTabActiveViewSync";
import { createMediaTabCacheState } from "../../logic/mediaLibraryPageHelpers";

type Row = {
  id: string;
  filename: string;
  storage_path: string;
};

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: "row-1",
  filename: "asset.png",
  storage_path: "user-1/images/asset.png",
  ...overrides,
});

describe("useMediaTabActiveViewSync", () => {
  it("loads saved prompts only when the prompts tab is active and not yet loaded", async () => {
    const loadPrompts = vi.fn(async () => undefined);
    const fetchMediaTabPage = vi.fn(async () => undefined);

    renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const mediaTabCache = createMediaTabCacheState<Row>();

      useMediaTabActiveViewSync({
        activeMediaQuery: "",
        activeTab: "saved_prompts",
        cacheTtlMs: 30_000,
        fetchEnabled: true,
        fetchMediaTabPage,
        loadPrompts,
        mediaTabCache,
        promptsLoaded: false,
        setError,
        setFiles,
        setLoading,
      });

      return { error, files, loading };
    });

    await waitFor(() => {
      expect(loadPrompts).toHaveBeenCalledTimes(1);
    });
    expect(fetchMediaTabPage).not.toHaveBeenCalled();
  });

  it("reuses fresh cached rows without issuing a fetch", async () => {
    const row = makeRow();
    const loadPrompts = vi.fn(async () => undefined);
    const fetchMediaTabPage = vi.fn(async () => undefined);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>("stale");
      const [mediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          rows: [row],
          query: "",
          loaded: true,
          loadedAtMs: Date.now(),
          loading: false,
          error: null,
        };
        return cache;
      });

      useMediaTabActiveViewSync({
        activeMediaQuery: "",
        activeTab: "uploaded_images",
        cacheTtlMs: 30_000,
        fetchEnabled: true,
        fetchMediaTabPage,
        loadPrompts,
        mediaTabCache,
        promptsLoaded: true,
        setError,
        setFiles,
        setLoading,
      });

      return { error, files, loading };
    });

    await waitFor(() => {
      expect(result.current.files).toEqual([row]);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetchMediaTabPage).not.toHaveBeenCalled();
    expect(loadPrompts).not.toHaveBeenCalled();
  });

  it("keeps stale rows visible and requests a stale refresh", async () => {
    const row = makeRow();
    const loadPrompts = vi.fn(async () => undefined);
    const fetchMediaTabPage = vi.fn(async () => undefined);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          rows: [row],
          query: "",
          loaded: true,
          loadedAtMs: Date.now() - 60_000,
          loading: false,
        };
        return cache;
      });

      useMediaTabActiveViewSync({
        activeMediaQuery: "",
        activeTab: "uploaded_images",
        cacheTtlMs: 30_000,
        fetchEnabled: true,
        fetchMediaTabPage,
        loadPrompts,
        mediaTabCache,
        promptsLoaded: true,
        setError,
        setFiles,
        setLoading,
      });

      return { error, files, loading };
    });

    await waitFor(() => {
      expect(result.current.files).toEqual([row]);
    });
    expect(result.current.loading).toBe(false);
    expect(fetchMediaTabPage).toHaveBeenCalledWith("uploaded_images", {
      query: "",
      reason: "stale_refresh",
    });
  });
});
