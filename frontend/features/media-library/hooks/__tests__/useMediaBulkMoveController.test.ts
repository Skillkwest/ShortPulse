import { act, renderHook } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaBulkMoveController } from "../useMediaBulkMoveController";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { createMediaPerfTimer, logMediaPerf } from "../../../../lib/mediaPerfTelemetry";
import { resolveMediaSigningStoragePaths } from "../../../../lib/mediaPreviewPath";
import {
  getSignedMediaUrlsBatch,
  invalidateSignedMediaUrl,
} from "../../../../lib/mediaSignedUrlCache";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock("../../../../lib/mediaPerfTelemetry", () => ({
  createMediaPerfTimer: vi.fn(),
  logMediaPerf: vi.fn(),
}));

vi.mock("../../../../lib/mediaPreviewPath", () => ({
  classifyMediaPreviewPath: vi.fn(() => "unknown"),
  resolveMediaSigningStoragePaths: vi.fn(),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: vi.fn(),
  invalidateSignedMediaUrl: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);
const createMediaPerfTimerMock = vi.mocked(createMediaPerfTimer);
const logMediaPerfMock = vi.mocked(logMediaPerf);
const resolveMediaSigningStoragePathsMock = vi.mocked(resolveMediaSigningStoragePaths);
const getSignedMediaUrlsBatchMock = vi.mocked(getSignedMediaUrlsBatch);
const invalidateSignedMediaUrlMock = vi.mocked(invalidateSignedMediaUrl);

type Row = {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  source?: string;
  status?: "uploading" | "ready";
  created_at: string;
  preview_storage_path?: string;
  signedUrl?: string;
};

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: "file-1",
  filename: "first.png",
  storage_path: "user/images/first.png",
  file_type: "image/png",
  source: "upload",
  status: "ready",
  created_at: "2026-02-14T00:00:00.000Z",
  ...overrides,
});

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

