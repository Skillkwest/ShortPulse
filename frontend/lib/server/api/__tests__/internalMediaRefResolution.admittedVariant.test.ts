import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInternalMediaRef } from "../../../media/internalMediaRefs";
import { resolveProductUseImageReferenceForMediaFile } from "../../admittedReferenceImageVariant";
import {
  resolveOpenAiImageFilesForInternalMediaRefs,
  resolveSignedUrlsForInternalMediaRefs,
} from "../internalMediaRefResolution";
import { getSupabaseAdmin } from "../supabaseAdmin";

vi.mock("../../admittedReferenceImageVariant", () => ({
  resolveProductUseImageReferenceForMediaFile: vi.fn(),
}));

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const resolveProductUseImageReferenceForMediaFileMock = vi.mocked(
  resolveProductUseImageReferenceForMediaFile
);
const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

describe("internal media ref admitted variant resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveProductUseImageReferenceForMediaFileMock.mockResolvedValue({
      mediaFileId: "media-1",
      storagePath: "user-1/variants/images/media-1/admitted_reference_25mb.jpg",
      signedUrl: "https://signed.test/admitted",
      mimeType: "image/jpeg",
      byteSize: 1024,
      width: 512,
      height: 512,
      variantKind: "admitted_reference_25mb",
      admissionMetadata: null,
    });
  });

  it("signs media-file refs through the server-owned admitted variant helper", async () => {
    const createSignedUrlsMock = vi.fn();
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
        })),
      },
    } as never);

    const ref = createInternalMediaRef({
      storagePath: "user-1/generations/images/original.png",
      mediaFileId: "media-1",
    });

    const urls = await resolveSignedUrlsForInternalMediaRefs({
      refs: [ref],
      userId: "user-1",
      expiresInSeconds: 600,
    });

    expect(resolveProductUseImageReferenceForMediaFileMock).toHaveBeenCalledWith({
      userId: "user-1",
      mediaFileId: "media-1",
      sign: true,
      expiresInSeconds: 600,
    });
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(urls).toEqual(["https://signed.test/admitted"]);
  });

  it("downloads the admitted derivative path for OpenAI edit refs with media IDs", async () => {
    const downloadMock = vi.fn(async () => ({
      data: {
        type: "image/jpeg",
        arrayBuffer: async () => Buffer.from("admitted").buffer,
      },
      error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          download: downloadMock,
        })),
      },
    } as never);

    const ref = createInternalMediaRef({
      storagePath: "user-1/generations/images/original.png",
      mediaFileId: "media-1",
    });

    const files = await resolveOpenAiImageFilesForInternalMediaRefs({
      refs: [ref],
      userId: "user-1",
    });

    expect(resolveProductUseImageReferenceForMediaFileMock).toHaveBeenCalledWith({
      userId: "user-1",
      mediaFileId: "media-1",
      sign: false,
    });
    expect(downloadMock).toHaveBeenCalledWith(
      "user-1/variants/images/media-1/admitted_reference_25mb.jpg"
    );
    expect(files[0]).toEqual(
      expect.objectContaining({
        contentType: "image/jpeg",
        storagePath: "user-1/variants/images/media-1/admitted_reference_25mb.jpg",
      })
    );
  });

  it("rejects malformed raw storage refs before signing", async () => {
    const createSignedUrlsMock = vi.fn();
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
        })),
      },
    } as never);

    const ref = createInternalMediaRef({
      storagePath: "user-1/../user-2/private.png",
    });

    const urls = await resolveSignedUrlsForInternalMediaRefs({
      refs: [ref],
      userId: "user-1",
    });

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(urls).toEqual([]);
  });

  it("rejects malformed raw storage refs before download", async () => {
    const downloadMock = vi.fn();
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          download: downloadMock,
        })),
      },
    } as never);

    const ref = createInternalMediaRef({
      storagePath: "user-1\\private\\image.png",
    });

    const files = await resolveOpenAiImageFilesForInternalMediaRefs({
      refs: [ref],
      userId: "user-1",
    });

    expect(downloadMock).not.toHaveBeenCalled();
    expect(files).toEqual([]);
  });
});
