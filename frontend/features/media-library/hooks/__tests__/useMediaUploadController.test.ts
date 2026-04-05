import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaUploadController } from "../useMediaUploadController";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { resolveMediaSigningStoragePaths } from "../../../../lib/mediaPreviewPath";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock("../../../../lib/mediaPreviewPath", () => ({
  classifyMediaPreviewPath: vi.fn(() => "unknown"),
  resolveMediaSigningStoragePaths: vi.fn(),
}));

vi.mock("../../../../lib/supabaseClient", async () => {
  const { createSupabaseClientModuleMock } =
    await import("../../../../tests/support/supabaseClientMock");
  return createSupabaseClientModuleMock();
});

const resolveMediaSigningStoragePathsMock = vi.mocked(resolveMediaSigningStoragePaths);
const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);
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

const createUploadSupabaseClient = (options: {
  userId?: string | null;
  insertedRow?: Partial<Row>;
  uploadError?: { message: string } | null;
}) => {
  const uploadMock = vi.fn(async () => ({ error: options.uploadError ?? null }));
  const singleMock = vi.fn(async () => ({
    data: {
      id: options.insertedRow?.id ?? "media-1",
      filename: options.insertedRow?.filename ?? "asset.png",
      storage_path: options.insertedRow?.storage_path ?? "user-1/images/media-1.png",
      file_type: options.insertedRow?.file_type ?? "image",
      file_size: options.insertedRow?.file_size ?? 123,
      source: options.insertedRow?.source ?? "upload",
      created_at: options.insertedRow?.created_at ?? "2026-02-14T00:00:00.000Z",
    },
    error: null,
  }));
  const selectMock = vi.fn(() => ({ single: singleMock }));
  const insertMock = vi.fn(() => ({ select: selectMock }));
  const fromMock = vi.fn((table: string) => {
    if (table === "media_files") {
      return {
        insert: insertMock,
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: options.userId
            ? {
                user: {
                  id: options.userId,
                },
              }
            : null,
        },
      })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
      })),
    },
    from: fromMock,
  };
};

describe("useMediaUploadController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    resolveMediaSigningStoragePathsMock.mockImplementation(
      (row: { storage_path?: string | null }) => [row.storage_path ?? ""]
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects private uploads that include non-image files", async () => {
    const supabaseClient = createUploadSupabaseClient({ userId: "user-1" });
    ensureSupabaseQueryClientMock.mockReturnValue(supabaseClient as never);

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
        signStoragePath: vi.fn(async () => "https://signed.example/private"),
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
    expect(supabaseClient.storage.from).not.toHaveBeenCalled();
    expect(result.current.rows).toEqual([]);
  });

  it("uploads files, swaps placeholders, and refreshes stale tab caches", async () => {
    const supabaseClient = createUploadSupabaseClient({
      userId: "user-1",
      insertedRow: {
        id: "media-123",
        storage_path: "user-1/images/media-123.png",
      },
    });
    ensureSupabaseQueryClientMock.mockReturnValue(supabaseClient as never);
    const markInactiveMediaCachesStale = vi.fn();
    const refreshStorageUsageBytes = vi.fn(async () => {});
    const logMediaEvent = vi.fn(async () => {});
    const signStoragePath = vi.fn(async () => "https://signed.example/media-123");
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
        signStoragePath,
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
    expect(signStoragePath).not.toHaveBeenCalled();
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
    expect(supabaseClient.storage.from).not.toHaveBeenCalled();
  });

  it("uses legacy direct upload path when NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED is false", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED", "false");
    const supabaseClient = createUploadSupabaseClient({
      userId: "user-1",
      insertedRow: {
        id: "media-legacy-1",
        storage_path: "user-1/images/media-legacy-1.png",
      },
    });
    ensureSupabaseQueryClientMock.mockReturnValue(supabaseClient as never);
    const signStoragePath = vi.fn(async () => "https://signed.example/media-legacy-1");

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
        signStoragePath,
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
    expect(signStoragePath).toHaveBeenCalledWith("user-1/images/media-legacy-1.png", {
      forceRefresh: true,
    });
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(supabaseClient.storage.from).toHaveBeenCalled();
  });

  it("tracks drag-over and drag-leave state", () => {
    const supabaseClient = createUploadSupabaseClient({ userId: "user-1" });
    ensureSupabaseQueryClientMock.mockReturnValue(supabaseClient as never);

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
        signStoragePath: vi.fn(async () => "https://signed.example/media"),
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
