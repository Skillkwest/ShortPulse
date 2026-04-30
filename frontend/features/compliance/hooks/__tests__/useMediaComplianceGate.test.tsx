import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaComplianceGate } from "../useMediaComplianceGate";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

describe("useMediaComplianceGate", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
  });

  it("loads accepted status for the signed-in user", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        accepted: true,
        acceptedAt: "2026-04-25T18:00:00.000Z",
      }),
    });

    const { result } = renderHook(() =>
      useMediaComplianceGate({
        enabled: true,
        userId: "user-123",
      })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
      expect(result.current.accepted).toBe(true);
    });
  });

  it("records acceptance for the current agreement", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          accepted: false,
          acceptedAt: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          accepted: true,
          acceptedAt: "2026-04-25T18:30:00.000Z",
        }),
      });

    const { result } = renderHook(() =>
      useMediaComplianceGate({
        enabled: true,
        userId: "user-123",
      })
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
      expect(result.current.accepted).toBe(false);
    });

    await act(async () => {
      await result.current.acceptAgreement();
    });

    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      2,
      "/api/account/media-compliance",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(result.current.accepted).toBe(true);
    expect(result.current.acceptedAt).toBe("2026-04-25T18:30:00.000Z");
  });

  it("keeps failed acceptance errors in gate state", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          accepted: false,
          acceptedAt: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValue({
          error: "Unauthorized",
        }),
      });

    const { result } = renderHook(() =>
      useMediaComplianceGate({
        enabled: true,
        userId: "user-123",
      })
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
      expect(result.current.accepted).toBe(false);
    });

    await act(async () => {
      await expect(result.current.acceptAgreement()).rejects.toThrow("Unauthorized");
    });

    expect(result.current.accepted).toBe(false);
    expect(result.current.error).toBe("Unauthorized");
    expect(result.current.loading).toBe(false);
  });
});
