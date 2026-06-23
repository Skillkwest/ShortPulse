import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFalStatusHandler } from "../../lib/server/api/falStatusProxy";

const requireApiUserMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const settleGenerationOutcomeMock = vi.fn();
const resolveProviderRequestOwnershipMock = vi.fn();
const settleDirectGenerationSuccessMock = vi.fn();
const settleDirectGenerationFailureMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const executeGenerationRecoveryMock = vi.fn();
const readMediaDeliveryPathsByIdMock = vi.fn();
const createSignedMediaUrlMock = vi.fn();
let persistedProjectionRows: Array<Record<string, unknown>> = [];
let persistedGenerationRows: Array<Record<string, unknown>> = [];
let persistedOutputRows: Array<Record<string, unknown>> = [];
let persistedDeliveryPathsByMediaId = new Map<
  string,
  { previewStoragePath: string; fullStoragePath: string }
>();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

vi.mock("../../lib/server/api/generationBilling", () => ({
  resolveProviderRequestOwnership: (...args: unknown[]) =>
    resolveProviderRequestOwnershipMock(...args),
  settleGenerationOutcome: (...args: unknown[]) => settleGenerationOutcomeMock(...args),
}));

vi.mock("../../lib/server/api/directGenerationSettlement", () => ({
  settleDirectGenerationSuccess: (...args: unknown[]) => settleDirectGenerationSuccessMock(...args),
  settleDirectGenerationFailure: (...args: unknown[]) => settleDirectGenerationFailureMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

vi.mock("../../lib/server/api/mediaDeliveryPaths", () => ({
  readMediaDeliveryPathsById: (...args: unknown[]) => readMediaDeliveryPathsByIdMock(...args),
}));

vi.mock("../../lib/server/mediaIngest", () => ({
  createSignedMediaUrl: (...args: unknown[]) => createSignedMediaUrlMock(...args),
}));

vi.mock("../../lib/server/falIntegration/recoveryExecution", () => ({
  executeGenerationRecovery: (...args: unknown[]) => executeGenerationRecoveryMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const toSignedResultUrl = (storagePath: string): string =>
  `https://signed.shortpulse.test/${encodeURIComponent(storagePath)}`;

describe("createFalStatusHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-fal-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://shortpulse.supabase.co";
    delete process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED;
    delete process.env.KIE_API_KEY;
    delete process.env.SHORTPULSE_KIE_API_KEY;
    delete process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED;
    delete process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST;
    delete process.env.SHORTPULSE_KIE_TRUSTED_HOSTS;
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    resolveProviderRequestOwnershipMock.mockResolvedValue("owned");
    settleGenerationOutcomeMock.mockResolvedValue({
      settled: true,
      note: "captured",
    });
    persistedProjectionRows = [];
    persistedGenerationRows = [];
    persistedOutputRows = [];
    persistedDeliveryPathsByMediaId = new Map();
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
    executeGenerationRecoveryMock.mockReset();
    settleDirectGenerationSuccessMock.mockReset();
    settleDirectGenerationFailureMock.mockReset();
    settleDirectGenerationSuccessMock.mockImplementation(
      async ({
        generationId,
        requestId,
        resultUrls,
      }: {
        generationId?: string | null;
        requestId: string;
        resultUrls: string[];
      }) => {
        const resolvedGenerationId =
          generationId ??
          (persistedProjectionRows.find((row) => row.request_id === requestId)?.generation_id as
            | string
            | undefined) ??
          (persistedGenerationRows.find((row) => row.request_id === requestId)?.id as
            | string
            | undefined) ??
          persistedProjectionRows[0]?.generation_id?.toString() ??
          persistedGenerationRows[0]?.id?.toString() ??
          "gen-1";
        persistedProjectionRows = [
          {
            generation_id: resolvedGenerationId,
            request_id: requestId,
            result_urls: resultUrls,
            publication_state: "published",
            status: "ready",
            task_state: "success",
            queue_state: "dispatched",
          },
        ];
        persistedGenerationRows = [
          {
            id: resolvedGenerationId,
            request_id: requestId,
            status: "success",
            error_message: null,
            created_at: "2026-04-18T00:00:00.000Z",
          },
        ];
        persistedOutputRows = resultUrls.map((resultUrl, index) => ({
          id: `out-${index + 1}`,
          generation_id: resolvedGenerationId,
          output_index: index,
          result_url: resultUrl,
          media_file_id: `media-${index + 1}`,
        }));
        persistedDeliveryPathsByMediaId = new Map(
          resultUrls.map((resultUrl, index) => {
            const extensionMatch = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(resultUrl);
            const extension = extensionMatch?.[1]?.toLowerCase() ?? "bin";
            const fullStoragePath = `user-1/generations/results/media-${index + 1}.${extension}`;
            return [
              `media-${index + 1}`,
              {
                previewStoragePath: fullStoragePath,
                fullStoragePath,
              },
            ] as const;
          })
        );
        return { ok: true, generationId: resolvedGenerationId, requestId };
      }
    );
    settleDirectGenerationFailureMock.mockImplementation(
      async ({
        generationId,
        requestId,
        errorMessage,
        errorDetail,
      }: {
        generationId?: string | null;
        requestId: string;
        errorMessage: string;
        errorDetail?: unknown;
      }) => {
        const resolvedGenerationId =
          generationId ??
          (persistedProjectionRows.find((row) => row.request_id === requestId)?.generation_id as
            | string
            | undefined) ??
          (persistedGenerationRows.find((row) => row.request_id === requestId)?.id as
            | string
            | undefined) ??
          persistedProjectionRows[0]?.generation_id?.toString() ??
          persistedGenerationRows[0]?.id?.toString() ??
          "gen-1";
        persistedProjectionRows = [
          {
            generation_id: resolvedGenerationId,
            request_id: requestId,
            result_urls: [],
            publication_state: "suppressed",
            status: "ready",
            task_state: "fail",
            queue_state: "failed",
            error_message_short: errorMessage,
            error_detail:
              typeof errorDetail === "string" ? errorDetail : JSON.stringify(errorDetail ?? null),
          },
        ];
        persistedGenerationRows = [
          {
            id: resolvedGenerationId,
            request_id: requestId,
            status: "fail",
            error_message: errorMessage,
            created_at: "2026-04-18T00:00:00.000Z",
          },
        ];
        persistedOutputRows = [];
        return { ok: true, generationId: resolvedGenerationId, requestId };
      }
    );
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
      outputQueryChain.eq.mockReturnValue(outputQueryChain);
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

  afterEach(() => {
    expect(settleGenerationOutcomeMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("does not commit a second response after the same response object is already ended", async () => {
    persistedGenerationRows = [
      {
        id: "gen-committed",
        request_id: "req-committed",
        status: "fail",
        error_message: "Already settled",
        metadata: {},
      },
    ];
    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-committed" },
      headers: {},
    };
    const res = {
      headersSent: false,
      writableEnded: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation(function (this: {
        headersSent: boolean;
        writableEnded: boolean;
      }) {
        this.headersSent = true;
        this.writableEnded = true;
        return this;
      }),
    };

    await handler(req as never, res as never);
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledTimes(1);
  });

  it("keeps nonterminal response_url payloads in polling state without result probes", async () => {
    persistedGenerationRows = [
      {
        id: "gen-1",
        status: "processing",
        metadata: {},
      },
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "IN_PROGRESS",
          response_url: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/requests/req-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      generationId?: string;
      shortpulseLifecycle?: {
        taskState?: string;
        isTerminal?: boolean;
        providerState?: string;
      };
    };
    expect(payload.status).toBe("IN_PROGRESS");
    expect(payload.generationId).toBe("gen-1");
    expect(payload.shortpulseLifecycle).toEqual(
      expect.objectContaining({
        taskState: "running",
        isTerminal: false,
        providerState: "in_progress",
      })
    );
    expect(settleDirectGenerationSuccessMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).not.toHaveBeenCalled();
  });

  it("uses narrow metadata URL projection when resolving provider-returned status bases", async () => {
    const selectCallsByTable = new Map<string, string[]>();
    const createRowsBuilder = (rows: Array<Record<string, unknown>>) => {
      const queryChain = {
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(async () => ({ data: rows, error: null })),
      };
      queryChain.eq.mockReturnValue(queryChain);
      queryChain.order.mockReturnValue(queryChain);
      return queryChain;
    };
    const generationRows = [
      {
        id: "gen-provider-url-1",
        request_id: "req-provider-url-1",
        status: "processing",
        provider_status_url:
          "https://queue.fal.run/fal-ai/provider-returned/requests/req-provider-url-1/status",
        provider_response_url:
          "https://queue.fal.run/fal-ai/provider-returned/requests/req-provider-url-1",
      },
    ];
    getSupabaseAdminMock.mockImplementation(() => ({
      from: vi.fn((tableName: string) => {
        let rows: Array<Record<string, unknown>>;
        if (tableName === "ai_generations") {
          rows = generationRows;
        } else if (tableName === "generation_projection") {
          rows = persistedProjectionRows;
        } else if (tableName === "ai_generation_outputs") {
          rows = persistedOutputRows;
        } else {
          throw new Error(`Unexpected table ${tableName}`);
        }
        return {
          select: vi.fn((selectColumns: string) => {
            const tableCalls = selectCallsByTable.get(tableName) ?? [];
            tableCalls.push(selectColumns);
            selectCallsByTable.set(tableName, tableCalls);
            return createRowsBuilder(rows);
          }),
        };
      }),
    }));
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "IN_PROGRESS",
          request_id: "req-provider-url-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-provider-url-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const aiGenerationSelectCalls = selectCallsByTable.get("ai_generations") ?? [];
    expect(aiGenerationSelectCalls).toContain(
      "provider_status_url:metadata->>provider_status_url, provider_response_url:metadata->>provider_response_url"
    );
    expect(aiGenerationSelectCalls).not.toContain("metadata");
    expect(fetchMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("does not settle nonterminal response_url media before provider completion", async () => {
    persistedGenerationRows = [
      {
        id: "gen-1",
        status: "processing",
        metadata: {},
      },
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "IN_PROGRESS",
          response_url: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/requests/req-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        status: "IN_PROGRESS",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "running",
          isTerminal: false,
        }),
      })
    );
    expect(settleDirectGenerationSuccessMock).not.toHaveBeenCalled();
  });

  it("does not settle nonterminal Kie media echoes before provider completion", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/kling-3.0";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    process.env.KIE_API_KEY = "test-kie-key";
    persistedGenerationRows = [
      {
        id: "gen-kie-running-echo",
        request_id: "req-kie-running-echo",
        status: "processing",
        metadata: {},
      },
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "success",
          data: {
            taskId: "req-kie-running-echo",
            successFlag: 0,
            response: {
              image_url: "https://cdn.shortpulse.test/input-character.png",
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/kling-3.0",
      queueBaseUrl: "https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}",
      routeLabel: "Kie Kling 3.0",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-kie-running-echo" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(settleDirectGenerationSuccessMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-kie-running-echo",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "running",
          isTerminal: false,
          providerState: "running",
        }),
      })
    );
  });

  it("returns canonical completed payload immediately when direct settlement persists outputs", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    process.env.KIE_API_KEY = "test-kie-key";
    persistedGenerationRows = [
      {
        id: "gen-kie-inline-1",
        request_id: "req-kie-inline-success",
        status: "processing",
        metadata: {},
      },
    ];
    settleDirectGenerationSuccessMock.mockImplementationOnce(async () => {
      persistedProjectionRows = [
        {
          generation_id: "gen-kie-inline-1",
          request_id: "req-kie-inline-success",
          result_urls: ["https://cdn.shortpulse.test/kie-inline-canonical.mp4"],
          publication_state: "published",
          status: "ready",
          task_state: "success",
          queue_state: "dispatched",
        },
      ];
      persistedOutputRows = [
        {
          id: "out-inline-1",
          generation_id: "gen-kie-inline-1",
          output_index: 0,
          result_url: "https://cdn.shortpulse.test/kie-inline-provider.mp4",
          media_file_id: "media-inline-1",
        },
      ];
      persistedDeliveryPathsByMediaId = new Map([
        [
          "media-inline-1",
          {
            previewStoragePath: "user-1/generations/results/media-inline-1.mp4",
            fullStoragePath: "user-1/generations/results/media-inline-1.mp4",
          },
        ],
      ]);
      return {
        ok: true,
        generationId: "gen-kie-inline-1",
        requestId: "req-kie-inline-success",
      };
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "success",
          data: {
            taskId: "req-kie-inline-success",
            successFlag: 1,
            response: {
              resultUrls: ["https://cdn.shortpulse.test/kie-inline-provider.mp4"],
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-kie-inline-success" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(settleDirectGenerationSuccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-kie-inline-1",
        requestId: "req-kie-inline-success",
        providerState: "completed",
        resultUrls: ["https://cdn.shortpulse.test/kie-inline-provider.mp4"],
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-kie-inline-success",
        generationId: "gen-kie-inline-1",
        status: "completed",
        state: "completed",
        resultUrls: [toSignedResultUrl("user-1/generations/results/media-inline-1.mp4")],
        result_urls: [toSignedResultUrl("user-1/generations/results/media-inline-1.mp4")],
        videos: [{ url: toSignedResultUrl("user-1/generations/results/media-inline-1.mp4") }],
        shortpulseLifecycle: expect.objectContaining({
          taskState: "success",
          isTerminal: true,
          deliveryState: "canonical_owned",
          providerState: "completed",
          resultUrls: [toSignedResultUrl("user-1/generations/results/media-inline-1.mp4")],
        }),
      })
    );
  });

  it("polls the provider when only legacy success metadata exists without canonical outputs", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    persistedGenerationRows = [
      {
        id: "gen-persisted-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/persisted-result.mp4"],
        },
      },
    ];
    const pendingPayload = {
      code: 200,
      msg: "success",
      data: {
        taskId: "req-persisted-success",
        successFlag: 0,
        response: null,
        responseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId=req-persisted-success",
      },
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(pendingPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-persisted-success" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 200,
        data: expect.objectContaining({
          taskId: "req-persisted-success",
          successFlag: 0,
        }),
      })
    );
  });

  it("returns completed payload from canonical outputs before the generation row flips to success", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    persistedGenerationRows = [
      {
        id: "gen-persisted-processing-1",
        status: "processing",
        metadata: {},
      },
    ];
    persistedOutputRows = [
      { output_index: 0, result_url: "https://cdn.shortpulse.test/persisted-output.mp4" },
    ];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-persisted-processing" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-persisted-processing",
        generationId: "gen-persisted-processing-1",
        status: "completed",
        state: "completed",
        resultUrls: ["https://cdn.shortpulse.test/persisted-output.mp4"],
        result_urls: ["https://cdn.shortpulse.test/persisted-output.mp4"],
        videos: [{ url: "https://cdn.shortpulse.test/persisted-output.mp4" }],
      })
    );
  });

  it("persists provider failure reasons from terminal Kie status payloads", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    persistedGenerationRows = [
      {
        id: "gen-kie-fail-reason-1",
        request_id: "req-kie-fail-reason",
        status: "processing",
        metadata: {},
      },
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "success",
          data: {
            taskId: "req-kie-fail-reason",
            successFlag: 2,
            failCode: "501",
            failMsg: "File type not supported",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-kie-fail-reason" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(settleDirectGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-kie-fail-reason-1",
        requestId: "req-kie-fail-reason",
        providerState: "failed",
        errorMessage: "File type not supported",
        errorDetail: expect.objectContaining({
          data: expect.objectContaining({
            failMsg: "File type not supported",
          }),
        }),
        failureReasonCode: "provider_error",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-kie-fail-reason",
        generationId: "gen-kie-fail-reason-1",
        status: "error",
        error: "File type not supported",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "fail",
          isTerminal: true,
          errorMessage: "File type not supported",
        }),
      })
    );
  });

  it("returns terminal success lifecycle when projection reports success without canonical outputs", async () => {
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
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "IN_PROGRESS",
          request_id: "req-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-1" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-1",
        generationId: "gen-projection-success-pending-1",
        status: "IN_PROGRESS",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "running",
          isTerminal: false,
          providerState: "in_progress",
          queueState: "dispatched",
          statusLabel: "Processing...",
        }),
      })
    );
  });

  it("returns transient completed payloads for persisted provider-only projection urls", async () => {
    persistedProjectionRows = [
      {
        generation_id: "gen-projection-transient-1",
        result_urls: ["https://cdn.shortpulse.test/provider-only.png"],
        publication_state: "suppressed",
        status: "ready",
        task_state: "success",
        queue_state: "dispatched",
      },
    ];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-transient-projection" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-transient-projection",
        generationId: "gen-projection-transient-1",
        status: "completed",
        resultUrls: ["https://cdn.shortpulse.test/provider-only.png"],
        shortpulseLifecycle: expect.objectContaining({
          taskState: "success",
          isTerminal: true,
          deliveryState: "transient_provider",
          providerState: "ready",
          queueState: "dispatched",
        }),
      })
    );
  });

  it("returns terminal error payload from generation projection failure without provider fetch", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
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
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-projection-fail" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-projection-fail",
        generationId: "gen-projection-fail-1",
        status: "error",
        state: "error",
        error: "Generation failed",
        detail: "Provider reported failed state during recovery execution.",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "fail",
          isTerminal: true,
          errorMessage: "Generation failed",
          errorDetail: "Provider reported failed state during recovery execution.",
        }),
      })
    );
  });

  it("probes provider status before honoring a recoverable no-media failure", async () => {
    persistedProjectionRows = [
      {
        generation_id: "gen-projection-no-media-1",
        result_urls: [],
        status: "ready",
        task_state: "fail",
        error_message_short: "No media returned.",
        error_detail: "Provider terminal success without media payload.",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "COMPLETED",
          images: [{ url: toSignedResultUrl("user-1/generations/results/media-1.png") }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-projection-no-media" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-projection-no-media",
        generationId: "gen-projection-no-media-1",
        status: "completed",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "success",
          isTerminal: true,
          resultUrls: [toSignedResultUrl("user-1/generations/results/media-1.png")],
          deliveryState: "canonical_owned",
        }),
      })
    );
  });

  it("does not use an older legacy success fallback when the newest row is still nonterminal", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    persistedGenerationRows = [
      {
        id: "gen-persisted-processing-1",
        status: "processing",
        metadata: {},
      },
      {
        id: "gen-persisted-success-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/persisted-result.mp4"],
        },
      },
    ];
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    const pendingPayload = {
      code: 200,
      msg: "success",
      data: {
        taskId: "req-persisted-success",
        successFlag: 0,
        response: null,
        responseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId=req-persisted-success",
      },
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(pendingPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-persisted-success" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 200,
        data: expect.objectContaining({
          taskId: "req-persisted-success",
          successFlag: 0,
        }),
      })
    );
  });

  it("fails closed when provider key is unavailable and only legacy success metadata exists", async () => {
    delete process.env.KIE_API_KEY;
    delete process.env.SHORTPULSE_KIE_API_KEY;
    persistedGenerationRows = [
      {
        id: "gen-persisted-without-key-1",
        status: "success",
        metadata: {
          result_urls: ["https://cdn.shortpulse.test/persisted-no-key.mp4"],
        },
      },
    ];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-persisted-without-key" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Error: KIE_API_KEY is not set on the server.",
    });
  });

  it("fails closed when queue base URLs are untrusted", async () => {
    const handler = createFalStatusHandler({
      queueBaseUrl: "https://example.com/untrusted",
      routeLabel: "Fal Untrusted",
      timeoutMs: 15000,
    });
    const req = {
      method: "POST",
      body: { requestId: "req-untrusted" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        request_id: "req-untrusted",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_status.untrusted_base_url",
      })
    );
  });

  it("keeps kie successFlag=0 record-info payloads non-terminal while media is pending", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    process.env.KIE_API_KEY = "test-kie-key";

    const pendingPayload = {
      code: 200,
      msg: "success",
      data: {
        taskId: "req-kie-running",
        successFlag: 0,
        response: null,
        responseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId=req-kie-running",
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pendingPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pendingPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pendingPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-kie-running" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 200,
        data: expect.objectContaining({
          successFlag: 0,
        }),
      })
    );
  });

  it("captures kie successFlag=1 payload media from data.response.resultUrls", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    process.env.KIE_API_KEY = "test-kie-key";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "success",
          data: {
            taskId: "req-kie-success",
            successFlag: 1,
            response: {
              resultUrls: ["https://cdn.shortpulse.test/kie-veo-result.mp4"],
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-kie-success" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        state: "completed",
      })
    );
  });

  it("captures kie veo success payload media from data.response.originUrls", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    process.env.KIE_API_KEY = "test-kie-key";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "success",
          data: {
            taskId: "req-kie-origin-success",
            successFlag: 1,
            response: {
              originUrls: ["https://cdn.shortpulse.test/kie-veo-origin-result.mp4"],
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-kie-origin-success" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        state: "completed",
      })
    );
  });

  it("returns a terminal lifecycle failure when kie veo status is blocked by safety filters", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    process.env.KIE_API_KEY = "test-kie-key";

    const policyMessage =
      "Request blocked: The input content was flagged by safety filters for containing sexual or explicit material.";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 400,
          msg: "error",
          data: {
            taskId: "req-kie-policy-blocked",
          },
          error_message: policyMessage,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      queueBaseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      routeLabel: "Kie Veo 3.1 Fast I2V",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-kie-policy-blocked" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        state: "error",
        error: "This request was blocked for explicit or unsafe content.",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "fail",
          isTerminal: true,
          errorMessage: "This request was blocked for explicit or unsafe content.",
          errorDetail:
            "This request was blocked for explicit or unsafe content. Try revising the prompt or references.",
          providerState: "failed",
          queueState: "failed",
        }),
      })
    );
  });

  it("returns terminal status payload media without depending on result fetch probes", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "COMPLETED",
          data: {
            images: [{ url: "https://cdn.shortpulse.test/terminal-status-media.png" }],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-terminal-media" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      request_id: string;
      data?: { images?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.state).toBe("completed");
    expect(payload.request_id).toBe("req-terminal-media");
    expect(payload.data?.images?.[0]?.url).toBe(
      toSignedResultUrl("user-1/generations/results/media-1.png")
    );
  });

  it("does not downgrade terminal status when completed status payload has stale in-progress response_url data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            response_url: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/requests/req-2",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
            data: {
              images: [{ url: "https://cdn.shortpulse.test/seedream-image-2.png" }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-2" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      request_id: string;
      data?: { images?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.state).toBe("completed");
    expect(payload.request_id).toBe("req-2");
    expect(payload.data?.images?.[0]?.url).toBe(
      toSignedResultUrl("user-1/generations/results/media-1.png")
    );
  });

  it("probes alternate queue bases when the first status base misses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            data: { images: [{ url: "https://cdn.shortpulse.test/alt-base-success.png" }] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: [
        "https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests",
        "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      ],
      routeLabel: "Fal Nano Banana Pro Edit",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-alt-base" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      request_id: string;
      data?: { images?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.request_id).toBe("req-alt-base");
    expect(payload.data?.images?.[0]?.url).toBe(
      toSignedResultUrl("user-1/generations/results/media-1.png")
    );
  });

  it("fails closed when the status route returns a missing-route response", async () => {
    persistedGenerationRows = [
      {
        id: "gen-status-alias-result-1",
        request_id: "req-status-alias-result",
        status: "running",
        metadata: {},
      },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            images: [{ url: "https://cdn.shortpulse.test/status-alias-result.png" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-2/requests",
      routeLabel: "Fal Nano Banana 2",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-status-alias-result" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        state: "error",
        error: "Not found",
        request_id: "req-status-alias-result",
        detail: { detail: "Not found" },
      })
    );
    expect(settleDirectGenerationSuccessMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_status.status_upstream_non_ok",
      })
    );
  });

  it("does not keep polling when the status route returns a missing-route response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "IN_PROGRESS" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-2/requests",
      routeLabel: "Fal Nano Banana 2",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-status-alias-running" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        state: "error",
        error: "Not found",
        request_id: "req-status-alias-running",
        detail: { detail: "Not found" },
      })
    );
    expect(settleDirectGenerationSuccessMock).not.toHaveBeenCalled();
    expect(settleDirectGenerationFailureMock).not.toHaveBeenCalled();
    expect(executeGenerationRecoveryMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api.fal_status.status_upstream_non_ok",
      })
    );
  });

  it("uses the selected status base for terminal result fetches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
            response_url:
              "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit/requests/req-cross-alias",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
            data: { images: [{ url: "https://cdn.shortpulse.test/cross-alias-media.png" }] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: [
        "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
        "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit/requests",
      ],
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-cross-alias" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      request_id: string;
      data?: { images?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.state).toBe("completed");
    expect(payload.request_id).toBe("req-cross-alias");
    expect(payload.data?.images?.[0]?.url).toBe(
      toSignedResultUrl("user-1/generations/results/media-1.png")
    );
  });

  it("does not downgrade terminal status when completed status payload has stale in-progress result data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
            data: {
              images: [{ url: "https://cdn.shortpulse.test/seedream-image-3.png" }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
      routeLabel: "Fal Seedream",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-3" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      request_id: string;
      data?: { images?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.state).toBe("completed");
    expect(payload.request_id).toBe("req-3");
    expect(payload.data?.images?.[0]?.url).toBe(
      toSignedResultUrl("user-1/generations/results/media-1.png")
    );
  });

  it("uses the selected completed status base when another alias reports terminal failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "FAILED",
            error: "temporary alias failure",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            data: {
              videos: [{ url: "https://cdn.shortpulse.test/veo-alias-media.mp4" }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: [
        "https://queue.fal.run/fal-ai/veo3.1/requests",
        "https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests",
      ],
      routeLabel: "Fal Veo image-to-video",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-veo-alias-conflict" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      request_id: string;
      data?: { videos?: Array<{ url?: string }> };
    };
    expect(payload.status).toBe("completed");
    expect(payload.state).toBe("completed");
    expect(payload.request_id).toBe("req-veo-alias-conflict");
    expect(payload.data?.videos?.[0]?.url).toBe(
      toSignedResultUrl("user-1/generations/results/media-1.mp4")
    );
  });

  it("treats retryable status upstream failures as transient and keeps polling payload", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "upstream temporarily unavailable" }), {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "x-fal-retryable": "true",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-status-retryable" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      error: "upstream temporarily unavailable",
      shortpulseLifecycle: {
        taskState: "running",
        isTerminal: false,
        providerState: "running",
        recoveryPending: true,
      },
    });
  });

  it("settles retryable status upstream failures when the payload already includes media", async () => {
    persistedGenerationRows = [
      {
        id: "gen-1",
        status: "processing",
        metadata: {},
      },
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "IN_PROGRESS",
          data: {
            images: [{ url: "https://cdn.shortpulse.test/retryable-status-image.png" }],
          },
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "x-fal-retryable": "true",
          },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-status-retryable-media" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        state: "completed",
        request_id: "req-status-retryable-media",
        generationId: "gen-1",
        data: expect.objectContaining({
          images: [{ url: toSignedResultUrl("user-1/generations/results/media-1.png") }],
        }),
        shortpulseLifecycle: expect.objectContaining({
          taskState: "success",
          isTerminal: true,
          resultUrls: [toSignedResultUrl("user-1/generations/results/media-1.png")],
          deliveryState: "canonical_owned",
        }),
      })
    );
    expect(settleDirectGenerationSuccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-status-retryable-media",
        resultUrls: ["https://cdn.shortpulse.test/retryable-status-image.png"],
      })
    );
  });

  it("adds normalized lifecycle hints to nonterminal provider status payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "IN_PROGRESS",
          request_id: "req-nonterminal-hint",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-nonterminal-hint" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "IN_PROGRESS",
        request_id: "req-nonterminal-hint",
        shortpulseLifecycle: {
          taskState: "running",
          isTerminal: false,
          providerState: "in_progress",
          queueState: "dispatched",
          statusLabel: "Processing...",
        },
      })
    );
  });

  it("treats retryable result upstream failures as transient and keeps completed status payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "result temporarily unavailable" }), {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "x-fal-retryable": "true",
          },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-result-retryable" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "COMPLETED",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "running",
          isTerminal: false,
          providerState: "completed",
          recoveryPending: true,
          queueState: "dispatched",
          statusLabel: "Processing...",
        }),
      })
    );
  });

  it("settles retryable result upstream failures when the result payload already includes media", async () => {
    persistedGenerationRows = [
      {
        id: "gen-1",
        status: "processing",
        metadata: {},
      },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            images: [{ url: "https://cdn.shortpulse.test/retryable-result-image.png" }],
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "x-fal-retryable": "true",
            },
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-result-retryable-media" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        state: "completed",
        request_id: "req-result-retryable-media",
        generationId: "gen-1",
        images: [{ url: toSignedResultUrl("user-1/generations/results/media-1.png") }],
        shortpulseLifecycle: expect.objectContaining({
          taskState: "success",
          isTerminal: true,
          resultUrls: [toSignedResultUrl("user-1/generations/results/media-1.png")],
          deliveryState: "canonical_owned",
        }),
      })
    );
    expect(settleDirectGenerationSuccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-result-retryable-media",
        resultUrls: ["https://cdn.shortpulse.test/retryable-result-image.png"],
      })
    );
  });

  it("settles missing result routes as terminal provider failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "not ready" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-result-alias-retryable" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        state: "error",
        error: "not ready",
        request_id: "req-result-alias-retryable",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "fail",
          isTerminal: true,
          providerState: "completed",
          queueState: "failed",
        }),
      })
    );
  });

  it("treats non-retryable result upstream failures as terminal and returns an error payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            detail: [
              {
                type: "downstream_service_error",
                msg: "Downstream service error",
              },
            ],
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "x-fal-needs-retry": "false",
            },
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-result-terminal-failure" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0]?.[0] as {
      status: string;
      state: string;
      error: string;
      request_id: string;
      detail?: {
        detail?: Array<{ type?: string; msg?: string }>;
      };
    };
    expect(payload.status).toBe("error");
    expect(payload.state).toBe("error");
    expect(payload.error).toBe("Downstream service error");
    expect(payload.request_id).toBe("req-result-terminal-failure");
    expect(typeof payload.detail).toBe("string");
    expect(payload.detail).toContain("downstream_service_error");
    expect(payload.detail).toContain("Downstream service error");
    expect(settleDirectGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        requestId: "req-result-terminal-failure",
        routeLabel: "Fal Nano Banana Pro",
      })
    );
  });

  it("treats transport failures as transient when status transient failures are enabled", async () => {
    process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED = "true";
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-transient-transport" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "IN_PROGRESS",
        state: "running",
        request_id: "req-transient-transport",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.fal.status.transient.transport",
      })
    );
  });

  it("treats non-JSON status responses as transient when status transient failures are enabled", async () => {
    process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED = "true";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("<html>upstream gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-transient-status-non-json" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "IN_PROGRESS",
        state: "running",
        request_id: "req-transient-status-non-json",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.fal.status.transient.non_json_status",
      })
    );
  });

  it("treats retryable Kie non-JSON status responses as transient without the broad transient flag", async () => {
    process.env.SHORTPULSE_KIE_API_KEY = "test-kie-key";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        "<!DOCTYPE html><html><head><title>kie.ai | 520: Web server is returning an unknown error</title></head></html>",
        {
          status: 520,
          headers: { "Content-Type": "text/html" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      provider: "kie",
      modelId: "kie-ai/seedance-2",
      queueBaseUrl: "https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}",
      routeLabel: "Kie Seedance 2",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-kie-seedance-cloudflare-520" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=req-kie-seedance-cloudflare-520",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-kie-key",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "IN_PROGRESS",
        state: "running",
        request_id: "req-kie-seedance-cloudflare-520",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.fal.status.transient.non_json_status",
        statusCode: 520,
      })
    );
  });

  it("treats non-JSON result responses as transient when status transient failures are enabled", async () => {
    process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED = "true";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response("<html>invalid-result-payload</html>", {
          status: 422,
          headers: { "Content-Type": "text/html" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-transient-result-non-json" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "IN_PROGRESS",
        state: "running",
        request_id: "req-transient-result-non-json",
      })
    );
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.fal.status.transient.non_json_result",
      })
    );
  });

  it("keeps polling when completed-without-media is requeued for recovery", async () => {
    process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED = "true";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            data: {},
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    executeGenerationRecoveryMock.mockResolvedValue({
      ok: true,
      state: "no_media",
      generationId: "gen-transient-no-media",
      requestId: "req-transient-no-media",
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    });

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-transient-no-media" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "IN_PROGRESS",
        state: "running",
        request_id: "req-transient-no-media",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "running",
          isTerminal: false,
          providerState: "completed",
          recoveryPending: true,
          completionState: "completed_awaiting_media",
          queueState: "dispatched",
        }),
      })
    );
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "poll",
        requestId: "req-transient-no-media",
      })
    );
    expect(settleDirectGenerationFailureMock).not.toHaveBeenCalled();
  });

  it("treats missing-media as a terminal canonical failure when recovery exhausts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            data: {},
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    executeGenerationRecoveryMock.mockImplementation(async () => {
      persistedProjectionRows = [
        {
          generation_id: "gen-terminal-no-media",
          request_id: "req-terminal-no-media",
          result_urls: [],
          publication_state: "suppressed",
          status: "ready",
          task_state: "fail",
          queue_state: "failed",
          error_message_short: "No media returned.",
          error_detail: "Provider terminal success without media payload.",
        },
      ];
      persistedGenerationRows = [
        {
          id: "gen-terminal-no-media",
          request_id: "req-terminal-no-media",
          status: "fail",
          error_message: "Generation failed.",
          created_at: "2026-04-18T00:00:00.000Z",
        },
      ];
      persistedOutputRows = [];
      return {
        ok: true,
        state: "exhausted",
        generationId: "gen-terminal-no-media",
        requestId: "req-terminal-no-media",
        mediaFileIds: [],
        mediaUrls: [],
        processed: true,
      };
    });

    const handler = createFalStatusHandler({
      queueBaseUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/requests",
      routeLabel: "Fal Nano Banana Pro",
      timeoutMs: 15000,
    });

    const req = {
      method: "POST",
      body: { requestId: "req-terminal-no-media" },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        state: "error",
        request_id: "req-terminal-no-media",
        error: "No media returned.",
        shortpulseLifecycle: expect.objectContaining({
          taskState: "fail",
          isTerminal: true,
          errorMessage: "No media returned.",
          providerState: "completed",
          queueState: "failed",
        }),
      })
    );
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-terminal-no-media",
      })
    );
    expect(settleDirectGenerationFailureMock).not.toHaveBeenCalled();
  });
});
