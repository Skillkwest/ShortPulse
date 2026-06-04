import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPersistedCompletedPayload,
  buildPersistedFailedPayload,
  readPersistedGenerationStatusContext,
  readPersistedSuccessResultUrls,
} from "../../lib/server/api/falStatusPersistedResults";

const getSupabaseAdminMock = vi.fn();
const resolveGenerationLineageByProviderRequestMock = vi.fn();
const readMediaDeliveryPathsByIdMock = vi.fn();
const createSignedMediaUrlMock = vi.fn();
let persistedProjectionRows: Array<Record<string, unknown>> = [];
let persistedGenerationRows: Array<Record<string, unknown>> = [];
let persistedOutputRows: Array<Record<string, unknown>> = [];
let persistedDeliveryPathsByMediaId = new Map<
  string,
  { previewStoragePath: string; fullStoragePath: string }
>();
let outputEqCalls: Array<[string, unknown]> = [];

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

vi.mock("../../lib/server/api/generationLineageResolver", () => ({
  resolveGenerationLineageByProviderRequest: (...args: unknown[]) =>
    resolveGenerationLineageByProviderRequestMock(...args),
}));

vi.mock("../../lib/server/api/mediaDeliveryPaths", () => ({
  readMediaDeliveryPathsById: (...args: unknown[]) => readMediaDeliveryPathsByIdMock(...args),
}));

vi.mock("../../lib/server/mediaIngest", () => ({
  createSignedMediaUrl: (...args: unknown[]) => createSignedMediaUrlMock(...args),
}));

