export type ElementAssetType = "image" | "video";

export type ElementStatus = "draft" | "ready";

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
};
