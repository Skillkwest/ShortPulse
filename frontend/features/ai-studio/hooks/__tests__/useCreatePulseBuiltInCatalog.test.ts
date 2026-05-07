import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { useCreatePulseBuiltInCatalog } from "../useCreatePulseBuiltInCatalog";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

describe("useCreatePulseBuiltInCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads Pulse built-ins through authenticated fetch", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      new Response(
        JSON.stringify({
          builtInDefinitions: [
            {
              presetId: "catalog_test",
              label: "Catalog Test",
              description: "Server catalog entry.",
              systemInstructions: "Use the control-plane catalog.",
              runtimeMode: "workflow_gpt",
              activationMode: "activate_and_start",
              outputMode: "chat_reply",
              memoryPolicy: "session",
              starterAssistantMessage: null,
              workflowStageHints: null,
              artifactTarget: "image_prompt",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const { result } = renderHook(() => useCreatePulseBuiltInCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchWithAuth).toHaveBeenCalledWith("/api/ai/create-pulse-builtins", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    expect(result.current.error).toBeNull();
    expect(result.current.builtInDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          presetId: "catalog_test",
          artifactTarget: "image_prompt",
        }),
      ])
    );
  });
});
