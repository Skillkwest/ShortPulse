/**
 * Hook-owned contracts for AI Studio page-content wiring.
 * Decouples hook return types from the `AiStudioPageContentProps` container type.
 */
import type { ComponentProps } from "react";
import type { CreatePropertiesPanelProps } from "../../components/CreatePropertiesPanel";
import type { EditPropertiesPanelProps } from "../../components/EditPropertiesPanel";
import type { ExpertEditPanelViewProps } from "../../components/edit/ExpertEditPanelView";
import type { ReferenceGridProps } from "../../components/ReferenceGrid";
import { StudioPreview } from "../../components/StudioPreview";
import type { VideoPropertiesPanelProps } from "../../components/VideoPropertiesPanel";
import type { StudioOutput } from "../../types";

export type AiStudioCreatePanelContract = CreatePropertiesPanelProps;
export type AiStudioEditPanelContract = EditPropertiesPanelProps;
export type AiStudioEditExpertPanelContract = ExpertEditPanelViewProps;
export type AiStudioVideoPanelContract = VideoPropertiesPanelProps;

export type AiStudioPanelContracts = {
  propertiesCreate: AiStudioCreatePanelContract;
  propertiesImage: AiStudioEditPanelContract;
  propertiesEditExpert: AiStudioEditExpertPanelContract;
  propertiesVideo: AiStudioVideoPanelContract;
  /**
   * @deprecated Use `propertiesCreate`.
   */
  propertiesText: AiStudioCreatePanelContract;
};

export type AiStudioReferenceGridContract = ReferenceGridProps;
type StudioPreviewContractProps = ComponentProps<typeof StudioPreview>;

export type AiStudioPreviewDetailContracts = {
  studioPreviewProps: StudioPreviewContractProps;
  detailModalOutput: StudioOutput | null;
  onDetailClose: () => void;
  onUpdateOutputPrompt: (id: string, prompt: string) => void;
  onDeleteOutput: (id: string) => void;
  onDetailDownload: (id: string) => void;
  onDetailSavePrompt: (promptText: string) => void;
  onOpenMediaLibrary: () => void;
};
