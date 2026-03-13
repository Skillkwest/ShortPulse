/**
 * Unit tests for media-library ingestion payload preparation.
 * Verifies storage-path re-signing and URL refresh/fallback behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareLibraryMediaIngestionPayload } from "../prepareLibraryMediaIngestionPayload";

const getSignedMediaUrlMock = vi.fn();
const refreshSupabaseSignedUrlIfNeededMock = vi.fn();
const mediaFilesMaybeSingleMock = vi.fn();
const mediaFilesSelectMock = vi.fn(() => ({
  eq: vi.fn(() => ({
    limit: vi.fn(() => ({
      maybeSingle: (...args: unknown[]) => mediaFilesMaybeSingleMock(...args),
    })),
  })),
}));
const mediaFilesFromMock = vi.fn(() => ({
  select: (...args: unknown[]) => mediaFilesSelectMock(...args),
}));
const ensureSupabaseClientMock = vi.fn(() => ({
  from: (...args: unknown[]) => mediaFilesFromMock(...args),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: (...args: unknown[]) => getSignedMediaUrlMock(...args),
}));

vi.mock("../../utils/imageUpload", async () => {
  const actual =
    await vi.importActual<typeof import("../../utils/imageUpload")>("../../utils/imageUpload");
  return {
    ...actual,
    refreshSupabaseSignedUrlIfNeeded: (...args: unknown[]) =>
      refreshSupabaseSignedUrlIfNeededMock(...args),
  };
});

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: (...args: unknown[]) => ensureSupabaseClientMock(...args),
}));

describe("prepareLibraryMediaIngestionPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshSupabaseSignedUrlIfNeededMock.mockImplementation(async (value: string) => value);
    getSignedMediaUrlMock.mockResolvedValue(null);
    mediaFilesMaybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it("refreshes preview/full URLs from storage paths when available", async () => {
    getSignedMediaUrlMock.mockImplementation(async ({ storagePath }: { storagePath: string }) => {
      if (storagePath === "user-1/previews/ref-1.jpg") {
        return "https://signed.example.com/previews/ref-1.jpg";
      }
      if (storagePath === "user-1/full/ref-1.jpg") {
        return "https://signed.example.com/full/ref-1.jpg";
      }
      return null;
    });

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-1",
      url: "https://expired.example.com/ref-1.jpg",
      fileType: "image",
      previewStoragePath: " user-1/previews/ref-1.jpg ",
      fullStoragePath: " user-1/full/ref-1.jpg ",
      previewUrl: "https://expired.example.com/ref-1-preview.jpg",
      fullUrl: "https://expired.example.com/ref-1-full.jpg",
    });

    expect(result.previewStoragePath).toBe("user-1/previews/ref-1.jpg");
    expect(result.fullStoragePath).toBe("user-1/full/ref-1.jpg");
    expect(result.previewUrl).toBe("https://signed.example.com/previews/ref-1.jpg");
    expect(result.fullUrl).toBe("https://signed.example.com/full/ref-1.jpg");
    expect(result.url).toBe("https://signed.example.com/full/ref-1.jpg");
    expect(refreshSupabaseSignedUrlIfNeededMock).not.toHaveBeenCalled();
  });

  it("falls back to existing payload URLs when signing/refresh cannot resolve", async () => {
    getSignedMediaUrlMock.mockResolvedValue(null);
    refreshSupabaseSignedUrlIfNeededMock.mockRejectedValue(
      new Error("Reference URL expired and could not be refreshed.")
    );

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-2",
      url: "https://expired.example.com/base.jpg",
      fileType: "image",
      previewStoragePath: "user-1/previews/missing.jpg",
      fullStoragePath: "user-1/full/missing.jpg",
      previewUrl: "https://expired.example.com/preview.jpg",
      fullUrl: "https://expired.example.com/full.jpg",
    });

    expect(result.previewUrl).toBe("https://expired.example.com/preview.jpg");
    expect(result.fullUrl).toBe("https://expired.example.com/full.jpg");
    expect(result.url).toBe("https://expired.example.com/full.jpg");
  });

  it("keeps non-signed external URLs unchanged when storage paths are absent", async () => {
    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-3",
      url: "https://cdn.example.com/reference.jpg",
      fileType: "image",
      previewUrl: "https://cdn.example.com/reference.jpg",
    });

    expect(getSignedMediaUrlMock).not.toHaveBeenCalled();
    expect(result.url).toBe("https://cdn.example.com/reference.jpg");
    expect(result.previewUrl).toBe("https://cdn.example.com/reference.jpg");
    expect(result.fullUrl).toBe("https://cdn.example.com/reference.jpg");
  });

  it("refreshes signed object URLs when no storage paths are provided", async () => {
    refreshSupabaseSignedUrlIfNeededMock.mockResolvedValue("https://signed.example.com/fresh.jpg");

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-4",
      url: "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/ref.jpg?token=expired",
      fileType: "image",
    });

    expect(getSignedMediaUrlMock).not.toHaveBeenCalled();
    expect(refreshSupabaseSignedUrlIfNeededMock).toHaveBeenCalledTimes(1);
    expect(result.url).toBe("https://signed.example.com/fresh.jpg");
    expect(result.previewUrl).toBe("https://signed.example.com/fresh.jpg");
    expect(result.fullUrl).toBe("https://signed.example.com/fresh.jpg");
  });

  it("falls back to media-id storage path lookup when payload path hints are missing", async () => {
    mediaFilesMaybeSingleMock.mockResolvedValue({
      data: {
        preview_storage_path: "user-1/previews/by-id.jpg",
        storage_path: "user-1/full/by-id.jpg",
      },
      error: null,
    });
    getSignedMediaUrlMock.mockImplementation(async ({ storagePath }: { storagePath: string }) => {
      if (storagePath === "user-1/previews/by-id.jpg") {
        return "https://signed.example.com/previews/by-id.jpg";
      }
      if (storagePath === "user-1/full/by-id.jpg") {
        return "https://signed.example.com/full/by-id.jpg";
      }
      return null;
    });

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-by-id",
      url: "https://expired.example.com/by-id.jpg",
      fileType: "image",
      previewStoragePath: null,
      fullStoragePath: null,
    });

    expect(ensureSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(mediaFilesFromMock).toHaveBeenCalledWith("media_files");
    expect(result.previewStoragePath).toBe("user-1/previews/by-id.jpg");
    expect(result.fullStoragePath).toBe("user-1/full/by-id.jpg");
    expect(result.previewUrl).toBe("https://signed.example.com/previews/by-id.jpg");
    expect(result.fullUrl).toBe("https://signed.example.com/full/by-id.jpg");
    expect(result.url).toBe("https://signed.example.com/full/by-id.jpg");
  });
});
