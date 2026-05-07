import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { CharacterQuickSwapDeckSection } from "../CharacterQuickSwapDeckSection";
import type { CharacterQuickSwapItem } from "../../types";

const createQuickSwapItems = (
  count: number,
  status: "active" | "archived"
): CharacterQuickSwapItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${status}-${index + 1}`,
    characterMediaId: `media-${status}-${index + 1}`,
    storagePath: `user-1/characters/char-1/quickswap/${status}-${index + 1}.png`,
    previewUrl: `https://example.com/${status}-${index + 1}.png`,
    status,
    createdAt: new Date(2026, 0, index + 1).toISOString(),
    archivedAt: status === "archived" ? new Date(2026, 1, index + 1).toISOString() : null,
    legacySlotKey: null,
  }));

const readRemoveReferenceIndex = (button: HTMLElement): number => {
  const label = button.getAttribute("aria-label") ?? "";
  const match = label.match(/Remove reference (\d+)/i);
  if (!match) {
    throw new Error(`Missing remove-reference label on button: ${label}`);
  }
  return Number(match[1]);
};

const renderSection = (
  overrides?: Partial<ComponentProps<typeof CharacterQuickSwapDeckSection>>
) => {
  const dragStartHandler = vi.fn();
  const dragEndHandler = vi.fn();
  const onReferenceDragStart = vi.fn(() => dragStartHandler);
  const onLoadMoreArchived = vi.fn();
  const result = render(
    <CharacterQuickSwapDeckSection
      beginnerMode={false}
      isCollapsed={false}
      contentId="quickswap-content"
      pageBusy={false}
      isDropActive={false}
      remainingCapacityHint={100}
      activeItems={createQuickSwapItems(40, "active")}
      archivedItems={createQuickSwapItems(80, "archived")}
      archivedCount={80}
      hasMoreArchived
      loadingArchived={false}
      quickSwapGridColumnCount={3}
      quickSwapArchiveGridColumnCount={4}
      onToggleCollapsed={vi.fn()}
      onOpenUploadPicker={vi.fn()}
      onRemoveItem={vi.fn()}
      onRestoreArchivedItem={vi.fn()}
      onLoadMoreArchived={onLoadMoreArchived}
      onReferenceDragStart={onReferenceDragStart}
      onReferenceDragEnd={dragEndHandler}
      onOpenReferencePreview={vi.fn()}
      resolveCharacterGridPreviewUrl={(url) => url ?? null}
      onDragEnter={vi.fn()}
      onDragOver={vi.fn()}
      onDragLeave={vi.fn()}
      onDrop={vi.fn()}
      {...overrides}
    />
  );
  return {
    ...result,
    dragStartHandler,
    dragEndHandler,
    onReferenceDragStart,
    onLoadMoreArchived,
  };
};

describe("CharacterQuickSwapDeckSection windowing", () => {
  const originalClientWidthDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth"
  );
  const originalClientHeightDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientHeight"
  );

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        if ((this as HTMLElement).classList?.contains("character-quickswap-active-scroll"))
          return 640;
        if ((this as HTMLElement).classList?.contains("character-quickswap-archive-grid"))
          return 720;
        return 220;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        if ((this as HTMLElement).classList?.contains("character-quickswap-active-scroll"))
          return 480;
        if ((this as HTMLElement).classList?.contains("character-quickswap-archive-grid"))
          return 260;
        return 240;
      },
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        private callback: ResizeObserverCallback;

        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
        }

        observe() {
          this.callback([], this as unknown as ResizeObserver);
        }

        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalClientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidthDescriptor);
    }
    if (originalClientHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeightDescriptor);
    }
  });

  it("renders only visible active references when the deck is large", async () => {
    renderSection();

    await waitFor(() => {
      const removeButtons = screen.getAllByRole("button", { name: /Remove reference/i });
      expect(removeButtons.length).toBeLessThan(40);
      expect(removeButtons.length).toBeGreaterThan(0);
    });
  });

  it("keeps absolute remove-label indexing stable while scrolling virtualized rows", async () => {
    const { container } = renderSection();
    const scrollSurface = container.querySelector(
      ".character-quickswap-active-scroll"
    ) as HTMLDivElement;
    scrollSurface.scrollTop = 1600;
    fireEvent.scroll(scrollSurface);

    await waitFor(() => {
      const removeButtons = screen.getAllByRole("button", { name: /Remove reference/i });
      const visibleIndices = removeButtons.map(readRemoveReferenceIndex);
      expect(Math.min(...visibleIndices)).toBeGreaterThan(1);
      expect(screen.queryByRole("button", { name: "Remove reference 1" })).toBeNull();
    });
  });

  it("supports dragging references after scrolling to a later virtual window", async () => {
    const { container, dragStartHandler } = renderSection();
    const scrollSurface = container.querySelector(
      ".character-quickswap-active-scroll"
    ) as HTMLDivElement;
    scrollSurface.scrollTop = 1600;
    fireEvent.scroll(scrollSurface);

    const visibleDeleteButton = await waitFor(() => {
      const removeButtons = screen.getAllByRole("button", { name: /Remove reference/i });
      const firstScrolledButton = removeButtons.find(
        (button) => readRemoveReferenceIndex(button) > 1
      );
      expect(firstScrolledButton).toBeTruthy();
      return firstScrolledButton as HTMLElement;
    });
    const visibleCard = visibleDeleteButton.closest("article");
    if (!visibleCard) {
      throw new Error("Expected visible reference card.");
    }

    fireEvent.dragStart(visibleCard);
    expect(dragStartHandler).toHaveBeenCalledTimes(1);
  });

  it("window-renders archived references when archive panel is opened", async () => {
    const { container } = renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Show Archived (80)" }));

    await waitFor(() => {
      const archivedCards = container.querySelectorAll(".character-quickswap-archive-card");
      expect(archivedCards.length).toBeLessThan(80);
      expect(archivedCards.length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
    });
  });

  it("forwards card image errors to the preview error callback", async () => {
    const onCardPreviewError = vi.fn();
    renderSection({
      activeItems: createQuickSwapItems(2, "active"),
      archivedItems: [],
      archivedCount: 0,
      hasMoreArchived: false,
      onCardPreviewError,
    });

    const firstImage = await screen.findByAltText("Reference 1");
    fireEvent.error(firstImage);

    expect(onCardPreviewError).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "active-1",
        storagePath: "user-1/characters/char-1/quickswap/active-1.png",
      }),
      expect.any(String)
    );
  });
});
