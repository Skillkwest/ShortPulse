import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRouter } from "next/router";
import { useAiStudioSessionIdentity } from "../useAiStudioSessionIdentity";
import { isValidAiStudioSessionId } from "../../logic/sessionIdentity";

vi.mock("next/router", () => ({
  useRouter: vi.fn(),
}));

type MockRouter = {
  isReady: boolean;
  pathname: string;
  query: Record<string, unknown>;
  replace: ReturnType<typeof vi.fn>;
};

const mockedUseRouter = vi.mocked(useRouter);

const createRouter = (overrides: Partial<MockRouter> = {}): MockRouter => ({
  isReady: true,
  pathname: "/ai-studio",
  query: {},
  replace: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe("useAiStudioSessionIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses existing valid sid from query without replacing URL", async () => {
    const existingSid = "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a";
    const router = createRouter({
      query: { sid: existingSid },
    });
    mockedUseRouter.mockReturnValue(router as never);

    const { result } = renderHook(() => useAiStudioSessionIdentity());
    await waitFor(() => {
      expect(result.current.sessionId).toBe(existingSid);
    });

    expect(router.replace).not.toHaveBeenCalled();
  });

  it("creates and injects sid when query is missing", async () => {
    const router = createRouter();
    mockedUseRouter.mockReturnValue(router as never);

    const { rerender, result } = renderHook(() => useAiStudioSessionIdentity());

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledTimes(1);
    });

    const [urlArg, asArg, optionsArg] = router.replace.mock.calls[0] ?? [];
    expect(asArg).toBeUndefined();
    expect(optionsArg).toEqual(expect.objectContaining({ shallow: true, scroll: false }));
    expect((urlArg as { pathname?: string }).pathname).toBe("/ai-studio");

    const sidFromReplace = (urlArg as { query?: Record<string, unknown> }).query?.sid;
    expect(typeof sidFromReplace).toBe("string");
    expect(isValidAiStudioSessionId(String(sidFromReplace))).toBe(true);
    expect(result.current.sessionId).toBeNull();

    router.query = { sid: String(sidFromReplace) };
    rerender();
    await waitFor(() => {
      expect(result.current.sessionId).toEqual(String(sidFromReplace));
    });
  });

  it("replaces invalid sid query values with a new valid session id", async () => {
    const router = createRouter({
      query: { sid: "invalid-session-id" },
    });
    mockedUseRouter.mockReturnValue(router as never);

    renderHook(() => useAiStudioSessionIdentity());

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledTimes(1);
    });

    const [urlArg] = router.replace.mock.calls[0] ?? [];
    const sidFromReplace = (urlArg as { query?: Record<string, unknown> }).query?.sid;
    expect(isValidAiStudioSessionId(String(sidFromReplace))).toBe(true);
  });
});
