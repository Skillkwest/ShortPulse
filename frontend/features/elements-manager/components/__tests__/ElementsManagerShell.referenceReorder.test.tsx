import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
    setData: vi.fn((type: string, value: string) => {
      values.set(type, value);
    }),
  } as unknown as DataTransfer;
};

const renderShell = (overrides: Record<string, unknown> = {}) => {
  const updateDraftField = vi.fn();
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
    clearActiveImageReferenceAtIndex: vi.fn(),
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
  return { updateDraftField };
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
});
