/**
 * Hook-owned contracts for AI Studio page-content wiring.
 * Decouples hook return types from the `AiStudioPageContentProps` container type.
 */
import type { ComponentProps } from "react";
import type { CreateMode } from "../../components/create/createModeTypes";
import type { PulseCreatePropertiesPanelProps } from "../../components/create/PulseCreatePropertiesPanel";
import type { StandardCreatePropertiesPanelProps } from "../../components/create/StandardCreatePropertiesPanel";
import type { ExpertEditPanelViewProps } from "../../components/edit/ExpertEditPanelView";
import type { ReferenceGridProps } from "../../components/ReferenceGrid";
import { StudioPreview } from "../../components/StudioPreview";
import type { VideoPropertiesPanelProps } from "../../components/VideoPropertiesPanel";
import type { StudioOutput } from "../../types";

type AiStudioCreatePanelBaseContract = {
  expertCreateMode: CreateMode;
  onExpertCreateModeChange?: (value: CreateMode) => void;
};

export type AiStudioCreatePanelContract =
  | (AiStudioCreatePanelBaseContract & {
      expertCreateMode: "standard";
      standard: StandardCreatePropertiesPanelProps;
      pulse?: never;
    })
  | (AiStudioCreatePanelBaseContract & {
      expertCreateMode: "pulse";
      pulse: PulseCreatePropertiesPanelProps;
      standard?: never;
    });
export type AiStudioEditExpertPanelContract = ExpertEditPanelViewProps;
export type AiStudioVideoPanelContract = VideoPropertiesPanelProps;

export type AiStudioDetailNavigationContract = {
  sourceSurface: "reference-grid";
  canNavigatePrevious: boolean;
  canNavigateNext: boolean;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
};

export type AiStudioPanelContracts = {
  propertiesCreate: AiStudioCreatePanelContract;
  propertiesEditExpert: AiStudioEditExpertPanelContract;
  propertiesVideo: AiStudioVideoPanelContract;
};

export type AiStudioReferenceGridContract = Omit<ReferenceGridProps, "selectedTool">;
export type AiStudioReferenceGridRuntimeContract = AiStudioReferenceGridContract & {
  detailNavigation: AiStudioDetailNavigationContract | null;
};
type StudioPreviewContractProps = ComponentProps<typeof StudioPreview>;

export type AiStudioPreviewDetailContracts = {
  studioPreviewProps: StudioPreviewContractProps;
  detailModalOutput: StudioOutput | null;
  detailNavigation: AiStudioDetailNavigationContract | null;
  isMediaStorageFull: boolean;
  onDetailClose: () => void;
  onUpdateOutputPrompt: (id: string, prompt: string) => void;
  onDeleteOutput: (id: string) => void;
  onDetailDownload: (id: string) => void;
  onDetailSaveReference: (id: string) => void;
  onDetailSavePrompt: (promptText: string) => void | boolean | Promise<boolean>;
  onOpenMediaLibrary: () => void;
};
