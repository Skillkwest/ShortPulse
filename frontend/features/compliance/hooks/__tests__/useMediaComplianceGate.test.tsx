import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaComplianceGate } from "../useMediaComplianceGate";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const reportAppErrorMock = vi.hoisted(() => vi.fn());
const isAuthRequiredErrorMock = vi.hoisted(() => vi.fn());
const isAuthSessionTimeoutErrorMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  AUTH_REQUIRED_CODE: "AUTH_REQUIRED",
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
  AUTH_SESSION_TIMEOUT_CODE: "AUTH_SESSION_TIMEOUT",
  isAuthRequiredError: (...args: unknown[]) => isAuthRequiredErrorMock(...args),
  isAuthSessionTimeoutError: (...args: unknown[]) => isAuthSessionTimeoutErrorMock(...args),
}));

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: (...args: unknown[]) => reportAppErrorMock(...args),
}));

describe("useMediaComplianceGate", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
    reportAppErrorMock.mockReset();
    isAuthRequiredErrorMock.mockReset();
    isAuthSessionTimeoutErrorMock.mockReset();
    isAuthRequiredErrorMock.mockReturnValue(false);
    isAuthSessionTimeoutErrorMock.mockReturnValue(false);
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
      expect(result.current.status).toBe("accepted");
      expect(result.current.initialized).toBe(true);
    });
  });

  it("uses the authenticated-fetch one-shot network retry for status reads", async () => {
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

    await waitFor(() => {
      expect(result.current.status).toBe("accepted");
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/account/media-compliance",
      expect.objectContaining({
        shortpulseLogScope: "app",
        shortpulseRetryNetworkOnce: true,
        shortpulseSkipErrorLogging: true,
      })
    );
  });

  it("revalidates media compliance when the browser restores the page", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          accepted: true,
          acceptedAt: "2026-04-25T18:00:00.000Z",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          accepted: false,
          acceptedAt: null,
        }),
      });

    const { result } = renderHook(() =>
      useMediaComplianceGate({
        enabled: true,
        userId: "user-123",
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("accepted");
    });

    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
      expect(result.current.status).toBe("needs_consent");
    });
  });

  it("keeps an accepted gate open when tab-return revalidation hits a transient network failure", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          accepted: true,
          acceptedAt: "2026-04-25T18:00:00.000Z",
        }),
      })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const { result } = renderHook(() =>
      useMediaComplianceGate({
        enabled: true,
        userId: "user-123",
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("accepted");
    });

    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
      expect(result.current.status).toBe("accepted");
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBeNull();
    expect(reportAppErrorMock).not.toHaveBeenCalled();
  });

  it("does not preserve an unaccepted gate when tab-return revalidation cannot reach the server", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          accepted: false,
          acceptedAt: null,
        }),
      })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const { result } = renderHook(() =>
      useMediaComplianceGate({
        enabled: true,
        userId: "user-123",
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("needs_consent");
    });

    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
      expect(result.current.status).toBe("service_unavailable");
    });
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.media_compliance_service_unavailable",
        endpoint: "/api/account/media-compliance",
      })
    );
  });

  it("can skip browser-restore media compliance revalidation after the initial check", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          accepted: true,
          acceptedAt: "2026-04-25T18:00:00.000Z",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          accepted: false,
          acceptedAt: null,
        }),
      });

    const { result } = renderHook(() =>
      useMediaComplianceGate({
        enabled: true,
        revalidateOnTabReturn: false,
        userId: "user-123",
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("accepted");
    });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    act(() => {
      window.dispatchEvent(new Event("pageshow"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("accepted");
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
      expect(result.current.status).toBe("needs_consent");
    });

    await act(async () => {
      await result.current.acceptAgreement();
    });

    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      2,
      "/api/account/media-compliance",
      expect.objectContaining({
        method: "POST",
        shortpulseSkipErrorLogging: true,
      })
    );
    expect(result.current.status).toBe("accepted");
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
        status: 401,
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
      expect(result.current.status).toBe("needs_consent");
    });

    await act(async () => {
      await expect(result.current.acceptAgreement()).rejects.toThrow("Unauthorized");
    });

    expect(result.current.status).toBe("auth_recovery_required");
    expect(result.current.error).toBe("Your session expired. Sign in again to continue.");
    expect(result.current.loading).toBe(false);
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.media_compliance_auth_recovery_required",
        endpoint: "/api/account/media-compliance",
      })
    );
  });

  it("uses a service-unavailable state when the status endpoint returns 503", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue({
        code: "MEDIA_COMPLIANCE_UNAVAILABLE",
        error: "Media agreement service is temporarily unavailable.",
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
      expect(result.current.status).toBe("service_unavailable");
    });

    expect(result.current.error).toBe("Media agreement service is temporarily unavailable.");
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.media_compliance_service_unavailable",
        endpoint: "/api/account/media-compliance",
      })
    );
  });

  it("uses auth recovery when auth fetch fails before an HTTP response is returned", async () => {
    const authRequiredError = Object.assign(
      new Error("You must be signed in to call this endpoint."),
      {
        code: "AUTH_REQUIRED",
      }
    );
    fetchWithAuthMock.mockRejectedValue(authRequiredError);
    isAuthRequiredErrorMock.mockReturnValue(true);

    const { result } = renderHook(() =>
      useMediaComplianceGate({
        enabled: true,
        userId: "user-123",
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("auth_recovery_required");
    });

    expect(result.current.error).toBe("Your session expired. Sign in again to continue.");
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client.media_compliance_auth_recovery_required",
      })
    );
  });
});
