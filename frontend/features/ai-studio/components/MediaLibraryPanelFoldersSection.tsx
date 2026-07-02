import React, { useEffect, useRef } from "react";
import { CaretLeft, CaretRight, FolderSimple, Plus } from "phosphor-react";
import { AiStudioModalLayer } from "./modal-layer/AiStudioModalLayer";

const FOLDER_TILE_IMAGE_SRC = "/Folder 1.png";
const ROOT_FOLDER_LABEL = "All Media";
const PENDING_FOLDER_ID_PREFIX = "__pending_new_folder__";

type FolderRow = {
  id: string;
  name: string;
  parentFolderId?: string | null;
  itemCount?: number;
};

type FolderContextMenuState = {
  folderId: string;
  folderName: string;
  x: number;
  y: number;
};

type MediaLibraryPanelFoldersSectionProps = {
  ancestorFolders: FolderRow[];
  folders: FolderRow[];
  canNavigateUp: boolean;
  onNavigateUp: () => void;
  onNavigateToRoot: () => void;
  onNavigateToFolder: (folderId: string) => void;
  onOpenFolderWithAnimation: (folderId: string, sourceElement: HTMLElement) => void;
  setActiveFolderId: (folderId: string) => void;
  editingFolderId: string | null;
  editingFolderName: string;
  setEditingFolderName: (value: string) => void;
  startFolderRename: (
    folderId: string,
    folderName: string,
    options?: { clearInput?: boolean }
  ) => void;
  cancelFolderRename: () => void;
  commitFolderRename: () => Promise<void>;
  createFolder: () => Promise<void>;
  creatingFolder: boolean;
  folderError: string | null;
  hoveredFolderId: string | null;
  hoveredReparentFolderId: string | null;
  isRootReparentDropHover: boolean;
  onFolderDragOver: (folderId: string, event: React.DragEvent<HTMLDivElement>) => void;
  onFolderDragLeave: (folderId: string) => void;
  onFolderDrop: (folderId: string, event: React.DragEvent<HTMLDivElement>) => Promise<void>;
  onFolderReparentDragStart: (event: React.DragEvent<HTMLElement>, folder: FolderRow) => void;
  onFolderReparentDragEnd: (event: React.DragEvent<HTMLElement>) => void;
  onFolderReparentDragOver: (folderId: string | null, event: React.DragEvent<HTMLElement>) => void;
  onFolderReparentDragLeave: (folderId: string | null) => void;
  onFolderReparentDrop: (
    folderId: string | null,
    event: React.DragEvent<HTMLElement>
  ) => Promise<boolean>;
  folderContextMenu: FolderContextMenuState | null;
  folderContextMenuRef: React.Ref<HTMLDivElement>;
  openFolderContextMenu: (
    event: React.MouseEvent<HTMLElement>,
    folder: FolderRow,
    isRoot: boolean
  ) => void;
  onContextCreateSubfolder: () => void;
  onContextRename: () => void;
  canOpenMovePicker: boolean;
  onOpenMovePicker: () => void;
  onContextDelete: () => Promise<void>;
};

