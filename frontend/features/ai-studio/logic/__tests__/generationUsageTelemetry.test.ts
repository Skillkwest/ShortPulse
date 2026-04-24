/**
 * Telemetry contract tests for AI Studio generation usage analytics.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reportAppErrorMock } = vi.hoisted(() => ({
  reportAppErrorMock: vi.fn(),
}));

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: reportAppErrorMock,
}));

import { trackAiStudioGenerateClicked } from "../generationUsageTelemetry";

describe("generationUsageTelemetry", () => {
  beforeEach(() => {
    reportAppErrorMock.mockClear();
  });

  it("emits normalized generate-click telemetry for accepted user actions", () => {
    trackAiStudioGenerateClicked({
      trigger: "generate",
      tool: "create",
      mode: "image",
      modelId: "fal-ai/nano-banana-pro",
      selectedModelId: "fal-ai/nano-banana-pro",
      projectIdPresent: true,
      isCharacterMode: true,
      selectedCharacterId: "char_123",
      hasStyle: true,
      styleId: "style_456",
      referenceCount: 2,
    });

    expect(reportAppErrorMock).toHaveBeenCalledTimes(1);
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.ai_studio.generate_clicked",
        message: "generate_clicked.generate",
        metadata: expect.objectContaining({
          telemetry_family: "generation_usage",
          telemetry_version: 1,
          event_name: "generate_clicked",
          trigger: "generate",
          tool: "create",
          selected_tool: "create",
          mode: "image",
          model_id: "fal-ai/nano-banana-pro",
          selected_model_id: "fal-ai/nano-banana-pro",
          project_id_present: true,
          is_character_mode: true,
          selected_character_id: "char_123",
          has_style: true,
          style_id: "style_456",
          reference_count: 2,
        }),
      })
    );
  });

  it("keeps nullable model metadata stable when no model is available", () => {
    trackAiStudioGenerateClicked({
      trigger: "regenerate",
      tool: "edit",
      mode: "image",
      modelId: null,
      selectedModelId: null,
      outputId: "out-123",
      referenceCount: null,
    });

    const payload = reportAppErrorMock.mock.calls[0]?.[0];
    expect(payload?.message).toBe("generate_clicked.regenerate");
    expect(payload?.metadata).toEqual(
      expect.objectContaining({
        model_id: null,
        selected_model_id: null,
        output_id: "out-123",
        selected_tool: "edit",
        project_id_present: false,
        is_character_mode: false,
        has_style: false,
        reference_count: 0,
      })
    );
  });
});
