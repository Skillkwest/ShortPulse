import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderMembershipBatchInput } from "../mediaFoldersService";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  applyFolderMembershipBatch,
  isCustomMediaFolderId,
  MEDIA_LIBRARY_ROOT_FOLDER_ID,
  sanitizeMediaFolderName,
} from "../mediaFoldersService";

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

type BatchMockOptions = {
  folderExists?: boolean;
  ownedMediaIds?: string[];
  ownedPromptIds?: string[];
  assignMediaRows?: Array<{ media_file_id: string }>;
  assignPromptRows?: Array<{ prompt_id: string }>;
  unassignMediaCount?: number;
  unassignPromptCount?: number;
};

const createSupabaseBatchMock = (options: BatchMockOptions = {}) => {
  const folderExists = options.folderExists ?? true;
  const ownedMediaIds = options.ownedMediaIds ?? [];
  const ownedPromptIds = options.ownedPromptIds ?? [];
  const assignMediaRows = options.assignMediaRows ?? [];
  const assignPromptRows = options.assignPromptRows ?? [];
  const unassignMediaCount = options.unassignMediaCount ?? 0;
  const unassignPromptCount = options.unassignPromptCount ?? 0;

  const folderMaybeSingleMock = vi.fn(async () => ({
    data: folderExists ? { id: "2d6fc803-2289-47a9-9a07-063ebf2eec4f" } : null,
    error: null,
  }));
  const mediaOwnershipInMock = vi.fn(async () => ({
    data: ownedMediaIds.map((id) => ({ id })),
    error: null,
  }));
  const promptOwnershipInMock = vi.fn(async () => ({
    data: ownedPromptIds.map((id) => ({ id })),
    error: null,
  }));
  const mediaAssignSelectMock = vi.fn(async () => ({
    data: assignMediaRows,
    error: null,
  }));
  const promptAssignSelectMock = vi.fn(async () => ({
    data: assignPromptRows,
    error: null,
  }));
  const mediaUnassignInMock = vi.fn(async () => ({
    error: null,
    count: unassignMediaCount,
  }));
  const promptUnassignInMock = vi.fn(async () => ({
    error: null,
    count: unassignPromptCount,
  }));

  const supabaseMock = {
    from: vi.fn((table: string) => {
      if (table === "media_folders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: folderMaybeSingleMock,
              })),
            })),
          })),
        };
      }
      if (table === "media_files") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: mediaOwnershipInMock,
            })),
          })),
        };
      }
      if (table === "media_prompts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: promptOwnershipInMock,
            })),
          })),
        };
      }
      if (table === "media_folder_media_items") {
        return {
          upsert: vi.fn(() => ({
            select: mediaAssignSelectMock,
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: mediaUnassignInMock,
              })),
            })),
          })),
        };
      }
      if (table === "media_folder_prompt_items") {
        return {
          upsert: vi.fn(() => ({
            select: promptAssignSelectMock,
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: promptUnassignInMock,
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  getSupabaseAdminMock.mockReturnValue(
    supabaseMock as unknown as ReturnType<typeof getSupabaseAdmin>
  );

  return {
    mediaAssignSelectMock,
    promptAssignSelectMock,
    mediaUnassignInMock,
    promptUnassignInMock,
  };
};

const createBatchInput = (
  overrides: Partial<FolderMembershipBatchInput> = {}
): FolderMembershipBatchInput => ({
  userId: "user-1",
  folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
  action: "assign",
  mediaIds: [],
  promptIds: [],
  ...overrides,
});

describe("mediaFoldersService helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects root and non-uuid folder ids", () => {
    expect(isCustomMediaFolderId(MEDIA_LIBRARY_ROOT_FOLDER_ID)).toBe(false);
    expect(isCustomMediaFolderId("not-a-uuid")).toBe(false);
  });

  it("accepts canonical uuid folder ids", () => {
    expect(isCustomMediaFolderId("2d6fc803-2289-47a9-9a07-063ebf2eec4f")).toBe(true);
  });

  it("sanitizes folder names with trimming and length guards", () => {
    expect(sanitizeMediaFolderName("  Campaign  ")).toBe("Campaign");
    expect(sanitizeMediaFolderName("   ")).toBeNull();
    expect(sanitizeMediaFolderName("x".repeat(65))).toBeNull();
  });

  it("rejects membership batch when any media/prompt id is not owned by the user", async () => {
    createSupabaseBatchMock({
      ownedMediaIds: ["media-1"],
      ownedPromptIds: ["prompt-1"],
    });

    await expect(
      applyFolderMembershipBatch(
        createBatchInput({
          action: "assign",
          mediaIds: ["media-1", "media-2"],
          promptIds: ["prompt-1"],
        })
      )
    ).rejects.toThrow("One or more item ids are invalid for this user");
  });

  it("assigns media + prompts and returns assigned counts", async () => {
    const { mediaAssignSelectMock, promptAssignSelectMock } = createSupabaseBatchMock({
      ownedMediaIds: ["media-1", "media-2"],
      ownedPromptIds: ["prompt-1"],
      assignMediaRows: [{ media_file_id: "media-1" }, { media_file_id: "media-2" }],
      assignPromptRows: [{ prompt_id: "prompt-1" }],
    });

    const result = await applyFolderMembershipBatch(
      createBatchInput({
        action: "assign",
        mediaIds: ["media-1", "media-2"],
        promptIds: ["prompt-1"],
      })
    );

    expect(mediaAssignSelectMock).toHaveBeenCalledWith("media_file_id");
    expect(promptAssignSelectMock).toHaveBeenCalledWith("prompt_id");
    expect(result).toEqual({
      folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      action: "assign",
      mediaAssigned: 2,
      mediaUnassigned: 0,
      promptsAssigned: 1,
      promptsUnassigned: 0,
    });
  });

  it("unassigns media + prompts and returns unassigned counts", async () => {
    const { mediaUnassignInMock, promptUnassignInMock } = createSupabaseBatchMock({
      ownedMediaIds: ["media-1"],
      ownedPromptIds: ["prompt-1", "prompt-2"],
      unassignMediaCount: 1,
      unassignPromptCount: 2,
    });

    const result = await applyFolderMembershipBatch(
      createBatchInput({
        action: "unassign",
        mediaIds: ["media-1"],
        promptIds: ["prompt-1", "prompt-2"],
      })
    );

    expect(mediaUnassignInMock).toHaveBeenCalledWith("media_file_id", ["media-1"]);
    expect(promptUnassignInMock).toHaveBeenCalledWith("prompt_id", ["prompt-1", "prompt-2"]);
    expect(result).toEqual({
      folderId: "2d6fc803-2289-47a9-9a07-063ebf2eec4f",
      action: "unassign",
      mediaAssigned: 0,
      mediaUnassigned: 1,
      promptsAssigned: 0,
      promptsUnassigned: 2,
    });
  });
});
