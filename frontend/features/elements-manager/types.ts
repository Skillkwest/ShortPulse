/**
 * Local-only types for the Elements library UI shell.
 * Keeps the cloned Character-style surface self-contained and decoupled from provider wiring.
 */
export type ElementAssetType = "image" | "video";

export type ElementStatus = "draft" | "ready";

export type ElementReferenceSetId = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10";

export type ElementReferenceSet = {
  description: string;
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
  thumbnailUrl: string | null;
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
  imageReferenceUrls: string[];
  videoReferenceUrl: string;
  activeReferenceSetId: ElementReferenceSetId;
  visibleReferenceSetIds: ElementReferenceSetId[];
  referenceSetLabels: ElementReferenceSetLabelMap;
  referenceSets: ElementReferenceSetMap;
};
