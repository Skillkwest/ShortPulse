/**
 * Dashboard route tests for the new guest/public mode.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const loadGrowthTelemetryMock = vi.hoisted(() => vi.fn());
const trackMarketingPageViewMock = vi.hoisted(() => vi.fn());

const stubMatchMedia = (matchesByQuery: Record<string, boolean>) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: matchesByQuery[query] ?? false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
};

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
    prefetch?: boolean;
  } & Record<string, unknown>) => {
    const anchorProps = { ...rest };
    delete (anchorProps as { prefetch?: boolean }).prefetch;
    return (
      <a href={href} {...anchorProps}>
        {children}
      </a>
    );
  },
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

vi.mock("../../lib/growthTelemetryLoader", () => ({
  loadGrowthTelemetry: (...args: unknown[]) => loadGrowthTelemetryMock(...args),
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
    loadGrowthTelemetryMock.mockResolvedValue({
      trackMarketingPageView: trackMarketingPageViewMock,
    });
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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
      screen.getByRole("heading", { name: /a true all-in-one for ai creators/i })
    ).toBeInTheDocument();
    expect(document.querySelector(".public-home-hero-video source")).not.toBeInTheDocument();
    expect(document.querySelector(".public-home-hero-bg")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /the world's best AI models\. Thousands of workflows\. One simple workspace\. Zero frustration\./i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText("Offer 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Offer 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Offer 3")).not.toBeInTheDocument();
    expect(screen.queryByText("Offer 4")).not.toBeInTheDocument();
    const guestActions = screen.getByLabelText("Guest actions");

    expect(within(guestActions).getByRole("link", { name: "Login" })).toHaveAttribute(
      "href",
      "/auth?next=%2Fdashboard"
    );
    expect(within(guestActions).getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "/pricing"
    );
    expect(within(guestActions).getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/auth?next=%2Fdashboard&mode=signup"
    );
    expect(screen.getAllByRole("link", { name: "ShortPulse home" })).toSatisfy(
      (links: HTMLAnchorElement[]) =>
        links.length >= 1 && links.every((link) => link.getAttribute("href") === "/")
    );
    expect(screen.queryByText("Public dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText(/workspace entry are now one surface/i)).not.toBeInTheDocument();
    expect(document.querySelector(".public-home-launch-button")).toHaveAttribute(
      "href",
      "/pricing?intent=create-project"
    );
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

    return waitFor(() => {
      expect(document.querySelector(".public-home-hero-video source")).toHaveAttribute(
        "src",
        "/dashboard/homepage-hero-background-perf.mp4"
      );
    });
  });

  it("keeps the model logo marquee active while the strip remains in view", async () => {
    render(<DashboardPage />);

    const modelMarquee = document.querySelector(".public-home-models");

    expect(modelMarquee).toBeInTheDocument();
    expect(modelMarquee).not.toHaveClass("public-home-models-idle");

    fireEvent.scroll(window);

    await waitFor(() => {
      expect(modelMarquee).not.toHaveClass("public-home-models-idle");
    });
  });

  it("defers public growth telemetry until after the startup idle window", async () => {
    vi.useFakeTimers();
    let idleCallback: IdleRequestCallback | null = null;
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((callback: IdleRequestCallback) => {
        idleCallback = callback;
        return 7;
      })
    );
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    render(<DashboardPage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3499);
    });

    expect(loadGrowthTelemetryMock).not.toHaveBeenCalled();
    expect(trackMarketingPageViewMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(loadGrowthTelemetryMock).not.toHaveBeenCalled();
    expect(idleCallback).not.toBeNull();

    await act(async () => {
      idleCallback?.({
        didTimeout: false,
        timeRemaining: () => 20,
      });
      await Promise.resolve();
    });

    expect(loadGrowthTelemetryMock).toHaveBeenCalledTimes(1);
    expect(trackMarketingPageViewMock).toHaveBeenCalledWith("dashboard", {
      page_surface: "dashboard",
    });
  });

  it("renders the public dashboard immediately while anonymous session bootstrap is still unresolved", () => {
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: false,
      session: null,
      user: null,
    });

    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", { name: /a true all-in-one for ai creators/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Checking your session before your dashboard workspace loads.")
    ).not.toBeInTheDocument();
    expect(readSupabaseSessionBootstrapHintMock).toHaveBeenCalled();
  });

  it("attaches the lite hero video source after compact layout resolution", async () => {
    stubMatchMedia({
      "(max-width: 760px)": true,
      "(max-width: 1080px)": true,
    });

    render(<DashboardPage />);

    expect(document.querySelector(".public-home-hero-video source")).not.toBeInTheDocument();

    await waitFor(
      () => {
        expect(document.querySelector(".public-home-hero-video source")).toHaveAttribute(
          "src",
          "/dashboard/homepage-hero-background-lite.mp4"
        );
      },
      { timeout: 3500 }
    );
    expect(document.querySelector(".public-home-hero-video source")).not.toHaveAttribute(
      "src",
      "/dashboard/homepage-hero-background-perf.mp4"
    );
  });

  it("renders active dashboard offers when supplied", () => {
    render(
      <DashboardPage
        dashboardOffers={[
          {
            id: "offer-1",
            eyebrow: "Launch deal",
            title: "Save on Studio",
            description: "",
            offerKind: "plan",
            discountLabel: "Save 30%",
            targetLabel: "Studio annual",
            ctaLabel: "View offer",
            ctaHref: "/pricing",
            displayOrder: 1,
            isActive: true,
            startsAt: null,
            endsAt: null,
            createdAt: "2026-06-11T00:00:00.000Z",
            updatedAt: "2026-06-11T00:00:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "Launch deal: Save on Studio" })).toHaveAttribute(
      "href",
      "/pricing"
    );
  });

  it("renders static tutorial props without waiting for live endpoint hydration", async () => {
    render(
      <DashboardPage
        dashboardTutorials={[
          {
            id: "stale-tutorial-1",
            title: "Stale signed thumbnail tutorial",
            youtubeUrl: "https://www.youtube.com/watch?v=abc123",
            thumbnailUrl: "https://cdn.example.com/stale-signed-thumbnail.gif",
            thumbnailStoragePath: null,
            thumbnailFileSizeBytes: null,
            thumbnailContentType: null,
            thumbnailMediaType: "image",
            thumbnailDisplayStoragePath: null,
            thumbnailDisplayFileSizeBytes: null,
            thumbnailDisplayContentType: null,
            thumbnailDisplayMediaType: null,
            thumbnailPosterUrl: null,
            thumbnailPosterStoragePath: null,
            thumbnailPosterFileSizeBytes: null,
            thumbnailPosterContentType: null,
            thumbnailAlt: "Stale tutorial preview",
            displayOrder: 1,
            isActive: true,
            createdAt: "2026-06-11T00:00:00.000Z",
            updatedAt: "2026-06-11T00:00:00.000Z",
          },
        ]}
      />
    );

    expect(await screen.findByText("Stale signed thumbnail tutorial")).toBeInTheDocument();
    expect(publicFetchMock).not.toHaveBeenCalledWith("/api/dashboard/tutorials", {
      method: "GET",
    });
  });

  it("renders public tutorial cards that open the tutorial modal", async () => {
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

    expect(await screen.findByText("Generate images with ShortPulse")).toBeInTheDocument();
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

  it("schedules a visible video tutorial thumbnail for immediate playback", async () => {
    publicFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tutorials: [
          {
            id: "tutorial-1",
            title: "Generate videos with ShortPulse",
            youtubeUrl: "https://www.youtube.com/watch?v=abc123",
            thumbnailUrl: "https://cdn.example.com/tutorial.mp4",
            thumbnailStoragePath: null,
            thumbnailFileSizeBytes: null,
            thumbnailContentType: null,
            thumbnailPosterUrl: "https://cdn.example.com/tutorial-poster.jpg",
            thumbnailPosterStoragePath: null,
            thumbnailPosterFileSizeBytes: null,
            thumbnailPosterContentType: null,
            thumbnailDisplayStoragePath: null,
            thumbnailDisplayFileSizeBytes: null,
            thumbnailDisplayContentType: null,
            thumbnailDisplayMediaType: null,
            thumbnailMediaType: "video",
            thumbnailAlt: "Tutorial preview",
            displayOrder: 1,
          },
        ],
      }),
    });

    render(<DashboardPage dashboardTutorials={[]} />);

    const tutorialButton = await screen.findByRole("button", {
      name: "Generate videos with ShortPulse: open tutorial",
    });
    const thumbnailVideo = tutorialButton.querySelector("video");

    expect(thumbnailVideo).toBeInTheDocument();
    await waitFor(
      () => {
        expect(thumbnailVideo).toHaveAttribute("preload", "auto");
        expect(thumbnailVideo).toHaveAttribute("src", "https://cdn.example.com/tutorial.mp4");
      },
      { timeout: 2500 }
    );
    expect(thumbnailVideo).toHaveAttribute("loop");
    expect(thumbnailVideo).toHaveAttribute("poster", "https://cdn.example.com/tutorial-poster.jpg");
  });

  it("pauses homepage media while the hero demo modal is open", async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.resolve());
    const pauseSpy = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);

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
            thumbnailContentType: null,
            thumbnailPosterUrl: "https://cdn.example.com/tutorial-poster.jpg",
            thumbnailPosterStoragePath: null,
            thumbnailPosterFileSizeBytes: null,
            thumbnailPosterContentType: null,
            thumbnailDisplayStoragePath: null,
            thumbnailDisplayFileSizeBytes: null,
            thumbnailDisplayContentType: null,
            thumbnailDisplayMediaType: null,
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

    const tutorialButton = await screen.findByRole("button", {
      name: "Generate videos with ShortPulse: open tutorial",
    });
    const thumbnailVideo = tutorialButton.querySelector("video");

    await waitFor(
      () => {
        expect(thumbnailVideo).toHaveAttribute("src", "https://cdn.example.com/tutorial.mp4");
        expect(thumbnailVideo).toHaveAttribute("preload", "auto");
      },
      { timeout: 2500 }
    );

    playSpy.mockClear();
    pauseSpy.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Watch Demo" }));

    expect(screen.getByRole("dialog", { name: "ShortPulse Demo" })).toBeInTheDocument();
    await waitFor(() => {
      expect(pauseSpy).toHaveBeenCalled();
      expect(thumbnailVideo).not.toHaveAttribute("loop");
      expect(thumbnailVideo).toHaveAttribute("preload", "none");
    });
  });

  it("keeps compact tutorial thumbnails eligible for playback", async () => {
    stubMatchMedia({
      "(max-width: 760px)": true,
      "(max-width: 1080px)": true,
    });
    publicFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tutorials: Array.from({ length: 6 }, (_, index) => ({
          id: `tutorial-${index + 1}`,
          title: `Generate video ${index + 1}`,
          youtubeUrl: "https://www.youtube.com/watch?v=abc123",
          thumbnailUrl: `https://cdn.example.com/tutorial-${index + 1}.mp4`,
          thumbnailPosterUrl: `https://cdn.example.com/tutorial-${index + 1}.jpg`,
          thumbnailMediaType: "video",
          thumbnailAlt: "Tutorial preview",
          displayOrder: index + 1,
        })),
      }),
    });

    render(<DashboardPage dashboardTutorials={[]} />);

    await screen.findByRole("button", {
      name: "Generate video 1: open tutorial",
    });

    const thumbnailVideos = document.querySelectorAll(".dashboard-tutorial-card video");

    await waitFor(
      () => {
        expect(thumbnailVideos[0]).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
        expect(thumbnailVideos[3]).toHaveAttribute("src", "https://cdn.example.com/tutorial-4.mp4");
        expect(thumbnailVideos[5]).toHaveAttribute("src", "https://cdn.example.com/tutorial-6.mp4");
      },
      { timeout: 2500 }
    );
  });

  it("keeps compact low-power tutorial thumbnails eligible for playback", async () => {
    stubMatchMedia({
      "(max-width: 760px)": true,
      "(max-width: 1080px)": true,
      "(update: slow)": true,
    });
    publicFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tutorials: Array.from({ length: 6 }, (_, index) => ({
          id: `tutorial-${index + 1}`,
          title: `Generate video ${index + 1}`,
          youtubeUrl: "https://www.youtube.com/watch?v=abc123",
          thumbnailUrl: `https://cdn.example.com/tutorial-${index + 1}.mp4`,
          thumbnailPosterUrl: `https://cdn.example.com/tutorial-${index + 1}.jpg`,
          thumbnailMediaType: "video",
          thumbnailAlt: "Tutorial preview",
          displayOrder: index + 1,
        })),
      }),
    });

    render(<DashboardPage dashboardTutorials={[]} />);

    await screen.findByRole("button", {
      name: "Generate video 1: open tutorial",
    });

    const thumbnailVideos = document.querySelectorAll(".dashboard-tutorial-card video");

    await waitFor(
      () => {
        expect(thumbnailVideos[0]).toHaveAttribute("src", "https://cdn.example.com/tutorial-1.mp4");
        expect(thumbnailVideos[2]).toHaveAttribute("src", "https://cdn.example.com/tutorial-3.mp4");
        expect(thumbnailVideos[5]).toHaveAttribute("src", "https://cdn.example.com/tutorial-6.mp4");
      },
      { timeout: 2500 }
    );
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
