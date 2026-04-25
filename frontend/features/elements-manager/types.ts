/**
 * Types for the Elements library shell and Supabase-backed draft state.
 */
export type ElementAssetType = "image" | "video";

export type ElementStatus = "draft" | "ready";

export type ElementProfileImageTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
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
  profileImageUrl: string | null;
  profileImageTransform: ElementProfileImageTransform;
  imageReferenceUrls: string[];
  videoReferenceUrl: string;
};
