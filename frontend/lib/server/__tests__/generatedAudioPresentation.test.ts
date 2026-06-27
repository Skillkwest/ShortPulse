import { describe, expect, it, vi } from "vitest";
import { mirrorGeneratedAudioPresentationToMediaFiles } from "../generatedAudioPresentation";

type SelectBuilder = {
  data: unknown;
  error: unknown;
  eq: ReturnType<typeof vi.fn>;
};

type UpdateBuilder = {
  error: unknown;
  eq: ReturnType<typeof vi.fn>;
};

const createSelectBuilder = (result: { data: unknown; error: unknown }): SelectBuilder => {
  const builder: SelectBuilder = {
    data: result.data,
    error: result.error,
    eq: vi.fn(() => builder),
  };
  return builder;
};

const createSupabaseAdminMock = (selectResult: { data: unknown; error: unknown }) => {
  const selectBuilder = createSelectBuilder(selectResult);
  const updateCalls: Array<{
    payload: Record<string, unknown>;
    builder: UpdateBuilder;
  }> = [];
  const update = vi.fn((payload: Record<string, unknown>) => {
    const builder: UpdateBuilder = {
      error: null,
      eq: vi.fn(() => builder),
    };
    updateCalls.push({ payload, builder });
    return builder;
  });
  const from = vi.fn((table: string) => {
    if (table !== "media_files") throw new Error(`Unexpected table: ${table}`);
    return {
      select: vi.fn(() => selectBuilder),
      update,
    };
  });
  return {
    supabaseAdmin: { from },
    selectBuilder,
    update,
    updateCalls,
  };
};

describe("mirrorGeneratedAudioPresentationToMediaFiles", () => {
  it("mirrors generated-audio title and companion art onto linked audio media rows", async () => {
    const { supabaseAdmin, selectBuilder, update, updateCalls } = createSupabaseAdminMock({
      data: [
        {
          id: "media-audio-1",
          file_type: "audio/mpeg",
          metadata: { existing: "kept" },
        },
        {
          id: "media-image-1",
          file_type: "image/png",
          metadata: {},
        },
      ],
      error: null,
    });

    const result = await mirrorGeneratedAudioPresentationToMediaFiles({
      generationId: "gen-1",
      userId: "user-1",
      displayTitle: "Quiet Signal",
      companionArtStatus: "ready",
      companionArtStoragePath: "user-1/generations/audio/gen-1/companion-art/cover.webp",
      supabaseAdmin: supabaseAdmin as never,
    });

    expect(selectBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(selectBuilder.eq).toHaveBeenCalledWith("source", "ai_studio");
    expect(selectBuilder.eq).toHaveBeenCalledWith("source_ref", "gen-1");
    expect(update).toHaveBeenCalledTimes(1);
    expect(updateCalls[0]?.payload).toEqual({
      metadata: {
        existing: "kept",
        display_title: "Quiet Signal",
        companion_art_status: "ready",
        companion_art_storage_path: "user-1/generations/audio/gen-1/companion-art/cover.webp",
      },
    });
    expect(updateCalls[0]?.builder.eq).toHaveBeenCalledWith("id", "media-audio-1");
    expect(updateCalls[0]?.builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(result).toEqual({ updatedCount: 1 });
  });

  it("clears mirrored metadata when canonical projection clears the fields", async () => {
    const { supabaseAdmin, updateCalls } = createSupabaseAdminMock({
      data: [
        {
          id: "media-audio-1",
          file_type: "audio",
          metadata: {
            display_title: "Old Title",
            companion_art_status: "ready",
            companion_art_storage_path: "user-1/generations/audio/gen-1/old.webp",
            other: "kept",
          },
        },
      ],
      error: null,
    });

    const result = await mirrorGeneratedAudioPresentationToMediaFiles({
      generationId: "gen-1",
      userId: "user-1",
      displayTitle: null,
      companionArtStatus: null,
      companionArtStoragePath: null,
      supabaseAdmin: supabaseAdmin as never,
    });

    expect(updateCalls[0]?.payload).toEqual({
      metadata: {
        other: "kept",
      },
    });
    expect(result).toEqual({ updatedCount: 1 });
  });

  it("degrades safely when linked media rows cannot be loaded", async () => {
    const { supabaseAdmin, update } = createSupabaseAdminMock({
      data: null,
      error: { message: "select failed" },
    });

    const result = await mirrorGeneratedAudioPresentationToMediaFiles({
      generationId: "gen-1",
      userId: "user-1",
      displayTitle: "Quiet Signal",
      companionArtStatus: "ready",
      companionArtStoragePath: "user-1/generations/audio/gen-1/companion-art/cover.webp",
      supabaseAdmin: supabaseAdmin as never,
    });

    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual({ updatedCount: 0 });
  });
});
