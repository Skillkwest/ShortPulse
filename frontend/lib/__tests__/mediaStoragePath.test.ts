import { describe, expect, it } from "vitest";
import { isCharacterScopedMediaStoragePath, isCharacterScopedMediaUrl } from "../mediaStoragePath";

describe("mediaStoragePath", () => {
  it("detects character-scoped storage paths in the user namespace", () => {
    expect(isCharacterScopedMediaStoragePath("user-1/characters/char-a/ref.png", "user-1")).toBe(
      true
    );
    expect(isCharacterScopedMediaStoragePath("user-1/library/ref.png", "user-1")).toBe(false);
  });

  it("detects character-scoped media URLs for decoded and encoded paths", () => {
    expect(
      isCharacterScopedMediaUrl(
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/characters/char-a/ref.png?token=abc"
      )
    ).toBe(true);
    expect(
      isCharacterScopedMediaUrl(
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1%2Fcharacters%2Fchar-a%2Fref.png?token=abc"
      )
    ).toBe(true);
    expect(isCharacterScopedMediaUrl("https://example.com/library/ref.png")).toBe(false);
  });
});
