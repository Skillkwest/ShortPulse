/**
 * Session-aware dashboard route.
 * Serves as the public home/landing/dashboard shell while preserving authenticated workspace actions.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { ChartBar, CloudArrowUp, ShieldCheck, Sparkle, type IconProps } from "phosphor-react";
import { AiStudioProjectEntryState } from "../features/ai-studio/components/AiStudioProjectEntryState";
import { ProjectsModal } from "../features/ai-studio/components/ProjectsModal";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import {
  buildPlanView,
  type BillingCatalogSnapshot,
  type BillingPlanRecord,
} from "../features/billing/catalog";
import { formatStorageUsageValue } from "../features/billing/storage";
import { useMediaStorageQuotaSummary } from "../features/billing/useMediaStorageQuotaSummary";
import {
  AuthenticatedDashboardView,
  type DashboardAnnouncement,
  type DashboardToolCard,
} from "../features/dashboard/components/AuthenticatedDashboardView";
import { DashboardAppBar } from "../features/dashboard/components/DashboardAppBar";
import { GuestDashboardView } from "../features/dashboard/components/GuestDashboardView";
import { ProjectNameModal } from "../features/projects/components/ProjectNameModal";
import { useProjectCreationDialog } from "../features/projects/hooks/useProjectCreationDialog";
import { buildPricingPath } from "../features/pricing/paths";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { trackMarketingPageView } from "../lib/growthTelemetry";
import { loadBillingCatalogSnapshot } from "../lib/server/api/billingCatalog";
import { readActiveDashboardOffers, type DashboardOffer } from "../lib/server/api/dashboardOffers";
import { getSupabaseAdmin } from "../lib/server/api/supabaseAdmin";
import {
  ensureSupabaseQueryClient,
  signOutSupabaseSession,
  useSupabaseSessionState,
} from "../lib/supabaseClient";
import { fetchWithAuth } from "../lib/authenticatedFetch";

const DEFAULT_PLAN_TIER = "free";
const DASHBOARD_HIDE_LEGACY_SECTIONS =
  process.env.NEXT_PUBLIC_DASHBOARD_HIDE_LEGACY_SECTIONS !== "false";
const DASHBOARD_FALLBACK_HELPER_COPY =
  "Your dashboard is the launch surface for analytics, creator ops, and storage - built for fast decisions and secure tooling.";
const DASHBOARD_BOOTSTRAP_ROUTE = "/dashboard";
const DASHBOARD_BOOTSTRAP_TITLE = "Loading dashboard";
const DASHBOARD_BOOTSTRAP_MESSAGE = "Checking your session before your dashboard workspace loads.";

type CurrentSubscriptionContractRow = {
  plan_id: string | null;
};

type BillingProfilePlanRow = {
  plan_id: string | null;
};

type DashboardPageStaticProps = InferGetStaticPropsType<typeof getStaticProps>;
type DashboardPageProps = {
  billingCatalog?: DashboardPageStaticProps["billingCatalog"];
  dashboardOffers?: DashboardPageStaticProps["dashboardOffers"];
};

type DashboardHeaderCard = {
  key: string;
  label: string;
  value: string;
  icon: ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;
  className?: string;
  href?: string;
};

const isSchemaCompatibilityError = (message: string) => {
  const text = message.toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache") ||
    text.includes("failed to parse select parameter") ||
    text.includes("column")
  );
};

const asDashboardAnnouncement = (value: unknown): DashboardAnnouncement | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const message = typeof row.message === "string" ? row.message.trim() : "";
  if (!id || !title || !message) return null;
  return {
    id,
    title,
    message,
    publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : null,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
  };
};

const emptyBillingCatalogSnapshot = (): BillingCatalogSnapshot => ({
  plans: [],
  packages: [],
  storageAddons: [],
});

const loadDashboardOffersSnapshot = async (): Promise<DashboardOffer[]> => {
  try {
    return await readActiveDashboardOffers(getSupabaseAdmin());
  } catch {
    return [];
  }
};

const getOfferIcon = (offer: DashboardOffer) => {
  if (offer.offerKind === "storage_addon") return CloudArrowUp;
  if (offer.offerKind === "plan") return ShieldCheck;
  if (offer.offerKind === "model_pricing") return ChartBar;
  return Sparkle;
};

const buildGuestHeaderCards = (offers: DashboardOffer[]): DashboardHeaderCard[] => {
  if (offers.length) {
    return offers.slice(0, 4).map((offer) => ({
      key: offer.id,
      label: offer.eyebrow,
      value: offer.title,
      icon: getOfferIcon(offer),
      href: offer.ctaHref,
    }));
  }

  return [
    {
      key: "guest-offer-1",
      label: "Offer 1",
      value: "Offer 1",
      icon: Sparkle,
    },
    {
      key: "guest-offer-2",
      label: "Offer 2",
      value: "Offer 2",
      icon: CloudArrowUp,
    },
    {
      key: "guest-offer-3",
      label: "Offer 3",
      value: "Offer 3",
      icon: ShieldCheck,
    },
    {
      key: "guest-offer-4",
      label: "Offer 4",
      value: "Offer 4",
      icon: ChartBar,
    },
  ];
};

const dashboardToolCards: DashboardToolCard[] = [
  {
    title: "AI Studio",
    eyebrow: "Generation",
    description:
      "Generate and iterate images/videos while managing characters, looks, prompts, and models in one workspace.",
    href: "/ai-studio",
    cta: "Open studio →",
    variant: "tool-creator",
    image: "/dashboard/creator-studio.png",
    icon: Sparkle,
  },
  {
    title: "Performance Analytics",
    eyebrow: "Analytics",
    description:
      "Compare high-performing Reels, TikToks, and Shorts across niches (Analytics coming soon).",
    href: "/performance-soon",
    cta: "Open analytics →",
    variant: "tool-performance",
    image: "/dashboard/performance-analytics.png",
    icon: ChartBar,
  },
];

/**
 * Loads the public billing catalog snapshot used by dashboard guest mode and the pricing route.
 */
