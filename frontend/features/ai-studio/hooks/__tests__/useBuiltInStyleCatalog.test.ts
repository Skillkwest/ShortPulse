import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { useBuiltInStyleCatalog } from "../useBuiltInStyleCatalog";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

describe("useBuiltInStyleCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with an empty catalog while the admin-owned runtime catalog loads", async () => {
    let resolveResponse: (response: Response) => void = () => {
      throw new Error("Expected deferred catalog response resolver.");
    };
    vi.mocked(fetchWithAuth).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })
    );

    const { result } = renderHook(() => useBuiltInStyleCatalog());

    expect(result.current.loading).toBe(true);
    expect(result.current.styleDefinitions).toEqual([]);
    expect(result.current.source).toBe("seed");
    expect(result.current.isAuthoritative).toBe(false);

    resolveResponse(
      new Response(
        JSON.stringify({
          source: "control_plane",
          degraded: false,
          styleDefinitions: [
            {
              styleId: "admin-style",
              title: "Admin Style",
              stylePrompt: "Use the admin-owned catalog.",
              previewImageUrl: "/Styles/Admin.png",
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
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.source).toBe("control_plane");
    expect(result.current.isAuthoritative).toBe(true);
    expect(result.current.styleDefinitions).toEqual([
      {
        styleId: "admin-style",
        title: "Admin Style",
        stylePrompt: "Use the admin-owned catalog.",
        previewImageUrl: "/Styles/Admin.png",
        referenceImageName: null,
        schemaVersion: 1,
      },
    ]);
  });

  it("does not expose legacy seeded styles when the runtime catalog is unavailable", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Built-in Styles are temporarily unavailable. Reload and try again.",
          source: "seed",
          degraded: true,
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    );

    const { result } = renderHook(() => useBuiltInStyleCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.styleDefinitions).toEqual([]);
    expect(result.current.error).toBe("Unable to load built-in Styles.");
    expect(result.current.isAuthoritative).toBe(false);
  });
});
