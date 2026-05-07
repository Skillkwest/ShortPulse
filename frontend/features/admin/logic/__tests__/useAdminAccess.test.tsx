import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetCachedAdminAccessStateForTests, useAdminAccess } from "../useAdminAccess";

const fetchWithAuthMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500) => ({
  ok,
  status,
  json: vi.fn(async () => body),
});

describe("useAdminAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCachedAdminAccessStateForTests();
  });

  it("reuses cached granted access while the next route verifies in the background", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        isAdmin: true,
        accessVia: "email_allowlist",
      })
    );

    const first = renderHook(() => useAdminAccess({ enabled: true, userId: "admin-1" }));

    await waitFor(() => expect(first.result.current.status).toBe("granted"));

    first.unmount();

    const nextResponse = deferred<ReturnType<typeof jsonResponse>>();
    fetchWithAuthMock.mockImplementationOnce(() => nextResponse.promise);

    const second = renderHook(() => useAdminAccess({ enabled: true, userId: "admin-1" }));

    expect(second.result.current.status).toBe("granted");
    expect(second.result.current.isAdmin).toBe(true);
    expect(second.result.current.isLoading).toBe(false);

    nextResponse.resolve(
      jsonResponse({
        isAdmin: true,
        accessVia: "email_allowlist",
      })
    );

    await waitFor(() => expect(fetchWithAuthMock).toHaveBeenCalledTimes(2));
  });

  it("preserves granted access when a background verification fails", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        isAdmin: true,
        accessVia: "email_allowlist",
      })
    );

    const first = renderHook(() => useAdminAccess({ enabled: true, userId: "admin-1" }));
    await waitFor(() => expect(first.result.current.status).toBe("granted"));
    first.unmount();

    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({ error: "Access endpoint unavailable." }, false, 500)
    );

    const second = renderHook(() => useAdminAccess({ enabled: true, userId: "admin-1" }));

    await waitFor(() => expect(fetchWithAuthMock).toHaveBeenCalledTimes(2));

    expect(second.result.current.status).toBe("granted");
    expect(second.result.current.isAdmin).toBe(true);
    expect(second.result.current.error).toBe("Access endpoint unavailable.");

    await act(async () => {
      second.result.current.refresh();
    });
  });

  it("does not reuse a prior user's cached grant after an account switch", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      jsonResponse({
        isAdmin: true,
        accessVia: "email_allowlist",
      })
    );

    const first = renderHook(() => useAdminAccess({ enabled: true, userId: "admin-1" }));
    await waitFor(() => expect(first.result.current.status).toBe("granted"));
    first.unmount();

    const nextResponse = deferred<ReturnType<typeof jsonResponse>>();
    fetchWithAuthMock.mockImplementationOnce(() => nextResponse.promise);

    const second = renderHook(() => useAdminAccess({ enabled: true, userId: "user-2" }));

    expect(second.result.current.status).toBe("checking");
    expect(second.result.current.isAdmin).toBe(false);
    expect(second.result.current.isLoading).toBe(true);

    nextResponse.resolve(
      jsonResponse({
        isAdmin: false,
        accessVia: "none",
      })
    );

    await waitFor(() => expect(second.result.current.status).toBe("denied"));
    expect(second.result.current.isAdmin).toBe(false);
  });
});
