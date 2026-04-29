/**
 * Hook-owned contracts for AI Studio page-content wiring.
 * Decouples hook return types from the `AiStudioPageContentProps` container type.
 */
import type { ComponentProps } from "react";
import type { PulseCreatePropertiesPanelProps } from "../../components/create/PulseCreatePropertiesPanel";
import type { StandardCreatePropertiesPanelProps } from "../../components/create/StandardCreatePropertiesPanel";
import type { ExpertEditPanelViewProps } from "../../components/edit/ExpertEditPanelView";
import type { ReferenceGridProps } from "../../components/ReferenceGrid";
import { StudioPreview } from "../../components/StudioPreview";
import type { VideoPropertiesPanelProps } from "../../components/VideoPropertiesPanel";
import type { StudioOutput } from "../../types";

export type AiStudioCreatePanelContract = StandardCreatePropertiesPanelProps &
  Partial<PulseCreatePropertiesPanelProps>;
export type AiStudioEditExpertPanelContract = ExpertEditPanelViewProps;
export type AiStudioVideoPanelContract = VideoPropertiesPanelProps;

export type AiStudioPanelContracts = {
  propertiesCreate: AiStudioCreatePanelContract;
  propertiesEditExpert: AiStudioEditExpertPanelContract;
  propertiesVideo: AiStudioVideoPanelContract;
};

export type AiStudioReferenceGridContract = Omit<ReferenceGridProps, "selectedTool">;
type StudioPreviewContractProps = ComponentProps<typeof StudioPreview>;

export type AiStudioPreviewDetailContracts = {
  studioPreviewProps: StudioPreviewContractProps;
  detailModalOutput: StudioOutput | null;
  onDetailClose: () => void;
  onUpdateOutputPrompt: (id: string, prompt: string) => void;
  onDeleteOutput: (id: string) => void;
  onDetailDownload: (id: string) => void;
  onDetailSaveReference: (id: string) => void;
  onDetailSavePrompt: (promptText: string) => void;
  onOpenMediaLibrary: () => void;
};