export const MediaLibraryPanelFoldersSection = React.memo(function MediaLibraryPanelFoldersSection({
  ancestorFolders,
  folders,
  canNavigateUp,
  onNavigateUp,
  onNavigateToRoot,
  onNavigateToFolder,
  onOpenFolderWithAnimation,
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
  hoveredReparentFolderId,
  isRootReparentDropHover,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  onFolderReparentDragStart,
  onFolderReparentDragEnd,
  onFolderReparentDragOver,
  onFolderReparentDragLeave,
  onFolderReparentDrop,
  folderContextMenu,
  folderContextMenuRef,
  openFolderContextMenu,
  onContextCreateSubfolder,
  onContextRename,
  canOpenMovePicker,
  onOpenMovePicker,
  onContextDelete,
}: MediaLibraryPanelFoldersSectionProps) {
  const folderNameClickTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (folderNameClickTimeoutRef.current !== null) {
        window.clearTimeout(folderNameClickTimeoutRef.current);
      }
    };
  }, []);

  const isPendingFolderId = (folderId: string): boolean =>
    folderId.startsWith(PENDING_FOLDER_ID_PREFIX);

  const handleOpenFolder = (folderId: string) => {
    if (isPendingFolderId(folderId)) return;
    setActiveFolderId(folderId);
  };

  const handleFolderNameClick = (folderId: string) => {
    if (folderNameClickTimeoutRef.current !== null) {
      window.clearTimeout(folderNameClickTimeoutRef.current);
    }
    folderNameClickTimeoutRef.current = window.setTimeout(() => {
      handleOpenFolder(folderId);
      folderNameClickTimeoutRef.current = null;
    }, 180);
  };

  const handleFolderNameDoubleClick = (folderId: string, folderName: string) => {
    if (folderNameClickTimeoutRef.current !== null) {
      window.clearTimeout(folderNameClickTimeoutRef.current);
      folderNameClickTimeoutRef.current = null;
    }
    startFolderRename(folderId, folderName, { clearInput: true });
  };

  const handleFolderChipDoubleClick = (
    folderId: string,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (isPendingFolderId(folderId)) return;
    onOpenFolderWithAnimation(folderId, event.currentTarget);
  };

  const clearPendingFolderNameClick = () => {
    if (folderNameClickTimeoutRef.current === null) return;
    window.clearTimeout(folderNameClickTimeoutRef.current);
    folderNameClickTimeoutRef.current = null;
  };

  const handleFolderReparentDragStart = (
    event: React.DragEvent<HTMLElement>,
    folder: FolderRow,
    isPending: boolean
  ) => {
    clearPendingFolderNameClick();
    if (isPending) {
      event.preventDefault();
      return;
    }
    onFolderReparentDragStart(event, folder);
  };

  const renderBreadcrumbLabel = (label: string) => (
    <span className="media-library-panel-folders-breadcrumb-label">
      <FolderSimple
        className="media-library-panel-folders-breadcrumb-folder-icon"
        size={12}
        aria-hidden
      />
      <span className="media-library-panel-folders-root-label">{label}</span>
    </span>
  );

  const toFolderItemCountLabel = (itemCount: number) =>
    `${itemCount} ${itemCount === 1 ? "item" : "items"}`;

  return (
    <>
      <div className="media-library-panel-folders">
        <div className="media-library-panel-folders-head">
          <span className="tiny subdued">
            <button
              type="button"
              className={`media-library-panel-folders-breadcrumb-button${
                isRootReparentDropHover ? " is-drop-hover" : ""
              }`}
              onClick={onNavigateToRoot}
              onDragOver={(event) => onFolderReparentDragOver(null, event)}
              onDragLeave={() => onFolderReparentDragLeave(null)}
              onDrop={(event) => {
                void onFolderReparentDrop(null, event);
              }}
            >
              {renderBreadcrumbLabel(ROOT_FOLDER_LABEL)}
            </button>
            {ancestorFolders.map((folder, index) => (
              <React.Fragment key={folder.id}>
                <CaretRight
                  className="media-library-panel-folders-breadcrumb-caret"
                  size={11}
                  weight="bold"
                  aria-hidden
                />
                {index === ancestorFolders.length - 1 ? (
                  <span
                    className="media-library-panel-folders-breadcrumb-current"
                    aria-current="location"
                  >
                    {renderBreadcrumbLabel(folder.name)}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="media-library-panel-folders-breadcrumb-button"
                    onClick={() => onNavigateToFolder(folder.id)}
                  >
                    {renderBreadcrumbLabel(folder.name)}
                  </button>
                )}
              </React.Fragment>
            ))}
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
          {folders.map((folder) => {
            const isEditing = editingFolderId === folder.id;
            const isPending = isPendingFolderId(folder.id);
            return (
              <div
                key={folder.id}
                className={`media-library-panel-folder-strip-item ${
                  hoveredFolderId === folder.id || hoveredReparentFolderId === folder.id
                    ? "is-drop-hover"
                    : ""
                }`}
                role="listitem"
                onContextMenu={(event) => openFolderContextMenu(event, folder, false)}
                onDragOver={(event) => {
                  onFolderReparentDragOver(folder.id, event);
                  if (event.defaultPrevented) return;
                  onFolderDragOver(folder.id, event);
                }}
                onDragLeave={() => {
                  onFolderReparentDragLeave(folder.id);
                  onFolderDragLeave(folder.id);
                }}
                onDrop={(event) => {
                  void onFolderReparentDrop(folder.id, event).then((handled) => {
                    if (handled) return;
                    void onFolderDrop(folder.id, event);
                  });
                }}
              >
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      className="media-library-panel-folder-chip media-library-panel-folder-chip--image is-active is-editing"
                      onClick={() => handleOpenFolder(folder.id)}
                      aria-label={`${folder.name} folder`}
                      aria-disabled={isPending}
                    >
                      {/* Decorative folder tile image; raw img preserves current chip sizing and load behavior. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="media-library-panel-folder-chip-image"
                        src={FOLDER_TILE_IMAGE_SRC}
                        alt=""
                        aria-hidden="true"
                      />
                      {typeof folder.itemCount === "number" ? (
                        <span
                          className="media-library-panel-folder-chip-count-badge"
                          aria-label={toFolderItemCountLabel(folder.itemCount)}
                        >
                          {folder.itemCount}
                        </span>
                      ) : null}
                    </button>
                    <div className="media-library-panel-folder-chip-edit">
                      <input
                        className="media-library-panel-folder-chip-input"
                        type="text"
                        value={editingFolderName}
                        placeholder={folder.name}
                        maxLength={64}
                        autoFocus
                        onChange={(event) => setEditingFolderName(event.target.value)}
                        onBlur={() => {
                          if (editingFolderName.trim()) {
                            void commitFolderRename();
                            return;
                          }
                          cancelFolderRename();
                        }}
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
                      className="media-library-panel-folder-chip media-library-panel-folder-chip--image"
                      onDoubleClick={(event) => handleFolderChipDoubleClick(folder.id, event)}
                      aria-label={`${folder.name} folder`}
                      aria-disabled={isPending}
                      draggable={!isPending}
                      onDragStart={(event) =>
                        handleFolderReparentDragStart(event, folder, isPending)
                      }
                      onDragEnd={onFolderReparentDragEnd}
                    >
                      {/* Decorative folder tile image; raw img preserves current chip sizing and load behavior. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="media-library-panel-folder-chip-image"
                        src={FOLDER_TILE_IMAGE_SRC}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                      />
                      {typeof folder.itemCount === "number" ? (
                        <span
                          className="media-library-panel-folder-chip-count-badge"
                          aria-label={toFolderItemCountLabel(folder.itemCount)}
                        >
                          {folder.itemCount}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="media-library-panel-folder-chip-name tiny"
                      onClick={() => handleFolderNameClick(folder.id)}
                      onDoubleClick={() => {
                        handleFolderNameDoubleClick(folder.id, folder.name);
                      }}
                      aria-label={`${folder.name} name`}
                      aria-disabled={isPending}
                      draggable={!isPending}
                      onDragStart={(event) =>
                        handleFolderReparentDragStart(event, folder, isPending)
                      }
                      onDragEnd={onFolderReparentDragEnd}
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
              onClick={onContextCreateSubfolder}
            >
              New subfolder
            </button>
            <button
              type="button"
              className="media-library-panel-folder-context-menu-item"
              role="menuitem"
              onClick={onContextRename}
            >
              Rename folder
            </button>
            {canOpenMovePicker ? (
              <button
                type="button"
                className="media-library-panel-folder-context-menu-item"
                role="menuitem"
                onClick={onOpenMovePicker}
              >
                Move to...
              </button>
            ) : null}
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
});
