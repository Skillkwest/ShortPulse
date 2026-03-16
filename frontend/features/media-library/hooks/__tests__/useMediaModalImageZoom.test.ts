import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMediaModalImageZoom } from "../useMediaModalImageZoom";

describe("useMediaModalImageZoom", () => {
  it("ignores zoom click when focused media is not an image", () => {
    const { result } = renderHook(() => useMediaModalImageZoom({ isFocusedImage: false }));

    act(() => {
      result.current.handleModalImageClick({
        clientX: 40,
        clientY: 30,
      } as unknown as React.MouseEvent<HTMLImageElement>);
    });

    expect(result.current.modalImageZoomActive).toBe(false);
    expect(result.current.modalImageZoomScale).toBe(1);
  });

  it("toggles zoom with keyboard enter and resets with escape", () => {
    const { result } = renderHook(() => useMediaModalImageZoom({ isFocusedImage: true }));
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleModalImageKeyDown({
        key: "Enter",
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLImageElement>);
    });

    expect(result.current.modalImageZoomActive).toBe(true);
    expect(result.current.modalImageZoomScale).toBe(2);
    expect(preventDefault).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleModalImageKeyDown({
        key: "Escape",
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLImageElement>);
    });

    expect(result.current.modalImageZoomActive).toBe(false);
    expect(result.current.modalImageZoomScale).toBe(1);
    expect(result.current.modalImagePan).toEqual({ x: 0, y: 0 });
  });

  it("supports pointer pan and releases pointer capture on pointer up", () => {
    const { result } = renderHook(() => useMediaModalImageZoom({ isFocusedImage: true }));
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    const hasPointerCapture = vi.fn(() => true);
    const preventDefault = vi.fn();

    act(() => {
      result.current.modalPreviewRef.current = {
        clientWidth: 200,
        clientHeight: 200,
        getBoundingClientRect: () => ({
          left: 10,
          top: 20,
          width: 200,
          height: 200,
          right: 210,
          bottom: 220,
          x: 10,
          y: 20,
          toJSON: () => ({}),
        }),
      } as unknown as HTMLDivElement;
      result.current.cacheModalImageNaturalSize(1000, 1000);
      result.current.handleModalImageKeyDown({
        key: "Enter",
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLImageElement>);
    });

    act(() => {
      result.current.handleModalImagePointerDown({
        pointerId: 7,
        clientX: 20,
        clientY: 30,
        button: 0,
        preventDefault,
        currentTarget: {
          setPointerCapture,
        },
      } as unknown as React.PointerEvent<HTMLImageElement>);
    });

    expect(result.current.isModalImagePanning).toBe(true);
    expect(setPointerCapture).toHaveBeenCalledWith(7);

    act(() => {
      result.current.handleModalImagePointerMove({
        pointerId: 7,
        clientX: 50,
        clientY: 45,
      } as unknown as React.PointerEvent<HTMLImageElement>);
    });

    expect(result.current.modalImagePan.x).not.toBe(0);

    act(() => {
      result.current.handleModalImagePointerUp({
        pointerId: 7,
        currentTarget: {
          hasPointerCapture,
          releasePointerCapture,
        },
      } as unknown as React.PointerEvent<HTMLImageElement>);
    });

    expect(result.current.isModalImagePanning).toBe(false);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("does not consume Escape when zoom mode is inactive", () => {
    const { result } = renderHook(() => useMediaModalImageZoom({ isFocusedImage: true }));
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleModalImageKeyDown({
        key: "Escape",
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLImageElement>);
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(result.current.modalImageZoomActive).toBe(false);
    expect(result.current.modalImageZoomScale).toBe(1);
  });
});
