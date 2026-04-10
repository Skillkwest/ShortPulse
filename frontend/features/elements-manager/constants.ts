/**
 * Elements library constants and draft defaults.
 */
import type {
  ElementDraft,
  ElementProfileImageTransform,
  ElementLibraryItem,
  ElementReferenceSet,
  ElementReferenceSetId,
  ElementReferenceSetLabelMap,
  ElementReferenceSetMap,
  ElementReferenceSetState,
} from "./types";

export const DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM: ElementProfileImageTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

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
  assetType: "image",
  description: "",
  deckReferenceUrls: [],
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
  return {
    name: "",
    alias: "",
    description: "",
    assetType: "image",
    profileImageUrl: null,
    profileImageTransform: DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM,
    imageReferenceUrls: [],
    videoReferenceUrl: "",
  };
};

export const createMockElementsLibrary = (): ElementLibraryItem[] => [
  {
    id: "element-red-lantern",
    name: "Red Lantern",
    alias: "redlantern",
    description: "Small glowing lantern used in night market scenes.",
    assetType: "image",
    profileImageUrl: null,
    profileImageTransform: DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM,
    thumbnailUrl: null,
    imageReferenceUrls: [
      "https://example.com/reference/red-lantern-01.jpg",
      "https://example.com/reference/red-lantern-02.jpg",
    ],
    videoReferenceUrl: null,
    updatedAt: "2026-04-06T09:00:00.000Z",
    status: "ready",
  },
  {
    id: "element-vintage-sedan",
    name: "Vintage Sedan",
    alias: "sedan",
    description: "Classic four-door car for cinematic street scenes.",
    assetType: "image",
    profileImageUrl: null,
    profileImageTransform: DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM,
    thumbnailUrl: null,
    imageReferenceUrls: [
      "https://example.com/reference/vintage-sedan-01.jpg",
      "https://example.com/reference/vintage-sedan-02.jpg",
      "https://example.com/reference/vintage-sedan-03.jpg",
    ],
    videoReferenceUrl: null,
    updatedAt: "2026-04-05T17:15:00.000Z",
    status: "ready",
  },
  {
    id: "element-street-crowd",
    name: "Street Crowd",
    alias: "crowd",
    description: "Walking crowd plate for city movement reference.",
    assetType: "video",
    profileImageUrl: null,
    profileImageTransform: DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM,
    thumbnailUrl: null,
    imageReferenceUrls: [],
    videoReferenceUrl: "https://example.com/reference/street-crowd.mp4",
    updatedAt: "2026-04-04T14:30:00.000Z",
    status: "ready",
  },
];
