/**
 * Characterization tests for the shared AI Studio styles runtime hook.
 * Locks catalog assembly, delete/reorder behavior, and selected-style invalidation.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStudioStylesRuntime } from "../useAiStudioStylesRuntime";

const mockUseStylesLibraryStyleDetailsPreference = vi.hoisted(() => vi.fn());
const mockUseStylesLibraryDeletedStyleIdsPreference = vi.hoisted(() => vi.fn());
const mockUseStylesLibraryPanelIdsPreference = vi.hoisted(() => vi.fn());
const mockUseBuiltInStyleCatalog = vi.hoisted(() => vi.fn());

vi.mock("../useStylesLibraryStyleDetailsPreference", () => ({
  useStylesLibraryStyleDetailsPreference: mockUseStylesLibraryStyleDetailsPreference,
}));

vi.mock("../useStylesLibraryDeletedStyleIdsPreference", () => ({
  useStylesLibraryDeletedStyleIdsPreference: mockUseStylesLibraryDeletedStyleIdsPreference,
}));

vi.mock("../useStylesLibraryPanelIdsPreference", () => ({
  useStylesLibraryPanelIdsPreference: mockUseStylesLibraryPanelIdsPreference,
}));

vi.mock("../useBuiltInStyleCatalog", () => ({
  useBuiltInStyleCatalog: mockUseBuiltInStyleCatalog,
}));

type MockStyleDetailsPreference = {
  styleDetailsById: Record<
    string,
    {
      style: string;
      title: string;
      referenceImageName: string;
      stylePrompt: string;
      previewImageUrl: string;
    }
  >;
  error: string | null;
  upsertStyleDetails: ReturnType<typeof vi.fn>;
  deleteStyleDetails: ReturnType<typeof vi.fn>;
};

type MockDeletedStyleIdsPreference = {
  deletedStyleIds: string[];
  error: string | null;
  deleteStyleId: ReturnType<typeof vi.fn>;
  restoreDeletedStyleIds: ReturnType<typeof vi.fn>;
};

type MockStylePanelIdsPreference = {
  stylePanelIds: string[];
  setStylePanelIds: ReturnType<typeof vi.fn>;
  removeStylePanelId: ReturnType<typeof vi.fn>;
};

const createDetailsPreference = (): MockStyleDetailsPreference => ({
  styleDetailsById: {},
  error: null,
  upsertStyleDetails: vi.fn(),
  deleteStyleDetails: vi.fn(),
});

const createDeletedPreference = (): MockDeletedStyleIdsPreference => ({
  deletedStyleIds: [],
  error: null,
  deleteStyleId: vi.fn(),
  restoreDeletedStyleIds: vi.fn(),
});

const createPanelIdsPreference = (): MockStylePanelIdsPreference => ({
  stylePanelIds: [],
  setStylePanelIds: vi.fn(),
  removeStylePanelId: vi.fn(),
});

describe("useAiStudioStylesRuntime", () => {
  let detailsPreference: MockStyleDetailsPreference;
  let deletedPreference: MockDeletedStyleIdsPreference;
  let panelIdsPreference: MockStylePanelIdsPreference;

  beforeEach(() => {
    detailsPreference = createDetailsPreference();
    deletedPreference = createDeletedPreference();
    panelIdsPreference = createPanelIdsPreference();

    mockUseStylesLibraryStyleDetailsPreference.mockImplementation(() => detailsPreference);
    mockUseStylesLibraryDeletedStyleIdsPreference.mockImplementation(() => deletedPreference);
    mockUseStylesLibraryPanelIdsPreference.mockImplementation(() => panelIdsPreference);
    mockUseBuiltInStyleCatalog.mockImplementation(() => ({
      styleDefinitions: [
        {
          styleId: "photorealistic",
          title: "Photorealistic",
          stylePrompt: "photorealistic prompt",
          previewImageUrl: "/Styles/Photoreal.png",
          referenceImageName: null,
          schemaVersion: 1,
        },
        {
          styleId: "cinematic",
          title: "Cinematic",
          stylePrompt: "cinematic prompt",
          previewImageUrl: "/Styles/Cinematic.png",
          referenceImageName: null,
          schemaVersion: 1,
        },
        {
          styleId: "cell-phone-snapshot",
          title: "Cell phone snapshot",
          stylePrompt: "snapshot prompt",
          previewImageUrl: "/Styles/Cell Phone Snap Shot.jpeg",
          referenceImageName: null,
          schemaVersion: 1,
        },
        {
          styleId: "anime",
          title: "Anime",
          stylePrompt: "anime prompt",
          previewImageUrl: "/Styles/Anime.png",
          referenceImageName: null,
          schemaVersion: 1,
        },
      ],
      loading: false,
      error: null,
      source: "control_plane",
      degraded: false,
      isAuthoritative: true,
      refresh: vi.fn(),
    }));
  });

  it("builds the visible catalog from built-ins, custom details, deleted ids, and ordering", async () => {
    detailsPreference.styleDetailsById = {
      cinematic: {
        style: "Dream Glow",
        title: "Dream Glow",
        referenceImageName: "Dream Glow",
        stylePrompt: "custom cinematic glow",
        previewImageUrl: "data:image/png;base64,override",
      },
      "style-library-custom-1": {
        style: "Soft Bloom",
        title: "Soft Bloom",
        referenceImageName: "Soft Bloom",
        stylePrompt: "soft bloom finish",
        previewImageUrl: "data:image/png;base64,custom",
      },
    };
    deletedPreference.deletedStyleIds = ["photorealistic"];
    panelIdsPreference.stylePanelIds = ["style-library-custom-1", "cinematic"];

    const onSelectedStylePromptChange = vi.fn();
    const onSelectedStyleContextChange = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioStylesRuntime({
        selectedStyleId: "cinematic",
        setSelectedStyleId: vi.fn(),
        onSelectedStylePromptChange,
        onSelectedStyleContextChange,
      })
    );

    expect(result.current.visibleStylesCatalog.map((style) => style.id)).toEqual([
      "style-library-custom-1",
      "cinematic",
      "cell-phone-snapshot",
      "anime",
    ]);
    expect(result.current.visibleStylesCatalog[1]).toMatchObject({
      id: "cinematic",
      title: "Cinematic",
      stylePrompt: "cinematic prompt",
      previewUrl: "/Styles/Cinematic.png",
      source: "built_in",
    });

    await waitFor(() => {
      expect(onSelectedStylePromptChange).toHaveBeenLastCalledWith("cinematic prompt");
    });
    expect(onSelectedStyleContextChange).toHaveBeenLastCalledWith({
      applied: true,
      styleId: "cinematic",
      styleName: "Cinematic",
      stylePrompt: "cinematic prompt",
      stylePreviewImageUrl: "/Styles/Cinematic.png",
    });
  });

  it("deletes seeded styles through the deleted-id preference and custom styles through details storage", async () => {
    deletedPreference.deleteStyleId.mockResolvedValue(true);
    detailsPreference.deleteStyleDetails.mockResolvedValue(true);
    panelIdsPreference.removeStylePanelId.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useAiStudioStylesRuntime({
        selectedStyleId: null,
        setSelectedStyleId: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.handleDeleteStyle("cinematic");
    });

    expect(deletedPreference.deleteStyleId).toHaveBeenCalledWith("cinematic");
    expect(detailsPreference.deleteStyleDetails).not.toHaveBeenCalled();
    expect(panelIdsPreference.removeStylePanelId).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleDeleteStyle("style-library-custom-1");
    });

    expect(detailsPreference.deleteStyleDetails).toHaveBeenCalledWith("style-library-custom-1");
    expect(panelIdsPreference.removeStylePanelId).toHaveBeenCalledWith("style-library-custom-1");
  });

  it("restores built-in styles through the deleted-id preference only", async () => {
    deletedPreference.deletedStyleIds = ["photorealistic"];
    deletedPreference.restoreDeletedStyleIds.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useAiStudioStylesRuntime({
        selectedStyleId: null,
        setSelectedStyleId: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.handleRestoreBuiltInStyles();
    });

    expect(deletedPreference.restoreDeletedStyleIds).toHaveBeenCalledTimes(1);
    expect(detailsPreference.deleteStyleDetails).not.toHaveBeenCalled();
    expect(detailsPreference.upsertStyleDetails).not.toHaveBeenCalled();
    expect(panelIdsPreference.setStylePanelIds).not.toHaveBeenCalled();
    expect(panelIdsPreference.removeStylePanelId).not.toHaveBeenCalled();
  });

  it("reorders the current visible catalog sequence through the persisted order preference", async () => {
    panelIdsPreference.stylePanelIds = [
      "cinematic",
      "anime",
      "photorealistic",
      "cell-phone-snapshot",
    ];
    panelIdsPreference.setStylePanelIds.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useAiStudioStylesRuntime({
        selectedStyleId: null,
        setSelectedStyleId: vi.fn(),
      })
    );

    await act(async () => {
      result.current.handleReorderStyle("anime", "cinematic");
    });

    expect(panelIdsPreference.setStylePanelIds).toHaveBeenCalledWith([
      "anime",
      "cinematic",
      "photorealistic",
      "cell-phone-snapshot",
    ]);
  });

  it("clears an invalid selected style when the style is no longer visible", async () => {
    const setSelectedStyleId = vi.fn();
    const onSelectedStylePromptChange = vi.fn();
    const onSelectedStyleContextChange = vi.fn();
    detailsPreference.styleDetailsById = {
      "style-library-custom-1": {
        style: "Soft Bloom",
        title: "Soft Bloom",
        referenceImageName: "Soft Bloom",
        stylePrompt: "soft bloom finish",
        previewImageUrl: "data:image/png;base64,custom",
      },
    };

    const { rerender } = renderHook(
      ({ selectedStyleId }: { selectedStyleId: string | null }) =>
        useAiStudioStylesRuntime({
          selectedStyleId,
          setSelectedStyleId,
          onSelectedStylePromptChange,
          onSelectedStyleContextChange,
        }),
      {
        initialProps: { selectedStyleId: "style-library-custom-1" },
      }
    );

    await waitFor(() => {
      expect(onSelectedStylePromptChange).toHaveBeenLastCalledWith("soft bloom finish");
    });

    deletedPreference.deletedStyleIds = ["style-library-custom-1"];
    rerender({ selectedStyleId: "style-library-custom-1" });

    await waitFor(() => {
      expect(setSelectedStyleId).toHaveBeenCalledWith(null);
    });
    expect(onSelectedStylePromptChange).toHaveBeenLastCalledWith(null);
    expect(onSelectedStyleContextChange).toHaveBeenLastCalledWith(null);
  });
});
