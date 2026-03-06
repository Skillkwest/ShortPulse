/**
 * Boundary adapter that maps hook-owned contracts into `AiStudioPageContent` props.
 */
import type { AiStudioPageContentProps } from "../../components/AiStudioPageContent";
import type { CanvasPropertiesPanelProps } from "../../components/canvas/useAiStudioCanvasWorkspaceState";
import type {
  AiStudioPanelContracts,
  AiStudioPreviewDetailContracts,
  AiStudioReferenceGridContract,
} from "./pageContentContracts";

type AiStudioPageContentAdapterInput = {
  panelProps: AiStudioPanelContracts;
  canvasProps: CanvasPropertiesPanelProps;
  referenceGridProps: AiStudioReferenceGridContract;
  previewDetailProps: AiStudioPreviewDetailContracts;
};

export type AiStudioPageContentAdapterOutput = Pick<
  AiStudioPageContentProps,
  | "propertiesCreate"
  | "propertiesText"
  | "propertiesImage"
  | "propertiesEditExpert"
  | "propertiesVideo"
  | "propertiesCanvas"
  | "referenceGridProps"
  | "studioPreviewProps"
  | "detailModalOutput"
  | "onDetailClose"
  | "onUpdateOutputPrompt"
  | "onDeleteOutput"
  | "onDetailDownload"
  | "onDetailSavePrompt"
  | "onOpenMediaLibrary"
>;

/**
 * Adapts hook-owned contracts to the page-content component contract.
 */
export const mapHookContractsToPageContentProps = ({
  panelProps,
  canvasProps,
  referenceGridProps,
  previewDetailProps,
}: AiStudioPageContentAdapterInput): AiStudioPageContentAdapterOutput => ({
  propertiesCreate: panelProps.propertiesCreate,
  propertiesText: panelProps.propertiesText,
  propertiesImage: panelProps.propertiesImage,
  propertiesEditExpert: panelProps.propertiesEditExpert,
  propertiesVideo: panelProps.propertiesVideo,
  propertiesCanvas: canvasProps,
  referenceGridProps,
  studioPreviewProps: previewDetailProps.studioPreviewProps,
  detailModalOutput: previewDetailProps.detailModalOutput,
  onDetailClose: previewDetailProps.onDetailClose,
  onUpdateOutputPrompt: previewDetailProps.onUpdateOutputPrompt,
  onDeleteOutput: previewDetailProps.onDeleteOutput,
  onDetailDownload: previewDetailProps.onDetailDownload,
  onDetailSavePrompt: previewDetailProps.onDetailSavePrompt,
  onOpenMediaLibrary: previewDetailProps.onOpenMediaLibrary,
});
