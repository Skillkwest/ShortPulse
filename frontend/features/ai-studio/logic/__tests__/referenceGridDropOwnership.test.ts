import { describe, expect, it, vi } from "vitest";
import {
  doesReferenceGridOwnFileDrop,
  REFERENCE_GRID_FILE_DROP_SURFACE_SELECTOR,
  resolveRightRailDropSurface,
  shouldBypassRightRailShellCapture,
} from "../referenceGridDropOwnership";

const mockRect = (element: Element, rect: Partial<DOMRect>) => {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
};

const createTransfer = (entries: Record<string, string>, types?: string[], files: File[] = []) =>
  ({
    types: types ?? Object.keys(entries),
    files: {
      ...files,
      length: files.length,
      item: (index: number) => files[index] ?? null,
    } as unknown as FileList,
    getData: (type: string) => entries[type] ?? "",
  }) as unknown as DataTransfer;

describe("referenceGridDropOwnership", () => {
  it("owns drops whose target is inside the All Refs surface", () => {
    const root = document.createElement("div");
    const surface = document.createElement("div");
    surface.setAttribute("data-right-rail-drop-surface", "all-refs");
    const child = document.createElement("button");
    surface.appendChild(child);
    root.appendChild(surface);

    expect(doesReferenceGridOwnFileDrop({ target: child, clientX: 500, clientY: 500 }, root)).toBe(
      true
    );
  });

  it("owns overlay-targeted drops by coordinates when the point is inside All Refs", () => {
    const root = document.createElement("div");
    const overlay = document.createElement("div");
    const surface = document.createElement("div");
    surface.setAttribute("data-right-rail-drop-surface", "all-refs");
    root.append(surface, overlay);
    mockRect(surface, { left: 200, right: 400, top: 100, bottom: 300 });

    expect(
      doesReferenceGridOwnFileDrop({ target: overlay, clientX: 250, clientY: 150 }, root)
    ).toBe(true);
  });

  it("rejects drops on Quick Slot or blank rail space outside All Refs", () => {
    const root = document.createElement("div");
    const quickSlot = document.createElement("div");
    quickSlot.setAttribute("data-right-rail-drop-surface", "quick-slot");
    const surface = document.createElement("div");
    surface.setAttribute("data-right-rail-drop-surface", "all-refs");
    root.append(quickSlot, surface);
    mockRect(surface, { left: 200, right: 400, top: 300, bottom: 600 });

    expect(
      doesReferenceGridOwnFileDrop({ target: quickSlot, clientX: 250, clientY: 150 }, root)
    ).toBe(false);
    expect(doesReferenceGridOwnFileDrop({ target: root, clientX: 250, clientY: 250 }, root)).toBe(
      false
    );
    expect(root.querySelector(REFERENCE_GRID_FILE_DROP_SURFACE_SELECTOR)).toBe(surface);
  });

  it("resolves canvas and quick-slot surfaces by target or coordinates", () => {
    const root = document.createElement("div");
    const canvas = document.createElement("div");
    const quickSlot = document.createElement("div");
    const overlay = document.createElement("div");
    canvas.setAttribute("data-right-rail-drop-surface", "canvas");
    quickSlot.setAttribute("data-right-rail-drop-surface", "quick-slot");
    root.append(canvas, quickSlot, overlay);
    mockRect(canvas, { left: 100, right: 300, top: 100, bottom: 220 });
    mockRect(quickSlot, { left: 100, right: 300, top: 240, bottom: 420 });

    expect(resolveRightRailDropSurface({ target: canvas, clientX: 120, clientY: 140 }, root)).toBe(
      "canvas"
    );
    expect(resolveRightRailDropSurface({ target: overlay, clientX: 140, clientY: 260 }, root)).toBe(
      "quick-slot"
    );
  });

  it("does not resolve collapsed canvas sections as active drop surfaces", () => {
    const root = document.createElement("div");
    const canvas = document.createElement("div");
    const canvasHeader = document.createElement("div");
    const quickSlot = document.createElement("div");
    const overlay = document.createElement("div");
    canvas.setAttribute("data-right-rail-drop-surface", "canvas");
    canvas.classList.add("is-divider-near-collapsed");
    quickSlot.setAttribute("data-right-rail-drop-surface", "quick-slot");
    canvas.append(canvasHeader);
    root.append(canvas, quickSlot, overlay);
    mockRect(canvas, { left: 100, right: 300, top: 100, bottom: 130 });
    mockRect(quickSlot, { left: 100, right: 300, top: 140, bottom: 420 });

    expect(
      resolveRightRailDropSurface({ target: canvasHeader, clientX: 120, clientY: 115 }, root)
    ).toBe(null);
    expect(resolveRightRailDropSurface({ target: overlay, clientX: 140, clientY: 115 }, root)).toBe(
      null
    );
    expect(resolveRightRailDropSurface({ target: overlay, clientX: 140, clientY: 260 }, root)).toBe(
      "quick-slot"
    );
  });

  it("bypasses shell capture for zero-file external media drags over Canvas", () => {
    const root = document.createElement("div");
    const canvas = document.createElement("div");
    canvas.setAttribute("data-right-rail-drop-surface", "canvas");
    root.append(canvas);

    const transfer = createTransfer(
      {
        "text/uri-list": "https://example.com/external-video.mp4",
        "text/plain": "https://example.com/external-video.mp4",
      },
      ["Files", "text/uri-list", "text/plain"]
    );

    expect(
      shouldBypassRightRailShellCapture(
        {
          target: canvas,
          clientX: 120,
          clientY: 140,
          dataTransfer: transfer,
        },
        root,
        { dropMode: "media" }
      )
    ).toBe(true);
  });

  it("does not bypass shell capture for real desktop files over Canvas", () => {
    const root = document.createElement("div");
    const canvas = document.createElement("div");
    canvas.setAttribute("data-right-rail-drop-surface", "canvas");
    root.append(canvas);

    const file = new File(["video"], "desktop.mp4", { type: "video/mp4" });
    const transfer = createTransfer({}, ["Files"], [file]);

    expect(
      shouldBypassRightRailShellCapture(
        {
          target: canvas,
          clientX: 120,
          clientY: 140,
          dataTransfer: transfer,
        },
        root,
        { dropMode: "media" }
      )
    ).toBe(false);
  });
});
