import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/openai/image-generate";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const readGenerationAbandonmentContextMock = vi.fn();
const generateOpenAiImageMock = vi.fn();
const persistGeneratedImageAssetMock = vi.fn();

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

vi.mock("../../lib/server/openaiImageGeneration", () => ({
  generateOpenAiImage: (...args: unknown[]) => generateOpenAiImageMock(...args),
  persistGeneratedImageAsset: (...args: unknown[]) => persistGeneratedImageAssetMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});
type MockResponse = ReturnType<typeof createMockResponse>;

describe("POST /api/openai/image-generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    chargeGenerationRequestMock.mockResolvedValue({
      userId: "user-1",
      modelId: "gpt-image-2",
      credits: 10,
      sourceRef: "billing-source-image-1",
      billingMode: "reservation",
      chargeMetadata: { debited_credits: 10 },
      pricingBreakdown: {
        billedCredits: 10,
        billedUsd: 0.1,
        pricingPolicySource: "control_plane",
        pricingPolicyVersion: 3,
        rawCredits: 6,
        usdRaw: 0.053,
      },
      pricingParams: {
        size: "1024x1024",
        quality: "medium",
      },
      markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "reserved" }),
      refund: vi.fn().mockResolvedValue(undefined),
    });
    captureSucceededGenerationByProviderRequestMock.mockResolvedValue({
      settled: true,
      sourceRef: "billing-source-image-1",
      note: "captured",
    });
    readGenerationAbandonmentContextMock.mockResolvedValue({
      abandoned: false,
      noRefund: false,
    });
  });

  it("rejects invalid payloads", async () => {
    const req = {
      method: "POST",
      body: {
        prompt: "portrait",
        size: "invalid-size",
        quality: "medium",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateOpenAiImageMock).not.toHaveBeenCalled();
  });

  it("stops before provider submission when billing already returned a fail-closed response", async () => {
    chargeGenerationRequestMock.mockImplementationOnce(async ({ res }: { res: MockResponse }) => {
      res.status(429).json({
        error: "Too many active generations. Please retry shortly.",
        code: "GENERATION_ADMISSION_LIMIT",
        retryAfterSeconds: 11,
        admissionScope: "per_user",
      });
      return null;
    });

    const req = {
      method: "POST",
      body: {
        prompt: "cinematic portrait",
        size: "1024x1024",
        quality: "medium",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(generateOpenAiImageMock).not.toHaveBeenCalled();
    expect(persistGeneratedImageAssetMock).not.toHaveBeenCalled();
    expect(captureSucceededGenerationByProviderRequestMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many active generations. Please retry shortly.",
      code: "GENERATION_ADMISSION_LIMIT",
      retryAfterSeconds: 11,
      admissionScope: "per_user",
    });
  });

  it("charges, generates, and persists one GPT Image 2 output", async () => {
    generateOpenAiImageMock.mockResolvedValue({
      buffer: Buffer.from("image-data"),
      contentType: "image/png",
      providerRequestId: "provider-image-1",
      revisedPrompt: "a more cinematic portrait",
    });
    persistGeneratedImageAssetMock.mockResolvedValue({
      generationId: "gen-image-1",
      mediaFileId: "media-image-1",
      requestId: "billing-source-image-1",
      storagePath: "user-1/generations/images/gen-image-1/portrait.png",
      signedUrl: "https://signed.example/generated-image.png",
      outputRowId: "output-image-1",
    });

    const req = {
      method: "POST",
      body: {
        prompt: "cinematic portrait",
        size: "1024x1024",
        quality: "medium",
        project_id: "project-1",
        generation_replay: { source: "reroll" },
        character_context: { characterId: "char-1" },
        style_context: { styleId: "style-1" },
        shortpulse_context: { submitPanel: "create" },
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "gpt-image-2",
        payload: {
          prompt: "cinematic portrait",
          size: "1024x1024",
          quality: "medium",
          n: 1,
        },
      })
    );
    expect(generateOpenAiImageMock).toHaveBeenCalledWith({
      prompt: "cinematic portrait",
      size: "1024x1024",
      quality: "medium",
    });

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.markSubmitted).toHaveBeenCalledWith(
      "provider-image-1",
      expect.objectContaining({
        source_mode: "image",
        requested_size: "1024x1024",
        requested_quality: "medium",
      })
    );

    expect(persistGeneratedImageAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        projectId: "project-1",
        requestId: "billing-source-image-1",
        providerRequestId: "provider-image-1",
        requestedSize: "1024x1024",
        requestedQuality: "medium",
        generationReplay: { source: "reroll" },
        characterContext: { characterId: "char-1" },
        styleContext: { styleId: "style-1" },
        extraMetadata: expect.objectContaining({
          billing_mode: "reservation",
          debited_credits: 10,
          provider_request_id: "provider-image-1",
          revised_prompt: "a more cinematic portrait",
          shortpulse_context: { submitPanel: "create" },
        }),
      })
    );
    expect(captureSucceededGenerationByProviderRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "provider-image-1",
      reason: "OpenAI image generation completed.",
      routeLabel: "openai-image-generate",
      detail: {
        generation_id: "gen-image-1",
        source_ref: "billing-source-image-1",
        source_mode: "image",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      output: {
        provider: "openai-image",
        mode: "image",
        generationId: "gen-image-1",
        mediaFileId: "media-image-1",
        requestId: "billing-source-image-1",
        previewUrl: "https://signed.example/generated-image.png",
        resultUrls: ["https://signed.example/generated-image.png"],
        previewStoragePath: "user-1/generations/images/gen-image-1/portrait.png",
        fullStoragePath: "user-1/generations/images/gen-image-1/portrait.png",
        mimeType: "image/png",
        modelId: "gpt-image-2",
        savedMediaIds: ["media-image-1"],
      },
    });
  });

  it("refunds the user when provider generation fails", async () => {
    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    generateOpenAiImageMock.mockRejectedValue(new Error("provider down"));

    const req = {
      method: "POST",
      body: {
        prompt: "cinematic portrait",
        size: "1024x1024",
        quality: "medium",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const resolvedCharge = charge ?? (await chargeGenerationRequestMock.mock.results[0]?.value);
    expect(resolvedCharge.refund).toHaveBeenCalledWith(
      "Auto-refund: OpenAI image generation failed.",
      expect.objectContaining({
        source_mode: "image",
      })
    );
    expect(logApiRouteExceptionMock).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to generate image",
      details: "provider down",
    });
  });
});
