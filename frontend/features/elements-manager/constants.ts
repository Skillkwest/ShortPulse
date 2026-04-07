import type { ElementDraft, ElementLibraryItem } from "./types";

export const createEmptyElementDraft = (): ElementDraft => ({
  name: "",
  alias: "",
  description: "",
  assetType: "image",
  imageReferenceUrls: [],
  videoReferenceUrl: "",
});

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
  },
];
