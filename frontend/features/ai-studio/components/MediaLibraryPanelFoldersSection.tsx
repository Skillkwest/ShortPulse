import React, { useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight, FolderSimple, Plus } from "phosphor-react";
import { AiStudioModalLayer } from "./modal-layer/AiStudioModalLayer";

const FOLDER_TILE_IMAGE_SRC = "/Folder 1.png";
const ROOT_FOLDER_LABEL = "All Media";
const PENDING_FOLDER_ID_PREFIX = "__pending_new_folder__";

type FolderRow = {
  id: string;
  name: string;
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
  onContextCreateSubfolder: () => void;
  onContextRename: () => void;
  canOpenMovePicker: boolean;
  onOpenMovePicker: () => void;
  onContextDelete: () => Promise<void>;
};

export function MediaLibraryPanelFoldersSection({
  ancestorFolders,
  folders,
  canNavigateUp,
  onNavigateUp,
  onNavigateToRoot,
  onNavigateToFolder,
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
  onContextCreateSubfolder,
  onContextRename,
  canOpenMovePicker,
  onOpenMovePicker,
  onContextDelete,
}: MediaLibraryPanelFoldersSectionProps) {
  const folderImageRefs = useRef(new Map<string, HTMLButtonElement>());
  const navigateTimeoutRef = useRef<number | null>(null);
  const folderNameClickTimeoutRef = useRef<number | null>(null);
  const [openingFolderId, setOpeningFolderId] = useState<string | null>(null);
  const [openingFolderGhost, setOpeningFolderGhost] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current !== null) {
        window.clearTimeout(navigateTimeoutRef.current);
      }
      if (folderNameClickTimeoutRef.current !== null) {
        window.clearTimeout(folderNameClickTimeoutRef.current);
      }
    };
  }, []);

  const isPendingFolderId = (folderId: string): boolean =>
    folderId.startsWith(PENDING_FOLDER_ID_PREFIX);

  const handleOpenFolder = (folderId: string) => {
    if (isPendingFolderId(folderId)) return;
    if (openingFolderId !== null) return;
    const sourceElement = folderImageRefs.current.get(folderId);
    if (!sourceElement) {
      setActiveFolderId(folderId);
      return;
    }
    const rect = sourceElement.getBoundingClientRect();
    setOpeningFolderId(folderId);
    setOpeningFolderGhost({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
    navigateTimeoutRef.current = window.setTimeout(() => {
      setActiveFolderId(folderId);
      setOpeningFolderId(null);
      setOpeningFolderGhost(null);
      navigateTimeoutRef.current = null;
    }, 120);
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
              className="media-library-panel-folders-breadcrumb-button"
              onClick={onNavigateToRoot}
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
                      ref={(node) => {
                        if (node) {
                          folderImageRefs.current.set(folder.id, node);
                        } else {
                          folderImageRefs.current.delete(folder.id);
                        }
                      }}
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
                      ref={(node) => {
                        if (node) {
                          folderImageRefs.current.set(folder.id, node);
                        } else {
                          folderImageRefs.current.delete(folder.id);
                        }
                      }}
                      type="button"
                      className="media-library-panel-folder-chip media-library-panel-folder-chip--image"
                      onDoubleClick={() => handleOpenFolder(folder.id)}
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
                    <button
                      type="button"
                      className="media-library-panel-folder-chip-name tiny"
                      onClick={() => handleFolderNameClick(folder.id)}
                      onDoubleClick={() => {
                        handleFolderNameDoubleClick(folder.id, folder.name);
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
      {openingFolderGhost ? (
        <div
          className="media-library-panel-folder-open-ghost"
          aria-hidden="true"
          style={{
            top: `${openingFolderGhost.top}px`,
            left: `${openingFolderGhost.left}px`,
            width: `${openingFolderGhost.width}px`,
            height: `${openingFolderGhost.height}px`,
          }}
        >
          {/* Ghost overlay mirrors the live folder tile exactly during transition. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FOLDER_TILE_IMAGE_SRC} alt="" />
        </div>
      ) : null}
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
}
