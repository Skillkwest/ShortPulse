import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaUploadController } from "../useMediaUploadController";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { readSupabaseUserId } from "../../../../lib/supabaseClient";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock("../../../../lib/supabaseClient", async () => {
  const { createSupabaseClientModuleMock } =
    await import("../../../../tests/support/supabaseClientMock");
  return createSupabaseClientModuleMock();
});

const readSupabaseUserIdMock = vi.mocked(readSupabaseUserId);
const fetchWithAuthMock = vi.mocked(fetchWithAuth);

type Row = {
  id: string;
  filename: string;
  storage_path: string;
  preview_storage_path?: string;
  file_type: string;
  file_size: number | null;
  source?: string | null;
  created_at: string;
  signedUrl?: string;
  status?: "uploading" | "ready";
};

describe("useMediaUploadController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects private uploads that include non-image files", async () => {
    const { result } = renderHook(() => {
      const [error, setError] = useState<string | null>(null);
      const [rows, setRows] = useState<Row[]>([]);
      const upload = useMediaUploadController<Row>({
        activeMediaTab: "private",
        activeTab: "private",
        currentUserIdRef: { current: null },
        getErrorMessage: (_error: unknown, fallback: string) => fallback,
        logMediaEvent: vi.fn(async () => {}),
        markInactiveMediaCachesStale: vi.fn(),
        refreshStorageUsageBytes: vi.fn(async () => {}),
        setError,
        updateVisibleRows: (updater) => {
          setRows((prev) => updater(prev));
        },
      });
      return {
        error,
        rows,
        upload,
      };
    });

    const unsupported = new File([new Uint8Array([1, 2, 3])], "clip.mp4", {
      type: "video/mp4",
    });
    await act(async () => {
      await result.current.upload.uploadSelected([unsupported]);
    });

    expect(result.current.error).toBe("Private uploads only support images.");
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(result.current.rows).toEqual([]);
  });

  it("uploads files, swaps placeholders, and refreshes stale tab caches", async () => {
    const markInactiveMediaCachesStale = vi.fn();
    const refreshStorageUsageBytes = vi.fn(async () => {});
    const logMediaEvent = vi.fn(async () => {});
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        file: {
          id: "media-123",
          filename: "asset.png",
          storage_path: "user-1/images/media-123.png",
          preview_storage_path: "user-1/images/media-123.png",
          file_type: "image",
          file_size: 123,
          source: "upload",
          created_at: "2026-02-14T00:00:00.000Z",
          signedUrl: "https://signed.example/media-123",
        },
      }),
    } as never);

    const { result } = renderHook(() => {
      const [error, setError] = useState<string | null>(null);
      const [rows, setRows] = useState<Row[]>([]);
      const upload = useMediaUploadController<Row>({
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        currentUserIdRef: { current: null },
        getErrorMessage: (_error: unknown, fallback: string) => fallback,
        logMediaEvent,
        markInactiveMediaCachesStale,
        refreshStorageUsageBytes,
        setError,
        updateVisibleRows: (updater) => {
          setRows((prev) => updater(prev));
        },
      });
      return {
        error,
        rows,
        upload,
      };
    });

    const image = new File([new Uint8Array([1, 2, 3])], "asset.png", {
      type: "image/png",
    });
    await act(async () => {
      await result.current.upload.uploadSelected([image]);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]).toMatchObject({
      id: "media-123",
      storage_path: "user-1/images/media-123.png",
      preview_storage_path: "user-1/images/media-123.png",
      signedUrl: "https://signed.example/media-123",
      status: "ready",
    });
    expect(markInactiveMediaCachesStale).toHaveBeenCalledWith("uploaded_images");
    expect(refreshStorageUsageBytes).toHaveBeenCalledTimes(1);
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/upload",
      expect.objectContaining({ method: "POST" })
    );
    expect(logMediaEvent).toHaveBeenCalledWith(
      "upload",
      "media_file",
      "media-123",
      expect.objectContaining({
        storage_path: "user-1/images/media-123.png",
      })
    );
  });

  it("removes optimistic placeholders when the upload API fails", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: "Media upload API is disabled",
        details: "Enable SHORTPULSE_MEDIA_UPLOAD_API_ENABLED to use this route.",
      }),
    } as never);

    const { result } = renderHook(() => {
      const [error, setError] = useState<string | null>(null);
      const [rows, setRows] = useState<Row[]>([]);
      const upload = useMediaUploadController<Row>({
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        currentUserIdRef: { current: null },
        getErrorMessage: (error: unknown, fallback: string) =>
          error instanceof Error ? error.message : fallback,
        logMediaEvent: vi.fn(async () => {}),
        markInactiveMediaCachesStale: vi.fn(),
        refreshStorageUsageBytes: vi.fn(async () => {}),
        setError,
        updateVisibleRows: (updater) => {
          setRows((prev) => updater(prev));
        },
      });
      return {
        error,
        rows,
        upload,
      };
    });

    const image = new File([new Uint8Array([1, 2, 3])], "asset.png", {
      type: "image/png",
    });
    await act(async () => {
      await result.current.upload.uploadSelected([image]);
    });

    expect(result.current.error).toBe(
      "Enable SHORTPULSE_MEDIA_UPLOAD_API_ENABLED to use this route."
    );
    expect(result.current.rows).toEqual([]);
  });

  it("tracks drag-over and drag-leave state", () => {
    const { result } = renderHook(() => {
      const [error, setError] = useState<string | null>(null);
      const [rows, setRows] = useState<Row[]>([]);
      const upload = useMediaUploadController<Row>({
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        currentUserIdRef: { current: null },
        getErrorMessage: (_error: unknown, fallback: string) => fallback,
        logMediaEvent: vi.fn(async () => {}),
        markInactiveMediaCachesStale: vi.fn(),
        refreshStorageUsageBytes: vi.fn(async () => {}),
        setError,
        updateVisibleRows: (updater) => {
          setRows((prev) => updater(prev));
        },
      });
      return {
        error,
        rows,
        upload,
      };
    });

    const preventDefault = vi.fn();
    act(() => {
      result.current.upload.handleDragOver({
        preventDefault,
      } as unknown as Parameters<typeof result.current.upload.handleDragOver>[0]);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.upload.isDragging).toBe(true);

    act(() => {
      result.current.upload.handleDragLeave();
    });

    expect(result.current.upload.isDragging).toBe(false);
  });
});
