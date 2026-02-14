/**
 * Workspace content composition for Media Library.
 * Renders the main header, upload stage, filters row, and gallery section in display order.
 */
import { MediaGallerySection, type MediaGallerySectionProps } from "./MediaGallerySection";
import { MediaFiltersRow, type MediaFiltersRowProps } from "./MediaFiltersRow";
import { MediaLibraryHeader, type MediaLibraryHeaderProps } from "./MediaLibraryHeader";
import { MediaUploadStage, type MediaUploadStageProps } from "./MediaUploadStage";

type WorkspaceFileRow = {
  id: string;
  filename: string;
  file_type: string;
  signedUrl?: string;
  status?: "uploading" | "ready";
};

type WorkspacePromptRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: string;
  created_at: string;
};

export type MediaLibraryWorkspaceContentProps<
  TFileRow extends WorkspaceFileRow,
  TPromptRow extends WorkspacePromptRow,
> = {
  filtersRowProps: MediaFiltersRowProps;
  gallerySectionProps: MediaGallerySectionProps<TFileRow, TPromptRow>;
  headerProps: MediaLibraryHeaderProps;
  uploadStageProps: MediaUploadStageProps;
};

/**
 * Renders the ordered Media Library workspace content sections.
 * Inputs: prepared prop groups for the header, upload, filter row, and gallery sections.
 * Output: composed page content blocks.
 * Side effects: none.
 */
export function MediaLibraryWorkspaceContent<
  TFileRow extends WorkspaceFileRow,
  TPromptRow extends WorkspacePromptRow,
>({
  filtersRowProps,
  gallerySectionProps,
  headerProps,
  uploadStageProps,
}: MediaLibraryWorkspaceContentProps<TFileRow, TPromptRow>) {
  return (
    <>
      <MediaLibraryHeader {...headerProps} />
      <MediaUploadStage {...uploadStageProps} />
      <MediaFiltersRow {...filtersRowProps} />
      <MediaGallerySection {...gallerySectionProps} />
    </>
  );
}
