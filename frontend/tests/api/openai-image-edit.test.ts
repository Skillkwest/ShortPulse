/**
 * Route coverage for the authenticated GPT Image 2 edit API.
 * Verifies validation, billing handoff, persistence, and refund behavior for standard edits.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/openai/image-edit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const readGenerationAbandonmentContextMock = vi.fn();
const editOpenAiImageMock = vi.fn();
const persistGeneratedImageAssetMock = vi.fn();
const readInternalMediaRefsFromPayloadMock = vi.fn();
const readInternalEditMediaRefsFromPayloadMock = vi.fn();
const resolveOpenAiImageFilesForInternalMediaRefsMock = vi.fn();
const resolveOpenAiImageFilesForInternalEditMediaRefsMock = vi.fn();
const filterExternalUrlsFromInternalRefsMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/generationBilling", () => ({
  chargeGenerationRequest: (...args: unknown[]) => chargeGenerationRequestMock(...args),
  captureSucceededGenerationByProviderRequest: (...args: unknown[]) =>
    captureSucceededGenerationByProviderRequestMock(...args),
}));

vi.mock("../../lib/server/api/generationAbandonment", () => ({
  readGenerationAbandonmentContext: (...args: unknown[]) =>
    readGenerationAbandonmentContextMock(...args),
}));

vi.mock("../../lib/server/api/internalMediaRefResolution", () => ({
  readInternalMediaRefsFromPayload: (...args: unknown[]) =>
    readInternalMediaRefsFromPayloadMock(...args),
  readInternalEditMediaRefsFromPayload: (...args: unknown[]) =>
    readInternalEditMediaRefsFromPayloadMock(...args),
  resolveOpenAiImageFilesForInternalMediaRefs: (...args: unknown[]) =>
    resolveOpenAiImageFilesForInternalMediaRefsMock(...args),
  resolveOpenAiImageFilesForInternalEditMediaRefs: (...args: unknown[]) =>
    resolveOpenAiImageFilesForInternalEditMediaRefsMock(...args),
  filterExternalUrlsFromInternalRefs: (...args: unknown[]) =>
    filterExternalUrlsFromInternalRefsMock(...args),
}));

vi.mock("../../lib/server/openaiImageGeneration", () => ({
  editOpenAiImage: (...args: unknown[]) => editOpenAiImageMock(...args),
  persistGeneratedImageAsset: async (...args: unknown[]) => {
    const result = await persistGeneratedImageAssetMock(...args);
    const input = args[0] as {
      beforeVisibleSettlement?: (context: {
        generationId: string;
        requestId: string;
        providerRequestId: string | null;
        outputRowId: string | null;
        mediaFileId: string | null;
      }) => Promise<void>;
      providerRequestId?: string | null;
    };
    await input.beforeVisibleSettlement?.({
      generationId: result.generationId,
      requestId: result.requestId,
      providerRequestId: input.providerRequestId ?? null,
      outputRowId: result.outputRowId ?? null,
      mediaFileId: result.mediaFileId ?? null,
    });
    return result;
  },
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});
type MockResponse = ReturnType<typeof createMockResponse>;

const createInternalFile = (filename: string) => ({
  buffer: Buffer.from(`file:${filename}`),
  contentType: "image/png",
  filename,
  byteLength: Buffer.byteLength(`file:${filename}`),
  storagePath: `user-1/${filename}`,
});

describe("POST /api/openai/image-edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    chargeGenerationRequestMock.mockResolvedValue({
      userId: "user-1",
      modelId: "gpt-image-2",
      credits: 15,
      sourceRef: "billing-source-image-edit-1",
      billingMode: "reservation",
      chargeMetadata: { debited_credits: 15 },
      pricingBreakdown: {
        billedCredits: 15,
        billedUsd: 0.15,
        pricingPolicySource: "control_plane",
        pricingPolicyVersion: 3,
        rawCredits: 11,
        usdRaw: 0.11,
      },
      pricingParams: {
        size: "1024x1024",
        quality: "medium",
        inputImageCount: 2,
        inputFidelity: "high",
      },
      markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "reserved" }),
      refund: vi.fn().mockResolvedValue(undefined),
    });
    captureSucceededGenerationByProviderRequestMock.mockResolvedValue({
      settled: true,
      sourceRef: "billing-source-image-edit-1",
      note: "captured",
    });
    readGenerationAbandonmentContextMock.mockResolvedValue({
      abandoned: false,
      noRefund: false,
    });
    readInternalMediaRefsFromPayloadMock.mockReturnValue([]);
    readInternalEditMediaRefsFromPayloadMock.mockReturnValue({
      baseImageRef: null,
      maskRef: null,
      referenceImageRef: null,
    });
    resolveOpenAiImageFilesForInternalMediaRefsMock.mockResolvedValue([]);
    resolveOpenAiImageFilesForInternalEditMediaRefsMock.mockResolvedValue({
      baseImageFile: null,
      maskFile: null,
      referenceImageFile: null,
    });
    filterExternalUrlsFromInternalRefsMock.mockImplementation((urls: unknown[]) =>
      urls.filter(
        (url): url is string => typeof url === "string" && !url.includes("stale.internal")
      )
    );
  });

  it("rejects invalid payloads", async () => {
    const req = {
      method: "POST",
      body: {
        prompt: "restyle this photo",
        size: "1024x1024",
        quality: "medium",
        images: [],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(editOpenAiImageMock).not.toHaveBeenCalled();
  });

  it("stops before provider submission when billing already returned a fail-closed response", async () => {
    chargeGenerationRequestMock.mockImplementationOnce(async ({ res }: { res: MockResponse }) => {
      res.status(402).json({
        error: "Insufficient credits. Add credits or switch plans before retrying.",
        code: "INSUFFICIENT_CREDITS",
      });
      return null;
    });

    const req = {
      method: "POST",
      body: {
        prompt: "cinematic portrait edit",
        size: "1024x1024",
        quality: "medium",
        images: [{ image_url: "https://example.com/base.png" }],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(editOpenAiImageMock).not.toHaveBeenCalled();
    expect(persistGeneratedImageAssetMock).not.toHaveBeenCalled();
    expect(captureSucceededGenerationByProviderRequestMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      error: "Insufficient credits. Add credits or switch plans before retrying.",
      code: "INSUFFICIENT_CREDITS",
    });
  });

  it("charges, edits, and persists one GPT Image 2 output", async () => {
    editOpenAiImageMock.mockResolvedValue({
      buffer: Buffer.from("image-data"),
      contentType: "image/png",
      providerRequestId: "provider-image-edit-1",
      revisedPrompt: "a more cinematic portrait",
      usage: {
        inputTokens: 120,
        outputTokens: 380,
        totalTokens: 500,
        inputImageTokens: 90,
        inputTextTokens: 30,
        outputImageTokens: 380,
        outputTextTokens: 0,
      },
    });
    persistGeneratedImageAssetMock.mockResolvedValue({
      generationId: "gen-image-edit-1",
      mediaFileId: "media-image-edit-1",
      requestId: "billing-source-image-edit-1",
      storagePath: "user-1/generations/images/gen-image-edit-1/portrait.png",
      signedUrl: "https://signed.example/generated-image-edit.png",
      outputRowId: "output-image-edit-1",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "cinematic portrait edit",
        size: "1024x1024",
        quality: "medium",
        images: [
          { image_url: "https://example.com/base.png" },
          { image_url: "https://example.com/ref.png" },
        ],
        mask: { image_url: "https://example.com/mask.png" },
        project_id: "project-1",
        generation_replay: { source: "reroll" },
        character_context: { characterId: "char-1" },
        style_context: { styleId: "style-1" },
        shortpulse_context: { submitPanel: "edit" },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "gpt-image-2",
        payload: {
          prompt: "cinematic portrait edit",
          size: "1024x1024",
          quality: "medium",
          n: 1,
          images: [
            { image_url: "https://example.com/base.png" },
            { image_url: "https://example.com/ref.png" },
          ],
          input_fidelity: "high",
          mask: { image_url: "https://example.com/mask.png" },
        },
      })
    );
    expect(editOpenAiImageMock).toHaveBeenCalledWith({
      prompt: "cinematic portrait edit",
      size: "1024x1024",
      quality: "medium",
      images: [
        { kind: "url", imageUrl: "https://example.com/base.png" },
        { kind: "url", imageUrl: "https://example.com/ref.png" },
      ],
      mask: { kind: "url", imageUrl: "https://example.com/mask.png" },
    });

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.markSubmitted).toHaveBeenCalledWith(
      "provider-image-edit-1",
      expect.objectContaining({
        source_mode: "image",
        openai_operation: "edit",
        requested_size: "1024x1024",
        requested_quality: "medium",
        input_image_count: 2,
        input_fidelity: "high",
        mask_present: true,
      })
    );

    expect(persistGeneratedImageAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        projectId: "project-1",
        requestId: "billing-source-image-edit-1",
        providerRequestId: "provider-image-edit-1",
        requestedSize: "1024x1024",
        requestedQuality: "medium",
        generationReplay: { source: "reroll" },
        characterContext: { characterId: "char-1" },
        styleContext: { styleId: "style-1" },
        extraMetadata: expect.objectContaining({
          billing_mode: "reservation",
          debited_credits: 15,
          provider_request_id: "provider-image-edit-1",
          revised_prompt: "a more cinematic portrait",
          shortpulse_context: { submitPanel: "edit" },
          openai_operation: "edit",
          input_image_count: 2,
          input_fidelity: "high",
          mask_present: true,
        }),
      })
    );
    expect(captureSucceededGenerationByProviderRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "provider-image-edit-1",
      reason: "OpenAI image edit completed.",
      routeLabel: "openai-image-edit",
      detail: {
        generation_id: "gen-image-edit-1",
        source_ref: "billing-source-image-edit-1",
        source_mode: "image",
        openai_operation: "edit",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      output: {
        provider: "openai-image",
        mode: "image",
        generationId: "gen-image-edit-1",
        mediaFileId: "media-image-edit-1",
        requestId: "billing-source-image-edit-1",
        previewUrl: "https://signed.example/generated-image-edit.png",
        resultUrls: ["https://signed.example/generated-image-edit.png"],
        previewStoragePath: "user-1/generations/images/gen-image-edit-1/portrait.png",
        fullStoragePath: "user-1/generations/images/gen-image-edit-1/portrait.png",
        mimeType: "image/png",
        modelId: "gpt-image-2",
        savedMediaIds: ["media-image-edit-1"],
      },
    });
  });

  it("replaces stale internal edit refs with direct provider file inputs before provider edit", async () => {
    editOpenAiImageMock.mockResolvedValue({
      buffer: Buffer.from("image-data"),
      contentType: "image/png",
      providerRequestId: "provider-image-edit-1",
      revisedPrompt: null,
      usage: null,
    });
    persistGeneratedImageAssetMock.mockResolvedValue({
      generationId: "gen-image-edit-1",
      mediaFileId: "media-image-edit-1",
      requestId: "billing-source-image-edit-1",
      storagePath: "user-1/generations/images/gen-image-edit-1/portrait.png",
      signedUrl: "https://signed.example/generated-image-edit.png",
      outputRowId: "output-image-edit-1",
    });
    readInternalEditMediaRefsFromPayloadMock.mockReturnValue({
      baseImageRef: {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/base.png",
      },
      maskRef: {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/mask.png",
      },
      referenceImageRef: {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user-1/ref.png",
      },
    });
    resolveOpenAiImageFilesForInternalEditMediaRefsMock.mockResolvedValue({
      baseImageFile: createInternalFile("base.png"),
      maskFile: createInternalFile("mask.png"),
      referenceImageFile: createInternalFile("ref.png"),
    });

    const req = {
      method: "POST",
      body: {
        prompt: "cinematic portrait edit",
        size: "1024x1024",
        quality: "medium",
        images: [
          { image_url: "https://stale.internal/base.png" },
          { image_url: "https://stale.internal/ref.png" },
        ],
        mask: { image_url: "https://stale.internal/mask.png" },
        shortpulse_internal_edit_media_refs: {
          base_image: {},
          mask_image: {},
          reference_image: {},
        },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(editOpenAiImageMock).toHaveBeenCalledWith({
      prompt: "cinematic portrait edit",
      size: "1024x1024",
      quality: "medium",
      images: [
        {
          kind: "file",
          buffer: createInternalFile("base.png").buffer,
          contentType: "image/png",
          filename: "base.png",
          sourceId: "user-1/base.png",
        },
        {
          kind: "file",
          buffer: createInternalFile("ref.png").buffer,
          contentType: "image/png",
          filename: "ref.png",
          sourceId: "user-1/ref.png",
        },
      ],
      mask: {
        kind: "file",
        buffer: createInternalFile("mask.png").buffer,
        contentType: "image/png",
        filename: "mask.png",
        sourceId: "user-1/mask.png",
      },
    });
  });

  it("clamps legacy input_fidelity payloads to high before internal billing", async () => {
    editOpenAiImageMock.mockRejectedValue(new Error("provider stopped"));

    const req = {
      method: "POST",
      body: {
        prompt: "cinematic portrait edit",
        size: "1024x1024",
        quality: "medium",
        images: [{ image_url: "https://example.com/base.png" }],
        input_fidelity: "low",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          input_fidelity: "high",
        }),
      })
    );
    expect(editOpenAiImageMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        inputFidelity: expect.any(String),
      })
    );
  });

  it("refunds the user when provider edit fails", async () => {
    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    editOpenAiImageMock.mockRejectedValue(new Error("provider down"));

    const req = {
      method: "POST",
      body: {
        prompt: "cinematic portrait edit",
        size: "1024x1024",
        quality: "medium",
        images: [{ image_url: "https://example.com/base.png" }],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const resolvedCharge = charge ?? (await chargeGenerationRequestMock.mock.results[0]?.value);
    expect(resolvedCharge.refund).toHaveBeenCalledWith(
      "Auto-refund: OpenAI image edit failed.",
      expect.objectContaining({
        source_mode: "image",
        openai_operation: "edit",
      })
    );
    expect(logApiRouteExceptionMock).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to edit image",
      details: "provider down",
    });
  });
});
