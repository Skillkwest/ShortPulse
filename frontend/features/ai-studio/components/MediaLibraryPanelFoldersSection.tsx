import React from "react";
import { CaretLeft, CaretRight, Folders, Plus } from "phosphor-react";
import { AiStudioModalLayer } from "./modal-layer/AiStudioModalLayer";

const FOLDER_TILE_IMAGE_SRC = "/Folder 1.png";
const ROOT_FOLDER_LABEL = "All Media";

type FolderRow = {
  id: string;
  name: string;
};

type FolderContextMenuState = {
  folderId: string;
  folderName: string;
  x: number;
  y: number;
};

type MediaLibraryPanelFoldersSectionProps = {
  activeFolderName: string;
  folders: FolderRow[];
  activeFolderId: string;
  canNavigateUp: boolean;
  onNavigateUp: () => void;
  onNavigateToRoot: () => void;
  onNavigateToActiveFolder: () => void;
  setActiveFolderId: (folderId: string) => void;
  editingFolderId: string | null;
  editingFolderName: string;
  setEditingFolderName: (value: string) => void;
  startFolderRename: (folderId: string, folderName: string) => void;
  cancelFolderRename: () => void;
  commitFolderRename: () => Promise<void>;
  createFolder: () => Promise<void>;
  creatingFolder: boolean;
  folderError: string | null;
  hoveredFolderId: string | null;
  onFolderDragOver: (folderId: string, event: React.DragEvent<HTMLDivElement>) => void;
  onFolderDragLeave: (folderId: string) => void;
  onFolderDrop: (folderId: string, event: React.DragEvent<HTMLDivElement>) => Promise<void>;
  folderContextMenu: FolderContextMenuState | null;
  folderContextMenuRef: React.Ref<HTMLDivElement>;
  openFolderContextMenu: (
    event: React.MouseEvent<HTMLElement>,
    folder: FolderRow,
    isRoot: boolean
  ) => void;
  onContextRename: () => void;
  onContextDelete: () => Promise<void>;
};

export function MediaLibraryPanelFoldersSection({
  activeFolderName,
  folders,
  activeFolderId,
  canNavigateUp,
  onNavigateUp,
  onNavigateToRoot,
  onNavigateToActiveFolder,
  setActiveFolderId,
  editingFolderId,
  editingFolderName,
  setEditingFolderName,
  startFolderRename,
  cancelFolderRename,
  commitFolderRename,
  createFolder,
  creatingFolder,
  folderError,
  hoveredFolderId,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  folderContextMenu,
  folderContextMenuRef,
  openFolderContextMenu,
  onContextRename,
  onContextDelete,
}: MediaLibraryPanelFoldersSectionProps) {
  const visibleFolders = folders.filter((folder) => folder.id !== activeFolderId);

  return (
    <>
      <div className="media-library-panel-folders">
        <div className="media-library-panel-folders-head">
          <span className="tiny subdued">
            <Folders size={14} weight="bold" aria-hidden />
            <button
              type="button"
              className="media-library-panel-folders-breadcrumb-button media-library-panel-folders-root-label"
              onClick={onNavigateToRoot}
            >
              {ROOT_FOLDER_LABEL}
            </button>
            {canNavigateUp ? (
              <>
                <CaretRight
                  className="media-library-panel-folders-breadcrumb-caret"
                  size={11}
                  weight="bold"
                  aria-hidden
                />
                <button
                  type="button"
                  className="media-library-panel-folders-breadcrumb-button media-library-panel-folders-root-label"
                  onClick={onNavigateToActiveFolder}
                >
                  {activeFolderName || ROOT_FOLDER_LABEL}
                </button>
              </>
            ) : null}
          </span>
        </div>
        <div className="media-library-panel-folder-strip" role="list" aria-label="Media folders">
          {canNavigateUp ? (
            <div
              className="media-library-panel-folder-strip-item media-library-panel-folder-strip-item--navigate-up"
              role="listitem"
            >
              <button
                type="button"
                className="media-library-panel-folder-up-button"
                aria-label="Go to parent folder"
                onClick={onNavigateUp}
              >
                <CaretLeft size={26} weight="bold" aria-hidden />
              </button>
            </div>
          ) : null}
          {visibleFolders.map((folder) => {
            const isActive = activeFolderId === folder.id;
            const isEditing = editingFolderId === folder.id;
            return (
              <div
                key={folder.id}
                className={`media-library-panel-folder-strip-item ${
                  hoveredFolderId === folder.id ? "is-drop-hover" : ""
                }`}
                role="listitem"
                onContextMenu={(event) => openFolderContextMenu(event, folder, false)}
                onDragOver={(event) => onFolderDragOver(folder.id, event)}
                onDragLeave={() => onFolderDragLeave(folder.id)}
                onDrop={(event) => {
                  void onFolderDrop(folder.id, event);
                }}
              >
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      className="media-library-panel-folder-chip media-library-panel-folder-chip--image is-active is-editing"
                      onClick={() => setActiveFolderId(folder.id)}
                      aria-label={`${folder.name} folder`}
                    >
                      <img
                        className="media-library-panel-folder-chip-image"
                        src={FOLDER_TILE_IMAGE_SRC}
                        alt=""
                        aria-hidden="true"
                      />
                    </button>
                    <div className="media-library-panel-folder-chip-edit">
                      <input
                        className="media-library-panel-folder-chip-input"
                        type="text"
                        value={editingFolderName}
                        maxLength={64}
                        autoFocus
                        onChange={(event) => setEditingFolderName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void commitFolderRename();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelFolderRename();
                          }
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`media-library-panel-folder-chip media-library-panel-folder-chip--image ${
                        isActive ? "is-active" : ""
                      }`}
                      onClick={() => setActiveFolderId(folder.id)}
                      aria-label={`${folder.name} folder`}
                    >
                      <img
                        className="media-library-panel-folder-chip-image"
                        src={FOLDER_TILE_IMAGE_SRC}
                        alt=""
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      className="media-library-panel-folder-chip-name tiny"
                      onClick={() => setActiveFolderId(folder.id)}
                      onDoubleClick={() => {
                        startFolderRename(folder.id, folder.name);
                      }}
                      aria-label={`${folder.name} name`}
                    >
                      {folder.name}
                    </button>
                  </>
                )}
              </div>
            );
          })}
          <div
            className="media-library-panel-folder-strip-item media-library-panel-folder-strip-item--create"
            role="listitem"
          >
            <button
              type="button"
              className="media-library-panel-folder-chip is-create"
              aria-label="Create new folder"
              onClick={() => {
                void createFolder();
              }}
              disabled={creatingFolder}
            >
              <Plus size={24} weight="bold" aria-hidden />
            </button>
          </div>
        </div>
      </div>
      {folderError ? <p className="tiny subdued">{folderError}</p> : null}
      {folderContextMenu ? (
        <AiStudioModalLayer>
          <div
            ref={folderContextMenuRef}
            className="media-library-panel-folder-context-menu"
            role="menu"
            aria-label={`${folderContextMenu.folderName} folder actions`}
            style={{
              top: `${folderContextMenu.y}px`,
              left: `${folderContextMenu.x}px`,
            }}
          >
            <button
              type="button"
              className="media-library-panel-folder-context-menu-item"
              role="menuitem"
              onClick={onContextRename}
            >
              Rename folder
            </button>
            <button
              type="button"
              className="media-library-panel-folder-context-menu-item is-destructive"
              role="menuitem"
              onClick={() => {
                void onContextDelete();
              }}
            >
              Delete folder
            </button>
          </div>
        </AiStudioModalLayer>
      ) : null}
    </>
  );
}
