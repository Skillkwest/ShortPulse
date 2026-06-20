import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CanvasHarness,
  createTransfer,
  mockViewportRect,
  SeededCanvasHarness,
} from "./canvasTestHarness";

describe("Canvas text behavior", () => {
  it("pins a text reference to the grid via the pin button", async () => {
    const pinSpy = vi.fn();
    render(<CanvasHarness onPinTextReference={pinSpy} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.doubleClick(viewport, {
      clientX: 280,
      clientY: 180,
    });

    const input = screen.getByTestId("canvas-draft-text-input");
    fireEvent.change(input, {
      target: { value: "Pin this prompt" },
    });
    fireEvent.keyDown(input, {
      key: "Enter",
    });

    const pinButton = await screen.findByLabelText("Pin text reference to reference grid");
    fireEvent.pointerDown(pinButton, {
      button: 0,
      pointerId: 401,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerUp(pinButton, {
      pointerId: 401,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.click(pinButton);

    expect(pinSpy).toHaveBeenCalledWith("Pin this prompt");
  });

  it("creates a manual text reference on blank-space double click and saves it on Enter", () => {
    const pinSpy = vi.fn();
    render(<CanvasHarness onPinTextReference={pinSpy} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.doubleClick(viewport, {
      clientX: 280,
      clientY: 180,
    });

    const input = screen.getByTestId("canvas-draft-text-input");
    fireEvent.change(input, {
      target: { value: "Manual canvas note" },
    });
    fireEvent.keyDown(input, {
      key: "Enter",
    });

    expect(screen.getByText("Manual canvas note")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-draft-text-input")).not.toBeInTheDocument();
    expect(pinSpy).toHaveBeenCalledTimes(1);
    expect(pinSpy).toHaveBeenCalledWith("Manual canvas note");
  });

  it("pins pasted manual text into the reference grid when the canvas draft is committed", async () => {
    const pinSpy = vi.fn();
    render(<CanvasHarness onPinTextReference={pinSpy} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.doubleClick(viewport, {
      clientX: 300,
      clientY: 190,
    });

    const input = screen.getByTestId("canvas-draft-text-input");
    const pasteEvent = createEvent.paste(input);
    Object.defineProperty(pasteEvent, "clipboardData", {
      configurable: true,
      value: {
        getData: (type: string) =>
          type === "text/plain" ? "  Pasted outside prompt reference  " : "",
      },
    });
    fireEvent(input, pasteEvent);

    const canvasText = await screen.findByText("Pasted outside prompt reference");
    expect(canvasText).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-draft-text-input")).not.toBeInTheDocument();
    expect(pinSpy).toHaveBeenCalledTimes(1);
    expect(pinSpy).toHaveBeenCalledWith("Pasted outside prompt reference");
  });

  it("creates a manual text reference from viewport pointer double-tap fallback", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.pointerDown(viewport, {
      button: 0,
      pointerId: 51,
      clientX: 280,
      clientY: 180,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 51,
      clientX: 280,
      clientY: 180,
    });
    fireEvent.pointerDown(viewport, {
      button: 0,
      pointerId: 52,
      clientX: 283,
      clientY: 181,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 52,
      clientX: 283,
      clientY: 181,
    });

    expect(screen.getByTestId("canvas-draft-text-input")).toBeInTheDocument();
  });

  it("creates a manual text reference from pointer double-click detail fallback", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.pointerDown(viewport, {
      button: 0,
      detail: 2,
      pointerId: 61,
      clientX: 290,
      clientY: 190,
    });

    expect(screen.getByTestId("canvas-draft-text-input")).toBeInTheDocument();
  });

  it("does not create a manual text reference when a double-click detail event comes from an existing item", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Existing note",
      }),
      clientX: 260,
      clientY: 170,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    fireEvent.click(item, {
      button: 0,
      detail: 2,
      clientX: 260,
      clientY: 170,
    });

    expect(screen.queryByTestId("canvas-draft-text-input")).toBeNull();
  });

  it("dedupes detail fallback and native dblclick into a single draft", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.pointerDown(viewport, {
      button: 0,
      detail: 2,
      pointerId: 62,
      clientX: 292,
      clientY: 192,
    });
    fireEvent.doubleClick(viewport, {
      clientX: 292,
      clientY: 192,
    });

    expect(screen.getAllByTestId("canvas-draft-text-input")).toHaveLength(1);
  });

  it("edits a text reference in place on double click and saves on blur", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Original note",
      }),
      clientX: 260,
      clientY: 170,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    fireEvent.doubleClick(item);

    const input = screen.getByTestId("canvas-text-edit-input");
    fireEvent.change(input, {
      target: { value: "Edited note" },
    });
    fireEvent.blur(input);

    expect(screen.getByText("Edited note")).toBeInTheDocument();
    expect(screen.queryByText("Original note")).not.toBeInTheDocument();
    expect(screen.queryByTestId("canvas-text-edit-input")).not.toBeInTheDocument();
  });

  it("keeps Enter as a newline while editing a canvas text reference", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Original note",
      }),
      clientX: 260,
      clientY: 170,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    fireEvent.doubleClick(item);

    const input = screen.getByTestId("canvas-text-edit-input") as HTMLTextAreaElement;
    fireEvent.change(input, {
      target: { value: "Edited\nnote" },
    });
    fireEvent.keyDown(input, {
      key: "Enter",
    });

    expect(input).toHaveValue("Edited\nnote");
    expect(screen.getByTestId("canvas-text-edit-input")).toBeInTheDocument();

    fireEvent.blur(input);
    expect((item as HTMLElement).textContent).toContain("Edited\nnote");
  });

  it("keeps the text edit caret at the insertion point while typing in the middle", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Original note",
      }),
      clientX: 260,
      clientY: 170,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    fireEvent.doubleClick(item);

    const input = screen.getByTestId("canvas-text-edit-input") as HTMLTextAreaElement;
    input.focus();
    input.setSelectionRange("Original ".length, "Original ".length);

    const nextValue = "Original middle note";
    const nextCaret = "Original middle".length;
    fireEvent.change(input, {
      target: {
        value: nextValue,
        selectionStart: nextCaret,
        selectionEnd: nextCaret,
        selectionDirection: "none",
      },
    });

    await waitFor(() => expect(input).toHaveValue(nextValue));
    expect(input.selectionStart).toBe(nextCaret);
    expect(input.selectionEnd).toBe(nextCaret);
  });

  it("renders resize handles for a selected text item and hides them while editing", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Resizable note",
      }),
      clientX: 260,
      clientY: 170,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    expect(screen.getByTestId("canvas-text-resize-handle-ne")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-text-resize-handle-sw")).toBeInTheDocument();

    fireEvent.doubleClick(item);

    expect(screen.getByTestId("canvas-text-edit-input")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-text-resize-handle-ne")).not.toBeInTheDocument();
    expect(screen.queryByTestId("canvas-text-resize-handle-sw")).not.toBeInTheDocument();
  });

  it("resizes a text reference freeform from the southeast handle without moving its top-left corner", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Resize east",
      }),
      clientX: 260,
      clientY: 170,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const startX = Number(item.getAttribute("data-x"));
    const startY = Number(item.getAttribute("data-y"));
    const startWidth = Number(item.getAttribute("data-width"));
    const startHeight = Number(item.getAttribute("data-height"));
    const handle = screen.getByTestId("canvas-text-resize-handle-se");

    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 701,
      clientX: 390,
      clientY: 230,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 701,
      clientX: 470,
      clientY: 290,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 701,
      clientX: 470,
      clientY: 290,
    });

    expect(Number(item.getAttribute("data-width"))).toBeGreaterThan(startWidth);
    expect(Number(item.getAttribute("data-height"))).toBeGreaterThan(startHeight);
    expect(Number(item.getAttribute("data-x"))).toBe(startX);
    expect(Number(item.getAttribute("data-y"))).toBe(startY);
  });

  it("resizes a text reference freeform from the northwest handle and shifts its top-left corner", async () => {
    render(
      <SeededCanvasHarness
        initialSessionState={{
          items: [
            {
              id: "text-freeform",
              kind: "text",
              x: 130,
              y: 90,
              z: 1,
              selected: true,
              outputId: null,
              sourceSurface: null,
              text: "Resize west",
              width: 260,
              height: 180,
            },
          ],
          draftTextEntry: null,
          textEditSession: null,
          draftOwnerInstanceId: null,
          textEditOwnerInstanceId: null,
          mainCamera: { x: 0, y: 0, zoom: 1 },
          railCamera: { x: 0, y: 0, zoom: 1 },
        }}
      />
    );
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    const item = await screen.findByTestId("canvas-item-text-freeform");
    const startX = Number(item.getAttribute("data-x"));
    const startY = Number(item.getAttribute("data-y"));
    const startWidth = Number(item.getAttribute("data-width"));
    const startHeight = Number(item.getAttribute("data-height"));
    const handle = screen.getByTestId("canvas-text-resize-handle-nw");

    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 702,
      clientX: 130,
      clientY: 110,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 702,
      clientX: 180,
      clientY: 150,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 702,
      clientX: 180,
      clientY: 150,
    });

    expect(Number(item.getAttribute("data-width"))).toBeLessThan(startWidth);
    expect(Number(item.getAttribute("data-height"))).toBeLessThan(startHeight);
    expect(Number(item.getAttribute("data-x"))).toBeGreaterThan(startX);
    expect(Number(item.getAttribute("data-y"))).toBeGreaterThan(startY);
  });

  it("does not rewrite selection on other canvas items when a text resize starts", async () => {
    render(
      <SeededCanvasHarness
        initialSessionState={{
          items: [
            {
              id: "text-1",
              kind: "text",
              x: 120,
              y: 80,
              z: 2,
              selected: true,
              outputId: null,
              sourceSurface: null,
              text: "Resizable note",
              width: 260,
              height: 160,
            },
            {
              id: "audio-1",
              kind: "audio",
              x: 420,
              y: 140,
              z: 3,
              selected: true,
              outputId: null,
              sourceSurface: null,
              mediaId: "media-audio-1",
              audioUrl: "https://example.com/reference-audio.mp3",
              title: "Reference audio",
              durationMs: 4_500,
              waveformPeaks: [20, 40, 60, 45, 30],
              width: 160,
              height: 200,
            },
          ],
          draftTextEntry: null,
          textEditSession: null,
          draftOwnerInstanceId: null,
          textEditOwnerInstanceId: null,
          mainCamera: { x: 0, y: 0, zoom: 1 },
          railCamera: { x: 0, y: 0, zoom: 1 },
        }}
      />
    );
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    const textItem = await screen.findByTestId("canvas-item-text-1");
    const audioItem = screen.getByTestId("canvas-item-audio-1");
    const audioStartX = audioItem.getAttribute("data-x");
    const audioStartY = audioItem.getAttribute("data-y");
    expect(textItem.getAttribute("data-selected")).toBe("true");
    expect(audioItem.getAttribute("data-selected")).toBe("true");

    const handle = screen.getByTestId("canvas-text-resize-handle-ne");
    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 703,
      clientX: 380,
      clientY: 90,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 703,
      clientX: 430,
      clientY: 90,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 703,
      clientX: 430,
      clientY: 90,
    });

    expect(textItem.getAttribute("data-selected")).toBe("true");
    expect(audioItem.getAttribute("data-selected")).toBe("true");
    expect(audioItem.getAttribute("data-x")).toBe(audioStartX);
    expect(audioItem.getAttribute("data-y")).toBe(audioStartY);
  });

  it("deletes a reference when right-clicking the canvas item", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Context menu note",
      }),
      clientX: 240,
      clientY: 150,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    fireEvent.contextMenu(item);

    await waitFor(() => {
      expect(screen.queryByTestId(/canvas-item-/)).not.toBeInTheDocument();
      expect(screen.queryByText("Context menu note")).not.toBeInTheDocument();
    });
  });
});
