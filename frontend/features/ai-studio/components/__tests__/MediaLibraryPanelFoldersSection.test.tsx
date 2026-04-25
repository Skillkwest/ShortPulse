import { render, screen } from "@testing-library/react";
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
        canNavigateUp={false}
        onNavigateUp={vi.fn()}
        onNavigateToRoot={vi.fn()}
        onNavigateToFolder={vi.fn()}
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
        onFolderDragOver={vi.fn()}
        onFolderDragLeave={vi.fn()}
        onFolderDrop={vi.fn(async () => {})}
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
});
