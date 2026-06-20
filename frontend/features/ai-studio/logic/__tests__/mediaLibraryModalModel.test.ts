import { describe, expect, it } from "vitest";
import {
  resolveMediaAudioBackgroundImageUrl,
  resolveMediaMetadataDisplayTitle,
  resolveMediaMetadataDurationMs,
  type MediaFileRow,
} from "../mediaLibraryModalModel";

const createAudioRow = (overrides: Partial<MediaFileRow> = {}): MediaFileRow => ({
  id: "audio-1",
  filename: "audio.mp3",
  storage_path: "user-1/generations/audio/audio.mp3",
  file_type: "audio/mpeg",
  metadata: null,
  ...overrides,
});

describe("mediaLibraryModalModel audio metadata", () => {
  it("uses resolved duration metadata when a zero duration candidate is present", () => {
    expect(
      resolveMediaMetadataDurationMs(
        {
          duration_ms: 0,
          resolved_duration_seconds: 30,
        },
        { fileType: "audio/mpeg" }
      )
    ).toBe(30_000);
  });

  it("treats zero-only audio duration metadata as unknown", () => {
    expect(resolveMediaMetadataDurationMs({ duration_ms: 0 }, { fileType: "audio/mpeg" })).toBe(
      null
    );
  });

  it("resolves audio companion art from metadata fallback fields", () => {
    expect(
      resolveMediaAudioBackgroundImageUrl(
        createAudioRow({
          metadata: {
            companion_art_url_fallback: "https://cdn.test/audio-cover.webp",
          },
        })
      )
    ).toBe("https://cdn.test/audio-cover.webp");
  });

  it("does not use Supabase image transformation URLs for audio companion art", () => {
    expect(
      resolveMediaAudioBackgroundImageUrl(
        createAudioRow({
          companion_art_url:
            "https://project.supabase.co/storage/v1/render/image/public/media/user-1/cover.webp",
          metadata: {
            companionArtUrl: "https://cdn.test/signed-cover.webp",
          },
        })
      )
    ).toBe("https://cdn.test/signed-cover.webp");
  });

  it("resolves generated audio display titles from metadata aliases", () => {
    expect(
      resolveMediaMetadataDisplayTitle({
        display_title: "Lunar Midnight Signal",
        song_title: "Fallback Song",
      })
    ).toBe("Lunar Midnight Signal");
    expect(
      resolveMediaMetadataDisplayTitle({
        voice_changer_title: "Warm City Take",
      })
    ).toBe("Warm City Take");
  });
});
