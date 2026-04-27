/**
 * Route coverage for the authenticated GPT Image 2 edit API.
 * Verifies validation, billing handoff, persistence, and refund behavior for standard edits.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/openai/image-edit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const editOpenAiImageMock = vi.fn();
const persistGeneratedImageAssetMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/generationBilling", () => ({
  chargeGenerationRequest: (...args: unknown[]) => chargeGenerationRequestMock(...args),
}));

vi.mock("../../lib/server/openaiImageGeneration", () => ({
  editOpenAiImage: (...args: unknown[]) => editOpenAiImageMock(...args),
  persistGeneratedImageAsset: (...args: unknown[]) => persistGeneratedImageAssetMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
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
      billingMode: "direct_debit",
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
      markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "attached" }),
      refund: vi.fn().mockResolvedValue(undefined),
    });
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
        input_fidelity: "high",
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
      images: ["https://example.com/base.png", "https://example.com/ref.png"],
      inputFidelity: "high",
      maskUrl: "https://example.com/mask.png",
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
          billing_mode: "direct_debit",
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
