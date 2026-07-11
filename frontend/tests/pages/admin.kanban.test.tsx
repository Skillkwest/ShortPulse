/**
 * Admin Ophestivus page tests.
 * Verifies the standalone Ophestivus route uses the admin shell and renders the board.
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminKanbanPage from "../../pages/admin/kanban";

const useProtectedRouteMock = vi.hoisted(() => vi.fn());
const useAdminAccessMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../lib/authGuard", () => ({
  useProtectedRoute: (...args: unknown[]) => useProtectedRouteMock(...args),
}));

vi.mock("../../features/admin/logic/useAdminAccess", () => ({
  useAdminAccess: (...args: unknown[]) => useAdminAccessMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

describe("Admin Ophestivus page", () => {
  beforeEach(() => {
    fetchWithAuthMock.mockReset();
    fetchWithAuthMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: { id: "admin-user", email: "admin@example.com" },
    });
    useAdminAccessMock.mockReturnValue({
      status: "ready",
      isLoading: false,
      isAdmin: true,
      error: null,
      refresh: vi.fn(),
    });
  });

  it("renders the standalone kanban workspace", () => {
    render(<AdminKanbanPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Ophestivus" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Ophestivus" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ophestivus" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByLabelText("Admin task status columns")).toBeInTheDocument();
    expect(document.querySelector("main")?.className).toContain("adminKanbanPageWide");
  });
});
