/**
 * Landing route tests for redirect and FAQ state behavior.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "../../pages/landing";

const ensureSupabaseClientMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt = "", ...rest }: { alt?: string } & Record<string, unknown>) => (
    <div aria-label={alt} data-next-image={String(rest.src ?? "")} />
  ),
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseClient: (...args: unknown[]) => ensureSupabaseClientMock(...args),
  isSupabaseAbortError: (error: unknown) =>
    error instanceof Error && error.message.toLowerCase().includes("signal is aborted"),
}));

describe("Landing route behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ data: { session: null } });
    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: getSessionMock,
      },
    });
  });

  it("redirects signed-in visitors to the dashboard", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });

    render(<LandingPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("stays accessible when the Supabase client is unavailable", () => {
    ensureSupabaseClientMock.mockImplementation(() => {
      throw new Error("Supabase env vars missing");
    });

    render(<LandingPage />);

    expect(screen.getByRole("heading", { name: /see what’s winning\./i })).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("ignores aborted session reads during landing bootstrap", async () => {
    getSessionMock.mockRejectedValue(new Error("signal is aborted without reason"));

    render(<LandingPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /see what’s winning\./i })).toBeInTheDocument();
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("opens one FAQ item at a time and lets the same item collapse", () => {
    render(<LandingPage />);

    const connectAccounts = screen.getByRole("button", {
      name: /do i need to connect my accounts\?/i,
    });
    const cancelAnytime = screen.getByRole("button", {
      name: /can i cancel anytime\?/i,
    });

    fireEvent.click(connectAccounts);
    expect(
      screen.getByText(
        "No. We surface public performance data; you can start without linking social accounts."
      )
    ).toBeInTheDocument();
    expect(connectAccounts).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(cancelAnytime);
    expect(
      screen.getByText("Yes. Change plans or cancel whenever you want—no contracts.")
    ).toBeInTheDocument();
    expect(cancelAnytime).toHaveAttribute("aria-expanded", "true");
    expect(connectAccounts).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText(
        "No. We surface public performance data; you can start without linking social accounts."
      )
    ).not.toBeInTheDocument();

    fireEvent.click(cancelAnytime);
    expect(cancelAnytime).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText("Yes. Change plans or cancel whenever you want—no contracts.")
    ).not.toBeInTheDocument();
  });
});
