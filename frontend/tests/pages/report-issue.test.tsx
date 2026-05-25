import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReportIssuePage from "../../pages/report-issue";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());

const routerState = vi.hoisted(() => ({
  asPath: "/report-issue?from=%2Fdashboard",
  query: {
    from: "/dashboard",
  } as Record<string, string>,
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/router", () => ({
  useRouter: () => routerState,
}));

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

describe("ReportIssuePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.asPath = "/report-issue?from=%2Fdashboard";
    routerState.query = { from: "/dashboard" };
    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: { id: "user-1", email: "user@example.com" },
    });
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reportId: "report-1" }),
    });
  });

  it("shows the same captured context that it submits to the API", async () => {
    render(<ReportIssuePage />);

    expect(screen.getByText("Captured context")).toBeInTheDocument();
    expect(screen.getByText("/dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Route context")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "The dashboard spinner never settled." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/report-issue",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            message: "The dashboard spinner never settled.",
            sourcePath: "/dashboard",
          }),
        })
      );
    });

    expect(
      await screen.findByText("Your report was sent to the ShortPulse admins. Thank you.")
    ).toBeInTheDocument();
  });
});
