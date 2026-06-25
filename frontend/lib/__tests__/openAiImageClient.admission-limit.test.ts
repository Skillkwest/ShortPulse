import { describe, expect, it, vi } from "vitest";
import { submitOpenAiGptImage2, submitOpenAiGptImage2Edit } from "../openAiImageClient";
import { fetchWithAuth } from "../authenticatedFetch";

vi.mock("../authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

describe("retired openAiImageClient", () => {
  it("fails closed before calling retired direct OpenAI GPT Image 2 routes", async () => {
    await expect(
      submitOpenAiGptImage2({
        prompt: "portrait",
        size: "1024x1024",
        quality: "medium",
      })
    ).rejects.toThrow("Direct OpenAI GPT Image 2 routes are retired.");

    await expect(
      submitOpenAiGptImage2Edit({
        prompt: "portrait edit",
        size: "1024x1024",
        quality: "medium",
        images: [{ image_url: "https://example.com/base.png" }],
      })
    ).rejects.toThrow("Direct OpenAI GPT Image 2 routes are retired.");

    expect(fetchWithAuth).not.toHaveBeenCalled();
  });
});
