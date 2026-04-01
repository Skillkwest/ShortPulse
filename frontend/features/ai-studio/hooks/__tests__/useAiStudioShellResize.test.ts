import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAiStudioShellResize } from "../useAiStudioShellResize";

describe("useAiStudioShellResize", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not read stored width or attach viewport listeners when disabled", () => {
    const getItemSpy = vi.spyOn(window.localStorage.__proto__, "getItem");
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    const { result } = renderHook(() =>
      useAiStudioShellResize({
        enabled: false,
      })
    );

    expect(result.current.showDivider).toBe(false);
    expect(getItemSpy).not.toHaveBeenCalled();
    expect(addEventListenerSpy).not.toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("hydrates stored width and tracks viewport changes when enabled", () => {
    const getItemSpy = vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue("420");
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    renderHook(() =>
      useAiStudioShellResize({
        enabled: true,
      })
    );

    expect(getItemSpy).toHaveBeenCalled();
    expect(addEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
