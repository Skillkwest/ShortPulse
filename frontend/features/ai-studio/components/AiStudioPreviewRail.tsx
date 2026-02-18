/**
 * AI Studio preview rail boundary.
 * Isolates preview column renders from toolbar/properties/reference shell updates.
 */
import React from "react";
import { StudioPreview } from "./StudioPreview";
import { recordAiStudioShellSectionRender } from "../logic/shellRenderCounters";

type AiStudioPreviewRailProps = {
  studioPreviewProps: React.ComponentProps<typeof StudioPreview>;
  onDropFiles: (files: FileList) => void;
  onTriggerFilePicker: () => void;
  onOpenMediaLibrary?: () => void;
};

export const AiStudioPreviewRail = React.memo(function AiStudioPreviewRail({
  studioPreviewProps,
  onDropFiles,
  onTriggerFilePicker,
  onOpenMediaLibrary,
}: AiStudioPreviewRailProps) {
  recordAiStudioShellSectionRender("preview");
  return (
    <StudioPreview
      {...studioPreviewProps}
      onDropFiles={onDropFiles}
      onTriggerFileSelect={onTriggerFilePicker}
      onOpenMediaLibrary={onOpenMediaLibrary}
    />
  );
});
