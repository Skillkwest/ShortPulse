import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileOwnedGenerationOutputSlot } from "../generationOutputConvergence";

const getSupabaseAdminMock = vi.fn();
const attachMediaFileToGenerationOutputMock = vi.fn();
const readPersistedGenerationOutputsMock = vi.fn();
const upsertGenerationPublicationMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../generationOutputs", () => ({
  attachMediaFileToGenerationOutput: (...args: unknown[]) =>
    attachMediaFileToGenerationOutputMock(...args),
  readPersistedGenerationOutputs: (...args: unknown[]) =>
    readPersistedGenerationOutputsMock(...args),
}));

vi.mock("../generationPublications", () => ({
  upsertGenerationPublication: (...args: unknown[]) => upsertGenerationPublicationMock(...args),
}));

vi.mock("../generationProjection", () => ({
  upsertGenerationProjection: (...args: unknown[]) => upsertGenerationProjectionMock(...args),
}));

const createAdminClient = ({
  storageRows,
  firstSelectError = null,
}: {
  storageRows: Array<{
    id: string;
    storage_path: string;
    file_type?: string | null;
    poster_variant_path?: string | null;
    preview_variant_path?: string | null;
  }>;
  firstSelectError?: { message: string } | null;
}) => ({
  __selectCallCount: 0,
  from: vi.fn(function (this: { __selectCallCount: number }, table: string) {
    if (table !== "media_files") {
      throw new Error(`Unexpected table: ${table}`);
    }
    const builder = {
      eq: vi.fn(),
      in: vi.fn(),
      limit: vi.fn(async () => {
        this.__selectCallCount += 1;
        if (this.__selectCallCount === 1 && firstSelectError) {
          return {
            data: null,
            error: firstSelectError,
          };
        }
        return {
          data: storageRows,
          error: null,
        };
      }),
    };
    builder.eq.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    return {
      select: vi.fn((fields: string) => {
        if (
          fields !==
            "id, preview_storage_path, storage_path, file_type, poster_variant_path, preview_variant_path" &&
          fields !== "id, storage_path, file_type, poster_variant_path, preview_variant_path"
        ) {
          throw new Error(`Unexpected fields: ${fields}`);
        }
        return builder;
      }),
    };
  }),
});

