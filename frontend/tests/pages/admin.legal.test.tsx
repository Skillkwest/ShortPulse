/**
 * Admin Legal page tests.
 * Verifies loading, policy selection, draft editing, and publish submission.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLegalPage from "../../pages/admin/legal";

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

const policiesPayload = {
  policies: [
    {
      slug: "terms",
      markdown: "# ShortPulse Terms of Service\n\nLast updated: June 21, 2026\n\n## Terms body\n",
      version: 1,
      versionId: 11,
      note: "seed",
      source: "control_plane",
      updatedAt: "2026-06-21T18:00:00.000Z",
      updatedByEmail: "admin@example.com",
      degraded: false,
      history: [],
    },
    {
      slug: "privacy",
      markdown: "# ShortPulse Privacy Policy\n\nLast updated: June 21, 2026\n\n## Privacy body\n",
      version: 1,
      versionId: 12,
      note: "seed",
      source: "control_plane",
      updatedAt: "2026-06-21T18:05:00.000Z",
      updatedByEmail: "admin@example.com",
      degraded: false,
      history: [],
    },
    {
      slug: "refund-policy",
      markdown: "# ShortPulse Refund Policy\n\nLast updated: June 21, 2026\n\n## Refund body\n",
      version: 1,
      versionId: 13,
      note: "seed",
      source: "control_plane",
      updatedAt: "2026-06-21T18:10:00.000Z",
      updatedByEmail: "admin@example.com",
      degraded: false,
      history: [],
    },
  ],
};

describe("Admin Legal page", () => {
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
      if (path === "/api/admin/legal/policies") {
        return jsonResponse(policiesPayload);
      }
      if (path === "/api/admin/legal/policies/privacy/publish") {
        return jsonResponse({
          ok: true,
          policy: {
            ...policiesPayload.policies[1],
            markdown:
              "# ShortPulse Privacy Policy\n\nLast updated: June 22, 2026\n\n## Privacy body\n",
            version: 2,
            versionId: 22,
            updatedAt: "2026-06-22T18:05:00.000Z",
          },
        });
      }
      throw new Error(`Unexpected URL: ${path}`);
    });
  });

  it("loads policies, selects a document, and publishes edited markdown", async () => {
    render(<AdminLegalPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /ShortPulse Privacy Policy/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /ShortPulse Privacy Policy/i }));
    expect(
      screen.getAllByRole("heading", { level: 3, name: "ShortPulse Privacy Policy" }).length
    ).toBeGreaterThan(0);

    const editor = screen.getByLabelText("Markdown");
    fireEvent.change(editor, {
      target: {
        value: "# ShortPulse Privacy Policy\n\nLast updated: June 22, 2026\n\n## Privacy body\n",
      },
    });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Publish note"), {
      target: { value: "Owner-approved privacy update" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Publish update/i }));

    await waitFor(() => expect(screen.getByText("Legal policy published.")).toBeInTheDocument());
    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/admin/legal/policies/privacy/publish",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          markdown: "# ShortPulse Privacy Policy\n\nLast updated: June 22, 2026\n\n## Privacy body",
          expectedUpdatedAt: "2026-06-21T18:05:00.000Z",
          note: "Owner-approved privacy update",
        }),
      })
    );
  });
});
