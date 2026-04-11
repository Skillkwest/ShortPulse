import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveLatestPublishedGenerationDelivery } from "../generatedMediaAuthority";

const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const readSupabaseUserIdMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
  readSupabaseUserId: readSupabaseUserIdMock,
}));

const createAwaitableSelectBuilder = (result: { data: unknown; error: unknown }) => {
  const builder: {
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: Promise<{ data: unknown; error: unknown }>["then"];
    catch: Promise<{ data: unknown; error: unknown }>["catch"];
    finally: Promise<{ data: unknown; error: unknown }>["finally"];
  } = {
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => result),
    then: (...args) => Promise.resolve(result).then(...args),
    catch: (...args) => Promise.resolve(result).catch(...args),
    finally: (...args) => Promise.resolve(result).finally(...args),
  };
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
};

describe("generatedMediaAuthority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
  });

  it("falls back to successful generation projection delivery when published media is suppressed", async () => {
    const publicationsBuilder = createAwaitableSelectBuilder({
      data: [],
      error: null,
    });
    const projectionBuilder = createAwaitableSelectBuilder({
      data: {
        preview_url: "https://fal.test/preview.png",
        result_urls: ["https://fal.test/full.png"],
        preview_storage_path: null,
        full_storage_path: null,
        task_state: "success",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
      },
      error: null,
    });

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationsBuilder),
          };
        }
        if (table === "generation_projection") {
          return {
            select: vi.fn(() => projectionBuilder),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveLatestPublishedGenerationDelivery({
        generationId: "gen-suppressed-1",
      })
    ).resolves.toEqual({
      previewUrl: "https://fal.test/preview.png",
      fullUrl: "https://fal.test/full.png",
      previewStoragePath: null,
      fullStoragePath: null,
    });
  });

  it("prefers published generation delivery when it exists", async () => {
    const publicationsBuilder = createAwaitableSelectBuilder({
      data: [
        {
          preview_url: "https://cdn.test/published-preview.png",
          full_url: "https://cdn.test/published-full.png",
          preview_storage_path: null,
          full_storage_path: null,
          created_at: "2026-04-11T19:45:41.000Z",
        },
      ],
      error: null,
    });

    const projectionSelect = vi.fn();

    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "generation_publications") {
          return {
            select: vi.fn(() => publicationsBuilder),
          };
        }
        if (table === "generation_projection") {
          return {
            select: projectionSelect,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    await expect(
      resolveLatestPublishedGenerationDelivery({
        generationId: "gen-published-1",
      })
    ).resolves.toEqual({
      previewUrl: "https://cdn.test/published-preview.png",
      fullUrl: "https://cdn.test/published-full.png",
      previewStoragePath: null,
      fullStoragePath: null,
    });

    expect(projectionSelect).not.toHaveBeenCalled();
  });
});
