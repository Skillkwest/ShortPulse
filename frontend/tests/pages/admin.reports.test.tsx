import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminReportsPage from "../../pages/admin/reports";

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

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn(async () => body),
});

describe("AdminReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useProtectedRouteMock.mockReturnValue({
      loading: false,
      user: { id: "admin-1", email: "admin@example.com" },
    });
    useAdminAccessMock.mockReturnValue({
      status: "ready",
      isLoading: false,
      isAdmin: true,
      error: null,
      refresh: vi.fn(),
    });

    fetchWithAuthMock.mockImplementation(async (url: unknown) => {
      const path = String(url);
      if (path.startsWith("/api/admin/reports?")) {
        return jsonResponse({
          reports: [
            {
              id: "report-1",
              user_id: "user-1",
              submitter_email: "alpha@example.com",
              message: "The dashboard spinner never settled.",
              admin_notes: "",
              status: path.includes("status=reviewing") ? "reviewing" : "new",
              source_path: "/dashboard",
              user_agent: "Mozilla/5.0",
              reviewed_at: null,
              reviewed_by_user_id: null,
              created_at: "2026-05-25T14:46:50.000Z",
              updated_at: "2026-05-25T14:46:50.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            openCount: 1,
            newCount: path.includes("status=reviewing") ? 0 : 1,
            reviewingCount: path.includes("status=reviewing") ? 1 : 0,
            resolvedCount: 0,
          },
          pagination: {
            page: 1,
            perPage: 50,
            totalCount: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
      throw new Error(`Unexpected URL: ${path}`);
    });
  });

  it("loads the report queue and refetches when the status filter changes", async () => {
    render(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText("alpha@example.com")).toBeInTheDocument();
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/reports?page=1&limit=50&status=open",
        expect.objectContaining({ method: "GET" })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /reviewing reports/i }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        "/api/admin/reports?page=1&limit=50&status=reviewing",
        expect.objectContaining({ method: "GET" })
      );
    });
  });
});
