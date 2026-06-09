/**
 * Tests for prompt-only style-preview generation client helper.
 * Locks customer-facing error normalization for Styles Library preview failures.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { isStylePreviewGenerationError, postGenerateStylePreview } from "../stylePreviewGeneration";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

describe("stylePreviewGeneration helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes provider support and request-id details from safety rejection copy", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      new Response(
        JSON.stringify({
          details:
            "Your request was rejected by the safety system. If you believe this is an error, contact us at help.openai.com and include the request ID req_3d45ff849f924f518429b524432e4ac1. safety_violations=[sexual].",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    try {
      await postGenerateStylePreview({
        styleId: "style-library-custom-1",
        styleName: "Dream Glow",
        stylePrompt: "dreamlike glow",
      });
      throw new Error("Expected style preview generation to reject.");
    } catch (error) {
      expect(isStylePreviewGenerationError(error)).toBe(true);
      if (!isStylePreviewGenerationError(error)) return;
      expect(error.userMessage).toBe(
        "The preview image was blocked by the safety system. Reason: sexual."
      );
      expect(error.userMessage).not.toMatch(/OpenAI|help\.openai\.com|request ID|req_/i);
    }
  });

  it("preserves the reason when the route already returned sanitized safety copy", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      new Response(
        JSON.stringify({
          details: "Your request was blocked by the safety system. Reason: sexual.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    try {
      await postGenerateStylePreview({
        styleId: "style-library-custom-1",
        styleName: "Dream Glow",
        stylePrompt: "dreamlike glow",
      });
      throw new Error("Expected style preview generation to reject.");
    } catch (error) {
      expect(isStylePreviewGenerationError(error)).toBe(true);
      if (!isStylePreviewGenerationError(error)) return;
      expect(error.userMessage).toBe(
        "The preview image was blocked by the safety system. Reason: sexual."
      );
    }
  });
});
