import type { ComponentProps } from "react";
import { EmbeddedMediaLibraryPanel } from "./EmbeddedMediaLibraryPanel";

type ElementsEmbeddedMediaLibraryPanelProps = Omit<
  ComponentProps<typeof EmbeddedMediaLibraryPanel>,
  | "surface"
  | "ariaLabel"
  | "errorTelemetrySource"
  | "deleteConfirmActivityId"
  | "unresolvedWarningPrefix"
  | "panelClassName"
  | "contentClassName"
>;

export function ElementsEmbeddedMediaLibraryPanel(props: ElementsEmbeddedMediaLibraryPanelProps) {
  return (
    <EmbeddedMediaLibraryPanel
      {...props}
      surface="elements-media-panel"
      ariaLabel="Elements media library panel"
      errorTelemetrySource="telemetry.ai_studio.elements_media_library_error"
      deleteConfirmActivityId="elements-media-library-delete-confirm"
      unresolvedWarningPrefix="[elements-media-library]"
      panelClassName="elements-embedded-media-library-panel"
      contentClassName="elements-embedded-media-library-content"
    />
  );
}
