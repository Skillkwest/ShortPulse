/**
 * Dashboard page tests for announcement rendering and fail-soft fallback behavior.
 */
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "../../pages/dashboard";

const useRouterMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const ensureSupabaseClientMock = vi.hoisted(() => vi.fn());
const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());
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

vi.mock("next/image", () => ({
  default: ({ alt = "", ...rest }: { alt?: string } & Record<string, unknown>) => (
    <div aria-label={alt} data-next-image={String(rest.src ?? "")} />
  ),
}));

vi.mock("next/router", () => ({
  useRouter: (...args: unknown[]) => useRouterMock(...args),
}));

vi.mock("../../features/ai-studio/hooks/useCredits", () => ({
  useCredits: (...args: unknown[]) => useCreditsMock(...args),
}));

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseClient: (...args: unknown[]) => ensureSupabaseClientMock(...args),
  ensureSupabaseQueryClient: (...args: unknown[]) => ensureSupabaseQueryClientMock(...args),
  useSupabaseSessionState: (...args: unknown[]) => useSupabaseSessionStateMock(...args),
}));

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

const appUser = {
  id: "user-1",
  email: "user@example.com",
  user_metadata: {
    display_name: "Kirk",
    plan: "business",
  },
};

const buildSupabaseClient = () => ({
  auth: {
    signOut: vi.fn(async () => ({ error: null })),
  },
  from: vi.fn((table: string) => {
    if (table === "billing_profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { plan_id: "business" }, error: null })),
          })),
        })),
      };
    }
    if (table === "billing_plans") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [],
            error: null,
          })),
        })),
      };
    }
    if (table === "media_files") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [{ file_size: 1024 }],
            error: null,
          })),
        })),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  }),
});

describe("Dashboard announcement rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({ replace: vi.fn() });
    useCreditsMock.mockReturnValue({
      balanceCents: 86,
      balanceLoading: false,
    });
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: appUser },
      user: appUser,
    });
    ensureSupabaseClientMock.mockReturnValue(buildSupabaseClient());
    ensureSupabaseQueryClientMock.mockReturnValue(buildSupabaseClient());
  });

  it("renders active announcement title and message when available", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        announcement: {
          id: "ann-1",
          title: "Maintenance window",
          message: "AI Studio saves may be briefly delayed at 2AM UTC.",
          publishedAt: "2026-03-10T00:00:00.000Z",
          updatedAt: "2026-03-10T00:00:00.000Z",
        },
      }),
    });

    render(<DashboardPage />);

    await waitFor(() =>
      expect(screen.getByText("Maintenance window", { selector: "p" })).toBeInTheDocument()
    );
    expect(
      screen.getByText("AI Studio saves may be briefly delayed at 2AM UTC.")
    ).toBeInTheDocument();
  });

  it("renders fallback helper copy when no active announcement exists", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({ announcement: null }),
    });

    render(<DashboardPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/launch surface for analytics, creator ops, and storage/i)
      ).toBeInTheDocument()
    );
  });

  it("renders fallback helper copy when announcement API fails", async () => {
    fetchWithAuthMock.mockRejectedValue(new Error("network down"));

    render(<DashboardPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/launch surface for analytics, creator ops, and storage/i)
      ).toBeInTheDocument()
    );
  });
});