describe("useMediaBulkMoveController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMediaPerfTimerMock.mockReturnValue(vi.fn());
    resolveMediaSigningStoragePathsMock.mockImplementation(
      (row: { storage_path?: string | null }) => [row.storage_path ?? ""]
    );
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
  });

  it("filters selected rows to active tab and excludes uploading rows", () => {
    const { result } = renderHook(() => {
      const [activeTab, setActiveTab] = useState<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const activeTabRef = useRef(activeTab);
      useEffect(() => {
        activeTabRef.current = activeTab;
      }, [activeTab]);
      const [bulkMoveError, setBulkMoveError] = useState<string | null>(null);
      const [bulkMoveNotice, setBulkMoveNotice] = useState<string | null>(null);
      const [bulkMoveMenuOpen, setBulkMoveMenuOpen] = useState(false);
      const [bulkMoving, setBulkMoving] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [files, setFiles] = useState<Row[]>([
        makeRow({ id: "eligible", status: "ready" }),
        makeRow({ id: "uploading", status: "uploading" }),
        makeRow({
          id: "private-item",
          source: "private_upload",
          storage_path: "user/private/images/p.png",
        }),
      ]);
      const [focusedFile, setFocusedFile] = useState<Row | null>(null);
      const [selectedIds, setSelectedIds] = useState(["eligible", "uploading", "private-item"]);

      const bulk = useMediaBulkMoveController({
        activeMediaTab: "uploaded_images",
        activeTabRef,
        applyMovedFilesToCaches: vi.fn(),
        bulkDeleting: false,
        bulkMoving,
        currentUserIdRef: { current: "user-1" },
        files,
        getErrorMessage,
        selectedIds,
        setActiveTab,
        setBulkMoveError,
        setBulkMoveMenuOpen,
        setBulkMoveNotice,
        setBulkMoving,
        setError,
        setFiles,
        setFocusedFile,
        setSelectedIds,
      });

      return {
        activeTab,
        bulk,
        bulkMoveError,
        bulkMoveMenuOpen,
        bulkMoveNotice,
        error,
        focusedFile,
      };
    });

    expect(result.current.bulk.selectedMediaRows.map((row) => row.id)).toEqual(["eligible"]);
    expect(result.current.bulk.bulkMoveTabOptions.length).toBeGreaterThan(0);
    expect(result.current.bulk.canBulkMove).toBe(true);
  });

  it("moves selected files, updates focused row, and switches tab on success", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        destinationTab: "private",
        moved: [
          {
            fileId: "file-1",
            file: makeRow({
              id: "file-1",
              source: "private_upload",
              storage_path: "user/private/images/file-1.png",
            }),
            fromTab: "uploaded_images",
            toTab: "private",
            previousStoragePath: "user/images/first.png",
            nextStoragePath: "user/private/images/file-1.png",
          },
        ],
        failed: [],
      }),
    } as never);
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user/private/images/file-1.png", "https://signed/private/file-1"]])
    );
    const applyMovedFilesToCaches = vi.fn();

    const { result } = renderHook(() => {
      const [activeTab, setActiveTab] = useState<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const activeTabRef = useRef(activeTab);
      useEffect(() => {
        activeTabRef.current = activeTab;
      }, [activeTab]);
      const [bulkMoveError, setBulkMoveError] = useState<string | null>(null);
      const [bulkMoveNotice, setBulkMoveNotice] = useState<string | null>(null);
      const [bulkMoveMenuOpen, setBulkMoveMenuOpen] = useState(true);
      const [bulkMoving, setBulkMoving] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [files, setFiles] = useState<Row[]>([makeRow()]);
      const [focusedFile, setFocusedFile] = useState<Row | null>(makeRow());
      const [selectedIds, setSelectedIds] = useState(["file-1"]);
      const bulk = useMediaBulkMoveController({
        activeMediaTab: "uploaded_images",
        activeTabRef,
        applyMovedFilesToCaches,
        bulkDeleting: false,
        bulkMoving,
        currentUserIdRef: { current: "user-1" },
        files,
        getErrorMessage,
        selectedIds,
        setActiveTab,
        setBulkMoveError,
        setBulkMoveMenuOpen,
        setBulkMoveNotice,
        setBulkMoving,
        setError,
        setFiles,
        setFocusedFile,
        setSelectedIds,
      });

      return {
        activeTab,
        bulk,
        bulkMoveError,
        bulkMoveMenuOpen,
        bulkMoveNotice,
        error,
        files,
        focusedFile,
        selectedIds,
      };
    });

    await act(async () => {
      await result.current.bulk.moveSelectedFiles("private");
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/move-batch",
      expect.objectContaining({ method: "POST" })
    );
    expect(applyMovedFilesToCaches).toHaveBeenCalled();
    expect(invalidateSignedMediaUrlMock).toHaveBeenCalledWith(
      "media_library",
      "user/images/first.png"
    );
    expect(result.current.focusedFile?.source).toBe("private_upload");
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.activeTab).toBe("private");
    expect(result.current.bulkMoveError).toBeNull();
    expect(result.current.bulkMoveNotice).toContain("moved");
    expect(logMediaPerfMock).not.toHaveBeenCalled();
  });

  it("chunks large bulk moves across multiple requests", async () => {
    const firstBatchMoved = Array.from({ length: 100 }, (_, index) => ({
      fileId: `file-${index + 1}`,
      file: makeRow({
        id: `file-${index + 1}`,
        filename: `file-${index + 1}.png`,
        source: "private_upload",
        storage_path: `user/private/images/file-${index + 1}.png`,
      }),
      fromTab: "uploaded_images" as const,
      toTab: "private" as const,
      previousStoragePath: `user/images/file-${index + 1}.png`,
      nextStoragePath: `user/private/images/file-${index + 1}.png`,
    }));
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          destinationTab: "private",
          moved: firstBatchMoved,
          failed: [],
        }),
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          destinationTab: "private",
          moved: [
            {
              fileId: "file-101",
              file: makeRow({
                id: "file-101",
                filename: "file-101.png",
                source: "private_upload",
                storage_path: "user/private/images/file-101.png",
              }),
              fromTab: "uploaded_images",
              toTab: "private",
              previousStoragePath: "user/images/file-101.png",
              nextStoragePath: "user/private/images/file-101.png",
            },
          ],
          failed: [],
        }),
      } as never);
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());

    const { result } = renderHook(() => {
      const [activeTab, setActiveTab] = useState<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const activeTabRef = useRef(activeTab);
      useEffect(() => {
        activeTabRef.current = activeTab;
      }, [activeTab]);
      const [bulkMoveError, setBulkMoveError] = useState<string | null>(null);
      const [, setBulkMoveNotice] = useState<string | null>(null);
      const [, setBulkMoveMenuOpen] = useState(true);
      const [bulkMoving, setBulkMoving] = useState(false);
      const [, setError] = useState<string | null>(null);
      const [files, setFiles] = useState<Row[]>(
        Array.from({ length: 101 }, (_, index) =>
          makeRow({
            id: `file-${index + 1}`,
            filename: `file-${index + 1}.png`,
            storage_path: `user/images/file-${index + 1}.png`,
          })
        )
      );
      const [, setFocusedFile] = useState<Row | null>(makeRow());
      const [selectedIds, setSelectedIds] = useState(
        Array.from({ length: 101 }, (_, index) => `file-${index + 1}`)
      );

      const bulk = useMediaBulkMoveController({
        activeMediaTab: "uploaded_images",
        activeTabRef,
        applyMovedFilesToCaches: vi.fn(),
        bulkDeleting: false,
        bulkMoving,
        currentUserIdRef: { current: "user-1" },
        files,
        getErrorMessage,
        selectedIds,
        setActiveTab,
        setBulkMoveError,
        setBulkMoveMenuOpen,
        setBulkMoveNotice,
        setBulkMoving,
        setError,
        setFiles,
        setFocusedFile,
        setSelectedIds,
      });

      return {
        bulk,
        bulkMoveError,
      };
    });

    await act(async () => {
      await result.current.bulk.moveSelectedFiles("private");
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(fetchWithAuthMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          fileIds: Array.from({ length: 100 }, (_, index) => `file-${index + 1}`),
          destinationTab: "private",
        }),
      })
    );
    expect(fetchWithAuthMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          fileIds: ["file-101"],
          destinationTab: "private",
        }),
      })
    );
    expect(result.current.bulkMoveError).toBeNull();
  });

  it("surfaces request failures as bulk move errors", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ details: "No eligible files" }),
    } as never);

    const { result } = renderHook(() => {
      const [activeTab, setActiveTab] = useState<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const activeTabRef = useRef(activeTab);
      useEffect(() => {
        activeTabRef.current = activeTab;
      }, [activeTab]);
      const [bulkMoveError, setBulkMoveError] = useState<string | null>(null);
      const [bulkMoveNotice, setBulkMoveNotice] = useState<string | null>(null);
      const [bulkMoveMenuOpen, setBulkMoveMenuOpen] = useState(true);
      const [bulkMoving, setBulkMoving] = useState(false);
      const [, setError] = useState<string | null>(null);
      const [files, setFiles] = useState<Row[]>([makeRow()]);
      const [, setFocusedFile] = useState<Row | null>(makeRow());
      const [selectedIds, setSelectedIds] = useState(["file-1"]);

      const bulk = useMediaBulkMoveController({
        activeMediaTab: "uploaded_images",
        activeTabRef,
        applyMovedFilesToCaches: vi.fn(),
        bulkDeleting: false,
        bulkMoving,
        currentUserIdRef: { current: "user-1" },
        files,
        getErrorMessage,
        selectedIds,
        setActiveTab,
        setBulkMoveError,
        setBulkMoveMenuOpen,
        setBulkMoveNotice,
        setBulkMoving,
        setError,
        setFiles,
        setFocusedFile,
        setSelectedIds,
      });

      return {
        bulk,
        bulkMoveError,
        bulkMoveMenuOpen,
        bulkMoveNotice,
      };
    });

    await act(async () => {
      await result.current.bulk.moveSelectedFiles("private");
    });

    expect(result.current.bulkMoveError).toBe("No eligible files");
    expect(result.current.bulkMoveNotice).toBeNull();
    expect(result.current.bulkMoveMenuOpen).toBe(false);
    expect(logMediaPerfMock).toHaveBeenCalled();
  });
});