describe("generationOutputConvergence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attachMediaFileToGenerationOutputMock.mockResolvedValue(undefined);
    upsertGenerationPublicationMock.mockResolvedValue(undefined);
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
  });

  it("converges publications and projection for a fully owned output set", async () => {
    const adminClient = createAdminClient({
      storageRows: [
        { id: "media-1", storage_path: "user-1/generations/images/media-1.png" },
        { id: "media-2", storage_path: "user-1/generations/images/media-2.png" },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(adminClient);
    readPersistedGenerationOutputsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/1.png",
        mediaFileId: "media-1",
      },
      {
        id: "output-2",
        outputIndex: 1,
        resultUrl: "https://cdn.shortpulse.test/2.png",
        mediaFileId: "media-2",
      },
    ]);

    const result = await reconcileOwnedGenerationOutputSlot({
      generationId: "gen-1",
      userId: "user-1",
      outputIndex: 0,
      mediaFileId: "media-1",
      resultUrl: "https://cdn.shortpulse.test/1.png",
      metadata: {
        recovery_execution: true,
      },
    });

    expect(attachMediaFileToGenerationOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        outputIndex: 0,
        mediaFileId: "media-1",
      })
    );
    expect(upsertGenerationPublicationMock).toHaveBeenCalledTimes(2);
    expect(upsertGenerationPublicationMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        generationOutputId: "output-1",
        ownedMediaFileId: "media-1",
        previewStoragePath: "user-1/generations/images/media-1.png",
        publicationState: "published",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        previewStoragePath: "user-1/generations/images/media-1.png",
        fullStoragePath: "user-1/generations/images/media-1.png",
        publicationState: "published",
        resultUrls: ["https://cdn.shortpulse.test/1.png", "https://cdn.shortpulse.test/2.png"],
        savedMediaIds: ["media-1", "media-2"],
      })
    );
    expect(result).toEqual({
      persistedOutputRows: [
        {
          id: "output-1",
          outputIndex: 0,
          resultUrl: "https://cdn.shortpulse.test/1.png",
          mediaFileId: "media-1",
        },
        {
          id: "output-2",
          outputIndex: 1,
          resultUrl: "https://cdn.shortpulse.test/2.png",
          mediaFileId: "media-2",
        },
      ],
      savedMediaIds: ["media-1", "media-2"],
      hasCanonicalOwnedMedia: true,
      previewStoragePath: "user-1/generations/images/media-1.png",
      fullStoragePath: "user-1/generations/images/media-1.png",
    });
  });

  it("updates partial owned-media convergence without forcing published projection state", async () => {
    const adminClient = createAdminClient({
      storageRows: [{ id: "media-1", storage_path: "user-1/generations/images/media-1.png" }],
    });
    getSupabaseAdminMock.mockReturnValue(adminClient);
    readPersistedGenerationOutputsMock.mockResolvedValue([
      {
        id: "output-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/1.png",
        mediaFileId: "media-1",
      },
      {
        id: "output-2",
        outputIndex: 1,
        resultUrl: "https://cdn.shortpulse.test/2.png",
        mediaFileId: null,
      },
    ]);

    const firstResult = await reconcileOwnedGenerationOutputSlot({
      generationId: "gen-1",
      userId: "user-1",
      outputIndex: 0,
      mediaFileId: "media-1",
      resultUrl: "https://cdn.shortpulse.test/1.png",
    });
    const secondResult = await reconcileOwnedGenerationOutputSlot({
      generationId: "gen-1",
      userId: "user-1",
      outputIndex: 0,
      mediaFileId: "media-1",
      resultUrl: "https://cdn.shortpulse.test/1.png",
    });

    expect(upsertGenerationPublicationMock).toHaveBeenCalledTimes(2);
    expect(upsertGenerationProjectionMock).toHaveBeenCalledTimes(2);
    expect(upsertGenerationProjectionMock).toHaveBeenNthCalledWith(
      1,
      expect.not.objectContaining({
        publicationState: "published",
      })
    );
    expect(firstResult).toEqual(secondResult);
    expect(firstResult).toEqual({
      persistedOutputRows: [
        {
          id: "output-1",
          outputIndex: 0,
          resultUrl: "https://cdn.shortpulse.test/1.png",
          mediaFileId: "media-1",
        },
        {
          id: "output-2",
          outputIndex: 1,
          resultUrl: "https://cdn.shortpulse.test/2.png",
          mediaFileId: null,
        },
      ],
      savedMediaIds: ["media-1"],
      hasCanonicalOwnedMedia: false,
      previewStoragePath: "user-1/generations/images/media-1.png",
      fullStoragePath: "user-1/generations/images/media-1.png",
    });
  });

  it("suppresses delivery paths when a matching user-owned row points outside the caller storage scope", async () => {
    const adminClient = createAdminClient({
      storageRows: [
        { id: "media-foreign-1", storage_path: "user-2/generations/images/foreign.png" },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(adminClient);
    readPersistedGenerationOutputsMock.mockResolvedValue([
      {
        id: "output-foreign-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/foreign.png",
        mediaFileId: "media-foreign-1",
      },
    ]);

    const result = await reconcileOwnedGenerationOutputSlot({
      generationId: "gen-foreign-1",
      userId: "user-1",
      outputIndex: 0,
      mediaFileId: "media-foreign-1",
      resultUrl: "https://cdn.shortpulse.test/foreign.png",
    });

    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationOutputId: "output-foreign-1",
        publicationState: "suppressed",
        previewStoragePath: null,
        fullStoragePath: null,
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        previewStoragePath: "user-2/generations/images/foreign.png",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-foreign-1",
        savedMediaIds: [],
      })
    );
    expect(result).toEqual({
      persistedOutputRows: [
        {
          id: "output-foreign-1",
          outputIndex: 0,
          resultUrl: "https://cdn.shortpulse.test/foreign.png",
          mediaFileId: "media-foreign-1",
        },
      ],
      savedMediaIds: [],
      hasCanonicalOwnedMedia: false,
      previewStoragePath: null,
      fullStoragePath: null,
    });
  });

  it("uses video preview-loop variants for preview storage while preserving the video as full storage", async () => {
    const adminClient = createAdminClient({
      storageRows: [
        {
          id: "media-video-1",
          storage_path: "user-1/generations/videos/media-video-1.mp4",
          file_type: "video/mp4",
          poster_variant_path: "user-1/variants/videos/media-video-1/poster_720.jpg",
          preview_variant_path: "user-1/variants/videos/media-video-1/preview_loop_360p.mp4",
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(adminClient);
    readPersistedGenerationOutputsMock.mockResolvedValue([
      {
        id: "output-video-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/video-1.mp4",
        mediaFileId: "media-video-1",
      },
    ]);

    const result = await reconcileOwnedGenerationOutputSlot({
      generationId: "gen-video-1",
      userId: "user-1",
      outputIndex: 0,
      mediaFileId: "media-video-1",
      resultUrl: "https://cdn.shortpulse.test/video-1.mp4",
    });

    expect(upsertGenerationPublicationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationOutputId: "output-video-1",
        previewStoragePath: "user-1/variants/videos/media-video-1/preview_loop_360p.mp4",
        fullStoragePath: "user-1/generations/videos/media-video-1.mp4",
        publicationState: "published",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-video-1",
        previewStoragePath: "user-1/variants/videos/media-video-1/preview_loop_360p.mp4",
        fullStoragePath: "user-1/generations/videos/media-video-1.mp4",
      })
    );
    expect(result.previewStoragePath).toBe(
      "user-1/variants/videos/media-video-1/preview_loop_360p.mp4"
    );
    expect(result.fullStoragePath).toBe("user-1/generations/videos/media-video-1.mp4");
  });

  it("falls back when preview_storage_path is unavailable in the media_files schema", async () => {
    const adminClient = createAdminClient({
      firstSelectError: {
        message:
          "Could not find the 'preview_storage_path' column of 'media_files' in the schema cache",
      },
      storageRows: [
        {
          id: "media-video-fallback-1",
          storage_path: "user-1/generations/videos/media-video-fallback-1.mp4",
          file_type: "video/mp4",
          poster_variant_path: "user-1/variants/videos/media-video-fallback-1/poster_720.jpg",
          preview_variant_path:
            "user-1/variants/videos/media-video-fallback-1/preview_loop_360p.mp4",
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(adminClient);
    readPersistedGenerationOutputsMock.mockResolvedValue([
      {
        id: "output-video-fallback-1",
        outputIndex: 0,
        resultUrl: "https://cdn.shortpulse.test/video-fallback-1.mp4",
        mediaFileId: "media-video-fallback-1",
      },
    ]);

    const result = await reconcileOwnedGenerationOutputSlot({
      generationId: "gen-video-fallback-1",
      userId: "user-1",
      outputIndex: 0,
      mediaFileId: "media-video-fallback-1",
      resultUrl: "https://cdn.shortpulse.test/video-fallback-1.mp4",
    });

    expect(result.previewStoragePath).toBe(
      "user-1/variants/videos/media-video-fallback-1/preview_loop_360p.mp4"
    );
    expect(result.fullStoragePath).toBe("user-1/generations/videos/media-video-fallback-1.mp4");
  });
});
