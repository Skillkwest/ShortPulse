/**
 * Elements library constants and draft defaults.
 */
import type { ElementDraft, ElementProfileImageTransform } from "./types";

export const ELEMENT_PANEL_ACCENT = "rgba(231, 92, 134, 0.96)";
export const ELEMENT_PANEL_ACCENT_SOFT = "rgba(242, 156, 188, 0.96)";
export const ELEMENT_PANEL_ACCENT_FAINT = "rgba(231, 92, 134, 0.18)";
export const ELEMENT_PANEL_ACCENT_LABEL = "#de7da4";
export const ELEMENT_PANEL_ACCENT_HELPER = "rgba(240, 171, 198, 0.92)";
export const ELEMENT_PANEL_ACCENT_PROGRESS_TEXT = "rgba(248, 193, 214, 0.95)";

export const DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM: ElementProfileImageTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

export const createEmptyElementDraft = (): ElementDraft => {
  return {
    name: "",
    description: "",
    assetType: "image",
    profileImageUrl: null,
    profileImageTransform: DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM,
    imageReferenceUrls: [],
    videoReferenceUrl: "",
  };
};
