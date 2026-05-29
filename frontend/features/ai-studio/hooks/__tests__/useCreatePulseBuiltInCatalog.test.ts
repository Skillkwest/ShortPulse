import { act, renderHook, waitFor } from "@testing-library/react";
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
          source: "control_plane",
          degraded: false,
          builtInDefinitions: [
            {
              presetId: "catalog_test",
              label: "Catalog Test",
              description: "Server catalog entry.",
              systemInstructions: "Use the control-plane catalog.",
              runtimeMode: "workflow_gpt",
              activationMode: "activate_and_start",
              outputMode: "apply_prompt",
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
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    expect(result.current.error).toBeNull();
    expect(result.current.source).toBe("control_plane");
    expect(result.current.degraded).toBe(false);
    expect(result.current.isAuthoritative).toBe(true);
    expect(result.current.builtInDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          presetId: "catalog_test",
          artifactTarget: "image_prompt",
          outputMode: "apply_prompt",
        }),
      ])
    );
    expect(result.current.builtInDefinitions[0]).not.toHaveProperty("systemInstructions");
  });

  it("keeps the last loaded catalog when a later refresh fails", async () => {
    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            source: "control_plane",
            degraded: false,
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
      )
      .mockRejectedValueOnce(new Error("network down"));

    const { result } = renderHook(() => useCreatePulseBuiltInCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.builtInDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          presetId: "catalog_test",
        }),
      ])
    );
    expect(result.current.source).toBe("control_plane");
    expect(result.current.degraded).toBe(false);
    expect(result.current.isAuthoritative).toBe(false);
    expect(result.current.error).toBe("network down");
  });

  it("reports degraded seed fallback explicitly when the runtime route fails soft", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      new Response(
        JSON.stringify({
          source: "seed",
          degraded: true,
          builtInDefinitions: [
            {
              presetId: "catalog_test",
              label: "Catalog Test",
              description: "Seed fallback entry.",
              systemInstructions: "Use the seeded catalog.",
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

    expect(result.current.error).toBeNull();
    expect(result.current.source).toBe("seed");
    expect(result.current.degraded).toBe(true);
    expect(result.current.isAuthoritative).toBe(false);
  });

  it("dedupes overlapping built-in catalog loads across concurrent hook mounts", async () => {
    let resolveResponse: ((response: Response) => void) | null = null;
    vi.mocked(fetchWithAuth).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })
    );

    const first = renderHook(() => useCreatePulseBuiltInCatalog());
    const second = renderHook(() => useCreatePulseBuiltInCatalog());

    expect(fetchWithAuth).toHaveBeenCalledTimes(1);

    resolveResponse?.(
      new Response(
        JSON.stringify({
          source: "control_plane",
          degraded: false,
          builtInDefinitions: [
            {
              presetId: "catalog_test",
              label: "Catalog Test",
              description: "Server catalog entry.",
              systemInstructions: "Use the control-plane catalog.",
              runtimeMode: "workflow_gpt",
              activationMode: "activate_and_start",
              outputMode: "apply_prompt",
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

    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
      expect(second.result.current.loading).toBe(false);
    });

    expect(first.result.current.isAuthoritative).toBe(true);
    expect(second.result.current.isAuthoritative).toBe(true);
  });
});
