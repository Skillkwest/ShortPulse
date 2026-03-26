import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaBulkDeleteController } from "../useMediaBulkDeleteController";
import { ensureSupabaseQueryClient } from "../../../../lib/supabaseClient";

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: vi.fn(),
}));

const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);

type MediaRow = {
  id: string;
  storage_path: string;
  file_type: string;
  metadata?: Record<string, unknown> | null;
  preview_storage_path?: string;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
};

type PromptRow = {
  id: string;
  prompt_text: string;
};

const makeMediaRow = (id: string): MediaRow => ({
  id,
  storage_path: `user-1/images/${id}.png`,
  file_type: "image/png",
  preview_storage_path: `user-1/images/${id}.png`,
});

const createSupabaseClient = () => ({
  from: vi.fn((table: string) => {
    if (table === "media_prompts") {
      return {
        delete: () => ({
          in: async () => ({ error: null }),
        }),
      };
    }
    if (table === "media_files") {
      return {
        delete: () => ({
          in: async () => ({ error: null }),
        }),
        select: () => ({
          in: async () => ({ data: [], error: null }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  }),
});

describe("useMediaBulkDeleteController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureSupabaseQueryClientMock.mockReturnValue(createSupabaseClient() as never);
  });

  it("deletes selected prompts immediately on prompt tabs", async () => {
    const collectMediaStoragePathsForDelete = vi.fn(async () => []);
    const markInactiveMediaCachesStale = vi.fn();
    const refreshStorageUsageBytes = vi.fn(async () => {});
    const removeStoragePaths = vi.fn(async () => {});
    const logMediaEvent = vi.fn(async () => {});
    const getErrorMessage = vi.fn((_: unknown, fallback: string) => fallback);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<MediaRow[]>([]);
      const [prompts, setPrompts] = useState<PromptRow[]>([
        { id: "prompt-1", prompt_text: "one" },
        { id: "prompt-2", prompt_text: "two" },
      ]);
      const [selectedIds, setSelectedIds] = useState<string[]>(["prompt-1", "prompt-2"]);
      const [pageError, setPageError] = useState<string | null>(null);
      const currentUserIdRef = useRef<string | null>("user-1");
      const controller = useMediaBulkDeleteController<MediaRow, PromptRow>({
        activeTabKey: "saved_prompts",
        activeMediaTab: "uploaded_images",
        collectMediaStoragePathsForDelete,
        currentUserIdRef,
        files,
        getErrorMessage,
        isPromptTab: true,
        logMediaEvent,
        markInactiveMediaCachesStale,
        refreshStorageUsageBytes,
        removeStoragePaths,
        selectedIds,
        setPageError,
        setPrompts,
        setSelectedIds,
        updateVisibleRows: setFiles,
      });
      return { controller, pageError, prompts, selectedIds };
    });

    await act(async () => {
      result.current.controller.requestDeleteSelected();
      await Promise.resolve();
    });

    expect(result.current.controller.confirmDeleteIds).toBeNull();
    expect(result.current.prompts).toEqual([]);
    expect(result.current.selectedIds).toEqual([]);
    expect(logMediaEvent).toHaveBeenCalledWith("delete", "media_prompt", "prompt-1");
    expect(logMediaEvent).toHaveBeenCalledWith("delete", "media_prompt", "prompt-2");
  });

  it("opens and cancels confirmation for media-tab bulk deletes", () => {
    const collectMediaStoragePathsForDelete = vi.fn(async () => []);
    const markInactiveMediaCachesStale = vi.fn();
    const refreshStorageUsageBytes = vi.fn(async () => {});
    const removeStoragePaths = vi.fn(async () => {});
    const logMediaEvent = vi.fn(async () => {});
    const getErrorMessage = vi.fn((_: unknown, fallback: string) => fallback);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<MediaRow[]>([
        makeMediaRow("file-1"),
        makeMediaRow("file-2"),
      ]);
      const [, setPrompts] = useState<PromptRow[]>([]);
      const [selectedIds, setSelectedIds] = useState<string[]>(["file-1", "file-2"]);
      const [pageError, setPageError] = useState<string | null>(null);
      const currentUserIdRef = useRef<string | null>("user-1");
      const controller = useMediaBulkDeleteController<MediaRow, PromptRow>({
        activeTabKey: "uploaded_images",
        activeMediaTab: "uploaded_images",
        collectMediaStoragePathsForDelete,
        currentUserIdRef,
        files,
        getErrorMessage,
        isPromptTab: false,
        logMediaEvent,
        markInactiveMediaCachesStale,
        refreshStorageUsageBytes,
        removeStoragePaths,
        selectedIds,
        setPageError,
        setPrompts,
        setSelectedIds,
        updateVisibleRows: setFiles,
      });
      return { controller, pageError };
    });

    act(() => {
      result.current.controller.requestDeleteSelected();
    });
    expect(result.current.controller.confirmDeleteIds).toEqual(["file-1", "file-2"]);

    act(() => {
      result.current.controller.cancelDeleteSelected();
    });
    expect(result.current.controller.confirmDeleteIds).toBeNull();
  });

  it("confirms media delete and reconciles rows, selection, and cache state", async () => {
    const collectMediaStoragePathsForDelete = vi.fn(async (targets: { storage_path: string }[]) =>
      targets.map((target) => target.storage_path)
    );
    const markInactiveMediaCachesStale = vi.fn();
    const refreshStorageUsageBytes = vi.fn(async () => {});
    const removeStoragePaths = vi.fn(async () => {});
    const logMediaEvent = vi.fn(async () => {});
    const getErrorMessage = vi.fn((_: unknown, fallback: string) => fallback);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<MediaRow[]>([
        makeMediaRow("file-1"),
        makeMediaRow("file-2"),
      ]);
      const [, setPrompts] = useState<PromptRow[]>([]);
      const [selectedIds, setSelectedIds] = useState<string[]>(["file-1", "file-2"]);
      const [pageError, setPageError] = useState<string | null>(null);
      const currentUserIdRef = useRef<string | null>("user-1");
      const controller = useMediaBulkDeleteController<MediaRow, PromptRow>({
        activeTabKey: "uploaded_images",
        activeMediaTab: "uploaded_images",
        collectMediaStoragePathsForDelete,
        currentUserIdRef,
        files,
        getErrorMessage,
        isPromptTab: false,
        logMediaEvent,
        markInactiveMediaCachesStale,
        refreshStorageUsageBytes,
        removeStoragePaths,
        selectedIds,
        setPageError,
        setPrompts,
        setSelectedIds,
        updateVisibleRows: setFiles,
      });
      return { controller, files, pageError, selectedIds };
    });

    act(() => {
      result.current.controller.requestDeleteSelected();
    });

    await act(async () => {
      await result.current.controller.confirmDeleteSelected();
    });

    expect(removeStoragePaths).toHaveBeenCalledWith([
      "user-1/images/file-1.png",
      "user-1/images/file-2.png",
    ]);
    expect(result.current.files).toEqual([]);
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.controller.confirmDeleteIds).toBeNull();
    expect(markInactiveMediaCachesStale).toHaveBeenCalledWith("uploaded_images");
    expect(refreshStorageUsageBytes).toHaveBeenCalled();
    expect(logMediaEvent).toHaveBeenCalledWith("delete", "media_file", "file-1", {
      storage_path: "user-1/images/file-1.png",
    });
    expect(logMediaEvent).toHaveBeenCalledWith("delete", "media_file", "file-2", {
      storage_path: "user-1/images/file-2.png",
    });
  });
});
