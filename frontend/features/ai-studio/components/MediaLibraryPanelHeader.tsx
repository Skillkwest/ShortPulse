/**
 * Media Library panel header chrome.
 * Keeps project-name editing and hidden upload input out of the main panel shell.
 */
import React from "react";

type MediaLibraryPanelHeaderProps = {
  projectName: string | null;
  projectNameDraft: string;
  setProjectNameDraft: React.Dispatch<React.SetStateAction<string>>;
  commitProjectName: () => void;
  projectNamePlaceholder: string;
  projectNameInputWidthCh: number;
  rootUploadInputRef: React.Ref<HTMLInputElement>;
  onRootUploadSelection: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
};

/**
 * Renders the project header and hidden root upload input for the Media Library panel.
 */
export const MediaLibraryPanelHeader = React.memo(function MediaLibraryPanelHeader({
  projectName,
  projectNameDraft,
  setProjectNameDraft,
  commitProjectName,
  projectNamePlaceholder,
  projectNameInputWidthCh,
  rootUploadInputRef,
  onRootUploadSelection,
}: MediaLibraryPanelHeaderProps) {
  return (
    <>
      <header className="media-library-panel-header">
        <div className="media-library-panel-header-title-group">
          <p className="eyebrow">Media</p>
        </div>
        <label className="media-library-panel-project-name-field">
          <span className="media-library-panel-project-name-label eyebrow">PROJECT:</span>
          <span className="sr-only">Project name</span>
          <input
            type="text"
            value={projectNameDraft}
            onChange={(event) => setProjectNameDraft(event.target.value)}
            onBlur={commitProjectName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setProjectNameDraft(projectName ?? "");
                event.currentTarget.blur();
              }
            }}
            className="media-library-panel-project-name-input"
            placeholder={projectNamePlaceholder}
            aria-label="Project name"
            maxLength={120}
            style={{ width: `${projectNameInputWidthCh}ch` }}
          />
        </label>
      </header>

      <input
        ref={rootUploadInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="media-library-panel-file-input"
        onChange={(event) => {
          void onRootUploadSelection(event);
        }}
      />
    </>
  );
});
