import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { useExpertEditSystemPresetCatalog } from "../useExpertEditSystemPresetCatalog";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

describe("useExpertEditSystemPresetCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps seeded presets without fetching when disabled", async () => {
    const { result } = renderHook(() => useExpertEditSystemPresetCatalog({ enabled: false }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchWithAuth).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.source).toBe("seed");
    expect(result.current.isAuthoritative).toBe(false);
    expect(result.current.systemPresetDefinitions.length).toBeGreaterThan(0);
  });

  it("loads Edit system presets through authenticated fetch", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      new Response(
        JSON.stringify({
          source: "control_plane",
          degraded: false,
          presetDefinitions: [
            {
              presetId: "style_test",
              label: "Style Test",
              prompt: "Use the control-plane catalog.",
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

    const { result } = renderHook(() => useExpertEditSystemPresetCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchWithAuth).toHaveBeenCalledWith("/api/ai/expert-edit-system-presets", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    expect(result.current.error).toBeNull();
    expect(result.current.source).toBe("control_plane");
    expect(result.current.degraded).toBe(false);
    expect(result.current.isAuthoritative).toBe(true);
    expect(result.current.systemPresetDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          presetId: "style_test",
        }),
      ])
    );
  });

  it("keeps the last loaded catalog when a later refresh fails", async () => {
    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            source: "control_plane",
            degraded: false,
            presetDefinitions: [
              {
                presetId: "style_test",
                label: "Style Test",
                prompt: "Use the control-plane catalog.",
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

    const { result } = renderHook(() => useExpertEditSystemPresetCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.systemPresetDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          presetId: "style_test",
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
          presetDefinitions: [
            {
              presetId: "style_test",
              label: "Style Test",
              prompt: "Use the seeded catalog.",
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

    const { result } = renderHook(() => useExpertEditSystemPresetCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.source).toBe("seed");
    expect(result.current.degraded).toBe(true);
    expect(result.current.isAuthoritative).toBe(false);
  });

  it("dedupes overlapping preset catalog loads across concurrent hook mounts", async () => {
    let resolveResponse: (response: Response) => void = () => {
      throw new Error("Expected deferred catalog response resolver.");
    };
    vi.mocked(fetchWithAuth).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })
    );

    const first = renderHook(() => useExpertEditSystemPresetCatalog());
    const second = renderHook(() => useExpertEditSystemPresetCatalog());

    expect(fetchWithAuth).toHaveBeenCalledTimes(1);

    resolveResponse(
      new Response(
        JSON.stringify({
          source: "control_plane",
          degraded: false,
          presetDefinitions: [
            {
              presetId: "style_test",
              label: "Style Test",
              prompt: "Use the control-plane catalog.",
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
