/**
 * AI Studio Elements panel layout tests.
 * Verifies the embedded Elements shell now mirrors the Character panel contract.
 */
import type React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ElementsPanel } from "../ElementsPanel";
import { INTERNAL_REFERENCE_DRAG_ORIGIN } from "../../utils/dragDrop";
import {
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
  registerComposerImageDropSession,
} from "../../../../lib/internalReferenceDragSession";
import { deriveElementAliasFromName } from "../../../elements-manager/logic/elementAlias";
import {
  loadElementManagerDraftByElementId,
  saveElementManagerDraft,
} from "../../../elements-manager/logic/elementsManagerPersistence";
import { uploadImageBlobToStorage, uploadImageToStorage } from "../../utils/imageUpload";

const { ensureSupabaseQueryClientMock } = vi.hoisted(() => ({
  ensureSupabaseQueryClientMock: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(async () => ({
          data: new Blob(["storage-image"], { type: "image/png" }),
          error: null,
        })),
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    })),
  })),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...imageProps} alt={props.alt ?? ""} />;
  },
}));

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
  uploadImageBlobToStorage: vi.fn(async () => "https://example.com/uploaded/internal-drop.png"),
  uploadImageToStorage: vi.fn(async (url: string) =>
    url.startsWith("blob:") || url.startsWith("data:image/")
      ? "https://example.com/uploaded/internal-drop.png"
      : url
  ),
}));

vi.mock("../../../../lib/supabaseClient", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/supabaseClient")>(
    "../../../../lib/supabaseClient"
  );
  return {
    ...actual,
    ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
  };
});

const createDataTransfer = (options?: { files?: File[]; data?: Record<string, string> }) => {
  const dataStore = new Map<string, string>(Object.entries(options?.data ?? {}));
  const files = options?.files ?? [];
  return {
    get types() {
      const baseTypes = Array.from(dataStore.keys());
      return files.length ? ["Files", ...baseTypes] : baseTypes;
    },
    files: files satisfies File[] as unknown as FileList,
    items: files.map((file) => ({
      kind: "file",
      type: file.type,
      getAsFile: () => file,
    })),
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
  ...createDataTransfer({ files: [file] }),
});

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
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

const addComposerImageDropSessionPayload = (
  transfer: ReturnType<typeof createDataTransfer>,
  options?: {
    outputId?: string;
    mediaId?: string;
    sourceSurface?: "all-refs" | "curated";
    displayArtifactUrl?: string;
    displayArtifactKind?: "blob" | "data" | "url";
    referenceUrl?: string | null;
    previewStoragePath?: string | null;
    fullStoragePath?: string | null;
  }
) => {
  const outputId = options?.outputId ?? "output-composer-1";
  const token = registerComposerImageDropSession({
    version: 1,
    origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
    referenceId: outputId,
    outputId,
    mediaId: options?.mediaId ?? null,
    displayArtifactUrl:
      options?.displayArtifactUrl ??
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnXl3sAAAAASUVORK5CYII=",
    displayArtifactKind: options?.displayArtifactKind ?? "data",
    previewStoragePath: options?.previewStoragePath ?? null,
    fullStoragePath: options?.fullStoragePath ?? null,
    referenceUrl: options?.referenceUrl ?? null,
    sourceSurface: options?.sourceSurface ?? "all-refs",
  });
  transfer.setData(COMPOSER_IMAGE_DROP_SESSION_TYPE, token);
};

const waitForElementEditor = async () => screen.findByLabelText("Element editor");

const openElementLibrary = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Elements" }));
  return screen.findByRole("dialog", { name: "Element library" });
};

const getPickerCardButtonByName = (name: string) => {
  const label = screen.getByText(name);
  const card = label.closest("article");
  if (!card) {
    throw new Error(`Expected picker card for ${name}.`);
  }
  return within(card).getAllByRole("button")[0];
};

