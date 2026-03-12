/**
 * useAvatarResilience tests.
 * Verifies bounded one-shot avatar recovery and deterministic fallback behavior.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAvatarResilience } from "../useAvatarResilience";

describe("useAvatarResilience", () => {
  it("returns the avatar url when no failure is recorded", () => {
    const { result } = renderHook(() => useAvatarResilience({ surfaceId: "create-trigger" }));

    expect(result.current.resolveAvatarUrl("char-1", "https://cdn.test/avatar.png")).toBe(
      "https://cdn.test/avatar.png"
    );
  });

  it("runs one recovery pass and clears failure when refresh returns a valid url", async () => {
    const recoverAvatarUrl = vi.fn(async () => "https://cdn.test/recovered.png");
    const { result } = renderHook(() => useAvatarResilience({ surfaceId: "create-trigger" }));

    await act(async () => {
      await result.current.handleAvatarError({
        avatarId: "char-1",
        recoverAvatarUrl,
      });
    });

    expect(recoverAvatarUrl).toHaveBeenCalledTimes(1);
    expect(result.current.isAvatarFailed("char-1")).toBe(false);
    expect(result.current.resolveAvatarUrl("char-1", "https://cdn.test/recovered.png")).toBe(
      "https://cdn.test/recovered.png"
    );
  });

  it("keeps fallback active when recovery cannot resolve a fresh url", async () => {
    const recoverAvatarUrl = vi.fn(async () => null);
    const { result } = renderHook(() => useAvatarResilience({ surfaceId: "create-trigger" }));

    await act(async () => {
      await result.current.handleAvatarError({
        avatarId: "char-1",
        recoverAvatarUrl,
      });
    });

    expect(result.current.isAvatarFailed("char-1")).toBe(true);
    expect(result.current.resolveAvatarUrl("char-1", "https://cdn.test/avatar.png")).toBeNull();
  });

  it("does not loop recovery attempts for the same avatar id", async () => {
    const recoverAvatarUrl = vi.fn(async () => null);
    const { result } = renderHook(() => useAvatarResilience({ surfaceId: "create-trigger" }));

    await act(async () => {
      await result.current.handleAvatarError({
        avatarId: "char-1",
        recoverAvatarUrl,
      });
    });
    await act(async () => {
      await result.current.handleAvatarError({
        avatarId: "char-1",
        recoverAvatarUrl,
      });
    });
    await act(async () => {
      await result.current.handleAvatarError({
        avatarId: "char-1",
        recoverAvatarUrl,
      });
    });

    expect(recoverAvatarUrl).toHaveBeenCalledTimes(1);
    expect(result.current.isAvatarFailed("char-1")).toBe(true);
  });
});
