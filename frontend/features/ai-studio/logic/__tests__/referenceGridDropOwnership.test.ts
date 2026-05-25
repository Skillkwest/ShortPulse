import { describe, expect, it, vi } from "vitest";
import {
  doesReferenceGridOwnFileDrop,
  REFERENCE_GRID_FILE_DROP_SURFACE_SELECTOR,
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

describe("referenceGridDropOwnership", () => {
  it("owns drops whose target is inside the All Refs surface", () => {
    const root = document.createElement("div");
    const surface = document.createElement("div");
    surface.setAttribute("data-reference-grid-drop-surface", "all-refs");
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
    surface.setAttribute("data-reference-grid-drop-surface", "all-refs");
    root.append(surface, overlay);
    mockRect(surface, { left: 200, right: 400, top: 100, bottom: 300 });

    expect(
      doesReferenceGridOwnFileDrop({ target: overlay, clientX: 250, clientY: 150 }, root)
    ).toBe(true);
  });

  it("rejects drops on Quick Slot or blank rail space outside All Refs", () => {
    const root = document.createElement("div");
    const quickSlot = document.createElement("div");
    quickSlot.className = "reference-curated-section";
    const surface = document.createElement("div");
    surface.setAttribute("data-reference-grid-drop-surface", "all-refs");
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
});
