import type { ComponentProps } from "react";
import { EmbeddedMediaLibraryPanel } from "../../ai-studio/components/EmbeddedMediaLibraryPanel";

type CharacterEmbeddedMediaLibraryPanelProps = Omit<
  ComponentProps<typeof EmbeddedMediaLibraryPanel>,
  | "surface"
  | "ariaLabel"
  | "errorTelemetrySource"
  | "deleteConfirmActivityId"
  | "unresolvedWarningPrefix"
  | "panelClassName"
  | "contentClassName"
>;

export function CharacterEmbeddedMediaLibraryPanel(props: CharacterEmbeddedMediaLibraryPanelProps) {
  return (
    <EmbeddedMediaLibraryPanel
      {...props}
      surface="character-media-panel"
      ariaLabel="Character media library panel"
      errorTelemetrySource="client.character_manager.media_library_error"
      deleteConfirmActivityId="character-media-library-delete-confirm"
      unresolvedWarningPrefix="[character-media-library]"
      panelClassName="character-embedded-media-library-panel"
      contentClassName="character-embedded-media-library-content"
    />
  );
}
