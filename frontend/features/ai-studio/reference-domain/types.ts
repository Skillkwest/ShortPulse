/**
 * Canonical reference-domain contracts for AI Studio.
 * Keeps entity/state/action definitions centralized for modular reducer and selector logic.
 */
import type { StudioOutput } from "../types";

export type ReferenceEntityKind = "upload" | "libraryMedia" | "generated" | "promptReference";

export type ReferenceEntityBase = {
  id: string;
  kind: ReferenceEntityKind;
  output: StudioOutput;
};

export type UploadReferenceEntity = ReferenceEntityBase & {
  kind: "upload";
};

export type LibraryMediaReferenceEntity = ReferenceEntityBase & {
  kind: "libraryMedia";
};

export type GeneratedReferenceEntity = ReferenceEntityBase & {
  kind: "generated";
};

export type PromptReferenceEntity = ReferenceEntityBase & {
  kind: "promptReference";
};

export type ReferenceEntity =
  | UploadReferenceEntity
  | LibraryMediaReferenceEntity
  | GeneratedReferenceEntity
  | PromptReferenceEntity;

export type ReferenceStateMeta = {
  version: number;
  lastUpdatedAt: string | null;
};

export type ReferenceState = {
  ids: string[];
  entities: Record<string, ReferenceEntity>;
  quickSlotIds: string[];
  archivedIds: string[];
  meta: ReferenceStateMeta;
};

export type ReferenceQuickSlotPlacement = "before" | "after" | "end";

export type ReferenceMediaHydrationPatch = Partial<
  Pick<
    StudioOutput,
    | "previewUrl"
    | "resultUrls"
    | "previewStoragePath"
    | "fullStoragePath"
    | "previewTier"
    | "mediaSource"
    | "localObjectUrl"
  >
>;

export type ReferenceReducerAction =
  | { type: "addMany"; entities: ReferenceEntity[]; archived?: boolean; updatedAt?: string | null }
  | { type: "remove"; id: string; updatedAt?: string | null }
  | { type: "archive"; id: string; updatedAt?: string | null }
  | { type: "restore"; id: string; updatedAt?: string | null }
  | { type: "setQuickSlots"; ids: string[]; updatedAt?: string | null }
  | {
      type: "reorderQuickSlots";
      id: string;
      targetId: string | null;
      placement: ReferenceQuickSlotPlacement;
      updatedAt?: string | null;
    }
  | {
      type: "setStatus";
      id: string;
      status: StudioOutput["status"];
      updatedAt?: string | null;
    }
  | {
      type: "hydrateMedia";
      id: string;
      patch: ReferenceMediaHydrationPatch;
      updatedAt?: string | null;
    };
