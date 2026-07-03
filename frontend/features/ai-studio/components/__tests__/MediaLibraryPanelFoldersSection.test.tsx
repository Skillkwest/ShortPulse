import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaLibraryPanelFoldersSection } from "../MediaLibraryPanelFoldersSection";

describe("MediaLibraryPanelFoldersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders folder item count badges on folder tiles", () => {
    render(
      <MediaLibraryPanelFoldersSection
        ancestorFolders={[]}
        folders={[{ id: "folder-1", name: "Campaign", itemCount: 3 }]}
        openingFolderId={null}
        canNavigateUp={false}
        onNavigateUp={vi.fn()}
        onNavigateToRoot={vi.fn()}
        onNavigateToFolder={vi.fn()}
        onOpenFolderWithAnimation={vi.fn()}
        setActiveFolderId={vi.fn()}
        editingFolderId={null}
        editingFolderName=""
        setEditingFolderName={vi.fn()}
        startFolderRename={vi.fn()}
        cancelFolderRename={vi.fn()}
        commitFolderRename={vi.fn(async () => {})}
        createFolder={vi.fn(async () => {})}
        creatingFolder={false}
        folderError={null}
        hoveredFolderId={null}
        hoveredReparentFolderId={null}
        isRootReparentDropHover={false}
        onFolderDragOver={vi.fn()}
        onFolderDragLeave={vi.fn()}
        onFolderDrop={vi.fn(async () => {})}
        onFolderReparentDragStart={vi.fn()}
        onFolderReparentDragEnd={vi.fn()}
        onFolderReparentDragOver={vi.fn()}
        onFolderReparentDragLeave={vi.fn()}
        onFolderReparentDrop={vi.fn(async () => false)}
        folderContextMenu={null}
        folderContextMenuRef={{ current: null }}
        openFolderContextMenu={vi.fn()}
        onContextCreateSubfolder={vi.fn()}
        onContextRename={vi.fn()}
        canOpenMovePicker={false}
        onOpenMovePicker={vi.fn()}
        onContextDelete={vi.fn(async () => {})}
      />
    );

    expect(screen.getByLabelText("3 items")).toHaveTextContent("3");
  });

  it("routes folder tile double-clicks through the animated open callback", () => {
    const onOpenFolderWithAnimation = vi.fn();

    render(
      <MediaLibraryPanelFoldersSection
        ancestorFolders={[]}
        folders={[{ id: "folder-1", name: "Campaign", itemCount: 3 }]}
        openingFolderId={null}
        canNavigateUp={false}
        onNavigateUp={vi.fn()}
        onNavigateToRoot={vi.fn()}
        onNavigateToFolder={vi.fn()}
        onOpenFolderWithAnimation={onOpenFolderWithAnimation}
        setActiveFolderId={vi.fn()}
        editingFolderId={null}
        editingFolderName=""
        setEditingFolderName={vi.fn()}
        startFolderRename={vi.fn()}
        cancelFolderRename={vi.fn()}
        commitFolderRename={vi.fn(async () => {})}
        createFolder={vi.fn(async () => {})}
        creatingFolder={false}
        folderError={null}
        hoveredFolderId={null}
        hoveredReparentFolderId={null}
        isRootReparentDropHover={false}
        onFolderDragOver={vi.fn()}
        onFolderDragLeave={vi.fn()}
        onFolderDrop={vi.fn(async () => {})}
        onFolderReparentDragStart={vi.fn()}
        onFolderReparentDragEnd={vi.fn()}
        onFolderReparentDragOver={vi.fn()}
        onFolderReparentDragLeave={vi.fn()}
        onFolderReparentDrop={vi.fn(async () => false)}
        folderContextMenu={null}
        folderContextMenuRef={{ current: null }}
        openFolderContextMenu={vi.fn()}
        onContextCreateSubfolder={vi.fn()}
        onContextRename={vi.fn()}
        canOpenMovePicker={false}
        onOpenMovePicker={vi.fn()}
        onContextDelete={vi.fn(async () => {})}
      />
    );

    const folderTile = screen.getByLabelText("Campaign folder");
    const folderImage = folderTile.querySelector(".media-library-panel-folder-chip-image");
    fireEvent.doubleClick(folderTile);

    expect(onOpenFolderWithAnimation).toHaveBeenCalledWith("folder-1", folderImage);
  });

  it("marks the source folder tile while its open ghost is playing", () => {
    render(
      <MediaLibraryPanelFoldersSection
        ancestorFolders={[]}
        folders={[{ id: "folder-1", name: "Campaign", itemCount: 3 }]}
        openingFolderId="folder-1"
        canNavigateUp={false}
        onNavigateUp={vi.fn()}
        onNavigateToRoot={vi.fn()}
        onNavigateToFolder={vi.fn()}
        onOpenFolderWithAnimation={vi.fn()}
        setActiveFolderId={vi.fn()}
        editingFolderId={null}
        editingFolderName=""
        setEditingFolderName={vi.fn()}
        startFolderRename={vi.fn()}
        cancelFolderRename={vi.fn()}
        commitFolderRename={vi.fn(async () => {})}
        createFolder={vi.fn(async () => {})}
        creatingFolder={false}
        folderError={null}
        hoveredFolderId={null}
        hoveredReparentFolderId={null}
        isRootReparentDropHover={false}
        onFolderDragOver={vi.fn()}
        onFolderDragLeave={vi.fn()}
        onFolderDrop={vi.fn(async () => {})}
        onFolderReparentDragStart={vi.fn()}
        onFolderReparentDragEnd={vi.fn()}
        onFolderReparentDragOver={vi.fn()}
        onFolderReparentDragLeave={vi.fn()}
        onFolderReparentDrop={vi.fn(async () => false)}
        folderContextMenu={null}
        folderContextMenuRef={{ current: null }}
        openFolderContextMenu={vi.fn()}
        onContextCreateSubfolder={vi.fn()}
        onContextRename={vi.fn()}
        canOpenMovePicker={false}
        onOpenMovePicker={vi.fn()}
        onContextDelete={vi.fn(async () => {})}
      />
    );

    expect(screen.getByLabelText("Campaign folder")).toHaveClass("is-opening");
  });
});
