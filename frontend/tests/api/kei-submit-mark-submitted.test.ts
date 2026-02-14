import { beforeEach, describe, expect, it, vi } from "vitest";
import createTaskHandler from "../../pages/api/kei/create-task";
import gpt4oGenerateHandler from "../../pages/api/kei/gpt4o-generate";

const chargeGenerationRequestMock = vi.fn();
const getModelConfigMock = vi.fn();

vi.mock("../../pages/api/_utils/generationBilling", () => ({
  chargeGenerationRequest: (...args: unknown[]) => chargeGenerationRequestMock(...args),
}));

vi.mock("../../features/ai-studio/logic/pricing", () => ({
  getModelConfig: (...args: unknown[]) => getModelConfigMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("KEI submit ownership tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KEI_API_KEY = "test-key";
    getModelConfigMock.mockReturnValue({ id: "mock-model", provider: "kei" });
  });

  it("records taskId as provider request id for create-task responses", async () => {
    const markSubmitted = vi.fn(async () => undefined);
    const refund = vi.fn(async () => undefined);
    chargeGenerationRequestMock.mockResolvedValue({
      markSubmitted,
      refund,
    });

    const upstreamPayload = { data: { taskId: "task_123" } };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(upstreamPayload),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      body: {
        model: "kei/gpt4o-image",
        input: { prompt: "hello" },
      },
    };
    const res = createMockResponse();

    await createTaskHandler(req as never, res as never);

    expect(markSubmitted).toHaveBeenCalledWith(
      "task_123",
      expect.objectContaining({
        provider: "kei",
        route: "create-task",
      })
    );
    expect(refund).not.toHaveBeenCalled();
  });

  it("records taskId as provider request id for gpt4o-generate responses", async () => {
    const markSubmitted = vi.fn(async () => undefined);
    const refund = vi.fn(async () => undefined);
    chargeGenerationRequestMock.mockResolvedValue({
      markSubmitted,
      refund,
    });

    const upstreamPayload = { taskId: "task_456" };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(upstreamPayload),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      body: { prompt: "hello" },
    };
    const res = createMockResponse();

    await gpt4oGenerateHandler(req as never, res as never);

    expect(markSubmitted).toHaveBeenCalledWith(
      "task_456",
      expect.objectContaining({
        provider: "kei",
        route: "gpt4o-generate",
      })
    );
    expect(refund).not.toHaveBeenCalled();
  });
});
