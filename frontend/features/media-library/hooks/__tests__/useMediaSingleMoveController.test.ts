import { act, renderHook } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaSingleMoveController } from "../useMediaSingleMoveController";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { resolveMediaSigningStoragePaths } from "../../../../lib/mediaPreviewPath";
import { invalidateSignedMediaUrl } from "../../../../lib/mediaSignedUrlCache";
import { createMediaTabCacheState } from "../../logic/mediaLibraryPageHelpers";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock("../../../../lib/mediaPreviewPath", () => ({
  resolveMediaSigningStoragePaths: vi.fn(),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  invalidateSignedMediaUrl: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);
const resolveMediaSigningStoragePathsMock = vi.mocked(resolveMediaSigningStoragePaths);
const invalidateSignedMediaUrlMock = vi.mocked(invalidateSignedMediaUrl);

type Row = {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  source?: string | null;
  created_at: string;
  preview_storage_path?: string;
  signedUrl?: string;
  status?: "uploading" | "ready";
};

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: "file-1",
  filename: "first.png",
  storage_path: "user/images/first.png",
  file_type: "image/png",
  source: "upload",
  created_at: "2026-02-14T00:00:00.000Z",
  status: "ready",
  ...overrides,
});

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

describe("useMediaSingleMoveController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveMediaSigningStoragePathsMock.mockImplementation(
      (row: { storage_path?: string | null }) => [row.storage_path ?? ""]
    );
  });

  it("derives modal move options and eligibility for focused files", () => {
    const { result } = renderHook(() => {
      const [activeTab, setActiveTab] = useState<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const activeTabRef = useRef(activeTab);
      useEffect(() => {
        activeTabRef.current = activeTab;
      }, [activeTab]);

      const [, setFiles] = useState<Row[]>([makeRow()]);
      const [focusedFile, setFocusedFile] = useState<Row | null>(makeRow());
      const [, setSelectedIds] = useState<string[]>(["file-1"]);
      const [, setModalError] = useState<string | null>(null);
      const [, setPageError] = useState<string | null>(null);
      const [, setMediaTabCache] = useState(() => createMediaTabCacheState<Row>());

      const move = useMediaSingleMoveController<Row>({
        activeTabRef,
        currentUserIdRef: { current: "user-1" },
        focusedFile,
        getErrorMessage,
        setActiveTab,
        setFiles,
        setFocusedFile,
        setMediaTabCache,
        setModalError,
        setPageError,
        setSelectedIds,
        signStoragePath: vi.fn(async () => "https://signed/focused"),
      });

      return { move };
    });

    expect(result.current.move.modalMoveTabOptions.length).toBeGreaterThan(0);
    expect(result.current.move.canMoveToAnotherTab).toBe(true);
  });

  it("moves a focused file, reconciles state, and updates active tab", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        file: makeRow({
          id: "file-1",
          source: "private_upload",
          storage_path: "user/private/images/file-1.png",
        }),
        fromTab: "uploaded_images",
        toTab: "private",
      }),
    } as never);

    const { result } = renderHook(() => {
      const [activeTab, setActiveTab] = useState<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const activeTabRef = useRef(activeTab);
      useEffect(() => {
        activeTabRef.current = activeTab;
      }, [activeTab]);

      const [files, setFiles] = useState<Row[]>([makeRow()]);
      const [focusedFile, setFocusedFile] = useState<Row | null>(makeRow());
      const [selectedIds, setSelectedIds] = useState<string[]>(["file-1"]);
      const [modalError, setModalError] = useState<string | null>(null);
      const [pageError, setPageError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          rows: [makeRow()],
          loaded: true,
          loadedAtMs: Date.now(),
        };
        return cache;
      });

      const move = useMediaSingleMoveController<Row>({
        activeTabRef,
        currentUserIdRef: { current: "user-1" },
        focusedFile,
        getErrorMessage,
        setActiveTab,
        setFiles,
        setFocusedFile,
        setMediaTabCache,
        setModalError,
        setPageError,
        setSelectedIds,
        signStoragePath: vi.fn(async () => "https://signed/private/file-1"),
      });

      return {
        activeTab,
        files,
        focusedFile,
        mediaTabCache,
        modalError,
        move,
        pageError,
        selectedIds,
      };
    });

    await act(async () => {
      await result.current.move.moveFocusedFile("private");
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/move",
      expect.objectContaining({ method: "POST" })
    );
    expect(invalidateSignedMediaUrlMock).toHaveBeenCalledWith(
      "media_library",
      "user/images/first.png"
    );
    expect(result.current.focusedFile?.source).toBe("private_upload");
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.activeTab).toBe("private");
    expect(result.current.move.moveError).toBeNull();
  });

  it("captures request failures as move errors", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ details: "No eligible destination" }),
    } as never);

    const { result } = renderHook(() => {
      const [activeTab, setActiveTab] = useState<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const activeTabRef = useRef(activeTab);
      useEffect(() => {
        activeTabRef.current = activeTab;
      }, [activeTab]);

      const [, setFiles] = useState<Row[]>([makeRow()]);
      const [focusedFile, setFocusedFile] = useState<Row | null>(makeRow());
      const [, setSelectedIds] = useState<string[]>(["file-1"]);
      const [, setModalError] = useState<string | null>(null);
      const [, setPageError] = useState<string | null>(null);
      const [, setMediaTabCache] = useState(() => createMediaTabCacheState<Row>());

      const move = useMediaSingleMoveController<Row>({
        activeTabRef,
        currentUserIdRef: { current: "user-1" },
        focusedFile,
        getErrorMessage,
        setActiveTab,
        setFiles,
        setFocusedFile,
        setMediaTabCache,
        setModalError,
        setPageError,
        setSelectedIds,
        signStoragePath: vi.fn(async () => null),
      });

      return { move };
    });

    await act(async () => {
      await result.current.move.moveFocusedFile("private");
    });

    expect(result.current.move.moveError).toBe("No eligible destination");
  });
});
