import { describe, expect, it } from "vitest";
import {
  assertUserScopedMediaStoragePath,
  isUserScopedMediaStoragePath,
} from "../../lib/mediaStoragePath";

describe("mediaStoragePath", () => {
  it("accepts a valid user-scoped path", () => {
    expect(isUserScopedMediaStoragePath("user-1/images/file.png", "user-1")).toBe(true);
    expect(
      assertUserScopedMediaStoragePath({
        path: " user-1/images/file.png ",
        userId: "user-1",
      })
    ).toBe("user-1/images/file.png");
  });

  it("rejects malformed path shapes", () => {
    expect(isUserScopedMediaStoragePath("", "user-1")).toBe(false);
    expect(isUserScopedMediaStoragePath("/user-1/images/file.png", "user-1")).toBe(false);
    expect(isUserScopedMediaStoragePath("user-1\\images\\file.png", "user-1")).toBe(false);
    expect(isUserScopedMediaStoragePath("user-1/images/../file.png", "user-1")).toBe(false);
  });

  it("rejects paths outside user scope", () => {
    expect(isUserScopedMediaStoragePath("user-2/images/file.png", "user-1")).toBe(false);
    expect(() =>
      assertUserScopedMediaStoragePath({
        path: "user-2/images/file.png",
        userId: "user-1",
      })
    ).toThrow("must start with 'user-1/'");
  });

  it("rejects invalid user namespace tokens", () => {
    expect(isUserScopedMediaStoragePath("user-1/images/file.png", "user/1")).toBe(false);
    expect(() =>
      assertUserScopedMediaStoragePath({
        path: "user-1/images/file.png",
        userId: "user/1",
      })
    ).toThrow("user namespace is invalid");
  });
});
