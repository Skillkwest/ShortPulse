import { act, renderHook } from "@testing-library/react";
import type { DragEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  useAiStudioShellDndController,
  type ShellDropPayload,
} from "../useAiStudioShellDndController";

const createDragEvent = (transfer: DataTransfer, overrides: Partial<DragEvent<HTMLElement>> = {}) =>
  ({
    dataTransfer: transfer,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: document.createElement("div"),
    clientX: 10,
    clientY: 10,
    ...overrides,
  }) as unknown as DragEvent<HTMLElement>;

const createTransfer = (types: string[] = [], files: File[] = []) =>
  ({
    types,
    files: {
      ...files,
      length: files.length,
      item: (index: number) => files[index] ?? null,
    } as unknown as FileList,
    getData: vi.fn((type: string) => (type === "text/reference-id" ? "" : "")),
  }) as unknown as DataTransfer;

describe("useAiStudioShellDndController", () => {
  it("commits drop mode changes only after RAF when backpressure is enabled", () => {
    vi.useFakeTimers();
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(
        (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number
      );
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((id: number) => clearTimeout(id));

    const shellRef = { current: document.createElement("section") };
    const rightRef = { current: document.createElement("div") };
    shellRef.current.appendChild(rightRef.current);
    vi.spyOn(shellRef.current, "getBoundingClientRect").mockReturnValue({
      top: 0,
      right: 400,
      bottom: 400,
      left: 0,
      width: 400,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(rightRef.current, "getBoundingClientRect").mockReturnValue({
      top: 0,
      right: 400,
      bottom: 400,
      left: 200,
      width: 200,
      height: 400,
      x: 200,
      y: 0,
      toJSON: () => ({}),
    });

    const { result } = renderHook(() =>
      useAiStudioShellDndController({
        shellRef,
        rightColumnRef: rightRef,
        resolveDropMode: () => "text",
        resolveDropPayload: () => ({ kind: "none" }),
        onDropFiles: vi.fn(),
        useRafBackpressure: true,
      })
    );

    act(() => {
      result.current.handleDragOverCapture(createDragEvent(createTransfer(["text/plain"])));
    });
    expect(result.current.dropMode).toBe("none");

    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(result.current.dropMode).toBe("text");

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    vi.useRealTimers();
  });

  it("routes payload handlers by payload kind", () => {
    const onDropFiles = vi.fn();
    const onDropMediaReference = vi.fn();
    const onDropLibraryMediaReference = vi.fn();
    const onDropLibraryPromptReference = vi.fn();
    const onDropTextReference = vi.fn();
    const shellRef = { current: document.createElement("section") };
    const rightRef = { current: document.createElement("div") };

    const payloadRef: { current: ShellDropPayload } = {
      current: { kind: "none" },
    };
    const { result } = renderHook(() =>
      useAiStudioShellDndController({
        shellRef,
        rightColumnRef: rightRef,
        resolveDropMode: () => "media",
        resolveDropPayload: () => payloadRef.current,
        onDropFiles,
        onDropMediaReference,
        onDropLibraryMediaReference,
        onDropLibraryPromptReference,
        onDropTextReference,
        useRafBackpressure: false,
      })
    );

    const files = [new File(["x"], "ref.png", { type: "image/png" })];
    payloadRef.current = {
      kind: "files",
      files: {
        ...files,
        length: files.length,
        item: (index: number) => files[index] ?? null,
      } as unknown as FileList,
    };
    act(() => {
      result.current.handleDropCapture(createDragEvent(createTransfer(["Files"], files)));
    });
    expect(onDropFiles).toHaveBeenCalledTimes(1);

    payloadRef.current = { kind: "media", reference: { url: "https://example.com/a.png" } };
    act(() => {
      result.current.handleDropCapture(createDragEvent(createTransfer(["text/plain"])));
    });
    expect(onDropMediaReference).toHaveBeenCalledWith({ url: "https://example.com/a.png" });

    payloadRef.current = {
      kind: "libraryMedia",
      payload: {
        id: "media-1",
        url: "https://example.com/media-1.png",
        fileType: "image",
      },
    };
    act(() => {
      result.current.handleDropCapture(createDragEvent(createTransfer(["text/plain"])));
    });
    expect(onDropLibraryMediaReference).toHaveBeenCalledWith({
      id: "media-1",
      url: "https://example.com/media-1.png",
      fileType: "image",
    });

    payloadRef.current = {
      kind: "libraryPrompt",
      payload: {
        id: "prompt-1",
        promptText: "prompt text",
        title: "Prompt title",
      },
    };
    act(() => {
      result.current.handleDropCapture(createDragEvent(createTransfer(["text/plain"])));
    });
    expect(onDropLibraryPromptReference).toHaveBeenCalledWith({
      id: "prompt-1",
      promptText: "prompt text",
      title: "Prompt title",
    });

    payloadRef.current = { kind: "text", text: "hello" };
    act(() => {
      result.current.handleDropCapture(createDragEvent(createTransfer(["text/plain"])));
    });
    expect(onDropTextReference).toHaveBeenCalledWith("hello");
  });

  it("caches shell fallback bounds across repeated dragovers until drop state clears", () => {
    const shellRef = { current: document.createElement("section") };
    const rightRef = { current: document.createElement("div") };
    shellRef.current.appendChild(rightRef.current);
    const shellRectSpy = vi.spyOn(shellRef.current, "getBoundingClientRect").mockReturnValue({
      top: 0,
      right: 400,
      bottom: 400,
      left: 0,
      width: 400,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const rightRectSpy = vi.spyOn(rightRef.current, "getBoundingClientRect").mockReturnValue({
      top: 0,
      right: 400,
      bottom: 400,
      left: 200,
      width: 200,
      height: 400,
      x: 200,
      y: 0,
      toJSON: () => ({}),
    });

    const { result } = renderHook(() =>
      useAiStudioShellDndController({
        shellRef,
        rightColumnRef: rightRef,
        resolveDropMode: () => "text",
        resolveDropPayload: () => ({ kind: "none" }),
        onDropFiles: vi.fn(),
        useRafBackpressure: false,
      })
    );

    act(() => {
      result.current.handleShellDragOverCapture(
        createDragEvent(createTransfer(["text/plain"]), {
          target: shellRef.current,
          clientX: 250,
          clientY: 40,
        })
      );
      result.current.handleShellDragOverCapture(
        createDragEvent(createTransfer(["text/plain"]), {
          target: shellRef.current,
          clientX: 250,
          clientY: 80,
        })
      );
    });

    expect(shellRectSpy).toHaveBeenCalledTimes(1);
    expect(rightRectSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleDropCapture(createDragEvent(createTransfer(["text/plain"])));
      result.current.handleShellDragOverCapture(
        createDragEvent(createTransfer(["text/plain"]), {
          target: shellRef.current,
          clientX: 250,
          clientY: 120,
        })
      );
    });

    expect(shellRectSpy).toHaveBeenCalledTimes(2);
    expect(rightRectSpy).toHaveBeenCalledTimes(2);
  });

  it("routes shell fallback text drops into the right-column prompt handler", () => {
    const shellRef = { current: document.createElement("section") };
    const rightRef = { current: document.createElement("div") };
    shellRef.current.appendChild(rightRef.current);
    vi.spyOn(shellRef.current, "getBoundingClientRect").mockReturnValue({
      top: 0,
      right: 400,
      bottom: 400,
      left: 0,
      width: 400,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(rightRef.current, "getBoundingClientRect").mockReturnValue({
      top: 0,
      right: 400,
      bottom: 400,
      left: 200,
      width: 200,
      height: 400,
      x: 200,
      y: 0,
      toJSON: () => ({}),
    });
    const onDropTextReference = vi.fn();
    const payloadRef: { current: ShellDropPayload } = {
      current: { kind: "text", text: "dragged chat history prompt" },
    };

    const { result } = renderHook(() =>
      useAiStudioShellDndController({
        shellRef,
        rightColumnRef: rightRef,
        resolveDropMode: () => "text",
        resolveDropPayload: () => payloadRef.current,
        onDropFiles: vi.fn(),
        onDropTextReference,
        useRafBackpressure: false,
      })
    );

    const dragEvent = createDragEvent(createTransfer(["text/plain"]), {
      target: shellRef.current,
      clientX: 250,
      clientY: 80,
    });

    act(() => {
      result.current.handleShellDropCapture(dragEvent);
    });

    expect(dragEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(dragEvent.stopPropagation).toHaveBeenCalledTimes(1);
    expect(onDropTextReference).toHaveBeenCalledWith("dragged chat history prompt");
  });
});
