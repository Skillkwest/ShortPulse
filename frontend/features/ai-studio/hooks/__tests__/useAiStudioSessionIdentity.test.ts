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
    window.history.replaceState({}, "", "/ai-studio");
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

  it("creates and injects sid without Next route navigation when query is missing", async () => {
    const router = createRouter();
    mockedUseRouter.mockReturnValue(router as never);

    const { result } = renderHook(() => useAiStudioSessionIdentity());

    await waitFor(() => {
      expect(result.current.sessionId).not.toBeNull();
    });

    const sidFromUrl = new URL(window.location.href).searchParams.get("sid");
    expect(router.replace).not.toHaveBeenCalled();
    expect(sidFromUrl).toBe(result.current.sessionId);
    expect(isValidAiStudioSessionId(String(sidFromUrl))).toBe(true);
  });

  it("preserves projectId when injecting sid into the URL without route navigation", async () => {
    window.history.replaceState({}, "", "/ai-studio?projectId=project-1");
    const router = createRouter({
      query: { projectId: "project-1" },
    });
    mockedUseRouter.mockReturnValue(router as never);

    const { result } = renderHook(() => useAiStudioSessionIdentity());

    await waitFor(() => {
      expect(result.current.sessionId).not.toBeNull();
    });

    const url = new URL(window.location.href);
    expect(router.replace).not.toHaveBeenCalled();
    expect(url.searchParams.get("projectId")).toBe("project-1");
    expect(url.searchParams.get("sid")).toBe(result.current.sessionId);
  });

  it("replaces invalid sid query values with a new valid session id", async () => {
    window.history.replaceState({}, "", "/ai-studio?sid=invalid-session-id");
    const router = createRouter({
      query: { sid: "invalid-session-id" },
    });
    mockedUseRouter.mockReturnValue(router as never);

    const { result } = renderHook(() => useAiStudioSessionIdentity());

    await waitFor(() => {
      expect(result.current.sessionId).not.toBeNull();
    });

    const sidFromUrl = new URL(window.location.href).searchParams.get("sid");
    expect(router.replace).not.toHaveBeenCalled();
    expect(sidFromUrl).toBe(result.current.sessionId);
    expect(isValidAiStudioSessionId(String(sidFromUrl))).toBe(true);
  });
});
