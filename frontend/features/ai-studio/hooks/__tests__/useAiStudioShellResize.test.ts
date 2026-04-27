import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAiStudioShellResize } from "../useAiStudioShellResize";
import { AI_SHELL_LEFT_MIN_PX } from "../../logic/shellResize";

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

  it("collapses to the minimum width once per project reset key", async () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue("1000");
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1400,
    });

    const { result, rerender } = renderHook(
      ({ minWidthResetKey }: { minWidthResetKey: string | null }) =>
        useAiStudioShellResize({
          enabled: true,
          minWidthResetKey,
        }),
      {
        initialProps: {
          minWidthResetKey: null as string | null,
        },
      }
    );

    const shellNode = {
      getBoundingClientRect: () => ({ width: 1600 }),
    } as HTMLElement;

    act(() => {
      result.current.shellRef.current = shellNode;
    });

    rerender({ minWidthResetKey: "project-1" });

    await waitFor(() => {
      expect(result.current.leftWidthPx).toBe(AI_SHELL_LEFT_MIN_PX);
    });

    rerender({ minWidthResetKey: "project-1" });

    await waitFor(() => {
      expect(result.current.leftWidthPx).toBe(AI_SHELL_LEFT_MIN_PX);
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
  });
});