describe("falStatusPersistedResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://shortpulse.supabase.co";
    persistedProjectionRows = [];
    persistedGenerationRows = [];
    persistedOutputRows = [];
    persistedDeliveryPathsByMediaId = new Map();
    outputEqCalls = [];
    resolveGenerationLineageByProviderRequestMock.mockResolvedValue({
      generationId: null,
      generationAttemptId: null,
      userId: null,
      sourceRef: null,
      requestId: null,
      providerRequestId: "",
      evidence: [],
      attemptLookupError: null,
    });
    readMediaDeliveryPathsByIdMock.mockImplementation(
      async ({ mediaFileIds }: { mediaFileIds: string[] }) =>
        new Map(
          mediaFileIds
            .map((mediaFileId) => {
              const paths = persistedDeliveryPathsByMediaId.get(mediaFileId);
              return paths ? ([mediaFileId, paths] as const) : null;
            })
            .filter(
              (entry): entry is [string, { previewStoragePath: string; fullStoragePath: string }] =>
                Boolean(entry)
            )
        )
    );
    createSignedMediaUrlMock.mockImplementation(async (storagePath: string) => {
      return `https://signed.shortpulse.test/${encodeURIComponent(storagePath)}`;
    });
    getSupabaseAdminMock.mockImplementation(() => {
      const generationQueryChain = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(async () => ({ data: persistedGenerationRows, error: null })),
      };
      generationQueryChain.eq.mockReturnValue(generationQueryChain);
      generationQueryChain.order.mockReturnValue(generationQueryChain);

      const outputQueryChain = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(async () => ({ data: persistedOutputRows, error: null })),
      };
      outputQueryChain.eq.mockImplementation((field: string, value: unknown) => {
        outputEqCalls.push([field, value]);
        return outputQueryChain;
      });
      outputQueryChain.order.mockReturnValue(outputQueryChain);

      const projectionQueryChain = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(async () => ({ data: persistedProjectionRows, error: null })),
      };
      projectionQueryChain.eq.mockReturnValue(projectionQueryChain);
      projectionQueryChain.order.mockReturnValue(projectionQueryChain);

      return {
        from: vi.fn((tableName: string) => {
          if (tableName === "generation_projection") {
            return {
              select: vi.fn().mockReturnValue(projectionQueryChain),
            };
          }

          if (tableName === "ai_generations") {
            return {
              select: vi.fn().mockReturnValue(generationQueryChain),
            };
          }

          if (tableName === "ai_generation_outputs") {
            return {
              select: vi.fn().mockReturnValue(outputQueryChain),
            };
          }

          throw new Error(`Unexpected table ${tableName}`);
        }),
      };
    });
  });

  it("returns no settled urls when only legacy success metadata exists", async () => {
    persistedGenerationRows = [
      {
        id: "gen-processing-1",
        status: "processing",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/ignore-me.mp4"],
        },
      },
      {
        id: "gen-success-1",
        status: "success",
        metadata: {
          media_urls: [{ url: "https://cdn.shortpulse.test/final.mp4" }],
        },
      },
    ];

    await expect(
      readPersistedSuccessResultUrls({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual([]);
  });

  it("ignores legacy success urls without projection context while preserving generation identity", async () => {
    persistedGenerationRows = [
      {
        id: "gen-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/final.mp4"],
        },
      },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual({
      generationId: "gen-success-1",
      resultUrls: [],
    });
  });

  it("does not read older legacy success urls without projection context", async () => {
    persistedGenerationRows = [
      {
        id: "gen-processing-1",
        status: "processing",
        metadata: {},
      },
      {
        id: "gen-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/final.mp4"],
        },
      },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual({
      generationId: "gen-processing-1",
      resultUrls: [],
    });
  });

  it("uses generation projection result urls as the canonical source", async () => {
    persistedProjectionRows = [
      {
        generation_id: "gen-projection-1",
        result_urls: [
          "https://cdn.shortpulse.test/media_library/user-1/generations/videos/projection-a.mp4",
        ],
        publication_state: "published",
        status: "ready",
        task_state: "success",
      },
    ];
    persistedGenerationRows = [
      {
        id: "gen-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/legacy-fallback.mp4"],
        },
      },
    ];
    persistedDeliveryPathsByMediaId.set("media-projection-1", {
      previewStoragePath: "user-1/generations/videos/projection-a.mp4",
      fullStoragePath: "user-1/generations/videos/projection-a.mp4",
    });
    persistedOutputRows = [
      {
        output_index: 0,
        result_url: "https://cdn.shortpulse.test/provider-copy.mp4",
        media_file_id: "media-projection-1",
      },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual({
      generationId: "gen-projection-1",
      resultUrls: [
        "https://signed.shortpulse.test/user-1%2Fgenerations%2Fvideos%2Fprojection-a.mp4",
      ],
      saveState: null,
      saveError: null,
      status: "ready",
      taskState: "success",
      deliveryState: "canonical_owned",
      recoveryPending: false,
      completionState: null,
      queueState: "dispatched",
      errorMessageShort: null,
      errorDetail: null,
    });
  });

  it("returns projection-backed terminal failure context when no result urls exist", async () => {
    persistedProjectionRows = [
      {
        generation_id: "gen-projection-fail-1",
        result_urls: [],
        status: "ready",
        task_state: "fail",
        error_message_short: "Generation failed",
        error_detail: "Provider reported failed state during recovery execution.",
      },
    ];
    persistedGenerationRows = [
      {
        id: "gen-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/legacy-fallback.mp4"],
        },
      },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual({
      generationId: "gen-projection-fail-1",
      resultUrls: [],
      saveState: null,
      saveError: null,
      status: "ready",
      taskState: "fail",
      queueState: null,
      errorMessageShort: "Generation failed",
      errorDetail: "Provider reported failed state during recovery execution.",
    });
  });

  it("does not fall back to ai_generations metadata when projection already reports success without canonical outputs", async () => {
    persistedProjectionRows = [
      {
        generation_id: "gen-projection-success-pending-1",
        result_urls: [],
        publication_state: "suppressed",
        status: "ready",
        task_state: "success",
        queue_state: "dispatched",
      },
    ];
    persistedGenerationRows = [
      {
        id: "gen-legacy-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/legacy-fallback.mp4"],
        },
      },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual({
      generationId: "gen-projection-success-pending-1",
      resultUrls: [],
      saveState: null,
      saveError: null,
      status: "ready",
      taskState: "success",
      recoveryPending: true,
      completionState: "completed_awaiting_media",
      queueState: "dispatched",
      errorMessageShort: null,
      errorDetail: null,
    });
  });

  it("reads canonical outputs from projection-linked generation ids", async () => {
    persistedProjectionRows = [
      {
        generation_id: "gen-projection-output-1",
        result_urls: [],
        publication_state: "suppressed",
        status: "ready",
        task_state: "running",
      },
    ];
    persistedGenerationRows = [
      {
        id: "gen-legacy-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/legacy-fallback.mp4"],
        },
      },
    ];
    persistedOutputRows = [
      {
        output_index: 0,
        result_url: "https://cdn.shortpulse.test/projected-output.mp4",
        media_file_id: "media-projected-1",
      },
    ];
    persistedDeliveryPathsByMediaId.set("media-projected-1", {
      previewStoragePath: "user-1/generations/videos/projected-output.mp4",
      fullStoragePath: "user-1/generations/videos/projected-output.mp4",
    });

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual({
      generationId: "gen-projection-output-1",
      resultUrls: [
        "https://signed.shortpulse.test/user-1%2Fgenerations%2Fvideos%2Fprojected-output.mp4",
      ],
      saveState: null,
      saveError: null,
      status: "ready",
      taskState: "success",
      deliveryState: "canonical_owned",
      recoveryPending: false,
      completionState: null,
      queueState: "dispatched",
      errorMessageShort: null,
      errorDetail: null,
    });

    expect(outputEqCalls).toContainEqual(["generation_id", "gen-projection-output-1"]);
  });

  it("prefers canonical persisted generation outputs over metadata result urls", async () => {
    persistedProjectionRows = [
      {
        generation_id: "gen-1",
        result_urls: [],
        publication_state: "suppressed",
        status: "ready",
        task_state: "running",
      },
    ];
    persistedGenerationRows = [
      {
        id: "gen-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/legacy-fallback.mp4"],
        },
      },
    ];
    persistedOutputRows = [
      {
        output_index: 1,
        result_url: "https://cdn.shortpulse.test/output-b.mp4",
        media_file_id: "media-b",
      },
      {
        output_index: 0,
        result_url: "https://cdn.shortpulse.test/output-a.mp4",
        media_file_id: "media-a",
      },
    ];
    persistedDeliveryPathsByMediaId.set("media-a", {
      previewStoragePath: "user-1/generations/videos/output-a.mp4",
      fullStoragePath: "user-1/generations/videos/output-a.mp4",
    });
    persistedDeliveryPathsByMediaId.set("media-b", {
      previewStoragePath: "user-1/generations/videos/output-b.mp4",
      fullStoragePath: "user-1/generations/videos/output-b.mp4",
    });

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual({
      generationId: "gen-1",
      resultUrls: [
        "https://signed.shortpulse.test/user-1%2Fgenerations%2Fvideos%2Foutput-a.mp4",
        "https://signed.shortpulse.test/user-1%2Fgenerations%2Fvideos%2Foutput-b.mp4",
      ],
      saveState: null,
      saveError: null,
      status: "ready",
      taskState: "success",
      deliveryState: "canonical_owned",
      recoveryPending: false,
      completionState: null,
      queueState: "dispatched",
      errorMessageShort: null,
      errorDetail: null,
    });
  });

  it("returns canonical outputs from the newest generation row even before status flips to success", async () => {
    persistedProjectionRows = [
      {
        generation_id: "gen-processing-1",
        result_urls: [],
        publication_state: "suppressed",
        status: "processing",
        task_state: "running",
      },
    ];
    persistedGenerationRows = [
      {
        id: "gen-processing-1",
        status: "processing",
        metadata: {},
      },
      {
        id: "gen-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/legacy-fallback.mp4"],
        },
      },
    ];
    persistedOutputRows = [
      {
        output_index: 0,
        result_url: "https://cdn.shortpulse.test/output-a.mp4",
        media_file_id: "media-a",
      },
    ];
    persistedDeliveryPathsByMediaId.set("media-a", {
      previewStoragePath: "user-1/generations/videos/output-a.mp4",
      fullStoragePath: "user-1/generations/videos/output-a.mp4",
    });

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-1",
      })
    ).resolves.toEqual({
      generationId: "gen-processing-1",
      resultUrls: ["https://signed.shortpulse.test/user-1%2Fgenerations%2Fvideos%2Foutput-a.mp4"],
      saveState: null,
      saveError: null,
      status: "processing",
      taskState: "success",
      deliveryState: "canonical_owned",
      recoveryPending: false,
      completionState: null,
      queueState: "dispatched",
      errorMessageShort: null,
      errorDetail: null,
    });

    expect(outputEqCalls).toContainEqual(["generation_id", "gen-processing-1"]);
  });

  it("keeps transient provider outputs idle in the generation-id fallback branch", async () => {
    persistedGenerationRows = [
      {
        id: "gen-transient-1",
        status: "success",
        metadata: {},
      },
    ];
    persistedOutputRows = [
      {
        output_index: 0,
        result_url: "https://tempfile.redpandaai.co/transient-output.mp4",
        media_file_id: null,
      },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-transient-1",
      })
    ).resolves.toEqual({
      generationId: "gen-transient-1",
      resultUrls: ["https://tempfile.redpandaai.co/transient-output.mp4"],
      status: "success",
      taskState: "success",
      deliveryState: "transient_provider",
      recoveryPending: false,
      completionState: null,
      queueState: "dispatched",
      saveState: "idle",
      saveError: null,
    });
  });

  it("uses shared lineage to find canonical outputs when request_id fallback cannot", async () => {
    resolveGenerationLineageByProviderRequestMock.mockResolvedValueOnce({
      generationId: "gen-lineage-output-1",
      generationAttemptId: "attempt-lineage-output-1",
      userId: "user-1",
      sourceRef: null,
      requestId: null,
      providerRequestId: "provider-req-lineage-1",
      evidence: ["generation_attempt"],
      attemptLookupError: null,
    });
    persistedOutputRows = [
      {
        output_index: 0,
        result_url: "https://cdn.shortpulse.test/lineage-output.mp4",
        media_file_id: "media-lineage-output-1",
      },
    ];
    persistedDeliveryPathsByMediaId.set("media-lineage-output-1", {
      previewStoragePath: "user-1/generations/videos/lineage-output.mp4",
      fullStoragePath: "user-1/generations/videos/lineage-output.mp4",
    });

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "provider-req-lineage-1",
      })
    ).resolves.toEqual({
      generationId: "gen-lineage-output-1",
      resultUrls: [
        "https://signed.shortpulse.test/user-1%2Fgenerations%2Fvideos%2Flineage-output.mp4",
      ],
      status: "success",
      taskState: "success",
      deliveryState: "canonical_owned",
      recoveryPending: false,
      completionState: null,
      queueState: "dispatched",
      saveState: "saved",
      saveError: null,
    });
    expect(resolveGenerationLineageByProviderRequestMock).toHaveBeenCalledWith({
      providerRequestId: "provider-req-lineage-1",
      userId: "user-1",
      includeProjection: true,
    });
    expect(outputEqCalls).toContainEqual(["generation_id", "gen-lineage-output-1"]);
  });

  it("drops foreign published projection urls when no owned output authority exists", async () => {
    persistedProjectionRows = [
      {
        generation_id: "gen-foreign-projection-1",
        result_urls: [
          "https://cdn.shortpulse.test/media_library/user-2/generations/videos/foreign.mp4",
        ],
        publication_state: "published",
        status: "ready",
        task_state: "success",
      },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-foreign-projection-1",
      })
    ).resolves.toEqual({
      generationId: "gen-foreign-projection-1",
      resultUrls: [],
      saveState: null,
      saveError: null,
      status: "ready",
      taskState: "success",
      recoveryPending: true,
      completionState: "completed_awaiting_media",
      queueState: "dispatched",
      errorMessageShort: null,
      errorDetail: null,
    });
  });

  it("signs canonical owned output media instead of trusting stored output urls", async () => {
    persistedProjectionRows = [
      {
        generation_id: "gen-owned-output-1",
        result_urls: [],
        publication_state: "published",
        status: "ready",
        task_state: "success",
      },
    ];
    persistedOutputRows = [
      {
        output_index: 0,
        result_url: "https://tempfile.redpandaai.co/provider-output.mp4",
        media_file_id: "media-owned-output-1",
      },
    ];
    persistedDeliveryPathsByMediaId.set("media-owned-output-1", {
      previewStoragePath: "user-1/generations/videos/owned-output.mp4",
      fullStoragePath: "user-1/generations/videos/owned-output.mp4",
    });

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-owned-output-1",
      })
    ).resolves.toEqual({
      generationId: "gen-owned-output-1",
      resultUrls: [
        "https://signed.shortpulse.test/user-1%2Fgenerations%2Fvideos%2Fowned-output.mp4",
      ],
      saveState: null,
      saveError: null,
      status: "ready",
      taskState: "success",
      deliveryState: "canonical_owned",
      recoveryPending: false,
      completionState: null,
      queueState: "dispatched",
      errorMessageShort: null,
      errorDetail: null,
    });
  });

  it("builds the completed proxy payload shape", () => {
    expect(
      buildPersistedCompletedPayload({
        requestId: "req-1",
        resultUrls: ["https://cdn.shortpulse.test/final.mp4"],
      })
    ).toEqual({
      request_id: "req-1",
      status: "completed",
      state: "completed",
      resultUrls: ["https://cdn.shortpulse.test/final.mp4"],
      result_urls: ["https://cdn.shortpulse.test/final.mp4"],
      images: [{ url: "https://cdn.shortpulse.test/final.mp4" }],
      videos: [{ url: "https://cdn.shortpulse.test/final.mp4" }],
      data: {
        images: [{ url: "https://cdn.shortpulse.test/final.mp4" }],
        videos: [{ url: "https://cdn.shortpulse.test/final.mp4" }],
      },
      shortpulseLifecycle: {
        taskState: "success",
        isTerminal: true,
        resultUrls: ["https://cdn.shortpulse.test/final.mp4"],
        saveError: null,
        providerState: "completed",
        deliveryState: "canonical_owned",
        queueState: "dispatched",
        statusLabel: "Just now",
      },
    });
  });

  it("ignores legacy failed rows without projection context while preserving generation identity", async () => {
    persistedGenerationRows = [
      {
        id: "gen-failed-1",
        status: "failed",
        error_message: "Legacy generation failed",
        metadata: {},
      },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-failed-1",
      })
    ).resolves.toEqual({
      generationId: "gen-failed-1",
      resultUrls: [],
    });
  });

  it("does not read older legacy failed state without projection context", async () => {
    persistedGenerationRows = [
      {
        id: "gen-processing-1",
        status: "processing",
        metadata: {},
      },
      {
        id: "gen-failed-1",
        status: "failed",
        error_message: "Older legacy generation failed",
        metadata: {},
      },
    ];

    await expect(
      readPersistedGenerationStatusContext({
        userId: "user-1",
        requestId: "req-failed-1",
      })
    ).resolves.toEqual({
      generationId: "gen-processing-1",
      resultUrls: [],
    });
  });

  it("builds the failed proxy payload shape", () => {
    expect(
      buildPersistedFailedPayload({
        requestId: "req-1",
        generationId: "gen-1",
        errorMessage: "Generation failed",
        errorDetail: "Provider failed",
        providerState: "failed",
        queueState: "failed",
      })
    ).toEqual({
      request_id: "req-1",
      generationId: "gen-1",
      status: "error",
      state: "error",
      error: "Generation failed",
      detail: "Provider failed",
      shortpulseLifecycle: {
        taskState: "fail",
        isTerminal: true,
        errorMessage: "Generation failed",
        errorDetail: "Provider failed",
        providerState: "failed",
        queueState: "failed",
      },
    });
  });
});
