import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderMembershipBatchInput } from "../mediaFoldersService";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  applyFolderMembershipBatch,
  createMediaFolderForUser,
  DEFAULT_MEDIA_LIBRARY_FOLDER_NAME,
  ensureDefaultMediaFolderForUserExists,
  isCustomMediaFolderId,
  listMediaFoldersForUser,
  MEDIA_LIBRARY_ROOT_FOLDER_ID,
  moveMediaFolderForUser,
  sanitizeMediaFolderName,
  sanitizeMediaFolderParentId,
} from "../mediaFoldersService";

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: vi.fn(),
}));

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);
const SOURCE_FOLDER_ID = "2d6fc803-2289-47a9-9a07-063ebf2eec4f";
const TARGET_FOLDER_ID = "6f1ff0ab-c9e7-4b20-9b27-53da4ac44b0b";

type BatchMockOptions = {
  sourceFolderExists?: boolean;
  targetFolderExists?: boolean;
  ownedMediaIds?: string[];
  characterScopedMediaIds?: string[];
  ownedPromptIds?: string[];
  existingTargetMediaIds?: string[];
  existingTargetPromptIds?: string[];
  existingSourceMediaIds?: string[];
  existingSourcePromptIds?: string[];
  unassignMediaCount?: number;
  unassignPromptCount?: number;
};

