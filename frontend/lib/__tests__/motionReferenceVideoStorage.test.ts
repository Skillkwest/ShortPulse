import { describe, expect, it } from "vitest";
import {
  isMotionReferenceVideoStoragePath,
  resolveMotionReferenceVideoStoragePathFromUrl,
} from "../motionReferenceVideoStorage";

describe("motionReferenceVideoStorage", () => {
  it("accepts canonical user-scoped motion-control storage paths", () => {
    expect(isMotionReferenceVideoStoragePath("user-1/videos/motion-control/ref.mp4")).toBe(true);
    expect(
      resolveMotionReferenceVideoStoragePathFromUrl(
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion-control/ref.mp4?token=fresh"
      )
    ).toBe("user-1/videos/motion-control/ref.mp4");
  });

  it("rejects legacy motion-control paths without a user namespace", () => {
    expect(isMotionReferenceVideoStoragePath("videos/motion-control/ref.mp4")).toBe(false);
    expect(
      resolveMotionReferenceVideoStoragePathFromUrl(
        "https://example.supabase.co/storage/v1/object/sign/media_library/videos/motion-control/ref.mp4?token=fresh"
      )
    ).toBeNull();
  });
});
