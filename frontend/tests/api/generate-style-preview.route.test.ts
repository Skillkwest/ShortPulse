/**
 * Route tests for POST /api/ai/generate-style-preview.
 * Locks billing, provider, resize, and refund behavior for prompt-only style-card previews.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/ai/generate-style-preview";

const { sharpMock, resizeMock, jpegMock, toBufferMock } = vi.hoisted(() => {
  const toBufferMock = vi.fn();
  const jpegMock = vi.fn(() => ({ toBuffer: toBufferMock }));
  const resizeMock = vi.fn(() => ({ jpeg: jpegMock }));
  const sharpMock = vi.fn(() => ({ resize: resizeMock }));
  return { sharpMock, resizeMock, jpegMock, toBufferMock };
});

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const chargeGenerationRequestMock = vi.fn();
const captureSucceededGenerationByProviderRequestMock = vi.fn();
const generateOpenAiImageMock = vi.fn();

vi.mock("sharp", () => ({
  default: sharpMock,
}));

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

vi.mock("../../lib/server/openaiImageGeneration", () => ({
  generateOpenAiImage: (...args: unknown[]) => generateOpenAiImageMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});
type MockResponse = ReturnType<typeof createMockResponse>;

const createCharge = () => ({
  userId: "user-1",
  modelId: "gpt-image-2",
  credits: 1,
  sourceRef: "style-preview-source-1",
  billingMode: "reservation" as const,
  chargeMetadata: { debited_credits: 1 },
  pricingBreakdown: {
    billedCredits: 1,
    billedUsd: 0.006,
    pricingPolicySource: "control_plane",
    pricingPolicyVersion: 3,
    rawCredits: 1,
    usdRaw: 0.006,
  },
  pricingParams: {
    size: "1024x1024",
    quality: "low",
  },
  markSubmitted: vi.fn().mockResolvedValue({ ok: true, status: "reserved" }),
  refund: vi.fn().mockResolvedValue(undefined),
});

describe("POST /api/ai/generate-style-preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    chargeGenerationRequestMock.mockResolvedValue(createCharge());
    captureSucceededGenerationByProviderRequestMock.mockResolvedValue({
      settled: true,
      sourceRef: "style-preview-source-1",
      note: "captured",
    });
    generateOpenAiImageMock.mockResolvedValue({
      buffer: Buffer.from("generated-png"),
      contentType: "image/png",
      providerRequestId: "provider-style-preview-1",
      revisedPrompt: null,
    });
    toBufferMock.mockResolvedValue(Buffer.from("preview-jpeg"));
  });

  it("rejects non-POST requests", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
  });

  it("rejects missing style inputs before billing", async () => {
    const req = {
      method: "POST",
      body: {
        styleId: "style-library-custom-1",
        styleName: "Dream Glow",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "styleId, styleName, and stylePrompt are required.",
    });
    expect(chargeGenerationRequestMock).not.toHaveBeenCalled();
    expect(generateOpenAiImageMock).not.toHaveBeenCalled();
  });

  it("stops before provider submission when billing returns a fail-closed response", async () => {
    chargeGenerationRequestMock.mockImplementationOnce(async ({ res }: { res: MockResponse }) => {
      res.status(429).json({
        error: "Too many active generations. Please retry shortly.",
        code: "GENERATION_ADMISSION_LIMIT",
      });
      return null;
    });
    const req = {
      method: "POST",
      body: {
        styleId: "style-library-custom-1",
        styleName: "Dream Glow",
        stylePrompt: "ethereal bloom and soft highlights",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(generateOpenAiImageMock).not.toHaveBeenCalled();
    expect(captureSucceededGenerationByProviderRequestMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many active generations. Please retry shortly.",
      code: "GENERATION_ADMISSION_LIMIT",
    });
  });

  it("charges through Create image pricing, generates, resizes, captures, and returns a data URL", async () => {
    const req = {
      method: "POST",
      body: {
        styleId: "style-library-custom-1",
        styleName: "Dream Glow",
        stylePrompt: "ethereal bloom and soft highlights",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(chargeGenerationRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "gpt-image-2",
        payload: expect.objectContaining({
          size: "1024x1024",
          quality: "low",
          n: 1,
        }),
        reason: "openai-gpt-image-2 style preview generation",
        shortpulseContext: {
          selected_tool: "create",
          mode: "image",
          source_mode: "style_preview",
          style_id: "style-library-custom-1",
          style_name: "Dream Glow",
        },
      })
    );
    const prompt = chargeGenerationRequestMock.mock.calls[0]?.[0]?.payload?.prompt;
    expect(prompt).toContain('custom style "Dream Glow"');
    expect(prompt).toContain("ethereal bloom and soft highlights");
    expect(generateOpenAiImageMock).toHaveBeenCalledWith({
      prompt,
      size: "1024x1024",
      quality: "low",
    });

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.markSubmitted).toHaveBeenCalledWith("provider-style-preview-1", {
      source_mode: "style_preview",
      requested_size: "1024x1024",
      requested_quality: "low",
      style_id: "style-library-custom-1",
    });
    expect(sharpMock).toHaveBeenCalledWith(Buffer.from("generated-png"));
    expect(resizeMock).toHaveBeenCalledWith(512, 512, {
      fit: "cover",
      position: "center",
    });
    expect(jpegMock).toHaveBeenCalledWith({
      quality: 86,
      mozjpeg: true,
    });
    expect(captureSucceededGenerationByProviderRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "provider-style-preview-1",
      reason: "Style preview image generated.",
      routeLabel: "ai-generate-style-preview",
      detail: {
        source_ref: "style-preview-source-1",
        source_mode: "style_preview",
        style_id: "style-library-custom-1",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      previewImageUrl: `data:image/jpeg;base64,${Buffer.from("preview-jpeg").toString("base64")}`,
      modelId: "gpt-image-2",
      size: "1024x1024",
      quality: "low",
    });
  });

  it("uses the source ref as provider request fallback when OpenAI omits one", async () => {
    generateOpenAiImageMock.mockResolvedValueOnce({
      buffer: Buffer.from("generated-png"),
      contentType: "image/png",
      providerRequestId: null,
      revisedPrompt: null,
    });
    const req = {
      method: "POST",
      body: {
        styleId: "style-library-custom-1",
        styleName: "Dream Glow",
        stylePrompt: "ethereal bloom and soft highlights",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.markSubmitted).toHaveBeenCalledWith(
      "openai:style-preview-source-1",
      expect.objectContaining({
        source_mode: "style_preview",
      })
    );
    expect(captureSucceededGenerationByProviderRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "openai:style-preview-source-1",
      })
    );
  });

  it("refunds and logs when generation fails after billing", async () => {
    generateOpenAiImageMock.mockRejectedValueOnce(new Error("provider down"));
    const req = {
      method: "POST",
      body: {
        styleId: "style-library-custom-1",
        styleName: "Dream Glow",
        stylePrompt: "ethereal bloom and soft highlights",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    const charge = await chargeGenerationRequestMock.mock.results[0]?.value;
    expect(charge.refund).toHaveBeenCalledWith(
      "Auto-refund: style preview image generation failed.",
      {
        source_mode: "style_preview",
      }
    );
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "ai-generate-style-preview",
        scope: "generation",
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to generate style preview",
      details: "provider down",
    });
  });
});
