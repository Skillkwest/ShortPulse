/**
 * Types for the Elements library shell and Supabase-backed draft state.
 */
export type ElementAssetType = "image" | "video";

export type ElementStatus = "draft" | "ready";

export type ElementReferenceSetId = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10";

export type ElementProfileImageTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export type ElementReferenceSet = {
  assetType: ElementAssetType;
  description: string;
  deckReferenceUrls: string[];
  imageReferenceUrls: string[];
  videoReferenceUrl: string;
};

export type ElementReferenceSetMap = Record<ElementReferenceSetId, ElementReferenceSet>;

export type ElementReferenceSetLabelMap = Record<ElementReferenceSetId, string>;

export type ElementReferenceSetState = {
  activeSetId: ElementReferenceSetId;
  tabOrder: ElementReferenceSetId[];
  tabLabels: ElementReferenceSetLabelMap;
  sets: ElementReferenceSetMap;
};

export type ElementLibraryItem = {
  id: string;
  name: string;
  alias: string;
  description: string;
  assetType: ElementAssetType;
  profileImageUrl: string | null;
  profileImageTransform: ElementProfileImageTransform;
  thumbnailUrl: string | null;
  deckReferenceUrls: string[];
  imageReferenceUrls: string[];
  videoReferenceUrl: string | null;
  updatedAt: string | null;
  status: ElementStatus;
  referenceSetState: ElementReferenceSetState;
};

export type ElementsWorkflowTab = "manage" | "profile";

export type ElementsProfileMode = "create" | "edit";

export type ElementDraft = {
  name: string;
  alias: string;
  description: string;
  assetType: ElementAssetType;
  profileImageUrl: string | null;
  profileImageTransform: ElementProfileImageTransform;
  deckReferenceUrls: string[];
  imageReferenceUrls: string[];
  videoReferenceUrl: string;
  activeReferenceSetId: ElementReferenceSetId;
  visibleReferenceSetIds: ElementReferenceSetId[];
  referenceSetLabels: ElementReferenceSetLabelMap;
  referenceSets: ElementReferenceSetMap;
};
