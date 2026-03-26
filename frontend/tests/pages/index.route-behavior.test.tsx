/**
 * Root route renders the authentication entry surface.
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IndexPage from "../../pages/index";

const ensureSupabaseClientMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionMock = vi.hoisted(() => vi.fn());
const primeSupabaseSessionMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const routerState = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  isReady: true,
  asPath: "/",
}));
const getSessionMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signUpMock = vi.hoisted(() => vi.fn());
const resetPasswordForEmailMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    query: routerState.query,
    isReady: routerState.isReady,
    asPath: routerState.asPath,
    push: pushMock,
    replace: replaceMock,
  }),
}));

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseClient: (...args: unknown[]) => ensureSupabaseClientMock(...args),
  readSupabaseSession: (...args: unknown[]) => readSupabaseSessionMock(...args),
  primeSupabaseSession: (...args: unknown[]) => primeSupabaseSessionMock(...args),
  isSupabaseAbortError: (error: unknown) =>
    error instanceof Error && error.message.toLowerCase().includes("signal is aborted"),
}));

describe("Index route behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.query = {};
    routerState.isReady = true;
    routerState.asPath = "/";
    readSupabaseSessionMock.mockResolvedValue(null);
    signInWithPasswordMock.mockResolvedValue({ error: null, data: { session: null } });
    signUpMock.mockResolvedValue({ error: null, data: { session: null } });
    resetPasswordForEmailMock.mockResolvedValue({ error: null });

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
        resetPasswordForEmail: resetPasswordForEmailMock,
      },
    });
  });

  it("shows the sign-in entry surface at the root route", async () => {
    render(<IndexPage />);

    expect(screen.getByText("ShortPulse workspace access")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
