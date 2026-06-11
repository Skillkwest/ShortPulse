/**
 * Dashboard route tests for the new guest/public mode.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "../../pages/dashboard";

const useRouterMock = vi.hoisted(() => vi.fn());
const useCreditsMock = vi.hoisted(() => vi.fn());
const useMediaStorageQuotaSummaryMock = vi.hoisted(() => vi.fn());
const ensureSupabaseClientMock = vi.hoisted(() => vi.fn());
const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());
const readPersistedSupabaseSessionHintMock = vi.hoisted(() => vi.fn());
const readSupabaseSessionBootstrapHintMock = vi.hoisted(() => vi.fn());
const primeSupabaseSessionMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const publicFetchMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../features/billing/useMediaStorageQuotaSummary", () => ({
  useMediaStorageQuotaSummary: (...args: unknown[]) => useMediaStorageQuotaSummaryMock(...args),
}));

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseClient: (...args: unknown[]) => ensureSupabaseClientMock(...args),
  ensureSupabaseQueryClient: (...args: unknown[]) => ensureSupabaseQueryClientMock(...args),
  useSupabaseSessionState: (...args: unknown[]) => useSupabaseSessionStateMock(...args),
  readPersistedSupabaseSessionHint: (...args: unknown[]) =>
    readPersistedSupabaseSessionHintMock(...args),
  primeSupabaseSession: (...args: unknown[]) => primeSupabaseSessionMock(...args),
}));

vi.mock("../../lib/supabaseSessionHints", async () => {
  const actual = await vi.importActual<typeof import("../../lib/supabaseSessionHints")>(
    "../../lib/supabaseSessionHints"
  );
  return {
    ...actual,
    readPersistedSupabaseSessionHint: (...args: unknown[]) =>
      readPersistedSupabaseSessionHintMock(...args),
    readSupabaseSessionBootstrapHint: (...args: unknown[]) =>
      readSupabaseSessionBootstrapHintMock(...args),
  };
});

vi.mock("../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

describe("Dashboard guest route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", publicFetchMock);
    publicFetchMock.mockReturnValue(new Promise(() => {}));
    useRouterMock.mockReturnValue({
      pathname: "/dashboard",
      push: vi.fn(),
      replace: vi.fn(),
      query: {},
    });
    useCreditsMock.mockReturnValue({
      balanceCents: null,
      balanceLoading: false,
    });
    useMediaStorageQuotaSummaryMock.mockReturnValue({
      quotaSummary: null,
      loading: false,
      refreshQuotaSummary: vi.fn(),
    });
    readPersistedSupabaseSessionHintMock.mockReturnValue(false);
    readSupabaseSessionBootstrapHintMock.mockReturnValue(false);
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a public dashboard with compact pricing, login, and signup guest CTAs", () => {
    render(
      <DashboardPage
        billingCatalog={{
          plans: [
            {
              id: "free",
              display_name: "Starter",
              sort_order: 0,
              monthly_price_cents: 0,
              monthly_credits_cents: 100,
              storage_limit_bytes: 1073741824,
              is_active: true,
            },
            {
              id: "studio",
              display_name: "Studio",
              sort_order: 20,
              monthly_price_cents: 3900,
              monthly_credits_cents: 3000,
              storage_limit_bytes: 107374182400,
              is_active: true,
            },
            {
              id: "business",
              display_name: "Business",
              sort_order: 30,
              monthly_price_cents: 12900,
              monthly_credits_cents: 12000,
              storage_limit_bytes: 536870912000,
              is_active: true,
            },
          ],
          packages: [],
          storageAddons: [],
        }}
      />
    );

    expect(
      screen.getByRole("heading", { name: /the creative studio for ai creators/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Create images, videos, characters, and content with powerful AI tools—all in one place."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText("Offer 1")).toHaveLength(2);
    expect(screen.getAllByText("Offer 2")).toHaveLength(2);
    expect(screen.getAllByText("Offer 3")).toHaveLength(2);
    expect(screen.getAllByText("Offer 4")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute(
      "href",
      "/auth?next=%2Fdashboard"
    );
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/auth?next=%2Fdashboard&mode=signup"
    );
    expect(screen.getByRole("link", { name: "ShortPulse home" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("Public dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText(/workspace entry are now one surface/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "New Project: Compare plans and unlock your first project",
      })
    ).toHaveAttribute("href", "/pricing?intent=create-project");
    expect(screen.getByText("ShortPulse · Home")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", {
        name: /open projects/i,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /choose where to start/i })
    ).not.toBeInTheDocument();
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(publicFetchMock).toHaveBeenCalledWith("/api/dashboard/tutorials", {
      method: "GET",
    });
    expect(screen.queryByRole("button", { name: "Profile menu" })).not.toBeInTheDocument();
    expect(useSupabaseSessionStateMock).not.toHaveBeenCalled();
  });

  it("renders the public dashboard immediately while anonymous session bootstrap is still unresolved", () => {
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: false,
      session: null,
      user: null,
    });

    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { name: /the creative studio for ai creators/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Checking your session before your dashboard workspace loads.")
    ).not.toBeInTheDocument();
    expect(readSupabaseSessionBootstrapHintMock).toHaveBeenCalled();
  });

  it("renders public tutorial cards that open the tutorial modal", () => {
    render(
      <DashboardPage
        dashboardTutorials={[
          {
            id: "tutorial-1",
            title: "Generate images with ShortPulse",
            youtubeUrl: "https://www.youtube.com/watch?v=abc123",
            thumbnailUrl: "https://cdn.example.com/tutorial.gif",
            thumbnailStoragePath: null,
            thumbnailFileSizeBytes: null,
            thumbnailContentType: null,
            thumbnailMediaType: "image",
            thumbnailAlt: "Tutorial preview",
            displayOrder: 1,
            isActive: true,
            createdAt: "2026-06-11T00:00:00.000Z",
            updatedAt: "2026-06-11T00:00:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByText("Generate images with ShortPulse")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Generate images with ShortPulse: open tutorial",
      })
    );

    expect(
      screen.getByRole("dialog", { name: "Generate images with ShortPulse" })
    ).toBeInTheDocument();
    expect(screen.getByTitle("Generate images with ShortPulse")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/abc123?rel=0&modestbranding=1&playsinline=1"
    );
    expect(screen.getByRole("link", { name: /launch ai studio/i })).toHaveAttribute(
      "href",
      "/pricing?intent=tutorial"
    );
  });

  it("renders video tutorial thumbnails with controlled smooth-loop playback", () => {
    render(
      <DashboardPage
        dashboardTutorials={[
          {
            id: "tutorial-1",
            title: "Generate videos with ShortPulse",
            youtubeUrl: "https://www.youtube.com/watch?v=abc123",
            thumbnailUrl: "https://cdn.example.com/tutorial.mp4",
            thumbnailStoragePath: null,
            thumbnailFileSizeBytes: null,
            thumbnailContentType: "video/mp4",
            thumbnailMediaType: "video",
            thumbnailAlt: "Tutorial preview",
            displayOrder: 1,
            isActive: true,
            createdAt: "2026-06-11T00:00:00.000Z",
            updatedAt: "2026-06-11T00:00:00.000Z",
          },
        ]}
      />
    );

    const tutorialButton = screen.getByRole("button", {
      name: "Generate videos with ShortPulse: open tutorial",
    });
    const thumbnailVideo = tutorialButton.querySelector("video");

    expect(thumbnailVideo).toBeInTheDocument();
    expect(thumbnailVideo).toHaveAttribute("preload", "auto");
    expect(thumbnailVideo).not.toHaveAttribute("loop");
  });

  it("hydrates public tutorial cards from the dashboard tutorials endpoint", async () => {
    publicFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tutorials: [
          {
            id: "tutorial-1",
            title: "Generate images with ShortPulse",
            youtubeUrl: "https://www.youtube.com/watch?v=abc123",
            thumbnailUrl: "https://cdn.example.com/tutorial.gif",
            thumbnailMediaType: "image",
            thumbnailAlt: "Tutorial preview",
            displayOrder: 1,
          },
        ],
      }),
    });

    render(<DashboardPage dashboardTutorials={[]} />);

    expect(
      await screen.findByRole("button", {
        name: "Generate images with ShortPulse: open tutorial",
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Generate images with ShortPulse: open tutorial",
      })
    );

    expect(
      screen.getByRole("dialog", { name: "Generate images with ShortPulse" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /launch ai studio/i })).toHaveAttribute(
      "href",
      "/pricing?intent=tutorial"
    );
  });
});