export const getStaticProps: GetStaticProps<{
  billingCatalog: BillingCatalogSnapshot;
  dashboardOffers: DashboardOffer[];
}> = async () => {
  const [billingCatalogResult, dashboardOffersResult] = await Promise.allSettled([
    loadBillingCatalogSnapshot(),
    loadDashboardOffersSnapshot(),
  ]);

  return {
    props: {
      billingCatalog:
        billingCatalogResult.status === "fulfilled"
          ? billingCatalogResult.value
          : emptyBillingCatalogSnapshot(),
      dashboardOffers:
        dashboardOffersResult.status === "fulfilled" ? dashboardOffersResult.value : [],
    },
    revalidate: 60,
  };
};

/**
 * Renders the public/authenticated dashboard route.
 */
export default function DashboardPage({
  billingCatalog = emptyBillingCatalogSnapshot(),
  dashboardOffers = [],
}: DashboardPageProps) {
  const router = useRouter();
  const { initialized, user } = useSupabaseSessionState();
  const isDashboardBootstrapPending = router.pathname === DASHBOARD_BOOTSTRAP_ROUTE && !initialized;
  const isAuthenticated = Boolean(user);
  const { balanceCents, balanceLoading } = useCredits({ enabled: isAuthenticated });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [resolvedPlan, setResolvedPlan] = useState<{
    id: string;
    label: string;
    className: string;
  } | null>(null);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [usageLoading, setUsageLoading] = useState(true);
  const [dashboardAnnouncement, setDashboardAnnouncement] = useState<DashboardAnnouncement | null>(
    null
  );
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const guestPageViewTrackedRef = useRef(false);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!initialized || user || guestPageViewTrackedRef.current) return;
    guestPageViewTrackedRef.current = true;
    trackMarketingPageView("dashboard", {
      page_surface: "dashboard",
    });
  }, [initialized, user]);

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "Guest";
  const firstName = (displayName || "creator").split(" ")[0];
  const fallbackPlanView = buildPlanView({
    planId: DEFAULT_PLAN_TIER,
    plans: billingCatalog.plans,
  });
  const planMeta = resolvedPlan ?? {
    id: fallbackPlanView.id,
    label: fallbackPlanView.displayName,
    className: fallbackPlanView.className,
  };
  const { quotaSummary, loading: quotaLoading } = useMediaStorageQuotaSummary({
    enabled: isAuthenticated,
    fallbackPlanId: planMeta.id,
  });
  const initials =
    displayName
      .split(" ")
      .filter((part) => part.trim().length > 0)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SP";

  const openProject = async (projectId: string) => {
    await router.push({
      pathname: "/ai-studio",
      query: {
        projectId,
      },
    });
  };
  const {
    isOpen: isProjectNameModalOpen,
    title: newProjectTitle,
    error: projectCreateError,
    isCreating: isCreatingProject,
    openDialog: openProjectNameModal,
    closeDialog: closeProjectNameModal,
    setTitle: setNewProjectTitle,
    submit: submitProjectCreate,
  } = useProjectCreationDialog({
    onCreatedProject: async (project) => {
      await openProject(project.id);
    },
  });

  useEffect(() => {
    let active = true;

    const loadUsage = async () => {
      if (!user) {
        if (!active) return;
        setResolvedPlan(null);
        setUsageLoading(false);
        return;
      }

      setUsageLoading(true);
      try {
        const supabase = ensureSupabaseQueryClient();
        const [billingContractResponse, billingProfileResponse, billingPlansResponse] =
          await Promise.all([
            supabase
              .from("billing_subscription_contracts")
              .select("plan_id")
              .eq("user_id", user.id)
              .is("ended_at", null)
              .maybeSingle(),
            supabase
              .from("billing_profiles")
              .select("plan_id")
              .eq("user_id", user.id)
              .maybeSingle(),
            supabase
              .from("billing_plans")
              .select(
                "id, display_name, monthly_price_cents, monthly_credits_cents, storage_limit_bytes, is_active"
              )
              .eq("is_active", true),
          ]);

        if (
          billingContractResponse.error &&
          !isSchemaCompatibilityError(billingContractResponse.error.message)
        ) {
          throw billingContractResponse.error;
        }

        const contractPlanId =
          !billingContractResponse.error && billingContractResponse.data
            ? ((billingContractResponse.data as CurrentSubscriptionContractRow).plan_id ?? null)
            : null;
        const billingPlanId =
          !billingProfileResponse.error && billingProfileResponse.data
            ? ((billingProfileResponse.data as BillingProfilePlanRow).plan_id ?? null)
            : null;
        const effectivePlanId = contractPlanId ?? billingPlanId ?? DEFAULT_PLAN_TIER;
        const plans =
          !billingPlansResponse.error && Array.isArray(billingPlansResponse.data)
            ? (billingPlansResponse.data as BillingPlanRecord[])
            : [];
        const planView = buildPlanView({
          planId: effectivePlanId,
          plans,
        });

        if (!active) return;
        setResolvedPlan({
          id: planView.id,
          label: planView.displayName,
          className: planView.className,
        });
      } catch {
        if (!active) return;
        setResolvedPlan(null);
      } finally {
        if (active) {
          setUsageLoading(false);
        }
      }
    };

    void loadUsage();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;

    const loadDashboardAnnouncement = async () => {
      if (!user) {
        if (active) {
          setDashboardAnnouncement(null);
        }
        return;
      }

      try {
        const response = await fetchWithAuth("/api/announcements/active", {
          method: "GET",
        });
        if (!response.ok) {
          throw new Error("Failed to load active announcement.");
        }
        const payload = (await response.json().catch(() => ({}))) as {
          announcement?: unknown;
        };
        if (!active) return;
        setDashboardAnnouncement(asDashboardAnnouncement(payload.announcement ?? null));
      } catch {
        if (!active) return;
        setDashboardAnnouncement(null);
      }
    };

    void loadDashboardAnnouncement();
    return () => {
      active = false;
    };
  }, [user]);

  const storageUsageValue = useMemo(() => {
    if (usageLoading || quotaLoading) return "…";
    return formatStorageUsageValue(
      quotaSummary?.usedBytes ?? 0,
      quotaSummary?.totalLimitBytes ?? 0
    );
  }, [quotaLoading, quotaSummary, usageLoading]);

  const aiCreditsValue =
    balanceLoading && balanceCents == null
      ? "…"
      : balanceCents == null
        ? "Credits unavailable"
        : `${balanceCents.toLocaleString()} credits`;

  const authHeaderCards: DashboardHeaderCard[] = [
    {
      key: "auth-storage",
      label: "Media Storage",
      value: storageUsageValue,
      icon: CloudArrowUp,
    },
    ...(DASHBOARD_HIDE_LEGACY_SECTIONS
      ? []
      : [
          {
            key: "auth-searches",
            label: "Searches",
            value: "0 / 100",
            icon: ChartBar,
          },
        ]),
    {
      key: "auth-credits",
      label: "AI credits",
      value: aiCreditsValue,
      icon: Sparkle,
    },
    {
      key: "auth-plan",
      label: "Plan",
      value: planMeta.label,
      className: planMeta.className,
      icon: ShieldCheck,
    },
  ];

  const handleSignOut = async () => {
    try {
      await signOutSupabaseSession();
      setShowLogoutConfirm(false);
      setProfileMenuOpen(false);
      router.replace("/");
    } catch {
      // Best-effort sign-out only.
    }
  };

  useEffect(() => {
    document.body.classList.add("dashboard-body");
    document.documentElement.classList.add("dashboard-body");
    return () => {
      document.body.classList.remove("dashboard-body");
      document.documentElement.classList.remove("dashboard-body");
    };
  }, []);

  const loginHref = `/auth?next=${encodeURIComponent("/dashboard")}`;
  const guestCreateProjectHref = buildPricingPath({ intent: "create-project" });
  const pageTitle = isAuthenticated ? "ShortPulse · Dashboard" : "ShortPulse · Home";

  if (isDashboardBootstrapPending) {
    return (
      <>
        <Head>
          <title>ShortPulse · Dashboard</title>
          <meta
            name="description"
            content="ShortPulse dashboard bootstrap while your authenticated workspace session resolves."
          />
        </Head>
        <AiStudioProjectEntryState
          variant="loading"
          phase="resolving-project"
          enableExperimentalAnimation
          title={DASHBOARD_BOOTSTRAP_TITLE}
          message={DASHBOARD_BOOTSTRAP_MESSAGE}
          steps={[]}
          stepsAriaLabel="Dashboard loading progress"
        />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta
          name="description"
          content="ShortPulse public dashboard and workspace entry for pricing, account access, and AI Studio project flow."
        />
      </Head>

      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <main id="main-content" className="page page-wide dashboard-refresh">
        <DashboardAppBar
          cards={isAuthenticated ? authHeaderCards : buildGuestHeaderCards(dashboardOffers)}
          actionSlot={
            isAuthenticated ? (
              <div className="user-cluster profile-menu" ref={profileMenuRef}>
                <button
                  className="avatar-card"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  aria-label="Profile menu"
                >
                  <div className="avatar">{initials}</div>
                </button>
                {profileMenuOpen ? (
                  <div className="profile-dropdown">
                    <Link href="/profile?section=account" onClick={() => setProfileMenuOpen(false)}>
                      Account & profile settings
                    </Link>
                    <Link href="/profile?section=credits" onClick={() => setProfileMenuOpen(false)}>
                      Billing & subscription
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setShowLogoutConfirm(true);
                      }}
                    >
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="user-cluster">
                <Link href={loginHref} className="avatar-card app-bar-login-button">
                  Log in
                </Link>
              </div>
            )
          }
        />

        {isAuthenticated ? (
          <AuthenticatedDashboardView
            dashboardAnnouncement={dashboardAnnouncement}
            dashboardFallbackHelperCopy={DASHBOARD_FALLBACK_HELPER_COPY}
            firstName={firstName}
            hideLegacySections={DASHBOARD_HIDE_LEGACY_SECTIONS}
            isCreatingProject={isCreatingProject}
            projectCreateError={projectCreateError}
            toolCards={dashboardToolCards}
            onCreateProject={() => {
              openProjectNameModal();
            }}
            onOpenProjects={() => setIsProjectsModalOpen(true)}
          />
        ) : (
          <GuestDashboardView createProjectHref={guestCreateProjectHref} />
        )}
      </main>

      {showLogoutConfirm ? (
        <ConfirmationModal
          title="Log out?"
          titleId="logout-title"
          body={<p>You will be signed out of ShortPulse.</p>}
          confirmLabel="Log out"
          tone="primary"
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={handleSignOut}
        />
      ) : null}

      {isProjectNameModalOpen ? (
        <ProjectNameModal
          value={newProjectTitle}
          isCreating={isCreatingProject}
          error={projectCreateError}
          onChange={setNewProjectTitle}
          onCancel={closeProjectNameModal}
          onSubmit={() => {
            void submitProjectCreate();
          }}
        />
      ) : null}

      {isAuthenticated ? (
        <ProjectsModal
          isOpen={isProjectsModalOpen}
          onClose={() => setIsProjectsModalOpen(false)}
          onSelectProject={openProject}
          onCreateProject={openProject}
        />
      ) : null}
    </>
  );
}
