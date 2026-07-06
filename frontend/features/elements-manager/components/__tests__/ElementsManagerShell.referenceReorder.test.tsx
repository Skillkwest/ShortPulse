import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ElementsManagerShell } from "../ElementsManagerShell";

const useElementsManagerViewStateMock = vi.hoisted(() => vi.fn());

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    const { alt, src, ...rest } = props;
    const imageProps = { ...rest };
    delete imageProps.width;
    delete imageProps.height;
    delete imageProps.unoptimized;
    return React.createElement("img", {
      ...imageProps,
      alt: alt ?? "",
      src: String(src),
    });
  },
}));

vi.mock("../../hooks/useElementsManagerViewState", () => ({
  useElementsManagerViewState: useElementsManagerViewStateMock,
}));

const createDataTransfer = () => {
  const values = new Map<string, string>();
  return {
    dropEffect: "",
    effectAllowed: "",
    getData: vi.fn((type: string) => values.get(type) ?? ""),
    setDragImage: vi.fn(),
    setData: vi.fn((type: string, value: string) => {
      values.set(type, value);
    }),
  } as unknown as DataTransfer;
};

const renderShell = (overrides: Record<string, unknown> = {}) => {
  const updateDraftField = vi.fn();
  const clearActiveImageReferenceAtIndex = vi.fn();
  useElementsManagerViewStateMock.mockReturnValue({
    elements: [],
    selectedElementId: null,
    pendingDeleteElementId: null,
    draft: {
      name: "Crown",
      description: "A ceremonial crown.",
      assetType: "image",
      profileImageUrl: null,
      profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
      imageReferenceUrls: [
        "https://example.com/primary.png",
        "https://example.com/secondary.png",
        "",
      ],
      videoReferenceUrl: "",
    },
    error: null,
    loading: false,
    isCreatingElement: false,
    isDeletingElement: false,
    isSwitchingElement: false,
    isSavingElement: false,
    updateDraftField,
    assignActiveVideoReference: vi.fn(),
    clearActiveImageReferenceAtIndex,
    clearActiveVideoReference: vi.fn(),
    onHandleImageReferenceTransferAtIndex: vi.fn(),
    onCreateElement: vi.fn(),
    onSaveElement: vi.fn(),
    onSelectElement: vi.fn(),
    onRequestDeleteElement: vi.fn(),
    onCancelDeleteElement: vi.fn(),
    onConfirmDeleteElement: vi.fn(),
    ...overrides,
  });

  render(<ElementsManagerShell />);
  return { updateDraftField, clearActiveImageReferenceAtIndex };
};

const getReferenceCard = (altText: string): HTMLElement => {
  const media = screen.getByAltText(altText);
  const card = media.closest("article");
  expect(card).not.toBeNull();
  return card as HTMLElement;
};

describe("ElementsManagerShell reference reordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("swaps image references when a filled slot is dropped onto another filled slot", () => {
    const { updateDraftField } = renderShell();
    const transfer = createDataTransfer();

    fireEvent.dragStart(getReferenceCard("Primary View reference"), { dataTransfer: transfer });
    fireEvent.drop(getReferenceCard("Secondary View reference"), { dataTransfer: transfer });

    expect(updateDraftField).toHaveBeenCalledWith("imageReferenceUrls", [
      "https://example.com/secondary.png",
      "https://example.com/primary.png",
      "",
    ]);
  });

  it("uses a custom lightweight drag image and keeps the media from competing as a native drag source", () => {
    renderShell();
    const transfer = createDataTransfer();
    const primaryMedia = screen.getByAltText("Primary View reference");
    const primaryCard = getReferenceCard("Primary View reference");

    expect(primaryMedia).toHaveAttribute("draggable", "false");

    fireEvent.dragStart(primaryCard, { dataTransfer: transfer });

    expect(transfer.setDragImage).toHaveBeenCalledTimes(1);
    expect(primaryCard).toHaveClass("is-dragging");
    expect(document.querySelector(".elements-reference-drag-ghost")).not.toBeNull();

    fireEvent.dragEnd(primaryCard, { dataTransfer: transfer });

    expect(primaryCard).not.toHaveClass("is-dragging");
    expect(document.querySelector(".elements-reference-drag-ghost")).toBeNull();
  });

  it("moves an image reference into an empty slot through the same draft path", () => {
    const { updateDraftField } = renderShell();
    const transfer = createDataTransfer();

    fireEvent.dragStart(getReferenceCard("Primary View reference"), { dataTransfer: transfer });
    fireEvent.drop(screen.getByText("Detail View").closest("article") as HTMLElement, {
      dataTransfer: transfer,
    });

    expect(updateDraftField).toHaveBeenCalledWith("imageReferenceUrls", [
      "",
      "https://example.com/secondary.png",
      "https://example.com/primary.png",
    ]);
  });

  it("opens a populated image reference slot in the shared detail modal on double click", async () => {
    renderShell();

    fireEvent.doubleClick(getReferenceCard("Primary View reference"));

    const dialog = await screen.findByRole("dialog", {
      name: "Preview Primary View reference",
    });
    expect(
      within(dialog).getByRole("heading", { name: "Primary View reference" })
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Download")).toBeInTheDocument();
  });

  it("does not open the slot detail modal when double clicking the clear action", () => {
    const { clearActiveImageReferenceAtIndex } = renderShell();

    fireEvent.doubleClick(screen.getByRole("button", { name: "Clear Primary View reference" }));

    expect(clearActiveImageReferenceAtIndex).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Preview Primary View reference" })).toBeNull();
  });

  it("reveals a filled reference clear button when keyboard focus enters the card", () => {
    renderShell();
    const clearButton = screen.getByRole("button", { name: "Clear Primary View reference" });

    expect(clearButton).toHaveStyle({ opacity: "0", pointerEvents: "none" });

    fireEvent.focus(clearButton);

    expect(clearButton).toHaveStyle({ opacity: "1", pointerEvents: "auto" });

    fireEvent.blur(clearButton, { relatedTarget: null });

    expect(clearButton).toHaveStyle({ opacity: "0", pointerEvents: "none" });
  });
});
