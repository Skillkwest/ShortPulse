/**
 * AI Studio Elements panel layout tests.
 * Verifies the cloned Character-style Elements shell and manage-mode scroll locking.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ElementsPanel } from "../ElementsPanel";
import { INTERNAL_REFERENCE_DRAG_ORIGIN } from "../../utils/dragDrop";
import type {
  ResolveInternalReferenceDrop,
  ResolvedInternalReferenceSource,
} from "../../logic/referenceSource/internalReferenceSource";
import { uploadImageToStorage } from "../../utils/imageUpload";

const elementsManagerPersistenceMockState = vi.hoisted(() => {
  const referenceSetIds = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;
  const createEmptyReferenceSet = () => ({
    description: "",
    deckReferenceUrls: [] as string[],
    imageReferenceUrls: [] as string[],
    videoReferenceUrl: "",
  });
  const createDefaultElementReferenceSetState = () => ({
    activeSetId: "1" as const,
    tabOrder: ["1"] as const,
    tabLabels: Object.fromEntries(
      referenceSetIds.map((setId) => [
        setId,
        setId === "1" ? "Double click me" : `Reference Set ${setId}`,
      ])
    ) as Record<(typeof referenceSetIds)[number], string>,
    sets: Object.fromEntries(
      referenceSetIds.map((setId) => [
        setId,
        {
          ...createEmptyReferenceSet(),
          assetType: "image" as const,
        },
      ])
    ) as Record<
      (typeof referenceSetIds)[number],
      ReturnType<typeof createEmptyReferenceSet> & { assetType: "image" }
    >,
  });
  const defaultTransform = { zoom: 1, offsetX: 0, offsetY: 0 };
  const seededDeckReferenceUrls = [
    "https://example.com/reference/red-lantern-01.jpg",
    "https://example.com/reference/red-lantern-02.jpg",
  ];
  const seededReferenceSetState = (() => {
    const base = createDefaultElementReferenceSetState();
    return {
      ...base,
      sets: {
        ...base.sets,
        "1": {
          assetType: "image" as const,
          description: "Warm lacquered lantern with a gold frame and soft ember glow.",
          deckReferenceUrls: seededDeckReferenceUrls,
          imageReferenceUrls: seededDeckReferenceUrls,
          videoReferenceUrl: "",
        },
      },
    };
  })();
  const makeSnapshot = (overrides?: Partial<Record<string, unknown>>) => ({
    elementId: "element-red-lantern",
    name: "Red Lantern",
    alias: "redlantern",
    status: "ready" as const,
    profileImageUrl: null as string | null,
    profileImageTransform: defaultTransform,
    updatedAt: "2026-04-06T09:00:00.000Z",
    referenceSetState: seededReferenceSetState,
    ...overrides,
  });
  const initialList = [
    {
      elementId: "element-red-lantern",
      elementName: "Red Lantern",
      elementAlias: "redlantern",
      elementAssetType: "image" as const,
      elementStatus: "ready" as const,
      profileImageUrl: null as string | null,
      profileImageTransform: defaultTransform,
      updatedAt: "2026-04-06T09:00:00.000Z",
    },
  ];
  const initialSnapshots = new Map<string, ReturnType<typeof makeSnapshot>>([
    ["element-red-lantern", makeSnapshot()],
  ]);

  return {
    createDefaultElementReferenceSetState,
    list: [...initialList],
    snapshots: new Map(initialSnapshots),
    reset: () => {
      elementsManagerPersistenceMockState.list = [...initialList];
      elementsManagerPersistenceMockState.snapshots = new Map(initialSnapshots);
    },
  };
});

vi.mock("../../../elements-manager/logic/elementsManagerPersistence", () => ({
  DEFAULT_ELEMENT_NAME: "New Element",
  clearElementProfileImage: vi.fn(async () => undefined),
  createElementDraftRow: vi.fn(async () => {
    const snapshot = {
      elementId: "element-new-element",
      name: "New Element",
      alias: "",
      status: "ready" as const,
      profileImageUrl: null as string | null,
      profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
      updatedAt: "2026-04-07T00:00:00.000Z",
      referenceSetState:
        elementsManagerPersistenceMockState.createDefaultElementReferenceSetState(),
    };
    elementsManagerPersistenceMockState.snapshots.set(snapshot.elementId, snapshot);
    elementsManagerPersistenceMockState.list = [
      {
        elementId: snapshot.elementId,
        elementName: snapshot.name,
        elementAlias: snapshot.alias,
        elementAssetType: "image" as const,
        elementStatus: snapshot.status,
        profileImageUrl: snapshot.profileImageUrl,
        profileImageTransform: snapshot.profileImageTransform,
        updatedAt: snapshot.updatedAt,
      },
      ...elementsManagerPersistenceMockState.list,
    ];
    return { elementId: snapshot.elementId };
  }),
  deleteElementManagerDraft: vi.fn(async ({ elementId }: { elementId: string }) => {
    elementsManagerPersistenceMockState.snapshots.delete(elementId);
    elementsManagerPersistenceMockState.list = elementsManagerPersistenceMockState.list.filter(
      (item) => item.elementId !== elementId
    );
  }),
  fetchElementsManagerList: vi.fn(async () => elementsManagerPersistenceMockState.list),
  loadElementManagerDraftByElementId: vi.fn(async (elementId: string) => {
    const snapshot = elementsManagerPersistenceMockState.snapshots.get(elementId);
    if (!snapshot) {
      throw new Error(`Missing element snapshot: ${elementId}`);
    }
    return snapshot;
  }),
  saveElementManagerDraftSnapshot: vi.fn(async ({ elementId, name, alias, referenceSetState }) => {
    const snapshot = elementsManagerPersistenceMockState.snapshots.get(elementId);
    if (!snapshot) {
      throw new Error(`Missing element snapshot: ${elementId}`);
    }
    const nextSnapshot = {
      ...snapshot,
      name,
      alias,
      referenceSetState,
      updatedAt: "2026-04-07T00:00:00.000Z",
    };
    elementsManagerPersistenceMockState.snapshots.set(elementId, nextSnapshot);
    elementsManagerPersistenceMockState.list = elementsManagerPersistenceMockState.list.map(
      (item) =>
        item.elementId === elementId
          ? {
              ...item,
              elementName: name,
              elementAlias: alias,
              elementAssetType:
                referenceSetState.sets[referenceSetState.activeSetId]?.assetType ??
                item.elementAssetType,
              updatedAt: nextSnapshot.updatedAt,
            }
          : item
    );
    return { updatedAt: nextSnapshot.updatedAt, status: nextSnapshot.status };
  }),
  saveElementProfileImageAdjustments: vi.fn(async ({ transform }) => transform),
  uploadElementProfileImage: vi.fn(async ({ file }) => ({
    profileImageUrl: `blob:${file.name}`,
    profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
  })),
}));

vi.mock("../../utils/imageUpload", () => ({
  uploadImageToStorage: vi.fn(async (url: string) =>
    url.startsWith("blob:") || url.startsWith("data:image/")
      ? "https://example.com/uploaded/internal-drop.png"
      : url
  ),
}));

const createDataTransfer = () => {
  const dataStore = new Map<string, string>();
  return {
    get types() {
      return Array.from(dataStore.keys());
    },
    effectAllowed: "all",
    dropEffect: "move",
    setDragImage: () => undefined,
    setData: (type: string, value: string) => {
      dataStore.set(type, value);
    },
    getData: (type: string) => dataStore.get(type) ?? "",
  };
};

const addInternalReferenceDragPayload = (
  transfer: ReturnType<typeof createDataTransfer>,
  options?: {
    outputId?: string;
    mediaId?: string;
    imageIndex?: number;
    sourceSurface?: "all-refs" | "curated";
    referenceUrl?: string;
  }
) => {
  const outputId = options?.outputId ?? "output-internal-1";
  transfer.setData("text/reference-origin", INTERNAL_REFERENCE_DRAG_ORIGIN);
  transfer.setData("text/reference-version", "1");
  transfer.setData("text/reference-id", outputId);
  transfer.setData("text/reference-output-id", outputId);
  transfer.setData("text/reference-image-index", String(options?.imageIndex ?? 0));
  transfer.setData("text/reference-source-surface", options?.sourceSurface ?? "all-refs");
  if (options?.mediaId) {
    transfer.setData("text/reference-media-id", options.mediaId);
  }
  if (options?.referenceUrl) {
    transfer.setData("text/reference-url", options.referenceUrl);
  }
};

const waitForElementProfileShell = async (timeout = 2000) => {
  await screen.findByRole("heading", { name: "Reference Assets" }, { timeout });
  await screen.findByRole("heading", { name: "Identity and Notes" }, { timeout });
};

const stubProfileImageFetch = () => {
  const fetchMock = vi.fn(async () => {
    const blob = new Blob(["profile-image"], { type: "image/png" });
    return new Response(blob, { status: 200, headers: { "Content-Type": "image/png" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("ElementsPanel layout", () => {
  beforeEach(() => {
    elementsManagerPersistenceMockState.reset();
    vi.mocked(uploadImageToStorage).mockClear();
  });

  it("defaults embedded elements workflow to Manage Elements and keeps layout stable", async () => {
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(<ElementsPanel />));
    });

    expect(
      screen.queryByRole("tablist", { name: "Elements workflow mode" })
    ).not.toBeInTheDocument();

    const regions = Array.from(container!.querySelectorAll("[data-layout-region]"))
      .map((node) => node.getAttribute("data-layout-region"))
      .filter((value): value is string => Boolean(value));
    expect(regions).toEqual([]);
    expect(screen.getByRole("heading", { name: "Elements Library" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Element Deck" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Element Sheet" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create New Element" })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Open element profile: Red Lantern" })
      ).toBeInTheDocument();
    });
  });

  it("opens the profile editor when selecting a library card", async () => {
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const workflowTablist = screen.getByRole("tablist", { name: "Elements workflow mode" });
    const workflowTabs = within(workflowTablist).getAllByRole("tab");
    expect(workflowTabs[0]).toHaveTextContent("Manage Elements");
    expect(workflowTabs[1]).toHaveTextContent("Element Profile");
    expect(screen.getByRole("tab", { name: "Element Profile" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "Element Profile" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("heading", { name: "Red Lantern" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reference Assets" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Identity and Notes" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Red Lantern")).toBeInTheDocument();
    expect(screen.getByDisplayValue("redlantern")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Double click me" })).toBeInTheDocument();
  });

  it("shows a delete confirmation dialog before removing an element reference tab", async () => {
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();
    fireEvent.click(screen.getByRole("button", { name: "Add character sheet preset tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete preset 2" }));

    const deleteDialog = screen.getByRole("dialog", {
      name: "Delete reference set “Reference Set 2”?",
    });
    expect(
      within(deleteDialog).getByText("Delete reference set “Reference Set 2”?")
    ).toBeInTheDocument();

    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog", { name: /Delete reference set/i })).not.toBeInTheDocument();
  });

  it("supports local profile image upload and crop controls in the element hero", async () => {
    const createObjectURLMock = vi.fn(() => "blob:element-profile-image");
    const revokeObjectURLMock = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });

    const { container } = render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const profileFileInput = container.querySelector('input[type="file"][accept="image/*"]');
    if (!(profileFileInput instanceof HTMLInputElement)) {
      throw new Error("Expected element profile file input to exist.");
    }

    const uploadFile = new File(["element-profile"], "element-profile.png", {
      type: "image/png",
    });

    fireEvent.change(profileFileInput, { target: { files: [uploadFile] } });

    await waitFor(() => {
      expect(screen.getByAltText("Element profile")).toBeInTheDocument();
      expect(
        screen.getByRole("group", { name: "Element profile crop controls" })
      ).toBeInTheDocument();
    });

    const cropControls = screen.getByRole("group", { name: "Element profile crop controls" });
    const zoomInput = cropControls.querySelector("#element-profile-adjust-zoom");
    if (!(zoomInput instanceof HTMLInputElement)) {
      throw new Error("Expected element profile zoom slider to exist.");
    }

    fireEvent.change(zoomInput, { target: { value: "1.4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("group", { name: "Element profile crop controls" })
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit element profile photo adjustments" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));

    await waitFor(() => {
      expect(screen.queryByAltText("Element profile")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Upload element profile photo" })
      ).toBeInTheDocument();
    });
  });

  it("returns to Manage Elements after confirming delete", async () => {
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();
    fireEvent.click(screen.getByRole("tab", { name: "Manage Elements" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete element: Red Lantern" }));

    expect(screen.getByText("Delete this element?")).toBeInTheDocument();

    fireEvent.click(
      within(
        screen.getByText("Delete this element?").closest(".modal-card") as HTMLElement
      ).getByRole("button", { name: "Delete" })
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Elements Library" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Open element profile: Red Lantern" })
      ).not.toBeInTheDocument();
    });
  });

  it("shows element profile guidance and asset type controls", async () => {
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    expect(screen.getByLabelText("Element profile summary")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Image Element" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Video Element" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByText("Reference guidance")).toBeInTheDocument();
    expect(screen.getByText(/@redlantern/i)).toBeInTheDocument();
  });

  it("switches the profile asset type and resets incompatible references", async () => {
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    fireEvent.click(screen.getByRole("button", { name: "Video Element" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Video Element" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(screen.getByRole("button", { name: "Image Element" })).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    });
    expect(screen.getByText("Motion Reference")).toBeInTheDocument();
    expect(screen.queryByText("Primary Look")).not.toBeInTheDocument();
  });

  it("locks the properties rail scroll in Manage Elements mode", async () => {
    const { container } = render(
      <div className="ai-properties" style={{ overflowY: "auto", overscrollBehaviorY: "auto" }}>
        <ElementsPanel />
      </div>
    );
    const propertiesRail = container.querySelector(".ai-properties") as HTMLDivElement | null;
    if (!propertiesRail) {
      throw new Error("Expected ai-properties wrapper to exist.");
    }

    await screen.findByRole("button", { name: "Open element profile: Red Lantern" });

    expect(propertiesRail.style.overflowY).toBe("hidden");
    expect(propertiesRail.style.overscrollBehaviorY).toBe("none");
  });

  it("accepts an internal reference-grid drop into the element sheet and deck locally", async () => {
    const { container } = render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const portraitLikeZone = screen.getByText("Support Angle").closest("article");
    if (!portraitLikeZone) {
      throw new Error("Expected support-angle drop zone to exist.");
    }

    const deckDropContent = container.querySelector(
      ".character-section--reference-drop .character-reference-drop-content"
    ) as HTMLDivElement | null;
    if (!deckDropContent) {
      throw new Error("Expected element deck drop content to exist.");
    }

    const internalDrag = createDataTransfer();
    addInternalReferenceDragPayload(internalDrag, {
      outputId: "output-elements-1",
      mediaId: "media-elements-1",
      sourceSurface: "all-refs",
      referenceUrl: "https://example.com/elements-drop.png",
    });

    fireEvent.dragOver(portraitLikeZone, { dataTransfer: internalDrag });
    fireEvent.drop(portraitLikeZone, { dataTransfer: internalDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Support Angle reference")).toBeInTheDocument();
    });

    const secondInternalDrag = createDataTransfer();
    addInternalReferenceDragPayload(secondInternalDrag, {
      outputId: "output-elements-2",
      mediaId: "media-elements-2",
      sourceSurface: "all-refs",
      referenceUrl: "https://example.com/elements-deck-drop.png",
    });

    fireEvent.dragEnter(deckDropContent, { dataTransfer: secondInternalDrag });
    fireEvent.dragOver(deckDropContent, { dataTransfer: secondInternalDrag });
    fireEvent.drop(deckDropContent, { dataTransfer: secondInternalDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Reference 3")).toBeInTheDocument();
    });
  });

  it("assigns an element deck card into an empty element reference slot", async () => {
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const deckList = screen.getByRole("list", { name: "Element deck references" });
    const deckCards = within(deckList).getAllByRole("listitem");
    const targetSlot = screen.getByText("Support Angle").closest("article");

    if (!targetSlot) {
      throw new Error("Expected support-angle slot to exist.");
    }

    const dragTransfer = createDataTransfer();
    fireEvent.dragStart(deckCards[0], { dataTransfer: dragTransfer });

    const originalGetData = dragTransfer.getData;
    dragTransfer.getData = () => "";
    fireEvent.dragEnter(targetSlot, { dataTransfer: dragTransfer });
    fireEvent.dragOver(targetSlot, { dataTransfer: dragTransfer });
    dragTransfer.getData = originalGetData;
    fireEvent.drop(targetSlot, { dataTransfer: dragTransfer });
    fireEvent.dragEnd(deckCards[0], { dataTransfer: dragTransfer });

    await waitFor(() => {
      expect(screen.getByAltText("Support Angle reference")).toBeInTheDocument();
    });
  });

  it("clearing an element sheet slot does not remove the source deck reference", async () => {
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const deckList = screen.getByRole("list", { name: "Element deck references" });
    expect(within(deckList).getAllByRole("listitem")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Clear Secondary Angle reference" }));

    await waitFor(() => {
      expect(screen.queryByAltText("Secondary Angle reference")).not.toBeInTheDocument();
    });

    expect(within(deckList).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByAltText("Primary Look")).toBeInTheDocument();
    expect(screen.getByAltText("Reference 2")).toBeInTheDocument();
  });

  it("uses an image-only drag ghost for filled element deck cards", async () => {
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const deckList = screen.getByRole("list", { name: "Element deck references" });
    const deckCards = within(deckList).getAllByRole("listitem");
    const dragTransfer = createDataTransfer();

    fireEvent.dragStart(deckCards[0], { dataTransfer: dragTransfer });

    const deckGhost = document.body.querySelector(".character-drag-ghost") as HTMLElement | null;
    expect(deckGhost).toBeInTheDocument();
    expect(deckGhost?.classList.contains("elements-drag-ghost")).toBe(true);
    expect(deckGhost?.classList.contains("character-drag-ghost--image-only")).toBe(true);
    expect(deckGhost?.querySelector(".character-reference-delete-btn")).toBeNull();

    fireEvent.dragEnd(deckCards[0], { dataTransfer: dragTransfer });
    expect(document.body.querySelector(".character-drag-ghost")).toBeNull();
  });

  it("saves a new profile image when a deck card is dropped on the profile photo", async () => {
    const fetchMock = stubProfileImageFetch();
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const deckList = screen.getByRole("list", { name: "Element deck references" });
    const deckCards = within(deckList).getAllByRole("listitem");
    const profileButton = screen.getByRole("button", { name: "Upload element profile photo" });
    const dragTransfer = createDataTransfer();

    fireEvent.dragStart(deckCards[0], { dataTransfer: dragTransfer });
    const originalDeckGetData = dragTransfer.getData;
    dragTransfer.getData = () => "";
    fireEvent.dragEnter(profileButton, { dataTransfer: dragTransfer });
    fireEvent.dragOver(profileButton, { dataTransfer: dragTransfer });
    dragTransfer.getData = originalDeckGetData;
    fireEvent.drop(profileButton, { dataTransfer: dragTransfer });
    fireEvent.dragEnd(deckCards[0], { dataTransfer: dragTransfer });

    await waitFor(() => {
      expect(screen.getByAltText("Element profile")).toHaveAttribute(
        "src",
        "blob:red-lantern-01.jpg"
      );
    });
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/reference/red-lantern-01.jpg");
  });

  it("saves a new profile image when a reference-grid image is dropped on the profile photo", async () => {
    const fetchMock = stubProfileImageFetch();
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const profileButton = screen.getByRole("button", { name: "Upload element profile photo" });
    const dragTransfer = createDataTransfer();
    addInternalReferenceDragPayload(dragTransfer, {
      outputId: "output-elements-profile-1",
      mediaId: "media-elements-profile-1",
      sourceSurface: "all-refs",
      referenceUrl: "https://example.com/reference/mantis-profile.png",
    });

    const originalReferenceGetData = dragTransfer.getData;
    dragTransfer.getData = () => "";
    fireEvent.dragEnter(profileButton, { dataTransfer: dragTransfer });
    fireEvent.dragOver(profileButton, { dataTransfer: dragTransfer });
    dragTransfer.getData = originalReferenceGetData;
    fireEvent.drop(profileButton, { dataTransfer: dragTransfer });

    await waitFor(() => {
      expect(screen.getByAltText("Element profile")).toHaveAttribute(
        "src",
        "blob:mantis-profile.png"
      );
    });
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/reference/mantis-profile.png");
  });

  it("saves a new profile image when an internal reference drop needs resolver fallback", async () => {
    const resolveProfileImageDropSource = vi.fn(
      async (): Promise<ResolvedInternalReferenceSource | null> => ({
        kind: "internal",
        sourceKind: "generated_output",
        sourceId: "media-elements-profile-2",
        outputId: "output-elements-profile-2",
        mediaId: "media-elements-profile-2",
        mediaSource: "generated",
        preview: { url: null },
        previewStoragePath: "user-1/generations/images/mantis-preview.png",
        fullStoragePath: "user-1/generations/images/mantis-full.png",
        promptText: "Taylor",
        provenance: {
          origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
          outputId: "output-elements-profile-2",
          mediaId: "media-elements-profile-2",
          imageIndex: 0,
          sourceSurface: "all-refs",
          resolutionReason: "saved_media_lookup",
        },
        preparedImageUrl: null,
        loadBlob: async () => new Blob(["profile-image"], { type: "image/png" }),
      })
    ) as ResolveInternalReferenceDrop;
    render(<ElementsPanel resolveProfileImageDropSource={resolveProfileImageDropSource} />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const profileButton = screen.getByRole("button", { name: "Upload element profile photo" });
    const dragTransfer = createDataTransfer();
    addInternalReferenceDragPayload(dragTransfer, {
      outputId: "output-elements-profile-2",
      mediaId: "media-elements-profile-2",
      sourceSurface: "all-refs",
    });

    const originalReferenceGetData = dragTransfer.getData;
    dragTransfer.getData = () => "";
    fireEvent.dragEnter(profileButton, { dataTransfer: dragTransfer });
    fireEvent.dragOver(profileButton, { dataTransfer: dragTransfer });
    dragTransfer.getData = originalReferenceGetData;
    fireEvent.drop(profileButton, { dataTransfer: dragTransfer });

    await waitFor(() => {
      expect(screen.getByAltText("Element profile")).toHaveAttribute("src", "blob:mantis-full.png");
    });
    expect(resolveProfileImageDropSource).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "output-elements-profile-2",
        mediaId: "media-elements-profile-2",
      })
    );
  });

  it("does not show a pending save overlay for local internal deck drops", async () => {
    const { container } = render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const deckDropContent = container.querySelector(
      ".character-section--reference-drop .character-reference-drop-content"
    ) as HTMLDivElement | null;
    if (!deckDropContent) {
      throw new Error("Expected element deck drop content to exist.");
    }

    const internalDrag = createDataTransfer();
    addInternalReferenceDragPayload(internalDrag, {
      outputId: "output-elements-pending-1",
      mediaId: "media-elements-pending-1",
      sourceSurface: "all-refs",
      referenceUrl: "https://example.com/elements-pending-drop.png",
    });

    fireEvent.dragEnter(deckDropContent, { dataTransfer: internalDrag });
    fireEvent.dragOver(deckDropContent, { dataTransfer: internalDrag });
    fireEvent.drop(deckDropContent, { dataTransfer: internalDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Reference 3")).toBeInTheDocument();
    });
    expect(screen.queryByText("Adding image to Element Deck...")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Processing drop and syncing your Element Deck.")
    ).not.toBeInTheDocument();
  });

  it("accepts transient internal reference-grid drops into the element deck via resolver fallback", async () => {
    const resolveProfileImageDropSource = vi.fn(
      async (): Promise<ResolvedInternalReferenceSource | null> => ({
        kind: "internal",
        sourceKind: "local_file",
        sourceId: "output-elements-deck-transient-1",
        outputId: "output-elements-deck-transient-1",
        mediaId: null,
        mediaSource: null,
        preview: { url: "blob:elements-transient-reference" },
        previewStoragePath: null,
        fullStoragePath: null,
        promptText: "Transient beach reference",
        provenance: {
          origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
          outputId: "output-elements-deck-transient-1",
          mediaId: null,
          imageIndex: 0,
          sourceSurface: "all-refs",
          resolutionReason: "local_object_url",
        },
        preparedImageUrl: null,
        loadBlob: async () => new Blob(["transient-image"], { type: "image/png" }),
      })
    ) as ResolveInternalReferenceDrop;

    const { container } = render(
      <ElementsPanel resolveProfileImageDropSource={resolveProfileImageDropSource} />
    );

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const deckDropContent = container.querySelector(
      ".character-section--reference-drop .character-reference-drop-content"
    ) as HTMLDivElement | null;
    if (!deckDropContent) {
      throw new Error("Expected element deck drop content to exist.");
    }

    const internalDrag = createDataTransfer();
    addInternalReferenceDragPayload(internalDrag, {
      outputId: "output-elements-deck-transient-1",
      sourceSurface: "all-refs",
    });

    fireEvent.dragEnter(deckDropContent, { dataTransfer: internalDrag });
    fireEvent.dragOver(deckDropContent, { dataTransfer: internalDrag });
    fireEvent.drop(deckDropContent, { dataTransfer: internalDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Reference 3")).toHaveAttribute(
        "src",
        "https://example.com/uploaded/internal-drop.png"
      );
    });
    expect(resolveProfileImageDropSource).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "output-elements-deck-transient-1",
      })
    );
    expect(uploadImageToStorage).toHaveBeenCalledWith("blob:elements-transient-reference");
  });
});
