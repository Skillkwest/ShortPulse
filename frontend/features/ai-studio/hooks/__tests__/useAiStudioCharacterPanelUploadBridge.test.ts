import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAiStudioCharacterPanelUploadBridge } from "../useAiStudioCharacterPanelUploadBridge";

describe("useAiStudioCharacterPanelUploadBridge", () => {
  it("captures dropped files as a one-shot pending upload request", () => {
    const { result } = renderHook(() => useAiStudioCharacterPanelUploadBridge());
    const files = [new File(["alpha"], "alpha.png", { type: "image/png" })];

    act(() => {
      result.current.addCharacterReferences(files);
    });

    expect(result.current.pendingCharacterUploadRequest).toEqual({
      requestId: 1,
      files,
    });
    expect(result.current.characterError).toBeNull();

    act(() => {
      result.current.clearPendingCharacterUploadRequest(1);
    });

    expect(result.current.pendingCharacterUploadRequest).toBeNull();
  });

  it("ignores stale clear requests", () => {
    const { result } = renderHook(() => useAiStudioCharacterPanelUploadBridge());

    act(() => {
      result.current.addCharacterReferences([
        new File(["beta"], "beta.png", { type: "image/png" }),
      ]);
    });

    act(() => {
      result.current.clearPendingCharacterUploadRequest(999);
    });

    expect(result.current.pendingCharacterUploadRequest?.requestId).toBe(1);
  });
});
