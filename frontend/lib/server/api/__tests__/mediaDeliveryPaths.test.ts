import { describe, expect, it, vi } from "vitest";
import { readMediaDeliveryPathsById } from "../mediaDeliveryPaths";

type MediaRow = {
  id: string;
  storage_path: string | null;
  file_type: string | null;
  thumb_variant_path: string | null;
  poster_variant_path: string | null;
  preview_variant_path: string | null;
};

const createSupabaseAdmin = ({
  rows,
  error = null,
}: {
  rows: MediaRow[];
  error?: { message?: string } | null;
}) => {
  const limitMock = vi.fn(async () => ({
    data: error ? null : rows,
    error,
  }));
  const eqMock = vi.fn(() => ({
    limit: limitMock,
  }));
  const inMock = vi.fn(() => ({
    eq: eqMock,
  }));
  const selectMock = vi.fn(() => ({
    in: inMock,
  }));
  const fromMock = vi.fn(() => ({
    select: selectMock,
  }));

  return {
    eqMock,
    fromMock,
    inMock,
    limitMock,
    selectMock,
    client: {
      from: fromMock,
    },
  };
};

describe("readMediaDeliveryPathsById", () => {
  it("prefers image thumbnail variants while keeping the original as full delivery", async () => {
    const supabase = createSupabaseAdmin({
      rows: [
        {
          id: "media-image-1",
          storage_path: "user-1/generations/images/full.png",
          file_type: "image/png",
          thumb_variant_path: "user-1/variants/images/thumb.webp",
          poster_variant_path: null,
          preview_variant_path: null,
        },
      ],
    });

    const paths = await readMediaDeliveryPathsById({
      mediaFileIds: ["media-image-1"],
      userId: "user-1",
      supabaseAdmin: supabase.client as never,
    });

    expect(paths.get("media-image-1")).toEqual({
      previewStoragePath: "user-1/variants/images/thumb.webp",
      fullStoragePath: "user-1/generations/images/full.png",
    });
    expect(supabase.inMock).toHaveBeenCalledWith("id", ["media-image-1"]);
    expect(supabase.eqMock).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("prefers video preview loops over posters and originals", async () => {
    const supabase = createSupabaseAdmin({
      rows: [
        {
          id: "media-video-1",
          storage_path: "user-1/generations/videos/full.mp4",
          file_type: "video/mp4",
          thumb_variant_path: "user-1/variants/videos/thumb.jpg",
          poster_variant_path: "user-1/variants/videos/poster.jpg",
          preview_variant_path: "user-1/variants/videos/preview-loop.mp4",
        },
      ],
    });

    const paths = await readMediaDeliveryPathsById({
      mediaFileIds: ["media-video-1"],
      userId: "user-1",
      supabaseAdmin: supabase.client as never,
    });

    expect(paths.get("media-video-1")).toEqual({
      previewStoragePath: "user-1/variants/videos/preview-loop.mp4",
      fullStoragePath: "user-1/generations/videos/full.mp4",
    });
  });

  it("drops rows whose delivery paths are outside the caller storage scope", async () => {
    const supabase = createSupabaseAdmin({
      rows: [
        {
          id: "media-foreign-1",
          storage_path: "user-2/generations/images/foreign.png",
          file_type: "image/png",
          thumb_variant_path: "user-1/variants/images/thumb.webp",
          poster_variant_path: null,
          preview_variant_path: null,
        },
        {
          id: "media-traversal-1",
          storage_path: "user-1/../escape.png",
          file_type: "image/png",
          thumb_variant_path: null,
          poster_variant_path: null,
          preview_variant_path: null,
        },
      ],
    });

    const paths = await readMediaDeliveryPathsById({
      mediaFileIds: ["media-foreign-1", "media-traversal-1"],
      userId: "user-1",
      supabaseAdmin: supabase.client as never,
    });

    expect(paths.size).toBe(0);
  });

  it("fails closed to no delivery paths when media row lookup fails", async () => {
    const supabase = createSupabaseAdmin({
      rows: [],
      error: { message: "media lookup unavailable" },
    });

    const paths = await readMediaDeliveryPathsById({
      mediaFileIds: ["media-error-1"],
      userId: "user-1",
      supabaseAdmin: supabase.client as never,
    });

    expect(paths.size).toBe(0);
  });
});
