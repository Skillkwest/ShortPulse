/**
 * Curated split-grid interaction tests for ReferenceCanvas.
 * Validates add/dedupe/reorder/remove behavior and curated drop rejection rules.
 */
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceCanvas, type ReferenceCanvasProps } from "../ReferenceCanvas";
import type { StudioOutput } from "../../types";

class MockResizeObserver {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

class MockIntersectionObserver {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

const outputs: StudioOutput[] = [
  {
    id: "out-1",
    prompt: "One",
    mode: "image",
    aspect: "1:1",
    model: "Model",
    status: "ready",
    timestamp: "Now",
    previewUrl: "https://example.com/one.png",
  },
  {
    id: "out-2",
    prompt: "Two",
    mode: "image",
    aspect: "1:1",
    model: "Model",
    status: "ready",
    timestamp: "Now",
    previewUrl: "https://example.com/two.png",
  },
];

const makeTransfer = (data: Record<string, string>): DataTransfer =>
  ({
    files: { length: 0, item: () => null } as unknown as FileList,
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? "",
  }) as unknown as DataTransfer;

const createProps = (overrides: Partial<ReferenceCanvasProps> = {}): ReferenceCanvasProps => ({
  outputs,
  activeOutputId: "out-1",
  selectedTool: "image",
  onSelectOutput: vi.fn(),
  onOpenDetails: vi.fn(),
  curatedReferenceIds: [],
  onAddCuratedReference: vi.fn(),
  onRemoveCuratedReference: vi.fn(),
  onReorderCuratedReference: vi.fn(),
  onPasteTextReference: vi.fn(),
  ...overrides,
});

describe("ReferenceCanvas curated split", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    if (!window.matchMedia) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds curated refs from all-refs internal drags", () => {
    const onAddCuratedReference = vi.fn();
    const onSelectOutput = vi.fn();
    const { container } = render(
      <ReferenceCanvas
        {...createProps({
          onAddCuratedReference,
          onSelectOutput,
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();

    fireEvent.drop(curatedSection, {
      dataTransfer: makeTransfer({
        "text/reference-id": "out-2",
        "text/reference-source-surface": "all-refs",
      }),
    });

    expect(onAddCuratedReference).toHaveBeenCalledWith("out-2");
    expect(onSelectOutput).toHaveBeenCalledWith("out-2");
  });

  it("dedupes duplicate curated drops from all-refs and keeps focus", () => {
    const onAddCuratedReference = vi.fn();
    const onSelectOutput = vi.fn();
    const { container } = render(
      <ReferenceCanvas
        {...createProps({
          curatedReferenceIds: ["out-2"],
          onAddCuratedReference,
          onSelectOutput,
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();

    fireEvent.drop(curatedSection, {
      dataTransfer: makeTransfer({
        "text/reference-id": "out-2",
        "text/reference-source-surface": "all-refs",
      }),
    });

    expect(onAddCuratedReference).not.toHaveBeenCalled();
    expect(onSelectOutput).toHaveBeenCalledWith("out-2");
  });

  it("reorders curated refs on internal curated drops", () => {
    const onReorderCuratedReference = vi.fn();
    const { container } = render(
      <ReferenceCanvas
        {...createProps({
          curatedReferenceIds: ["out-1", "out-2"],
          onReorderCuratedReference,
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const targetCard = curatedSection.querySelector(".reference-card") as HTMLElement;
    expect(targetCard).toBeTruthy();
    Object.defineProperty(targetCard, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        toJSON: () => ({}),
      }),
    });

    fireEvent.drop(targetCard, {
      clientY: 10,
      dataTransfer: makeTransfer({
        "text/reference-id": "out-2",
        "text/reference-source-surface": "curated",
      }),
    });

    expect(onReorderCuratedReference).toHaveBeenCalledWith("out-2", "out-1", "after");
  });

  it("removes curated items with the explicit action button", () => {
    const onRemoveCuratedReference = vi.fn();
    const { getByLabelText } = render(
      <ReferenceCanvas
        {...createProps({
          curatedReferenceIds: ["out-1"],
          onRemoveCuratedReference,
        })}
      />
    );

    fireEvent.click(getByLabelText("Remove from curated"));

    expect(onRemoveCuratedReference).toHaveBeenCalledWith("out-1");
  });

  it("rejects non-internal drops in curated section", () => {
    const onAddCuratedReference = vi.fn();
    const onReorderCuratedReference = vi.fn();
    const onPasteTextReference = vi.fn();
    const { container } = render(
      <ReferenceCanvas
        {...createProps({
          onAddCuratedReference,
          onReorderCuratedReference,
          onPasteTextReference,
        })}
      />
    );
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();

    fireEvent.drop(curatedSection, {
      dataTransfer: makeTransfer({
        "text/plain": "dropped text payload",
      }),
    });

    expect(onAddCuratedReference).not.toHaveBeenCalled();
    expect(onReorderCuratedReference).not.toHaveBeenCalled();
    expect(onPasteTextReference).not.toHaveBeenCalled();
  });

  it("snaps split toward inventory when clicking the divider pill", () => {
    const { container, getByRole, getByText } = render(<ReferenceCanvas {...createProps()} />);
    const divider = getByRole("separator", {
      name: "Resize Quick Slot Inventory and Reference Grid sections",
    });
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const allRefsSection = container.querySelector(".reference-all-refs-section") as HTMLElement;
    expect(allRefsSection).toBeTruthy();
    const panel = container.querySelector(".reference-canvas-panel") as HTMLElement;
    expect(panel).toBeTruthy();
    Object.defineProperty(panel, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 600,
        height: 600,
        right: 600,
        bottom: 600,
        toJSON: () => ({}),
      }),
    });
    expect(divider).toHaveAttribute("aria-valuenow", "35");

    fireEvent.pointerDown(getByText("Inventory ↓"));
    fireEvent.click(getByText("Inventory ↓"));

    expect(divider).toHaveAttribute("aria-valuenow", "88");
    expect(curatedSection.classList.contains("is-all-refs-expanded")).toBe(false);
    expect(allRefsSection.classList.contains("is-inventory-expanded")).toBe(true);
  });

  it("snaps split toward all refs when clicking the all-refs divider pill", () => {
    const { container, getByRole, getByText } = render(<ReferenceCanvas {...createProps()} />);
    const divider = getByRole("separator", {
      name: "Resize Quick Slot Inventory and Reference Grid sections",
    });
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const allRefsSection = container.querySelector(".reference-all-refs-section") as HTMLElement;
    expect(allRefsSection).toBeTruthy();
    const panel = container.querySelector(".reference-canvas-panel") as HTMLElement;
    expect(panel).toBeTruthy();
    Object.defineProperty(panel, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 600,
        height: 600,
        right: 600,
        bottom: 600,
        toJSON: () => ({}),
      }),
    });
    const curatedHeader = container.querySelector(".reference-curated-header") as HTMLElement;
    expect(curatedHeader).toBeTruthy();
    Object.defineProperty(curatedHeader, "offsetHeight", {
      configurable: true,
      value: 44,
    });
    expect(divider).toHaveAttribute("aria-valuenow", "35");

    fireEvent.pointerDown(getByText("All Refs ↑"));
    fireEvent.click(getByText("All Refs ↑"));

    expect(divider).toHaveAttribute("aria-valuenow", "7");
    expect(curatedSection.classList.contains("is-all-refs-expanded")).toBe(true);
    expect(allRefsSection.classList.contains("is-inventory-expanded")).toBe(false);
  });

  it("collapses quick slots when resizing to the top bound", () => {
    const { container, getByRole } = render(<ReferenceCanvas {...createProps()} />);
    const divider = getByRole("separator", {
      name: "Resize Quick Slot Inventory and Reference Grid sections",
    });
    const curatedSection = container.querySelector(".reference-curated-section") as HTMLElement;
    expect(curatedSection).toBeTruthy();
    const panel = container.querySelector(".reference-canvas-panel") as HTMLElement;
    expect(panel).toBeTruthy();
    Object.defineProperty(panel, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 600,
        height: 600,
        right: 600,
        bottom: 600,
        toJSON: () => ({}),
      }),
    });

    fireEvent.keyDown(divider, { key: "Home" });

    expect(curatedSection.classList.contains("is-all-refs-expanded")).toBe(true);
  });
});
