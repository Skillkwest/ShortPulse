import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MediaLibraryPanel } from "../MediaLibraryPanel";

const listMediaFoldersMock = vi.fn();
const createMediaFolderMock = vi.fn();
const renameMediaFolderMock = vi.fn();
const deleteMediaFolderMock = vi.fn();
const applyMediaFolderMembershipBatchMock = vi.fn();
const fetchMediaPromptListPageMock = vi.fn();
const fetchMediaListPageMock = vi.fn();

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: () => ({
    auth: {
      getSession: async () => ({
        data: {
          session: {
            user: {
              id: "user-1",
            },
          },
        },
      }),
    },
    storage: {
      from: () => ({
        download: async () => ({ data: null, error: new Error("nope") }),
      }),
    },
  }),
}));

vi.mock("../../../../lib/useVisibleErrorTelemetry", () => ({
  useVisibleErrorTelemetry: () => undefined,
}));

vi.mock("../../../../lib/mediaPerfTelemetry", () => ({
  createMediaPerfTimer: () => () => undefined,
}));

vi.mock("../../../media-library/hooks/useMediaAdaptivePressure", () => ({
  useMediaAdaptivePressure: () => ({
    previewPressureLevel: 0,
  }),
}));

vi.mock("../../../media-library/hooks/useMediaPreviewSigningController", () => ({
  useMediaPreviewSigningController: () => undefined,
}));

vi.mock("../../../media-library/hooks/useMediaPreviewRecoveryController", () => ({
  useMediaPreviewRecoveryController: () => ({
    refreshSignedUrl: async () => "https://cdn.example.com/fallback.png",
    handleMediaPreviewError: () => undefined,
  }),
}));

vi.mock("../../../media-library/logic/mediaListApi", () => ({
  fetchMediaListPage: (...args: unknown[]) => fetchMediaListPageMock(...args),
}));

vi.mock("../../../media-library/logic/mediaPreviewResolver", () => ({
  resolveSignedSelectionUrl: async ({ row }: { row: { signedUrl?: string | null } }) =>
    row.signedUrl ?? null,
}));

vi.mock("../../../media-library/logic/mediaPreviewRuntimeShared", () => ({
  signMediaStoragePath: async () => null,
  resolveAndApplySignedPreviewUrlsByRows: async () => new Set<string>(),
  hydrateMediaPreviewViaStorageDownload: async () => null,
}));

vi.mock("../../logic/mediaLibraryPanelApi", async () => {
  const actual = await vi.importActual("../../logic/mediaLibraryPanelApi");
  return {
    ...actual,
    listMediaFolders: (...args: unknown[]) => listMediaFoldersMock(...args),
    createMediaFolder: (...args: unknown[]) => createMediaFolderMock(...args),
    renameMediaFolder: (...args: unknown[]) => renameMediaFolderMock(...args),
    deleteMediaFolder: (...args: unknown[]) => deleteMediaFolderMock(...args),
    applyMediaFolderMembershipBatch: (...args: unknown[]) =>
      applyMediaFolderMembershipBatchMock(...args),
    fetchMediaPromptListPage: (...args: unknown[]) => fetchMediaPromptListPageMock(...args),
  };
});

vi.mock("../media-library-modal/MediaLibraryMediaGrid", () => ({
  MediaLibraryMediaGrid: (props: {
    activeMedia: Array<{ id: string; filename: string }>;
    onSelectMediaFile: (row: { id: string; filename: string }) => void;
  }) => (
    <div data-testid="mock-media-grid">
      {props.activeMedia.map((row) => (
        <button key={row.id} type="button" onClick={() => props.onSelectMediaFile(row)}>
          Select media {row.filename}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../media-library-modal/MediaLibraryPromptGrid", () => ({
  MediaLibraryPromptGrid: (props: {
    sortedPrompts: Array<{ id: string; title: string | null }>;
    onSelectPromptCard: (row: { id: string; title: string | null; prompt_text: string }) => void;
  }) => (
    <div data-testid="mock-prompt-grid">
      {props.sortedPrompts.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() =>
            props.onSelectPromptCard({
              id: row.id,
              title: row.title,
              prompt_text: "Prompt text",
            })
          }
        >
          Select prompt {row.title || row.id}
        </button>
      ))}
    </div>
  ),
}));

describe("MediaLibraryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMediaFoldersMock.mockResolvedValue([
      {
        id: "folder-1",
        name: "Campaign",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ]);
    fetchMediaListPageMock.mockResolvedValue({
      rows: [
        {
          id: "media-1",
          filename: "ref-1.png",
          storage_path: "user-1/uploads/ref-1.png",
          preview_storage_path: "user-1/uploads/ref-1.png",
          file_type: "image/png",
          source: "upload",
          created_at: "2026-03-02T00:00:00.000Z",
          metadata: null,
          signedUrl: "https://cdn.example.com/ref-1.png",
        },
      ],
      nextCursor: null,
      hasMore: false,
      signedById: new Map<string, string>(),
    });
    fetchMediaPromptListPageMock.mockResolvedValue({
      rows: [
        {
          id: "prompt-1",
          title: "Prompt One",
          prompt_text: "Prompt text",
          mode: "text",
          source: "manual",
          created_at: "2026-03-02T00:00:00.000Z",
          updated_at: "2026-03-02T00:00:00.000Z",
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("loads folders + media data and supports click-to-add", async () => {
    const onSelectMedia = vi.fn();
    const onSelectPrompt = vi.fn();
    render(<MediaLibraryPanel onSelectMedia={onSelectMedia} onSelectPrompt={onSelectPrompt} />);

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Select media ref-1.png" }));
    await waitFor(() => {
      expect(onSelectMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "media-1",
          filename: "ref-1.png",
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Select prompt Prompt One" }));
    expect(onSelectPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "prompt-1",
        promptText: "Prompt text",
      })
    );
  });

  it("assigns the picked item to a selected custom folder", async () => {
    const onSelectMedia = vi.fn();
    const onSelectPrompt = vi.fn();
    render(<MediaLibraryPanel onSelectMedia={onSelectMedia} onSelectPrompt={onSelectPrompt} />);

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Select prompt Prompt One" }));

    const assignButton = screen.getByRole("button", {
      name: "Add Picked Item To Folder",
    });
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith({
        folderId: "folder-1",
        action: "assign",
        mediaIds: [],
        promptIds: ["prompt-1"],
      });
    });
  });
});
