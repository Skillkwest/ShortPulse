import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReferenceGridPerfWatchdog } from "../useReferenceGridPerfWatchdog";

const mockDocumentVisibility = (visibilityState: DocumentVisibilityState) =>
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(visibilityState);

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useReferenceGridPerfWatchdog", () => {
  it("does not start pressure sampling while the document is hidden", () => {
    vi.useFakeTimers();
    const visibilitySpy = mockDocumentVisibility("hidden");
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    renderHook(() => useReferenceGridPerfWatchdog({ enabled: true }));

    expect(setIntervalSpy).not.toHaveBeenCalled();

    visibilitySpy.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(setIntervalSpy).toHaveBeenCalled();
  });
});