describe("ElementsPanel layout", () => {
  beforeEach(() => {
    elementsManagerPersistenceMockState.reset();
    vi.mocked(loadElementManagerDraftByElementId).mockClear();
    vi.mocked(saveElementManagerDraft).mockClear();
    vi.mocked(uploadImageBlobToStorage).mockClear();
    vi.mocked(uploadImageToStorage).mockClear();
    ensureSupabaseQueryClientMock.mockClear();
  });

  it("renders the Character-style Elements shell with the media library fixed below", async () => {
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(<ElementsPanel />));
    });

    await waitForElementEditor();

    expect(
      screen.queryByRole("tablist", { name: "Elements workflow mode" })
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".elements-panel-root > .elements-panel-split-host")
    ).toBeTruthy();
    expect(container.querySelector(".elements-panel-top-section")).toBeTruthy();
    expect(container.querySelector(".elements-panel-bottom-section")).toBeTruthy();
    expect(container.querySelector(".elements-panel-library-workspace")).toBeTruthy();
    expect(container.querySelector(".elements-panel-editor-column-panel")).toBeTruthy();
    expect(container.querySelector(".elements-manage-list")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Elements Library" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elements" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "All Media type tabs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add files" })).toBeInTheDocument();
  });

  it("opens the saved elements modal and loads a saved element into the editor", async () => {
    render(<ElementsPanel />);
    await waitForElementEditor();

    const dialog = await openElementLibrary();
    expect(within(dialog).getByText("Elements")).toBeInTheDocument();
    fireEvent.click(getPickerCardButtonByName("Red Lantern"));

    await waitFor(() => {
      expect(loadElementManagerDraftByElementId).toHaveBeenCalledWith("element-red-lantern");
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Name:")).toHaveValue("Red Lantern");
    });
    expect(screen.getByLabelText("Description:")).toHaveValue(
      "Warm lacquered lantern with a gold frame and soft ember glow."
    );
    expect(screen.getByAltText("Primary View reference")).toBeInTheDocument();
    expect(screen.getByAltText("Secondary View reference")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Delete this element?" })).not.toBeInTheDocument();
  });

  it("requires the first two references before the first save and then persists the staged draft", async () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitForElementEditor();
    fireEvent.change(screen.getByLabelText("Name:"), { target: { value: "Taylor" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(saveElementManagerDraft).not.toHaveBeenCalled();
    });
    expect(
      screen.getByText("Add the first two required references before saving the element.")
    ).toBeInTheDocument();

    const primaryZone = screen.getByText("Primary View").closest("article");
    const secondaryZone = screen.getByText("Secondary View").closest("article");
    if (!primaryZone || !secondaryZone) {
      throw new Error("Expected required reference zones to exist.");
    }

    const primaryDrag = createDataTransfer();
    addMediaLibraryDragPayload(primaryDrag, {
      url: "https://example.com/library-drop-primary.png",
      fileType: "image",
    });
    fireEvent.dragEnter(primaryZone, { dataTransfer: primaryDrag });
    fireEvent.dragOver(primaryZone, { dataTransfer: primaryDrag });
    fireEvent.drop(primaryZone, { dataTransfer: primaryDrag });

    const secondaryDrag = createDataTransfer();
    addMediaLibraryDragPayload(secondaryDrag, {
      url: "https://example.com/library-drop-secondary.png",
      fileType: "image",
    });
    fireEvent.dragEnter(secondaryZone, { dataTransfer: secondaryDrag });
    fireEvent.dragOver(secondaryZone, { dataTransfer: secondaryDrag });
    fireEvent.drop(secondaryZone, { dataTransfer: secondaryDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Primary View reference")).toHaveAttribute(
        "src",
        "https://example.com/library-drop-primary.png"
      );
      expect(screen.getByAltText("Secondary View reference")).toHaveAttribute(
        "src",
        "https://example.com/library-drop-secondary.png"
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(saveElementManagerDraft).toHaveBeenCalledWith({
        name: "Taylor",
        profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
        description: "",
        assetType: "image",
        imageReferenceUrls: [
          "https://example.com/library-drop-primary.png",
          "https://example.com/library-drop-secondary.png",
        ],
        videoReferenceUrl: null,
      });
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Delete this element?" })).not.toBeInTheDocument();
  });

  it("accepts an internal reference-grid drop into the staged element sheet before first save", async () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitForElementEditor();

    const targetZone = screen.getByText("Secondary View").closest("article");
    if (!targetZone) {
      throw new Error("Expected secondary reference zone.");
    }

    const internalDrag = createDataTransfer();
    addInternalReferenceDragPayload(internalDrag, {
      outputId: "output-elements-1",
      mediaId: "media-elements-1",
      sourceSurface: "all-refs",
      referenceUrl: "https://example.com/elements-drop.png",
    });

    fireEvent.dragOver(targetZone, { dataTransfer: internalDrag });
    fireEvent.drop(targetZone, { dataTransfer: internalDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Secondary View reference")).toBeInTheDocument();
    });
  });

  it("resolves internal reference drops through the internal source resolver when no direct reference url is present", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:resolved-internal-reference"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    const resolveElementProfileImageDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "output-elements-blob",
      provenance: {
        origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
        outputId: "output-elements-blob",
        mediaId: "media-elements-blob",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "local_object_url" as const,
      },
      outputId: "output-elements-blob",
      generationId: null,
      mediaId: "media-elements-blob",
      mediaSource: "generated" as const,
      preview: { url: null },
      previewStoragePath: null,
      fullStoragePath: null,
      promptText: null,
      loadBlob: async () => new Blob(["resolver-image"], { type: "image/png" }),
    }));

    render(<ElementsPanel resolveProfileImageDropSource={resolveElementProfileImageDropSource} />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitForElementEditor();

    const targetZone = screen.getByText("Secondary View").closest("article");
    if (!targetZone) {
      throw new Error("Expected secondary reference zone.");
    }

    const internalDrag = createDataTransfer();
    addInternalReferenceDragPayload(internalDrag, {
      outputId: "output-elements-blob",
      mediaId: "media-elements-blob",
      sourceSurface: "all-refs",
    });

    fireEvent.dragOver(targetZone, { dataTransfer: internalDrag });
    fireEvent.drop(targetZone, { dataTransfer: internalDrag });

    await waitFor(() => {
      expect(resolveElementProfileImageDropSource).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByAltText("Secondary View reference")).toHaveAttribute(
        "src",
        "https://example.com/uploaded/internal-drop.png"
      );
    });
    expect(uploadImageBlobToStorage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(uploadImageBlobToStorage).mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(uploadImageToStorage).not.toHaveBeenCalledWith("blob:resolved-internal-reference");
  });

  it("accepts a local image file drop into an unsaved element reference slot", async () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitForElementEditor();

    const targetZone = screen.getByText("Secondary View").closest("article");
    if (!targetZone) {
      throw new Error("Expected secondary reference zone.");
    }

    const localFile = new File(["local-reference"], "secondary-angle.png", {
      type: "image/png",
    });
    const fileDrag = createFileDataTransfer(localFile);

    fireEvent.dragEnter(targetZone, { dataTransfer: fileDrag });
    fireEvent.dragOver(targetZone, { dataTransfer: fileDrag });
    fireEvent.drop(targetZone, { dataTransfer: fileDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Secondary View reference")).toHaveAttribute(
        "src",
        "https://example.com/uploaded/internal-drop.png"
      );
    });
    expect(uploadImageBlobToStorage).toHaveBeenCalledWith(localFile);
    expect(uploadImageToStorage).not.toHaveBeenCalledWith("blob:element-reference-local-file");
  });

  it("shows a loading spinner over the target reference card while an upload is in flight", async () => {
    const pendingUpload = createDeferred<string>();
    vi.mocked(uploadImageBlobToStorage).mockImplementationOnce(async () => pendingUpload.promise);

    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitForElementEditor();

    const targetZone = screen.getByText("Secondary View").closest("article");
    if (!targetZone) {
      throw new Error("Expected secondary reference zone.");
    }

    const localFile = new File(["local-reference"], "secondary-angle.png", {
      type: "image/png",
    });

    fireEvent.drop(targetZone, { dataTransfer: createFileDataTransfer(localFile) });

    await waitFor(() => {
      expect(uploadImageBlobToStorage).toHaveBeenCalledWith(localFile);
    });

    expect(
      screen.getByRole("status", { name: "Loading Secondary View reference" })
    ).toHaveTextContent("Loading...");
    expect(targetZone).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      pendingUpload.resolve("https://example.com/uploaded/secondary-reference.png");
      await pendingUpload.promise;
    });

    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Loading Secondary View reference" })).toBeNull();
    });
    expect(targetZone).toHaveAttribute("aria-busy", "false");
  });

  it("accepts a composer image drop session from Reference Grid when no internal payload survives", async () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitForElementEditor();

    const targetZone = screen.getByText("Secondary View").closest("article");
    if (!targetZone) {
      throw new Error("Expected secondary reference zone.");
    }

    const composerDrag = createDataTransfer();
    addComposerImageDropSessionPayload(composerDrag, {
      outputId: "output-composer-elements-1",
      mediaId: "media-composer-elements-1",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
    });

    fireEvent.dragOver(targetZone, { dataTransfer: composerDrag });
    fireEvent.drop(targetZone, { dataTransfer: composerDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Secondary View reference")).toHaveAttribute(
        "src",
        "https://example.com/uploaded/internal-drop.png"
      );
    });
    expect(uploadImageToStorage).toHaveBeenCalledWith(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnXl3sAAAAASUVORK5CYII="
    );
  });

  it("prefers degraded internal reference hints over synthetic dropped files", async () => {
    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitForElementEditor();

    const targetZone = screen.getByText("Secondary View").closest("article");
    if (!targetZone) {
      throw new Error("Expected secondary reference zone.");
    }

    const syntheticFile = new File(["synthetic-reference"], "synthetic.png", {
      type: "image/png",
    });
    const degradedDataImage =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnXl3sAAAAASUVORK5CYII=";
    const degradedInternalDrag = createDataTransfer({
      files: [syntheticFile],
      data: {
        "text/reference-origin": "",
        "image/url": degradedDataImage,
      },
    });

    fireEvent.dragEnter(targetZone, { dataTransfer: degradedInternalDrag });
    fireEvent.dragOver(targetZone, { dataTransfer: degradedInternalDrag });
    fireEvent.drop(targetZone, { dataTransfer: degradedInternalDrag });

    await waitFor(() => {
      expect(screen.getByAltText("Secondary View reference")).toHaveAttribute(
        "src",
        "https://example.com/uploaded/internal-drop.png"
      );
    });
    expect(uploadImageToStorage).toHaveBeenCalledWith(degradedDataImage);
    expect(uploadImageBlobToStorage).not.toHaveBeenCalled();
  });

  it("recovers element internal drops from storage when the resolver blob loader is stale", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:recovered-internal-reference"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    const resolveElementProfileImageDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "output-elements-stale-loader",
      provenance: {
        origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
        outputId: "output-elements-stale-loader",
        mediaId: "media-elements-stale-loader",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "output-elements-stale-loader",
      generationId: "gen-elements-stale-loader",
      mediaId: "media-elements-stale-loader",
      mediaSource: "generated" as const,
      preview: { url: null },
      previewStoragePath: "user-1/generations/images/stale-loader-preview.png",
      fullStoragePath: "user-1/generations/images/stale-loader-full.png",
      promptText: null,
      preparedImageUrl: null,
      loadBlob: async () => {
        throw new Error("stale blob");
      },
    }));

    render(<ElementsPanel resolveProfileImageDropSource={resolveElementProfileImageDropSource} />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitForElementEditor();

    const targetZone = screen.getByText("Secondary View").closest("article");
    if (!targetZone) {
      throw new Error("Expected secondary reference zone.");
    }

    const internalDrag = createDataTransfer();
    addInternalReferenceDragPayload(internalDrag, {
      outputId: "output-elements-stale-loader",
      mediaId: "media-elements-stale-loader",
      sourceSurface: "all-refs",
    });

    fireEvent.dragOver(targetZone, { dataTransfer: internalDrag });
    fireEvent.drop(targetZone, { dataTransfer: internalDrag });

    await waitFor(() => {
      expect(resolveElementProfileImageDropSource).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByAltText("Secondary View reference")).toHaveAttribute(
        "src",
        "https://example.com/uploaded/internal-drop.png"
      );
    });
    expect(uploadImageBlobToStorage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(uploadImageBlobToStorage).mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(uploadImageToStorage).not.toHaveBeenCalledWith("blob:recovered-internal-reference");
    expect(ensureSupabaseQueryClientMock).toHaveBeenCalled();
  });

  it("allows another slot upload to finish while a different slot upload is still pending", async () => {
    let resolvePrimaryUpload: ((value: string) => void) | null = null;
    const primaryUploadPromise = new Promise<string>((resolve) => {
      resolvePrimaryUpload = resolve;
    });

    vi.mocked(uploadImageBlobToStorage)
      .mockImplementationOnce(async () => primaryUploadPromise)
      .mockImplementationOnce(async () => "https://example.com/uploaded/secondary-reference.png");

    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitForElementEditor();

    const primaryZone = screen.getByText("Primary View").closest("article");
    const secondaryZone = screen.getByText("Secondary View").closest("article");
    if (!primaryZone || !secondaryZone) {
      throw new Error("Expected primary and secondary reference zones.");
    }

    const primaryFile = new File(["primary"], "primary-angle.png", { type: "image/png" });
    const secondaryFile = new File(["secondary"], "secondary-angle.png", { type: "image/png" });

    fireEvent.drop(primaryZone, { dataTransfer: createFileDataTransfer(primaryFile) });
    fireEvent.drop(secondaryZone, { dataTransfer: createFileDataTransfer(secondaryFile) });

    await waitFor(() => {
      expect(uploadImageBlobToStorage).toHaveBeenCalledTimes(2);
    });
    expect(
      screen.getByRole("status", { name: "Loading Primary View reference" })
    ).toHaveTextContent("Loading...");
    expect(primaryZone).toHaveAttribute("aria-busy", "true");
    await waitFor(() => {
      expect(screen.getByAltText("Secondary View reference")).toHaveAttribute(
        "src",
        "https://example.com/uploaded/secondary-reference.png"
      );
    });
    expect(screen.queryByRole("status", { name: "Loading Secondary View reference" })).toBeNull();
    expect(secondaryZone).toHaveAttribute("aria-busy", "false");

    resolvePrimaryUpload?.("https://example.com/uploaded/primary-reference.png");

    await waitFor(() => {
      expect(screen.getByAltText("Primary View reference")).toHaveAttribute(
        "src",
        "https://example.com/uploaded/primary-reference.png"
      );
    });
  });

  it("shows independent loading overlays when two element reference slots upload concurrently", async () => {
    const primaryUpload = createDeferred<string>();
    const secondaryUpload = createDeferred<string>();

    vi.mocked(uploadImageBlobToStorage)
      .mockImplementationOnce(async () => primaryUpload.promise)
      .mockImplementationOnce(async () => secondaryUpload.promise);

    render(<ElementsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitForElementEditor();

    const primaryZone = screen.getByText("Primary View").closest("article");
    const secondaryZone = screen.getByText("Secondary View").closest("article");
    if (!primaryZone || !secondaryZone) {
      throw new Error("Expected primary and secondary reference zones.");
    }

    fireEvent.drop(primaryZone, {
      dataTransfer: createFileDataTransfer(
        new File(["primary"], "primary.png", { type: "image/png" })
      ),
    });
    fireEvent.drop(secondaryZone, {
      dataTransfer: createFileDataTransfer(
        new File(["secondary"], "secondary.png", { type: "image/png" })
      ),
    });

    await waitFor(() => {
      expect(uploadImageBlobToStorage).toHaveBeenCalledTimes(2);
    });

    expect(
      screen.getByRole("status", { name: "Loading Primary View reference" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading Secondary View reference" })
    ).toBeInTheDocument();
    expect(primaryZone).toHaveAttribute("aria-busy", "true");
    expect(secondaryZone).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      primaryUpload.resolve("https://example.com/uploaded/primary-reference.png");
      await primaryUpload.promise;
    });

    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Loading Primary View reference" })).toBeNull();
    });
    expect(
      screen.getByRole("status", { name: "Loading Secondary View reference" })
    ).toBeInTheDocument();
    expect(primaryZone).toHaveAttribute("aria-busy", "false");
    expect(secondaryZone).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      secondaryUpload.resolve("https://example.com/uploaded/secondary-reference.png");
      await secondaryUpload.promise;
    });

    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Loading Secondary View reference" })).toBeNull();
    });
    expect(secondaryZone).toHaveAttribute("aria-busy", "false");
  });

  it("keeps profile photo controls out of the embedded element editor", async () => {
    const { container } = render(<ElementsPanel />);
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

  it("deletes elements from the saved library modal instead of the top workspace", async () => {
    render(<ElementsPanel />);
    await waitForElementEditor();

    await openElementLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Delete Red Lantern" }));

    const dialog = screen.getByRole("dialog", { name: "Delete this element?" });
    const modalLayerRoot = document.getElementById("ai-studio-modal-layer-root");
    expect(modalLayerRoot).not.toBeNull();
    expect(modalLayerRoot?.contains(dialog)).toBe(true);
    expect(within(dialog).getByText("Delete this element?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Red Lantern")).not.toBeInTheDocument();
    });
  });

  it("locks the properties rail scroll while the embedded Elements shell is active", async () => {
    const { container } = render(
      <div className="ai-properties" style={{ overflowY: "auto", overscrollBehaviorY: "auto" }}>
        <ElementsPanel />
      </div>
    );
    const propertiesRail = container.querySelector(".ai-properties") as HTMLDivElement | null;
    if (!propertiesRail) {
      throw new Error("Expected ai-properties wrapper to exist.");
    }

    await waitForElementEditor();

    expect(propertiesRail.style.overflowY).toBe("hidden");
    expect(propertiesRail.style.overscrollBehaviorY).toBe("none");
  });

  it("does not show the media paginator when the embedded library is on the prompts tab", async () => {
    render(<ElementsPanel />);

    fireEvent.click(await screen.findByRole("tab", { name: "Prompts" }));

    expect(
      screen.queryByTestId("media-library-panel-root-media-paginator")
    ).not.toBeInTheDocument();
  });
});
