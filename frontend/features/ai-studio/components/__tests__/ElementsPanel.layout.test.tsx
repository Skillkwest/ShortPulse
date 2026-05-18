/**
 * AI Studio Elements panel layout tests.
 * Verifies the embedded Elements shell layout contract and manage-mode scroll locking.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ElementsPanel } from "../ElementsPanel";
import { ElementsManagerShell } from "../../../elements-manager/components/ElementsManagerShell";
import { INTERNAL_REFERENCE_DRAG_ORIGIN } from "../../utils/dragDrop";
import { deriveElementAliasFromName } from "../../../elements-manager/logic/elementAlias";
import {
  loadElementManagerDraftByElementId,
  saveElementManagerDraft,
} from "../../../elements-manager/logic/elementsManagerPersistence";
import { uploadImageToStorage } from "../../utils/imageUpload";

const elementsManagerPersistenceMockState = vi.hoisted(() => {
  const defaultTransform = { zoom: 1, offsetX: 0, offsetY: 0 };
  const seededReferenceImageUrls = [
    "https://example.com/reference/red-lantern-01.jpg",
    "https://example.com/reference/red-lantern-02.jpg",
  ];
  const makeSnapshot = (overrides?: Partial<Record<string, unknown>>) => ({
    userId: "user-1",
    elementId: "element-red-lantern",
    name: "Red Lantern",
    alias: "redlantern",
    status: "ready" as const,
    profileImageUrl: null as string | null,
    profileImageTransform: defaultTransform,
    description: "Warm lacquered lantern with a gold frame and soft ember glow.",
    assetType: "image" as const,
    imageReferenceUrls: seededReferenceImageUrls,
    videoReferenceUrl: null as string | null,
    updatedAt: "2026-04-06T09:00:00.000Z",
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
  saveElementManagerDraft: vi.fn(
    async ({
      name,
      description,
      assetType,
      imageReferenceUrls,
      videoReferenceUrl,
      profileImageTransform,
    }) => {
      const snapshot = {
        userId: "user-1",
        elementId: "element-new-element",
        name,
        alias: deriveElementAliasFromName(name),
        status: "ready" as const,
        profileImageUrl: null as string | null,
        profileImageTransform,
        description,
        assetType,
        imageReferenceUrls,
        videoReferenceUrl,
        updatedAt: "2026-04-07T00:00:00.000Z",
      };
      elementsManagerPersistenceMockState.snapshots.set(snapshot.elementId, snapshot);
      elementsManagerPersistenceMockState.list = [
        {
          elementId: snapshot.elementId,
          elementName: snapshot.name,
          elementAlias: snapshot.alias,
          elementAssetType: snapshot.assetType,
          elementStatus: snapshot.status,
          profileImageUrl: snapshot.profileImageUrl,
          profileImageTransform: snapshot.profileImageTransform,
          updatedAt: snapshot.updatedAt,
        },
        ...elementsManagerPersistenceMockState.list,
      ];
      return snapshot;
    }
  ),
  saveElementManagerDraftSnapshot: vi.fn(
    async ({ elementId, name, description, assetType, imageReferenceUrls, videoReferenceUrl }) => {
      const snapshot = elementsManagerPersistenceMockState.snapshots.get(elementId);
      if (!snapshot) {
        throw new Error(`Missing element snapshot: ${elementId}`);
      }
      const nextSnapshot = {
        ...snapshot,
        name,
        alias: deriveElementAliasFromName(name),
        description,
        assetType,
        imageReferenceUrls,
        videoReferenceUrl,
        updatedAt: "2026-04-07T00:00:00.000Z",
      };
      elementsManagerPersistenceMockState.snapshots.set(elementId, nextSnapshot);
      elementsManagerPersistenceMockState.list = elementsManagerPersistenceMockState.list.map(
        (item) =>
          item.elementId === elementId
            ? {
                ...item,
                elementName: name,
                elementAlias: deriveElementAliasFromName(name),
                elementAssetType: assetType ?? item.elementAssetType,
                updatedAt: nextSnapshot.updatedAt,
              }
            : item
      );
      return { updatedAt: nextSnapshot.updatedAt, status: nextSnapshot.status };
    }
  ),
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

const createFileDataTransfer = (file: File) => ({
  files: [file],
  items: [
    {
      kind: "file",
      type: file.type,
      getAsFile: () => file,
    },
  ],
  types: ["Files"],
  effectAllowed: "all",
  dropEffect: "move",
  setDragImage: () => undefined,
  setData: () => undefined,
  getData: () => "",
});

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

const addMediaLibraryDragPayload = (
  transfer: ReturnType<typeof createDataTransfer>,
  options?: {
    id?: string;
    url?: string;
    fileType?: "image" | "video" | "audio";
    filename?: string;
    originFolderId?: string;
  }
) => {
  const payload = {
    kind: "libraryMedia" as const,
    source: "mediaLibrary" as const,
    payload: {
      id: options?.id ?? "media-library-1",
      url: options?.url ?? "https://example.com/library-drop.png",
      fileType: options?.fileType ?? "image",
      originFolderId: options?.originFolderId ?? "all_items",
      filename: options?.filename ?? "library-drop.png",
      promptText: "A saved media item",
      previewUrl: options?.url ?? "https://example.com/library-drop.png",
      fullUrl: options?.url ?? "https://example.com/library-drop.png",
    },
  };
  const serialized = JSON.stringify(payload);
  transfer.setData("application/x-shortpulse-media-library-item", serialized);
  transfer.setData("text/x-shortpulse-media-library-item", serialized);
};

const waitForElementEditor = async (options?: { timeout?: number }) => {
  const timeout = options?.timeout ?? 2000;
  const editor = await screen.findByLabelText("Element editor", undefined, { timeout });
  await within(editor).findByText("References", undefined, { timeout });
  return editor;
};

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

describe("ElementsPanel layout", () => {
  beforeEach(() => {
    elementsManagerPersistenceMockState.reset();
    vi.mocked(saveElementManagerDraft).mockClear();
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
    expect(
      container!.querySelector(".elements-panel-root > .elements-panel-split-host")
    ).toBeTruthy();
    expect(
      container!.querySelector(".elements-panel-top-section > .elements-manager-shell")
    ).toBeTruthy();
    expect(container!.querySelector(".elements-panel-bottom-section")).toBeTruthy();
    expect(container!.querySelector(".elements-manager-shell--panel")).toBeTruthy();
    expect(container!.querySelector(".character-manager-page")).toBeNull();
    expect(container!.querySelector(".character-manager-page--embedded")).toBeNull();
    expect(container!.querySelector(".elements-manager-shell--character-clone")).toBeNull();
    expect(container!.querySelector(".panel.media-panel.elements-manage-panel")).toBeNull();
    expect(container!.querySelector(".elements-manage-list")).toBeTruthy();
    const chipViewport = container!.querySelector(".elements-manage-chip-container");
    expect(chipViewport).toBeTruthy();
    expect(chipViewport?.querySelector(".elements-manage-header-actions")).toBeNull();
    expect(screen.getByRole("heading", { name: "Elements Library" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Element Deck" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Element Sheet" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Element" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "+ Create" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "All Media type tabs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add files" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /expand media library panel/i })
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit element: Red Lantern" })).toBeInTheDocument();
    });
  });

  it("stages a new element locally and only persists it after Save Element is clicked", async () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "+ Create" }));

    const dialog = await waitForElementEditor();
    expect(screen.getByRole("button", { name: "Save Element" })).toBeEnabled();
    expect(within(dialog).getByLabelText("Name:")).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "New Element" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close element editor" })).not.toBeInTheDocument();
    expect(saveElementManagerDraft).not.toHaveBeenCalled();
    expect(elementsManagerPersistenceMockState.list).toHaveLength(1);

    fireEvent.change(within(dialog).getByLabelText("Name:"), { target: { value: "Taylor" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Element" }));

    await waitFor(() => {
      expect(saveElementManagerDraft).toHaveBeenCalledWith({
        name: "Taylor",
        profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
        description: "",
        assetType: "image",
        imageReferenceUrls: [],
        videoReferenceUrl: null,
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Element" })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Edit element: Taylor" })).toBeInTheDocument();
    expect(elementsManagerPersistenceMockState.list).toHaveLength(2);
  });

  it("opens the element editor in a right-side column from the manage list with no workflow tabs or extra wrapper chrome", async () => {
    const { container } = render(<ElementsPanel />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit element: Red Lantern",
      })
    );
    const dialog = await waitForElementEditor();

    expect(
      screen.queryByRole("tablist", { name: "Elements workflow mode" })
    ).not.toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("Red Lantern")).toBeInTheDocument();
    const referencesHeading = within(dialog).getByText("References");
    const descriptionHeading = within(dialog).getByText("Description:");
    expect(referencesHeading).toBeInTheDocument();
    expect(within(dialog).getByText("Detail Shot")).toBeInTheDocument();
    expect(
      referencesHeading.compareDocumentPosition(descriptionHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(dialog.querySelectorAll(".elements-reference-card")).toHaveLength(3);
    expect(
      dialog.querySelector(".elements-description-text-container .elements-description-count")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Element" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Red Lantern" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close element editor" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit element: Red Lantern" })).toBeInTheDocument();
    expect(container.querySelector(".elements-library-workspace")).toBeTruthy();
    expect(container.querySelector(".elements-library-column")).toBeTruthy();
    expect(container.querySelector(".elements-editor-column")).toBeTruthy();
    expect(container.querySelector(".elements-editor-column-panel")).toBeTruthy();
  });

  it("hides the description editor when the embedded media library is maximized", async () => {
    render(<ElementsManagerShell isEmbeddedMediaLibraryMaximized />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit element: Red Lantern",
      })
    );
    const dialog = await waitForElementEditor();

    expect(within(dialog).getByDisplayValue("Red Lantern")).toBeInTheDocument();
    expect(within(dialog).getByText("References")).toBeInTheDocument();
    expect(within(dialog).queryByText("Description:")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Description:")).not.toBeInTheDocument();
    expect(dialog.querySelector(".elements-description-text-container")).toBeNull();
  });

  it("opens the element editor when the visible chip surface is clicked", async () => {
    render(<ElementsPanel />);

    const elementButton = await screen.findByRole("button", { name: "Edit element: Red Lantern" });
    const elementCard = elementButton.closest("article");
    if (!elementCard) {
      throw new Error("Expected element card article to exist.");
    }

    await act(async () => {
      fireEvent.click(elementCard);
    });
    const dialog = await waitForElementEditor();

    expect(within(dialog).getByDisplayValue("Red Lantern")).toBeInTheDocument();
  });

  it("ignores stale element selection responses when a newer chip is clicked", async () => {
    elementsManagerPersistenceMockState.list = [
      ...elementsManagerPersistenceMockState.list,
      {
        elementId: "element-blue-comet",
        elementName: "Blue Comet",
        elementAlias: "bluecomet",
        elementAssetType: "image" as const,
        elementStatus: "ready" as const,
        profileImageUrl: null,
        profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
        updatedAt: "2026-04-07T09:00:00.000Z",
      },
    ];
    elementsManagerPersistenceMockState.snapshots.set("element-blue-comet", {
      userId: "user-1",
      elementId: "element-blue-comet",
      name: "Blue Comet",
      alias: "bluecomet",
      status: "ready" as const,
      profileImageUrl: null,
      profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
      description: "A cool blue comet with icy tails.",
      assetType: "image" as const,
      imageReferenceUrls: [],
      videoReferenceUrl: null,
      updatedAt: "2026-04-07T09:00:00.000Z",
    });

    const redSelection =
      createDeferred<Awaited<ReturnType<typeof loadElementManagerDraftByElementId>>>();
    const blueSelection =
      createDeferred<Awaited<ReturnType<typeof loadElementManagerDraftByElementId>>>();

    vi.mocked(loadElementManagerDraftByElementId).mockImplementation((elementId: string) => {
      if (elementId === "element-red-lantern") {
        return redSelection.promise;
      }
      if (elementId === "element-blue-comet") {
        return blueSelection.promise;
      }
      throw new Error(`Unexpected element id: ${elementId}`);
    });

    render(<ElementsPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit element: Red Lantern" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit element: Blue Comet" }));

    await act(async () => {
      blueSelection.resolve(
        elementsManagerPersistenceMockState.snapshots.get("element-blue-comet")!
      );
      await blueSelection.promise;
    });

    const dialog = await waitForElementEditor();
    expect(within(dialog).getByDisplayValue("Blue Comet")).toBeInTheDocument();

    await act(async () => {
      redSelection.resolve(
        elementsManagerPersistenceMockState.snapshots.get("element-red-lantern")!
      );
      await redSelection.promise;
    });

    await waitFor(() => {
      expect(within(dialog).getByDisplayValue("Blue Comet")).toBeInTheDocument();
    });
  });

  it("opens create mode in the right-side editor column without the old wrapper chrome", async () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "+ Create" }));
    const dialog = await waitForElementEditor();
    fireEvent.change(within(dialog).getByLabelText("Name:"), {
      target: { value: "Draft Beach" },
    });

    expect(within(dialog).getByDisplayValue("Draft Beach")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Element" })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Discard new element?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close element editor" })).not.toBeInTheDocument();
  });

  it("does not render profile photo controls in the element profile editor", async () => {
    const { container } = render(<ElementsPanel />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit element: Red Lantern",
      })
    );
    await waitForElementEditor();

    expect(container.querySelector('input[type="file"][accept="image/*"]')).toBeNull();
    expect(screen.queryByAltText("Element profile")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Element profile crop controls" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /element profile photo/i })
    ).not.toBeInTheDocument();
  });

  it("returns to Manage Elements after confirming delete", async () => {
    render(<ElementsPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit element: Red Lantern" }));

    const deleteButton = await screen.findByRole("button", {
      name: "Delete element: Red Lantern",
    });

    fireEvent.click(deleteButton);

    const dialog = screen.getByRole("dialog", { name: "Delete this element?" });
    expect(within(dialog).getByText("Delete this element?")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Elements Library" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Edit element: Red Lantern" })
      ).not.toBeInTheDocument();
    });
  });

  it("shows element editor guidance without redundant summary chrome", async () => {
    render(<ElementsPanel />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit element: Red Lantern",
      })
    );
    const dialog = await waitForElementEditor();

    expect(screen.queryByLabelText("Element profile summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Element Type")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Image Element" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Video Element" })).not.toBeInTheDocument();
    expect(screen.queryByText("Prompt Guidance:")).not.toBeInTheDocument();
    expect(screen.queryByText(/@redlantern/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText("References")).toBeInTheDocument();
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

    await screen.findByRole("button", { name: "Edit element: Red Lantern" });

    expect(propertiesRail.style.overflowY).toBe("hidden");
    expect(propertiesRail.style.overscrollBehaviorY).toBe("none");
  });

  it("accepts an internal reference-grid drop into the element sheet locally", async () => {
    render(<ElementsPanel />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit element: Red Lantern",
      })
    );
    await waitForElementEditor();

    const portraitLikeZone = screen.getByText("Secondary").closest("article");
    if (!portraitLikeZone) {
      throw new Error("Expected secondary-angle drop zone to exist.");
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
      expect(screen.getByAltText("Secondary reference")).toBeInTheDocument();
    });
  });

  it("accepts a local image file drop into an element reference slot", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:element-reference-local-file"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    render(<ElementsPanel />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit element: Red Lantern",
      })
    );
    await waitForElementEditor();

    const supportAngleZone = screen.getByText("Secondary").closest("article");
    if (!supportAngleZone) {
      throw new Error("Expected secondary-angle drop zone to exist.");
    }

    const localFile = new File(["local-reference"], "secondary-angle.png", {
      type: "image/png",
    });
    const fileDrag = createFileDataTransfer(localFile);

    fireEvent.dragEnter(supportAngleZone, { dataTransfer: fileDrag });
    fireEvent.dragOver(supportAngleZone, { dataTransfer: fileDrag });
    fireEvent.drop(supportAngleZone, { dataTransfer: fileDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Secondary reference")).toHaveAttribute(
        "src",
        "https://example.com/uploaded/internal-drop.png"
      );
    });
    expect(uploadImageToStorage).toHaveBeenCalledWith("blob:element-reference-local-file");
  });

  it("accepts a media-library drag into an explicit image reference slot", async () => {
    render(<ElementsPanel />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit element: Red Lantern",
      })
    );
    await waitForElementEditor();

    const supportAngleZone = screen.getByText("Secondary").closest("article");
    if (!supportAngleZone) {
      throw new Error("Expected secondary-angle drop zone to exist.");
    }

    const libraryDrag = createDataTransfer();
    addMediaLibraryDragPayload(libraryDrag, {
      url: "https://example.com/library-drop.png",
      fileType: "image",
    });

    fireEvent.dragEnter(supportAngleZone, { dataTransfer: libraryDrag });
    fireEvent.dragOver(supportAngleZone, { dataTransfer: libraryDrag });
    fireEvent.drop(supportAngleZone, { dataTransfer: libraryDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Secondary reference")).toHaveAttribute(
        "src",
        "https://example.com/library-drop.png"
      );
    });
  });

  it("does not show the media paginator when the embedded library is on the prompts tab", async () => {
    render(<ElementsPanel />);

    fireEvent.click(await screen.findByRole("tab", { name: "Prompts" }));

    expect(
      screen.queryByTestId("media-library-panel-root-media-paginator")
    ).not.toBeInTheDocument();
  });
});
