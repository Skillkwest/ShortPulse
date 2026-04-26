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
}: {
  storageRows: Array<{ id: string; storage_path: string }>;
}) => ({
  from: vi.fn((table: string) => {
    if (table !== "media_files") {
      throw new Error(`Unexpected table: ${table}`);
    }
    const builder = {
      eq: vi.fn(),
      in: vi.fn(),
      limit: vi.fn(async () => ({
        data: storageRows,
        error: null,
      })),
    };
    builder.eq.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    return {
      select: vi.fn((fields: string) => {
        if (fields !== "id, storage_path") {
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
});
