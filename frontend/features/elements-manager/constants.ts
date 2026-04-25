/**
 * Elements library constants and draft defaults.
 */
import type { ElementDraft, ElementProfileImageTransform } from "./types";

export const DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM: ElementProfileImageTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

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
