import { describe, expect, it } from "vitest";
import { resolveReferenceDownloadTarget } from "../referenceDownload";

type QueryResult = {
  data: unknown;
  error: { message?: string | null } | null;
};

const createSupabaseMock = ({
  publicationRows = [],
  mediaFileRows = [],
  canonicalOutputRows = [],
}: {
  publicationRows?: unknown[];
  mediaFileRows?: unknown[];
  canonicalOutputRows?: unknown[];
}) => ({
  from: (table: string) => {
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
          in: async (): Promise<QueryResult> => ({
            data: mediaFileRows,
            error: null,
          }),
          eq: () => ({
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
});
