import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ensureSupabaseQueryClientMock,
  readSupabaseUserIdMock,
  getSignedMediaUrlMock,
  refreshSupabaseSignedUrlIfNeededMock,
} = vi.hoisted(() => ({
  ensureSupabaseQueryClientMock: vi.fn(),
  readSupabaseUserIdMock: vi.fn(),
  getSignedMediaUrlMock: vi.fn(),
  refreshSupabaseSignedUrlIfNeededMock: vi.fn(),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
  readSupabaseUserId: readSupabaseUserIdMock,
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: getSignedMediaUrlMock,
  invalidateSignedMediaUrl: vi.fn(),
}));

vi.mock("../../../ai-studio/utils/imageUpload", () => ({
  refreshSupabaseSignedUrlIfNeeded: refreshSupabaseSignedUrlIfNeededMock,
}));

vi.mock("../../../../lib/mediaStoragePath", () => ({
  assertUserScopedMediaStoragePath: vi.fn(),
}));

import {
  loadElementManagerDraftByElementId,
  saveElementManagerDraft,
  saveElementManagerDraftSnapshot,
} from "../elementsManagerPersistenceCore";

const createSupabaseMock = () => ({
  from: (table: string) => {
    if (table === "elements") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              neq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "element-1",
                    name: "Taylor",
                    alias: "taylor",
                    status: "ready",
                    metadata: {
                      profile_image_storage_path: "user-1/elements/element-1/profile/profile.png",
                      active_reference_set_id: "1",
                      active_reference_set_asset_type: "image",
                      reference_set_tab_order: ["1"],
                    },
                    updated_at: "2026-04-07T00:00:00.000Z",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "element_reference_sets") {
      return {
        select: () => ({
          eq: () => ({
            eq: async () => ({
              data: [
                {
                  id: "set-1",
                  element_id: "element-1",
                  set_key: "1",
                  label: "Double click me",
                  description: "saved element",
                  asset_type: "image",
                  deck_reference_urls: [
                    "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/expired-deck.png?token=old",
                  ],
                  image_reference_urls: [
                    "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/expired-slot.png?token=old",
                  ],
                  video_reference_url: null,
                  updated_at: "2026-04-07T00:00:00.000Z",
                },
              ],
              error: null,
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  },
});

describe("elementsManagerPersistenceCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    ensureSupabaseQueryClientMock.mockReturnValue(createSupabaseMock());
    getSignedMediaUrlMock.mockResolvedValue(
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/elements/element-1/profile/profile.png?token=fresh"
    );
    refreshSupabaseSignedUrlIfNeededMock.mockImplementation(async (value: string) =>
      value.includes("token=old") ? value.replace("token=old", "token=fresh") : value
    );
  });

  it("refreshes persisted signed reference urls when hydrating a saved element", async () => {
    const snapshot = await loadElementManagerDraftByElementId("element-1");

    expect(snapshot.profileImageUrl).toContain("token=fresh");
    expect(snapshot.description).toBe("saved element");
    expect(snapshot.assetType).toBe("image");
    expect(snapshot.imageReferenceUrls).toEqual([
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/expired-slot.png?token=fresh",
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/expired-deck.png?token=fresh",
    ]);
    expect(snapshot.videoReferenceUrl).toBeNull();
    expect(refreshSupabaseSignedUrlIfNeededMock).toHaveBeenCalledTimes(2);
  });

  it("upserts active reference sets before pruning stale set keys during save", async () => {
    const operations: string[] = [];
    const supabaseMock = {
      from: (table: string) => {
        if (table === "elements") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      name: "Taylor",
                      alias: "taylor",
                      metadata: {
                        profile_image_storage_path: "user-1/elements/element-1/profile/profile.png",
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: () => {
              operations.push("elements.update");
              return {
                eq: () => ({
                  eq: () => ({
                    select: () => ({
                      single: async () => ({
                        data: { updated_at: "2026-04-07T01:00:00.000Z" },
                        error: null,
                      }),
                    }),
                  }),
                }),
              };
            },
          };
        }

        if (table === "element_reference_sets") {
          return {
            upsert: async () => {
              operations.push("reference_sets.upsert");
              return { error: null };
            },
            delete: () => ({
              eq: () => ({
                eq: () => ({
                  in: async (_column: string, staleSetIds: string[]) => {
                    operations.push(`reference_sets.delete:${staleSetIds.join(",")}`);
                    return { error: null };
                  },
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    };

    ensureSupabaseQueryClientMock.mockReturnValue(supabaseMock);

    const result = await saveElementManagerDraftSnapshot({
      elementId: "element-1",
      name: "Taylor",
      profileImageTransform: { zoom: 1.2, offsetX: 4, offsetY: -2 },
      description: "front",
      assetType: "image",
      imageReferenceUrls: ["https://example.com/front.png"],
      videoReferenceUrl: null,
    });

    expect(result).toEqual({
      updatedAt: "2026-04-07T01:00:00.000Z",
      status: "ready",
    });
    expect(operations).toEqual([
      "elements.update",
      "reference_sets.upsert",
      "reference_sets.delete:2,3,4,5,6,7,8,9,10",
    ]);
  });

  it("creates and persists a new element only when the explicit save flow runs", async () => {
    const operations: string[] = [];
    const savedElementId = "element-new";
    const supabaseMock = {
      from: (table: string) => {
        if (table === "elements") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: savedElementId, updated_at: "2026-04-07T01:00:00.000Z" },
                  error: null,
                }),
              }),
            }),
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      name: "Taylor",
                      alias: "taylor",
                      metadata: {
                        active_reference_set_id: "1",
                        active_reference_set_asset_type: "image",
                        reference_set_tab_order: ["1"],
                      },
                    },
                    error: null,
                  }),
                  neq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: savedElementId,
                        name: "Taylor",
                        alias: "taylor",
                        status: "ready",
                        metadata: {
                          active_reference_set_id: "1",
                          active_reference_set_asset_type: "image",
                          reference_set_tab_order: ["1"],
                        },
                        updated_at: "2026-04-07T02:00:00.000Z",
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            update: () => {
              operations.push("elements.update");
              return {
                eq: () => ({
                  eq: () => ({
                    select: () => ({
                      single: async () => ({
                        data: { updated_at: "2026-04-07T02:00:00.000Z" },
                        error: null,
                      }),
                    }),
                  }),
                }),
              };
            },
            delete: () => ({
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            }),
          };
        }

        if (table === "element_reference_sets") {
          return {
            insert: async () => ({ error: null }),
            upsert: async () => {
              operations.push("reference_sets.upsert");
              return { error: null };
            },
            delete: () => ({
              eq: () => ({
                eq: () => ({
                  in: async (_column: string, staleSetIds: string[]) => {
                    operations.push(`reference_sets.delete:${staleSetIds.join(",")}`);
                    return { error: null };
                  },
                }),
              }),
            }),
            select: () => ({
              eq: () => ({
                eq: async () => ({
                  data: [
                    {
                      id: "set-1",
                      element_id: savedElementId,
                      set_key: "1",
                      label: "Double click me",
                      description: "new element",
                      asset_type: "image",
                      deck_reference_urls: ["https://example.com/taylor-front.png"],
                      image_reference_urls: ["https://example.com/taylor-front.png"],
                      video_reference_url: null,
                      updated_at: "2026-04-07T02:00:00.000Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    };

    ensureSupabaseQueryClientMock.mockReturnValue(supabaseMock);

    const snapshot = await saveElementManagerDraft({
      name: "Taylor",
      profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
      description: "new element",
      assetType: "image",
      imageReferenceUrls: ["https://example.com/taylor-front.png"],
      videoReferenceUrl: null,
    });

    expect(snapshot.elementId).toBe(savedElementId);
    expect(snapshot.name).toBe("Taylor");
    expect(snapshot.alias).toBe("taylor");
    expect(snapshot.status).toBe("ready");
    expect(snapshot.description).toBe("new element");
    expect(snapshot.imageReferenceUrls).toEqual(["https://example.com/taylor-front.png"]);
    expect(operations).toEqual([
      "elements.update",
      "reference_sets.upsert",
      "reference_sets.delete:2,3,4,5,6,7,8,9,10",
    ]);
  });

  it("preserves the previous name-derived alias as a legacy compatibility token when renaming", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const supabaseMock = {
      from: (table: string) => {
        if (table === "elements") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      name: "Taylor",
                      alias: "taylor",
                      metadata: {
                        profile_image_storage_path: "user-1/elements/element-1/profile/profile.png",
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              updates.push(payload);
              return {
                eq: () => ({
                  eq: () => ({
                    select: () => ({
                      single: async () => ({
                        data: { updated_at: "2026-04-07T03:00:00.000Z" },
                        error: null,
                      }),
                    }),
                  }),
                }),
              };
            },
          };
        }

        if (table === "element_reference_sets") {
          return {
            upsert: async () => ({ error: null }),
            delete: () => ({
              eq: () => ({
                eq: () => ({
                  in: async () => ({ error: null }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    };

    ensureSupabaseQueryClientMock.mockReturnValue(supabaseMock);

    await saveElementManagerDraftSnapshot({
      elementId: "element-1",
      name: "Beach",
      profileImageTransform: { zoom: 1.2, offsetX: 4, offsetY: -2 },
      description: "front",
      assetType: "image",
      imageReferenceUrls: ["https://example.com/front.png"],
      videoReferenceUrl: null,
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      name: "Beach",
      alias: "taylor",
      status: "ready",
    });
  });
});
