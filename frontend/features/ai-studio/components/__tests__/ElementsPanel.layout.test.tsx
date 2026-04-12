/**
 * AI Studio Elements panel layout tests.
 * Verifies the embedded Elements shell layout contract and manage-mode scroll locking.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ElementsPanel } from "../ElementsPanel";
import { INTERNAL_REFERENCE_DRAG_ORIGIN } from "../../utils/dragDrop";
import type {
  ResolveInternalReferenceDrop,
  ResolvedInternalReferenceSource,
} from "../../logic/referenceSource/internalReferenceSource";
import { saveElementManagerDraft } from "../../../elements-manager/logic/elementsManagerPersistence";
import { uploadImageToStorage } from "../../utils/imageUpload";

const elementsManagerPersistenceMockState = vi.hoisted(() => {
  const defaultTransform = { zoom: 1, offsetX: 0, offsetY: 0 };
  const seededReferenceImageUrls = [
    "https://example.com/reference/red-lantern-01.jpg",
    "https://example.com/reference/red-lantern-02.jpg",
  ];
  const makeSnapshot = (overrides?: Partial<Record<string, unknown>>) => ({
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
      alias,
      description,
      assetType,
      imageReferenceUrls,
      videoReferenceUrl,
      profileImageTransform,
    }) => {
      const snapshot = {
        elementId: "element-new-element",
        name,
        alias,
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
    async ({
      elementId,
      name,
      alias,
      description,
      assetType,
      imageReferenceUrls,
      videoReferenceUrl,
    }) => {
      const snapshot = elementsManagerPersistenceMockState.snapshots.get(elementId);
      if (!snapshot) {
        throw new Error(`Missing element snapshot: ${elementId}`);
      }
      const nextSnapshot = {
        ...snapshot,
        name,
        alias,
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
                elementAlias: alias,
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

const waitForElementProfileShell = async (timeout = 2000) => {
  await screen.findByDisplayValue("Red Lantern", undefined, { timeout });
  await screen.findByText("References", undefined, { timeout });
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
    expect(container!.querySelector(".elements-panel-root > .elements-manager-shell")).toBeTruthy();
    expect(container!.querySelector(".elements-manager-shell--panel")).toBeTruthy();
    expect(container!.querySelector(".character-manager-page")).toBeNull();
    expect(container!.querySelector(".character-manager-page--embedded")).toBeNull();
    expect(container!.querySelector(".elements-manager-shell--character-clone")).toBeNull();
    expect(container!.querySelector(".panel.media-panel.elements-manage-panel")).toBeNull();
    expect(container!.querySelector(".elements-manage-list")).toBeTruthy();
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

  it("stages a new element locally and only persists it after Save Element is clicked", async () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Create New Element" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Element" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Save Element" })).toBeEnabled();
    expect(screen.getByLabelText("Name:")).toHaveValue("");
    expect(screen.getByLabelText("Alias:")).toHaveValue("");
    expect(saveElementManagerDraft).not.toHaveBeenCalled();
    expect(elementsManagerPersistenceMockState.list).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Name:"), { target: { value: "Taylor" } });
    fireEvent.change(screen.getByLabelText("Alias:"), { target: { value: "taylor_element" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Element" }));

    await waitFor(() => {
      expect(saveElementManagerDraft).toHaveBeenCalledWith({
        name: "Taylor",
        alias: "taylor_element",
        profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
        description: "",
        assetType: "image",
        imageReferenceUrls: [],
        videoReferenceUrl: null,
      });
    });

    fireEvent.click(screen.getByRole("tab", { name: "Manage Elements" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Open element profile: Taylor" })
      ).toBeInTheDocument();
    });
    expect(elementsManagerPersistenceMockState.list).toHaveLength(2);
  });

  it("requires saving a new element before adding profile photos or references", async () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Create New Element" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Element" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Upload element profile photo" }));

    expect(
      screen.getByText("Save the element before adding a profile photo or references.")
    ).toBeInTheDocument();
  });

  it("opens the profile editor as a single-column profile workspace", async () => {
    const { container } = render(<ElementsPanel />);

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
    expect(container.querySelector(".elements-profile-hero")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Red Lantern" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Reference Assets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Identity and Notes" })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Red Lantern")).toBeInTheDocument();
    expect(screen.getByDisplayValue("redlantern")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Double click me" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add character sheet preset tab" })
    ).not.toBeInTheDocument();

    const regions = Array.from(container.querySelectorAll("[data-layout-region]"))
      .map((node) => node.getAttribute("data-layout-region"))
      .filter((value): value is string => Boolean(value));
    expect(regions).toEqual(["sheet"]);
    expect(container.querySelector(".elements-profile-panel")).toBeTruthy();
    expect(container.querySelector(".elements-workflow-tab-row")).toBeTruthy();
    expect(container.querySelector(".elements-references-grid")).toBeTruthy();
  });

  it("does not render the shared preset-tab system in the elements profile", async () => {
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    expect(screen.queryByRole("tab", { name: "Double click me" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add character sheet preset tab" })
    ).not.toBeInTheDocument();
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

  it("shows element profile guidance without redundant summary chrome", async () => {
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    expect(screen.queryByLabelText("Element profile summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Element Type")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Image Element" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Video Element" })).not.toBeInTheDocument();
    expect(screen.queryByText("Prompt Guidance:")).not.toBeInTheDocument();
    expect(screen.queryByText(/@redlantern/i)).not.toBeInTheDocument();
    expect(screen.getByText("References")).toBeInTheDocument();
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

  it("accepts an internal reference-grid drop into the element sheet locally", async () => {
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const portraitLikeZone = screen.getByText("Support Angle").closest("article");
    if (!portraitLikeZone) {
      throw new Error("Expected support-angle drop zone to exist.");
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

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const supportAngleZone = screen.getByText("Support Angle").closest("article");
    if (!supportAngleZone) {
      throw new Error("Expected support-angle drop zone to exist.");
    }

    const localFile = new File(["local-reference"], "support-angle.png", {
      type: "image/png",
    });
    const fileDrag = createFileDataTransfer(localFile);

    fireEvent.dragEnter(supportAngleZone, { dataTransfer: fileDrag });
    fireEvent.dragOver(supportAngleZone, { dataTransfer: fileDrag });
    fireEvent.drop(supportAngleZone, { dataTransfer: fileDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Support Angle reference")).toHaveAttribute(
        "src",
        "https://example.com/uploaded/internal-drop.png"
      );
    });
    expect(uploadImageToStorage).toHaveBeenCalledWith("blob:element-reference-local-file");
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

  it("saves a new profile image when a local image file is dropped on the profile photo", async () => {
    render(<ElementsPanel />);

    const openProfileButton = await screen.findByRole("button", {
      name: "Open element profile: Red Lantern",
    });
    fireEvent.click(openProfileButton);
    await waitForElementProfileShell();

    const profileButton = screen.getByRole("button", { name: "Upload element profile photo" });
    const localFile = new File(["profile-image"], "local-profile.png", { type: "image/png" });
    const fileDrag = createFileDataTransfer(localFile);

    fireEvent.dragEnter(profileButton, { dataTransfer: fileDrag });
    fireEvent.dragOver(profileButton, { dataTransfer: fileDrag });
    fireEvent.drop(profileButton, { dataTransfer: fileDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Element profile")).toHaveAttribute(
        "src",
        "blob:local-profile.png"
      );
    });
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
});
