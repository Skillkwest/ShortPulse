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
    expect(snapshot.referenceSetState.sets["1"].deckReferenceUrls).toEqual([
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/expired-deck.png?token=fresh",
    ]);
    expect(snapshot.referenceSetState.sets["1"].imageReferenceUrls).toEqual([
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/expired-slot.png?token=fresh",
    ]);
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
      alias: "taylor",
      profileImageTransform: { zoom: 1.2, offsetX: 4, offsetY: -2 },
      referenceSetState: {
        activeSetId: "1",
        tabOrder: ["1", "3"],
        tabLabels: {
          "1": "Double click me",
          "2": "Reference Set 2",
          "3": "Reference Set 3",
          "4": "Reference Set 4",
          "5": "Reference Set 5",
          "6": "Reference Set 6",
          "7": "Reference Set 7",
          "8": "Reference Set 8",
          "9": "Reference Set 9",
          "10": "Reference Set 10",
        },
        sets: {
          "1": {
            assetType: "image",
            description: "front",
            deckReferenceUrls: ["https://example.com/front.png"],
            imageReferenceUrls: ["https://example.com/front.png"],
            videoReferenceUrl: "",
          },
          "2": {
            assetType: "image",
            description: "",
            deckReferenceUrls: [],
            imageReferenceUrls: [],
            videoReferenceUrl: "",
          },
          "3": {
            assetType: "video",
            description: "motion",
            deckReferenceUrls: [],
            imageReferenceUrls: [],
            videoReferenceUrl: "https://example.com/motion.mp4",
          },
          "4": {
            assetType: "image",
            description: "",
            deckReferenceUrls: [],
            imageReferenceUrls: [],
            videoReferenceUrl: "",
          },
          "5": {
            assetType: "image",
            description: "",
            deckReferenceUrls: [],
            imageReferenceUrls: [],
            videoReferenceUrl: "",
          },
          "6": {
            assetType: "image",
            description: "",
            deckReferenceUrls: [],
            imageReferenceUrls: [],
            videoReferenceUrl: "",
          },
          "7": {
            assetType: "image",
            description: "",
            deckReferenceUrls: [],
            imageReferenceUrls: [],
            videoReferenceUrl: "",
          },
          "8": {
            assetType: "image",
            description: "",
            deckReferenceUrls: [],
            imageReferenceUrls: [],
            videoReferenceUrl: "",
          },
          "9": {
            assetType: "image",
            description: "",
            deckReferenceUrls: [],
            imageReferenceUrls: [],
            videoReferenceUrl: "",
          },
          "10": {
            assetType: "image",
            description: "",
            deckReferenceUrls: [],
            imageReferenceUrls: [],
            videoReferenceUrl: "",
          },
        },
      },
    });

    expect(result).toEqual({
      updatedAt: "2026-04-07T01:00:00.000Z",
      status: "ready",
    });
    expect(operations).toEqual([
      "elements.update",
      "reference_sets.upsert",
      "reference_sets.delete:2,4,5,6,7,8,9,10",
    ]);
  });
});