const createSupabaseBatchMock = (options: BatchMockOptions = {}) => {
  const sourceFolderExists = options.sourceFolderExists ?? true;
  const targetFolderExists = options.targetFolderExists ?? true;
  const ownedMediaIds = options.ownedMediaIds ?? [];
  const characterScopedMediaIds = options.characterScopedMediaIds ?? [];
  const ownedPromptIds = options.ownedPromptIds ?? [];
  const existingTargetMediaIds = options.existingTargetMediaIds ?? [];
  const existingTargetPromptIds = options.existingTargetPromptIds ?? [];
  const existingSourceMediaIds = options.existingSourceMediaIds ?? [];
  const existingSourcePromptIds = options.existingSourcePromptIds ?? [];
  const unassignMediaCount = options.unassignMediaCount ?? 0;
  const unassignPromptCount = options.unassignPromptCount ?? 0;

  const folderMaybeSingleMock = vi.fn(async (...args: unknown[]) => {
    const folderId = typeof args[0] === "string" ? args[0] : "";
    const exists = folderId === SOURCE_FOLDER_ID ? sourceFolderExists : targetFolderExists;
    return {
      data: exists ? { id: folderId } : null,
      error: null,
    };
  });
  const mediaOwnershipInMock = vi.fn(async (_column: string, ids: string[]) => ({
    data: ids
      .filter((id) => ownedMediaIds.includes(id))
      .map((id) => ({
        id,
        storage_path: characterScopedMediaIds.includes(id)
          ? `user-1/characters/example/${id}.png`
          : `user-1/upload/${id}.png`,
      })),
    error: null,
  }));
  const promptOwnershipInMock = vi.fn(async () => ({
    data: ownedPromptIds.map((id) => ({ id })),
    error: null,
  }));
  const mediaMembershipSelectInByFolderMock = vi.fn(
    async (idColumn: string, ids: string[], folderId: string) => {
      const existingIds =
        idColumn === "media_file_id"
          ? folderId === SOURCE_FOLDER_ID
            ? [...existingSourceMediaIds]
            : [...existingTargetMediaIds]
          : [];
      return {
        data: ids.filter((id) => existingIds.includes(id)).map((id) => ({ media_file_id: id })),
        error: null,
      };
    }
  );
  const promptMembershipSelectInByFolderMock = vi.fn(
    async (idColumn: string, ids: string[], folderId: string) => {
      const existingIds =
        idColumn === "prompt_id"
          ? folderId === SOURCE_FOLDER_ID
            ? [...existingSourcePromptIds]
            : [...existingTargetPromptIds]
          : [];
      return {
        data: ids.filter((id) => existingIds.includes(id)).map((id) => ({ prompt_id: id })),
        error: null,
      };
    }
  );
  const mediaUpsertMock = vi.fn(async () => ({
    error: null,
  }));
  const promptUpsertMock = vi.fn(async () => ({
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
    rpc: vi.fn(async () => ({
      data: [{ folder_id: SOURCE_FOLDER_ID, item_count: 0 }],
      error: null,
    })),
    from: vi.fn((table: string) => {
      if (table === "media_folders") {
        return {
          select: vi.fn(() => {
            let selectedFolderId = "";
            return {
              eq: vi.fn((column: string, value: string) => {
                if (column === "id") selectedFolderId = value;
                return {
                  eq: vi.fn(() => ({
                    maybeSingle: () => folderMaybeSingleMock(selectedFolderId),
                  })),
                };
              }),
            };
          }),
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
          select: vi.fn(() => {
            let selectedFolderId = "";
            return {
              eq: vi.fn((column: string, value: string) => {
                if (column === "folder_id") selectedFolderId = value;
                return {
                  eq: vi.fn((secondColumn: string, secondValue: string) => {
                    if (secondColumn === "folder_id") selectedFolderId = secondValue;
                    return {
                      in: (columnName: string, ids: string[]) =>
                        mediaMembershipSelectInByFolderMock(columnName, ids, selectedFolderId),
                    };
                  }),
                };
              }),
            };
          }),
          upsert: mediaUpsertMock,
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
          select: vi.fn(() => {
            let selectedFolderId = "";
            return {
              eq: vi.fn((column: string, value: string) => {
                if (column === "folder_id") selectedFolderId = value;
                return {
                  eq: vi.fn((secondColumn: string, secondValue: string) => {
                    if (secondColumn === "folder_id") selectedFolderId = secondValue;
                    return {
                      in: (columnName: string, ids: string[]) =>
                        promptMembershipSelectInByFolderMock(columnName, ids, selectedFolderId),
                    };
                  }),
                };
              }),
            };
          }),
          upsert: promptUpsertMock,
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
    mediaUpsertMock,
    promptUpsertMock,
    mediaUnassignInMock,
    promptUnassignInMock,
  };
};

const createBatchInput = (
  overrides: Partial<FolderMembershipBatchInput> = {}
): FolderMembershipBatchInput => ({
  userId: "user-1",
  folderId: TARGET_FOLDER_ID,
  action: "assign",
  mediaIds: [],
  promptIds: [],
  ...overrides,
});

const createSupabaseMoveMock = ({
  folderExists = true,
  parentExists = true,
  currentParentFolderId = null as string | null,
  updateError = null as { message?: string | null; code?: string | null } | null,
  updatedParentFolderId = TARGET_FOLDER_ID,
} = {}) => {
  const ownedFolderSelections = [
    {
      data: folderExists ? { id: SOURCE_FOLDER_ID, parent_folder_id: currentParentFolderId } : null,
      error: null,
    },
    {
      data: parentExists ? { id: updatedParentFolderId } : null,
      error: null,
    },
  ];
  const updateMaybeSingleMock = vi.fn().mockResolvedValue({
    data: updateError
      ? null
      : {
          id: SOURCE_FOLDER_ID,
          user_id: "user-1",
          name: "Folder A",
          parent_folder_id: updatedParentFolderId,
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-02T00:00:00.000Z",
        },
    error: updateError,
  });

  const supabaseMock = {
    rpc: vi.fn(async () => ({
      data: [{ folder_id: SOURCE_FOLDER_ID, item_count: 0 }],
      error: null,
    })),
    from: vi.fn((table: string) => {
      if (table === "media_folders") {
        return {
          select: vi.fn(() => {
            let firstEqColumn = "";
            return {
              eq: vi.fn((column: string) => {
                firstEqColumn = column;
                return {
                  eq: vi.fn((secondColumn: string) => {
                    if (firstEqColumn === "user_id" && secondColumn === "parent_folder_id") {
                      return Promise.resolve({
                        count: 0,
                        error: null,
                      });
                    }
                    return {
                      maybeSingle: vi.fn().mockResolvedValue(ownedFolderSelections.shift() ?? null),
                    };
                  }),
                };
              }),
            };
          }),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: updateMaybeSingleMock,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "media_folder_media_items" || table === "media_folder_prompt_items") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [],
                error: null,
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
};

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

  it("normalizes parent folder ids to root/null or canonical uuids", () => {
    expect(sanitizeMediaFolderParentId(undefined)).toBeNull();
    expect(sanitizeMediaFolderParentId(null)).toBeNull();
    expect(sanitizeMediaFolderParentId("")).toBeNull();
    expect(sanitizeMediaFolderParentId(MEDIA_LIBRARY_ROOT_FOLDER_ID)).toBeNull();
    expect(sanitizeMediaFolderParentId("2d6fc803-2289-47a9-9a07-063ebf2eec4f")).toBe(
      "2d6fc803-2289-47a9-9a07-063ebf2eec4f"
    );
    expect(sanitizeMediaFolderParentId("not-a-folder")).toBeUndefined();
  });

  it("falls back to legacy folder listing when parent_folder_id is unavailable", async () => {
    const legacySelectMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: SOURCE_FOLDER_ID,
          user_id: "user-1",
          name: "Folder A",
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-02T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const primarySelectMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'column "parent_folder_id" does not exist' },
    });
    const primaryQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: primarySelectMock,
          })),
        })),
      })),
    };
    const legacyQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: legacySelectMock,
          })),
        })),
      })),
    };
    const supabaseMock = {
      from: vi.fn().mockReturnValueOnce(primaryQuery).mockReturnValueOnce(legacyQuery),
    };
    getSupabaseAdminMock.mockReturnValue(
      supabaseMock as unknown as ReturnType<typeof getSupabaseAdmin>
    );

    await expect(listMediaFoldersForUser("user-1")).resolves.toEqual([
      {
        id: SOURCE_FOLDER_ID,
        user_id: "user-1",
        name: "Folder A",
        parent_folder_id: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-02T00:00:00.000Z",
        item_count: 0,
      },
    ]);
  });

  it("includes direct child folders in listed folder item counts", async () => {
    const listSelectMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: SOURCE_FOLDER_ID,
          user_id: "user-1",
          name: "Parent",
          parent_folder_id: null,
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-02T00:00:00.000Z",
        },
        {
          id: TARGET_FOLDER_ID,
          user_id: "user-1",
          name: "Child",
          parent_folder_id: SOURCE_FOLDER_ID,
          created_at: "2026-03-03T00:00:00.000Z",
          updated_at: "2026-03-04T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const listQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: listSelectMock,
          })),
        })),
      })),
    };
    const supabaseMock = {
      from: vi.fn().mockReturnValue(listQuery),
      rpc: vi.fn(async () => ({
        data: [{ folder_id: SOURCE_FOLDER_ID, item_count: "0" }],
        error: null,
      })),
    };
    getSupabaseAdminMock.mockReturnValue(
      supabaseMock as unknown as ReturnType<typeof getSupabaseAdmin>
    );

    await expect(listMediaFoldersForUser("user-1")).resolves.toEqual([
      {
        id: SOURCE_FOLDER_ID,
        user_id: "user-1",
        name: "Parent",
        parent_folder_id: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-02T00:00:00.000Z",
        item_count: 1,
      },
      {
        id: TARGET_FOLDER_ID,
        user_id: "user-1",
        name: "Child",
        parent_folder_id: SOURCE_FOLDER_ID,
        created_at: "2026-03-03T00:00:00.000Z",
        updated_at: "2026-03-04T00:00:00.000Z",
        item_count: 0,
      },
    ]);
  });

  it("falls back to legacy root-folder creation when parent_folder_id is unavailable", async () => {
    const legacyInsertMock = vi.fn().mockResolvedValue({
      data: {
        id: SOURCE_FOLDER_ID,
        user_id: "user-1",
        name: "Folder A",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-02T00:00:00.000Z",
      },
      error: null,
    });
    const primaryInsertMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'column "parent_folder_id" does not exist' },
    });
    const primaryInsertQuery = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: primaryInsertMock,
        })),
      })),
    };
    const legacyInsertQuery = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: legacyInsertMock,
        })),
      })),
    };
    const supabaseMock = {
      from: vi.fn().mockReturnValueOnce(primaryInsertQuery).mockReturnValueOnce(legacyInsertQuery),
    };
    getSupabaseAdminMock.mockReturnValue(
      supabaseMock as unknown as ReturnType<typeof getSupabaseAdmin>
    );

    await expect(
      createMediaFolderForUser({
        userId: "user-1",
        name: "Folder A",
        parentFolderId: null,
      })
    ).resolves.toEqual({
      id: SOURCE_FOLDER_ID,
      user_id: "user-1",
      name: "Folder A",
      parent_folder_id: null,
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-02T00:00:00.000Z",
      item_count: 0,
    });
  });

  it("seeds a default root folder when the user has no custom folders", async () => {
    const listSelectMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const insertMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: SOURCE_FOLDER_ID,
        user_id: "user-1",
        name: DEFAULT_MEDIA_LIBRARY_FOLDER_NAME,
        parent_folder_id: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
      error: null,
    });
    const listQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: listSelectMock,
          })),
        })),
      })),
    };
    const insertQuery = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: insertMaybeSingleMock,
        })),
      })),
    };
    const supabaseMock = {
      from: vi.fn().mockReturnValueOnce(listQuery).mockReturnValueOnce(insertQuery),
    };
    getSupabaseAdminMock.mockReturnValue(
      supabaseMock as unknown as ReturnType<typeof getSupabaseAdmin>
    );

    await expect(ensureDefaultMediaFolderForUserExists("user-1")).resolves.toEqual({
      id: SOURCE_FOLDER_ID,
      user_id: "user-1",
      name: DEFAULT_MEDIA_LIBRARY_FOLDER_NAME,
      parent_folder_id: null,
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
      item_count: 0,
    });
  });

  it("does not seed the default folder when the user already has folders", async () => {
    const listSelectMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: SOURCE_FOLDER_ID,
          user_id: "user-1",
          name: "Existing Folder",
          parent_folder_id: null,
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const listQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: listSelectMock,
          })),
        })),
      })),
    };
    const supabaseMock = {
      from: vi.fn().mockReturnValueOnce(listQuery),
      rpc: vi.fn(async () => ({
        data: [{ folder_id: SOURCE_FOLDER_ID, item_count: "3" }],
        error: null,
      })),
    };
    getSupabaseAdminMock.mockReturnValue(
      supabaseMock as unknown as ReturnType<typeof getSupabaseAdmin>
    );

    await expect(ensureDefaultMediaFolderForUserExists("user-1")).resolves.toBeNull();
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("get_media_folder_item_counts", {
      p_user_id: "user-1",
      p_folder_ids: [SOURCE_FOLDER_ID],
    });
  });

  it("returns null when moving a missing folder", async () => {
    createSupabaseMoveMock({ folderExists: false });

    await expect(
      moveMediaFolderForUser({
        userId: "user-1",
        folderId: SOURCE_FOLDER_ID,
        parentFolderId: TARGET_FOLDER_ID,
      })
    ).resolves.toBeNull();
  });

  it("moves a folder to a new owned parent", async () => {
    createSupabaseMoveMock();

    await expect(
      moveMediaFolderForUser({
        userId: "user-1",
        folderId: SOURCE_FOLDER_ID,
        parentFolderId: TARGET_FOLDER_ID,
      })
    ).resolves.toMatchObject({
      id: SOURCE_FOLDER_ID,
      parent_folder_id: TARGET_FOLDER_ID,
    });
  });

  it("maps hierarchy trigger failures to a deterministic error", async () => {
    createSupabaseMoveMock({
      updateError: {
        message: "Folder hierarchy cannot contain cycles",
      },
    });

    await expect(
      moveMediaFolderForUser({
        userId: "user-1",
        folderId: SOURCE_FOLDER_ID,
        parentFolderId: TARGET_FOLDER_ID,
      })
    ).rejects.toThrow("Invalid folder hierarchy");
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

  it("rejects membership batch when any media id is character-scoped", async () => {
    createSupabaseBatchMock({
      ownedMediaIds: ["media-1", "media-2"],
      characterScopedMediaIds: ["media-2"],
      ownedPromptIds: [],
    });

    await expect(
      applyFolderMembershipBatch(
        createBatchInput({
          action: "assign",
          mediaIds: ["media-1", "media-2"],
          promptIds: [],
        })
      )
    ).rejects.toThrow("Character-scoped media ids are not allowed in media-library folders");
  });

  it("assigns media + prompts and returns assigned counts", async () => {
    const { mediaUpsertMock, promptUpsertMock } = createSupabaseBatchMock({
      ownedMediaIds: ["media-1", "media-2"],
      ownedPromptIds: ["prompt-1"],
      existingTargetMediaIds: [],
      existingTargetPromptIds: [],
    });

    const result = await applyFolderMembershipBatch(
      createBatchInput({
        action: "assign",
        mediaIds: ["media-1", "media-2"],
        promptIds: ["prompt-1"],
      })
    );

    expect(mediaUpsertMock).toHaveBeenCalledTimes(1);
    expect(promptUpsertMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      action: "assign",
      folderId: TARGET_FOLDER_ID,
      sourceFolderId: null,
      targetFolderId: null,
      mediaAssigned: 2,
      mediaUnassigned: 0,
      promptsAssigned: 1,
      promptsUnassigned: 0,
      mediaDuplicates: 0,
      promptDuplicates: 0,
      mediaSkipped: 0,
      promptSkipped: 0,
    });
  });

  it("unassigns media + prompts and returns unassigned counts", async () => {
    const { mediaUnassignInMock, promptUnassignInMock } = createSupabaseBatchMock({
      ownedMediaIds: ["media-1"],
      ownedPromptIds: ["prompt-1", "prompt-2"],
      existingTargetMediaIds: ["media-1"],
      existingTargetPromptIds: ["prompt-1", "prompt-2"],
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
      action: "unassign",
      folderId: TARGET_FOLDER_ID,
      sourceFolderId: null,
      targetFolderId: null,
      mediaAssigned: 0,
      mediaUnassigned: 1,
      promptsAssigned: 0,
      promptsUnassigned: 2,
      mediaDuplicates: 0,
      promptDuplicates: 0,
      mediaSkipped: 0,
      promptSkipped: 0,
    });
  });
});
