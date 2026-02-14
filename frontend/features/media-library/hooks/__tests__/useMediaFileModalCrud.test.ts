import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaFileModalCrud } from "../useMediaFileModalCrud";
import { ensureSupabaseClient } from "../../../../lib/supabaseClient";

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: vi.fn(),
}));

const ensureSupabaseClientMock = vi.mocked(ensureSupabaseClient);

type Row = {
  id: string;
  filename: string;
  storage_path: string;
  preview_storage_path?: string | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
  file_type: string;
  created_at: string;
  status?: "uploading" | "ready";
};

const makeRow = (id: string, filename: string): Row => ({
  id,
  filename,
  storage_path: `u/private/${filename}`,
  file_type: "image/png",
  created_at: "2026-02-14T00:00:00.000Z",
  status: "ready",
});

describe("useMediaFileModalCrud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureSupabaseClientMock.mockReturnValue({
      from: () => ({
        update: () => ({
          eq: async () => ({ error: null }),
        }),
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    } as never);
  });

  it("opens and closes the file modal while resetting local modal state", () => {
    const markInactiveMediaCachesStale = vi.fn();
    const refreshStorageUsageBytes = vi.fn(async () => {});
    const removeStoragePaths = vi.fn(async () => {});
    const collectMediaStoragePathsForDelete = vi.fn(async () => []);
    const logMediaEvent = vi.fn(async () => {});
    const getErrorMessage = vi.fn((_: unknown, fallback: string) => fallback);

    const { result } = renderHook(() => {
      const [rows, setRows] = useState<Row[]>([makeRow("file-1", "first.png")]);
      const [, setSelectedIds] = useState<string[]>([]);
      const [focusedFile, setFocusedFile] = useState<Row | null>(null);
      const [pageError, setPageError] = useState<string | null>(null);
      const modal = useMediaFileModalCrud<Row>({
        activeMediaTab: "uploaded_images",
        collectMediaStoragePathsForDelete,
        focusedFile,
        getErrorMessage,
        logMediaEvent,
        markInactiveMediaCachesStale,
        refreshStorageUsageBytes,
        removeStoragePaths,
        setPageError,
        setFocusedFile,
        setSelectedIds,
        updateVisibleRows: setRows,
      });

      return { focusedFile, modal, pageError, rows };
    });

    act(() => {
      result.current.modal.openModal(makeRow("file-1", "first.png"));
    });

    expect(result.current.focusedFile?.id).toBe("file-1");
    expect(result.current.modal.renameValue).toBe("first.png");

    act(() => {
      result.current.modal.handleRenameInputChange("renamed.png");
      result.current.modal.closeModal();
    });

    expect(result.current.focusedFile).toBeNull();
    expect(result.current.modal.renameValue).toBe("");
    expect(result.current.modal.modalError).toBeNull();
  });

  it("saves rename and updates visible row state", async () => {
    const markInactiveMediaCachesStale = vi.fn();
    const refreshStorageUsageBytes = vi.fn(async () => {});
    const removeStoragePaths = vi.fn(async () => {});
    const collectMediaStoragePathsForDelete = vi.fn(async () => []);
    const logMediaEvent = vi.fn(async () => {});
    const getErrorMessage = vi.fn((_: unknown, fallback: string) => fallback);

    const { result } = renderHook(() => {
      const [rows, setRows] = useState<Row[]>([makeRow("file-1", "first.png")]);
      const [, setSelectedIds] = useState<string[]>([]);
      const [focusedFile, setFocusedFile] = useState<Row | null>(null);
      const [pageError, setPageError] = useState<string | null>(null);
      const modal = useMediaFileModalCrud<Row>({
        activeMediaTab: "uploaded_images",
        collectMediaStoragePathsForDelete,
        focusedFile,
        getErrorMessage,
        logMediaEvent,
        markInactiveMediaCachesStale,
        refreshStorageUsageBytes,
        removeStoragePaths,
        setPageError,
        setFocusedFile,
        setSelectedIds,
        updateVisibleRows: setRows,
      });

      return { focusedFile, modal, pageError, rows };
    });

    act(() => {
      result.current.modal.openModal(makeRow("file-1", "first.png"));
      result.current.modal.handleRenameInputChange("renamed.png");
    });

    await act(async () => {
      await result.current.modal.saveRename();
    });

    expect(result.current.rows[0]?.filename).toBe("renamed.png");
    expect(result.current.focusedFile?.filename).toBe("renamed.png");
    expect(markInactiveMediaCachesStale).toHaveBeenCalledWith("uploaded_images");
    expect(logMediaEvent).toHaveBeenCalledWith("rename", "media_file", "file-1", {
      from: "first.png",
      to: "renamed.png",
    });
  });

  it("deletes focused file target and clears selection", async () => {
    const markInactiveMediaCachesStale = vi.fn();
    const refreshStorageUsageBytes = vi.fn(async () => {});
    const removeStoragePaths = vi.fn(async () => {});
    const collectMediaStoragePathsForDelete = vi.fn(async () => ["u/private/first.png"]);
    const logMediaEvent = vi.fn(async () => {});
    const getErrorMessage = vi.fn((_: unknown, fallback: string) => fallback);

    const { result } = renderHook(() => {
      const [rows, setRows] = useState<Row[]>([
        makeRow("file-1", "first.png"),
        makeRow("file-2", "second.png"),
      ]);
      const [selectedIds, setSelectedIds] = useState<string[]>(["file-1", "file-2"]);
      const [focusedFile, setFocusedFile] = useState<Row | null>(null);
      const [pageError, setPageError] = useState<string | null>(null);
      const modal = useMediaFileModalCrud<Row>({
        activeMediaTab: "uploaded_images",
        collectMediaStoragePathsForDelete,
        focusedFile,
        getErrorMessage,
        logMediaEvent,
        markInactiveMediaCachesStale,
        refreshStorageUsageBytes,
        removeStoragePaths,
        setPageError,
        setFocusedFile,
        setSelectedIds,
        updateVisibleRows: setRows,
      });

      return { focusedFile, modal, pageError, rows, selectedIds };
    });

    act(() => {
      result.current.modal.openModal(makeRow("file-1", "first.png"));
      result.current.modal.requestDeleteFile(makeRow("file-1", "first.png"));
    });

    await act(async () => {
      await result.current.modal.confirmDeleteFile();
    });

    expect(removeStoragePaths).toHaveBeenCalledWith(["u/private/first.png"]);
    expect(result.current.rows.map((row) => row.id)).toEqual(["file-2"]);
    expect(result.current.selectedIds).toEqual(["file-2"]);
    expect(result.current.focusedFile).toBeNull();
    expect(markInactiveMediaCachesStale).toHaveBeenCalledWith("uploaded_images");
    expect(logMediaEvent).toHaveBeenCalledWith("delete", "media_file", "file-1", {
      storage_path: "u/private/first.png",
    });
  });
});
