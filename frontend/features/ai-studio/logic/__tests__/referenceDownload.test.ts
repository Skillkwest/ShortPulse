import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveReferenceDownloadTarget } from "../referenceDownload";

const readSupabaseUserIdMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  readSupabaseUserId: readSupabaseUserIdMock,
}));

type QueryResult = {
  data: unknown;
  error: { message?: string | null } | null;
};

const createSupabaseMock = ({
  publicationRows = [],
  mediaFileRows = [],
  canonicalOutputRows = [],
  projectionRows = [],
  generationRows = [],
  projectGenerationRows = [],
}: {
  publicationRows?: unknown[];
  mediaFileRows?: unknown[];
  canonicalOutputRows?: unknown[];
  projectionRows?: unknown[];
  generationRows?: unknown[];
  projectGenerationRows?: unknown[];
}) => ({
  from: (table: string) => {
    if (table === "generation_projection") {
      const builder = {
        eq: () => builder,
        limit: () => ({
          maybeSingle: async (): Promise<QueryResult> => ({
            data: Array.isArray(projectionRows) ? (projectionRows[0] ?? null) : null,
            error: null,
          }),
        }),
      };
      return {
        select: () => builder,
      };
    }
    if (table === "ai_generations") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async (): Promise<QueryResult> => ({
                  data: Array.isArray(generationRows) ? (generationRows[0] ?? null) : null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "project_generation_items") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async (): Promise<QueryResult> => ({
                    data: Array.isArray(projectGenerationRows)
                      ? (projectGenerationRows[0] ?? null)
                      : null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "generation_publications") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: async (): Promise<QueryResult> => ({
                  data: publicationRows,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "media_files") {
      return {
        select: () => ({
          in: () => ({
            order: () => ({
              limit: async (): Promise<QueryResult> => ({
                data: mediaFileRows,
                error: null,
              }),
            }),
          }),
          eq: () => ({
            limit: () => ({
              maybeSingle: async (): Promise<QueryResult> => ({
                data: Array.isArray(mediaFileRows) ? (mediaFileRows[0] ?? null) : null,
                error: null,
              }),
            }),
            order: () => ({
              limit: async (): Promise<QueryResult> => ({
                data: mediaFileRows,
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    if (table === "ai_generation_outputs") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async (): Promise<QueryResult> => ({
                data: canonicalOutputRows,
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  },
});

describe("resolveReferenceDownloadTarget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
  });

  it("prefers publication-owned media linkage before canonical generation outputs", async () => {
    const target = await resolveReferenceDownloadTarget({
      output: {
        savedMediaIds: [],
        generationId: "gen-1",
        mediaSource: "generated",
        taskId: "task-1",
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: "https://cdn.example.com/preview.png",
        resultUrls: ["https://cdn.example.com/result.png"],
      },
      supabase: createSupabaseMock({
        publicationRows: [
          {
            owned_media_file_id: "media-from-publication",
            preview_storage_path: null,
            full_storage_path: null,
          },
        ],
        mediaFileRows: [
          {
            storage_path: "user-1/generations/images/from-publication.png",
            filename: "from-publication.png",
          },
        ],
        canonicalOutputRows: [{ media_file_id: "media-from-canonical-output", output_index: 0 }],
      }) as never,
    });

    expect(target).toEqual({
      fileRecord: {
        storagePath: "user-1/generations/images/from-publication.png",
        filename: "from-publication.png",
      },
      generationId: "gen-1",
      directUrl: "https://cdn.example.com/result.png",
    });
  });

  it("uses publication storage paths directly when present", async () => {
    const target = await resolveReferenceDownloadTarget({
      output: {
        savedMediaIds: [],
        generationId: "gen-1",
        mediaSource: "generated",
        taskId: "task-1",
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: undefined,
        resultUrls: [],
      },
      supabase: createSupabaseMock({
        publicationRows: [
          {
            owned_media_file_id: null,
            preview_storage_path: "user-1/generations/images/from-publication-preview.png",
            full_storage_path: "user-1/generations/images/from-publication-full.png",
          },
        ],
      }) as never,
    });

    expect(target).toEqual({
      fileRecord: {
        storagePath: "user-1/generations/images/from-publication-full.png",
        filename: null,
      },
      generationId: "gen-1",
      directUrl: null,
    });
  });

  it("uses canonical storage_path for saved media downloads instead of preview storage paths", async () => {
    const target = await resolveReferenceDownloadTarget({
      output: {
        savedMediaIds: ["media-1"],
        generationId: undefined,
        mediaSource: "upload",
        taskId: undefined,
        previewStoragePath: undefined,
        fullStoragePath: undefined,
        previewUrl: "https://cdn.example.com/preview.png",
        resultUrls: [],
      },
      supabase: createSupabaseMock({
        mediaFileRows: [
          {
            storage_path: "user-1/media/full-resolution.png",
            preview_storage_path: "user-1/media/preview-resolution.png",
            filename: "full-resolution.png",
          },
        ],
      }) as never,
    });

    expect(target).toEqual({
      fileRecord: {
        storagePath: "user-1/media/full-resolution.png",
        filename: "full-resolution.png",
      },
      generationId: null,
      directUrl: "https://cdn.example.com/preview.png",
    });
  });

  it("does not resolve request-backed generations for downloads when the active project does not own them", async () => {
    const target = await resolveReferenceDownloadTarget({
      output: {
        savedMediaIds: [],
        generationId: undefined,
        mediaSource: "generated",
        taskId: "req-project-missing",
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: "https://cdn.example.com/project-preview.png",
        resultUrls: [],
      },
      projectId: "project-1",
      supabase: createSupabaseMock({
        projectionRows: [
          {
            generation_id: "gen-not-owned",
          },
        ],
        projectGenerationRows: [],
      }) as never,
    });

    expect(target).toEqual({
      fileRecord: null,
      generationId: null,
      directUrl: "https://cdn.example.com/project-preview.png",
    });
  });
});
