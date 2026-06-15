import { act, renderHook, waitFor } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAiStudioShellResize } from "../useAiStudioShellResize";
import {
  AI_SHELL_DIVIDER_TRACK_PX,
  AI_SHELL_LEFT_CREATE_MIN_PX,
  AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX,
  AI_SHELL_LEFT_MIN_PX,
  AI_SHELL_LEFT_SOUND_MIN_PX,
  AI_SHELL_LEFT_VIDEO_MIN_PX,
  AI_SHELL_LEFT_WIDTH_STORAGE_KEY,
  AI_SHELL_RIGHT_COLLAPSED_MIN_PX,
  AI_SHELL_RIGHT_COMPACT_MIN_PX,
  AI_SHELL_RIGHT_MIN_PX,
} from "../../logic/shellResize";

describe("useAiStudioShellResize", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
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
    expect(result.current.shellLayoutMode).toBe("right-rail-focus");
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

  it("honors a caller-provided left-column minimum when collapsing on a reset key", async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1400,
    });

    const { result, rerender } = renderHook(
      ({ minWidthResetKey }: { minWidthResetKey: string | null }) =>
        useAiStudioShellResize({
          enabled: true,
          minLeftWidthPx: AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX,
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
      expect(result.current.leftWidthPx).toBe(AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX);
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("uses the Create minimum when opening a collapsed Create shell", async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1600,
    });

    const { result } = renderHook(() =>
      useAiStudioShellResize({
        enabled: true,
        minLeftWidthPx: AI_SHELL_LEFT_CREATE_MIN_PX,
      })
    );

    const shellNode = {
      getBoundingClientRect: () => ({ width: 1800 }),
    } as HTMLElement;

    act(() => {
      result.current.shellRef.current = shellNode;
      result.current.collapseToMin();
    });

    await waitFor(() => {
      expect(result.current.leftWidthPx).toBe(AI_SHELL_LEFT_CREATE_MIN_PX);
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("persists the dragged shell width only after pointer resizing stops", async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1400,
    });
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");

    const { result } = renderHook(() =>
      useAiStudioShellResize({
        enabled: true,
      })
    );

    act(() => {
      result.current.shellRef.current = {
        getBoundingClientRect: () => ({ width: 1600 }),
      } as HTMLElement;
      result.current.leftColumnRef.current = {
        getBoundingClientRect: () => ({ width: 760 }),
      } as HTMLElement;
    });

    await waitFor(() => {
      expect(result.current.showDivider).toBe(true);
    });

    setItemSpy.mockClear();

    act(() => {
      result.current.dividerProps.onPointerDown?.({
        pointerId: 101,
        button: 0,
        clientX: 760,
        preventDefault: vi.fn(),
      } as unknown as ReactPointerEvent<HTMLButtonElement>);
    });

    expect(result.current.isResizing).toBe(true);
    expect(setItemSpy).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 101, clientX: 820 }));
    });

    expect(result.current.leftWidthPx).toBe(820);
    expect(setItemSpy).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 101, clientX: 820 }));
    });

    await waitFor(() => {
      expect(result.current.isResizing).toBe(false);
      expect(setItemSpy).toHaveBeenCalledWith(AI_SHELL_LEFT_WIDTH_STORAGE_KEY, "820");
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("switches to compact split instead of hiding the right rail when desktop minimums do not fit", async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1400,
    });

    const { result } = renderHook(() =>
      useAiStudioShellResize({
        enabled: true,
        minLeftWidthPx: 888,
      })
    );

    act(() => {
      result.current.shellRef.current = {
        getBoundingClientRect: () => ({ width: 980 }),
      } as HTMLElement;
    });

    await waitFor(() => {
      expect(result.current.shellLayoutMode).toBe("compact-split");
      expect(result.current.showDivider).toBe(true);
      expect(result.current.rightColumnHidden).toBe(false);
      expect(result.current.shellStyle).toMatchObject({
        "--ai-shell-right-min-width": `${AI_SHELL_RIGHT_COMPACT_MIN_PX}px`,
      });
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("clamps against visible viewport width when the shell has already overflowed", async () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue("1200");
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
    });

    const parentNode = document.createElement("div");
    const shellNode = document.createElement("section");
    parentNode.appendChild(shellNode);
    document.body.appendChild(parentNode);
    Object.defineProperty(parentNode, "clientWidth", {
      configurable: true,
      value: 1000,
    });
    parentNode.getBoundingClientRect = vi.fn(
      () =>
        ({
          width: 1000,
          height: 800,
          left: 280,
          right: 1280,
          top: 0,
          bottom: 800,
          x: 280,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect
    );
    shellNode.getBoundingClientRect = vi.fn(
      () =>
        ({
          width: 1440,
          height: 800,
          left: 280,
          right: 1720,
          top: 0,
          bottom: 800,
          x: 280,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect
    );

    const { result } = renderHook(() =>
      useAiStudioShellResize({
        enabled: true,
        minLeftWidthPx: AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX,
      })
    );

    act(() => {
      result.current.shellRef.current = shellNode;
    });

    const visibleShellWidth = window.innerWidth - 280;
    const rightSafeLeftWidth =
      visibleShellWidth - AI_SHELL_RIGHT_MIN_PX - AI_SHELL_DIVIDER_TRACK_PX;

    await waitFor(() => {
      expect(result.current.shellLayoutMode).toBe("compact-split");
      expect(result.current.leftWidthPx).toBe(rightSafeLeftWidth);
      expect(result.current.rightColumnHidden).toBe(false);
      expect(result.current.shellStyle).toMatchObject({
        "--ai-shell-left-width": `${rightSafeLeftWidth}px`,
        "--ai-shell-right-min-width": `${AI_SHELL_RIGHT_COMPACT_MIN_PX}px`,
      });
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it.each([
    { label: "Create", minLeftWidthPx: AI_SHELL_LEFT_CREATE_MIN_PX },
    { label: "Expert Edit", minLeftWidthPx: AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX },
    { label: "Video", minLeftWidthPx: AI_SHELL_LEFT_VIDEO_MIN_PX },
    { label: "Sound", minLeftWidthPx: AI_SHELL_LEFT_SOUND_MIN_PX },
  ])(
    "allows $label to expand to the right edge and unmount right-rail content",
    async ({ minLeftWidthPx }) => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 1800,
      });

      const { result } = renderHook(() =>
        useAiStudioShellResize({
          enabled: true,
          minLeftWidthPx,
          minRightWidthPx: AI_SHELL_RIGHT_COLLAPSED_MIN_PX,
        })
      );

      act(() => {
        result.current.shellRef.current = {
          getBoundingClientRect: () => ({ width: 1800 }),
        } as HTMLElement;
      });

      await waitFor(() => {
        expect(result.current.showDivider).toBe(true);
      });

      act(() => {
        result.current.expandToMax();
      });

      await waitFor(() => {
        expect(result.current.leftWidthPx).toBe(1800 - AI_SHELL_DIVIDER_TRACK_PX);
        expect(result.current.rightColumnHidden).toBe(true);
        expect(result.current.shellStyle).toMatchObject({
          "--ai-shell-left-width": `${1800 - AI_SHELL_DIVIDER_TRACK_PX}px`,
          "--ai-shell-right-min-width": `${AI_SHELL_RIGHT_COLLAPSED_MIN_PX}px`,
          "--ai-shell-right-visibility": "0",
        });
      });

      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  );
});
