import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDraftCharacter,
  fetchCharacterManagerList,
} from "../characterManagerPersistenceCore";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";

vi.mock("../../../../lib/supabaseClient", async () => {
  const { createSupabaseClientModuleMock } =
    await import("../../../../tests/support/supabaseClientMock");
  return createSupabaseClientModuleMock();
});

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: vi.fn(),
  getSignedMediaUrlsBatch: vi.fn(),
  invalidateSignedMediaUrl: vi.fn(),
}));

const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);
const readSupabaseUserIdMock = vi.mocked(readSupabaseUserId);
const getSignedMediaUrlsBatchMock = vi.mocked(getSignedMediaUrlsBatch);

const createAwaitableQuery = <TData>(data: TData, error: unknown = null) => {
  const query = {
    data,
    error,
    eq: () => query,
    neq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data, error }),
    single: async () => ({ data, error }),
  };
  return query;
};

describe("characterManagerPersistenceCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
  });

  it("repairs missing character sheets while listing characters", async () => {
    const createdSheetRows: Array<Record<string, unknown>> = [];
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "characters") {
          return {
            select: () =>
              createAwaitableQuery([
                {
                  id: "char-1",
                  name: "Hero",
                  description: "",
                  status: "draft",
                  updated_at: "2026-04-25T00:00:00.000Z",
                  metadata: {},
                },
                {
                  id: "char-2",
                  name: "Ayla",
                  description: "",
                  status: "draft",
                  updated_at: "2026-04-24T00:00:00.000Z",
                  metadata: {},
                },
              ]),
          };
        }
        if (table === "character_reference_packs") {
          return {
            select: () =>
              createAwaitableQuery([
                {
                  id: "sheet-1",
                  character_id: "char-1",
                  status: "ready",
                  version: 2,
                },
              ]),
            insert: (payload: Record<string, unknown>) => {
              createdSheetRows.push(payload);
              return {
                select: () =>
                  createAwaitableQuery({
                    id: "sheet-2",
                    character_id: payload.character_id,
                    status: "draft",
                    version: 1,
                  }),
              };
            },
          };
        }
        if (table === "character_reference_images") {
          return {
            select: () => createAwaitableQuery([]),
          };
        }
        throw new Error(`Unexpected table lookup: ${table}`);
      }),
    } as unknown as ReturnType<typeof ensureSupabaseQueryClient>);

    const result = await fetchCharacterManagerList();

    expect(createdSheetRows).toEqual([
      {
        character_id: "char-2",
        user_id: "user-1",
        version: 1,
        status: "draft",
      },
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        characterId: "char-1",
        characterSheetId: "sheet-1",
      }),
      expect.objectContaining({
        characterId: "char-2",
        characterSheetId: "sheet-2",
      }),
    ]);
  });

  it("cleans up the created character row when initial sheet creation fails", async () => {
    const deletedCharacterIds: string[] = [];
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "characters") {
          return {
            insert: () => ({
              select: () =>
                createAwaitableQuery({
                  id: "char-failed",
                  name: "Broken Hero",
                  description: "",
                  status: "draft",
                  active_character_sheet_id: null,
                  active_reference_pack_id: null,
                  metadata: {},
                }),
            }),
            delete: () => {
              const query = {
                data: null,
                error: null,
                eq: (column: string, value: string) => {
                  if (column === "id") {
                    deletedCharacterIds.push(value);
                  }
                  return query;
                },
              };
              return query;
            },
          };
        }
        if (table === "character_reference_packs") {
          return {
            insert: () => ({
              select: () =>
                createAwaitableQuery(
                  null,
                  new Error("Unable to create a character sheet right now.")
                ),
            }),
          };
        }
        throw new Error(`Unexpected table lookup: ${table}`);
      }),
    } as unknown as ReturnType<typeof ensureSupabaseQueryClient>);

    await expect(createDraftCharacter("Broken Hero")).rejects.toThrow(
      "Unable to create a character sheet right now."
    );
    expect(deletedCharacterIds).toEqual(["char-failed"]);
  });
});
