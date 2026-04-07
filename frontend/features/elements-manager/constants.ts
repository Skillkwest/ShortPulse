/**
 * Local-only Elements library constants and mock fixtures.
 * Provides Character-shell-compatible draft defaults without any persistence dependencies.
 */
import type {
  ElementDraft,
  ElementLibraryItem,
  ElementReferenceSet,
  ElementReferenceSetId,
  ElementReferenceSetLabelMap,
  ElementReferenceSetMap,
  ElementReferenceSetState,
} from "./types";

export const ELEMENT_REFERENCE_SET_IDS: ElementReferenceSetId[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
];

export const MAX_ELEMENT_REFERENCE_SET_TAB_COUNT = ELEMENT_REFERENCE_SET_IDS.length;

export const createEmptyElementReferenceSet = (): ElementReferenceSet => ({
  description: "",
  imageReferenceUrls: [],
  videoReferenceUrl: "",
});

export const createDefaultElementReferenceSetLabels = (): ElementReferenceSetLabelMap =>
  Object.fromEntries(
    ELEMENT_REFERENCE_SET_IDS.map((setId) => [
      setId,
      setId === "1" ? "Double click me" : `Reference Set ${setId}`,
    ])
  ) as ElementReferenceSetLabelMap;

export const createEmptyElementReferenceSetMap = (): ElementReferenceSetMap =>
  Object.fromEntries(
    ELEMENT_REFERENCE_SET_IDS.map((setId) => [setId, createEmptyElementReferenceSet()])
  ) as ElementReferenceSetMap;

export const createDefaultElementReferenceSetState = (
  overrides?: Partial<ElementReferenceSetState>
): ElementReferenceSetState => ({
  activeSetId: overrides?.activeSetId ?? "1",
  tabOrder: overrides?.tabOrder ?? ["1"],
  tabLabels: overrides?.tabLabels ?? createDefaultElementReferenceSetLabels(),
  sets: overrides?.sets ?? createEmptyElementReferenceSetMap(),
});

export const createEmptyElementDraft = (): ElementDraft => {
  const defaultSetState = createDefaultElementReferenceSetState();
  return {
    name: "",
    alias: "",
    description: defaultSetState.sets[defaultSetState.activeSetId].description,
    assetType: "image",
    imageReferenceUrls: defaultSetState.sets[defaultSetState.activeSetId].imageReferenceUrls,
    videoReferenceUrl: defaultSetState.sets[defaultSetState.activeSetId].videoReferenceUrl,
    activeReferenceSetId: defaultSetState.activeSetId,
    visibleReferenceSetIds: defaultSetState.tabOrder,
    referenceSetLabels: defaultSetState.tabLabels,
    referenceSets: defaultSetState.sets,
  };
};

const createReferenceSetState = (seed: {
  description: string;
  imageReferenceUrls?: string[];
  videoReferenceUrl?: string;
  activeSetId?: ElementReferenceSetId;
}): ElementReferenceSetState => {
  const sets = createEmptyElementReferenceSetMap();
  const activeSetId = seed.activeSetId ?? "1";
  sets[activeSetId] = {
    description: seed.description,
    imageReferenceUrls: seed.imageReferenceUrls ?? [],
    videoReferenceUrl: seed.videoReferenceUrl ?? "",
  };
  return createDefaultElementReferenceSetState({
    activeSetId,
    sets,
  });
};

export const createMockElementsLibrary = (): ElementLibraryItem[] => [
  {
    id: "element-red-lantern",
    name: "Red Lantern",
    alias: "redlantern",
    description: "Small glowing lantern used in night market scenes.",
    assetType: "image",
    thumbnailUrl: null,
    imageReferenceUrls: [
      "https://example.com/reference/red-lantern-01.jpg",
      "https://example.com/reference/red-lantern-02.jpg",
    ],
    videoReferenceUrl: null,
    updatedAt: "2026-04-06T09:00:00.000Z",
    status: "ready",
    referenceSetState: createReferenceSetState({
      description: "Warm lacquered lantern with a gold frame and soft ember glow.",
      imageReferenceUrls: [
        "https://example.com/reference/red-lantern-01.jpg",
        "https://example.com/reference/red-lantern-02.jpg",
      ],
    }),
  },
  {
    id: "element-vintage-sedan",
    name: "Vintage Sedan",
    alias: "sedan",
    description: "Classic four-door car for cinematic street scenes.",
    assetType: "image",
    thumbnailUrl: null,
    imageReferenceUrls: [
      "https://example.com/reference/vintage-sedan-01.jpg",
      "https://example.com/reference/vintage-sedan-02.jpg",
      "https://example.com/reference/vintage-sedan-03.jpg",
    ],
    videoReferenceUrl: null,
    updatedAt: "2026-04-05T17:15:00.000Z",
    status: "ready",
    referenceSetState: createReferenceSetState({
      description: "Cream paint, chrome trim, rounded hood, and dramatic city-street reflections.",
      imageReferenceUrls: [
        "https://example.com/reference/vintage-sedan-01.jpg",
        "https://example.com/reference/vintage-sedan-02.jpg",
        "https://example.com/reference/vintage-sedan-03.jpg",
      ],
    }),
  },
  {
    id: "element-street-crowd",
    name: "Street Crowd",
    alias: "crowd",
    description: "Walking crowd plate for city movement reference.",
    assetType: "video",
    thumbnailUrl: null,
    imageReferenceUrls: [],
    videoReferenceUrl: "https://example.com/reference/street-crowd.mp4",
    updatedAt: "2026-04-04T14:30:00.000Z",
    status: "ready",
    referenceSetState: createReferenceSetState({
      description: "Loose evening foot traffic with layered depth and soft motion blur.",
      videoReferenceUrl: "https://example.com/reference/street-crowd.mp4",
    }),
  },
];
