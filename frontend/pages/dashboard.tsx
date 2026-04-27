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
import {
  ChartBar,
  CloudArrowUp,
  FolderSimple,
  Person,
  ShieldCheck,
  Sparkle,
  type IconProps,
} from "phosphor-react";
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
import { buildPricingPath } from "../features/pricing/paths";
import { formatCurrencyFromCents } from "../features/profile/profilePageModel";
import { trackMarketingPageView } from "../lib/growthTelemetry";
import { loadBillingCatalogSnapshot } from "../lib/server/api/billingCatalog";
import {
  ensureSupabaseClient,
  ensureSupabaseQueryClient,
  primeSupabaseSession,
  useSupabaseSessionState,
} from "../lib/supabaseClient";
import { fetchWithAuth } from "../lib/authenticatedFetch";

const DEFAULT_PLAN_TIER = "free";
const DASHBOARD_HIDE_LEGACY_SECTIONS =
  process.env.NEXT_PUBLIC_DASHBOARD_HIDE_LEGACY_SECTIONS !== "false";
const DASHBOARD_FALLBACK_HELPER_COPY =
  "Your dashboard is the launch surface for analytics, creator ops, and storage - built for fast decisions and secure tooling.";

type CurrentSubscriptionContractRow = {
  plan_id: string | null;
};

type BillingProfilePlanRow = {
  plan_id: string | null;
};

type DashboardPageStaticProps = InferGetStaticPropsType<typeof getStaticProps>;
type DashboardPageProps = {
  billingCatalog?: DashboardPageStaticProps["billingCatalog"];
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

const sortBillingPlans = (plans: readonly BillingPlanRecord[]) =>
  [...plans].sort((left, right) => {
    if ((left.sort_order ?? 0) === (right.sort_order ?? 0)) {
      return left.monthly_price_cents - right.monthly_price_cents;
    }
    return (left.sort_order ?? 0) - (right.sort_order ?? 0);
  });

const buildGuestHeaderCards = (billingCatalog: BillingCatalogSnapshot): DashboardHeaderCard[] => {
  const sortedPlans = sortBillingPlans(billingCatalog.plans);
  const preferredPlanIds = ["free", "studio", "business"];
  const selectedPlanIds = preferredPlanIds.filter((planId) =>
    sortedPlans.some((plan) => plan.id === planId)
  );
  const selectedPlans =
    selectedPlanIds.length >= 2
      ? selectedPlanIds
          .map((planId) => sortedPlans.find((plan) => plan.id === planId) ?? null)
          .filter((plan): plan is BillingPlanRecord => plan !== null)
      : sortedPlans.slice(0, 3);

  return selectedPlans.map((plan) => {
    const planView = buildPlanView({ planId: plan.id, plans: billingCatalog.plans });
    const label = plan.id === "free" ? "Start free" : planView.displayName;
    const value =
      plan.monthly_price_cents === 0
        ? `${plan.monthly_credits_cents.toLocaleString()} credits / month`
        : `${formatCurrencyFromCents(plan.monthly_price_cents)} / month`;

    return {
      key: `guest-${plan.id}`,
      label,
      value,
      icon: plan.id === "free" ? Sparkle : plan.id === "business" ? ShieldCheck : CloudArrowUp,
      href: buildPricingPath({ planId: plan.id }),
      className: planView.className,
    };
  });
};

const dashboardToolCards: DashboardToolCard[] = [
  {
    title: "Media Library",
    eyebrow: "Storage",
    description: "Upload and organize private assets with secure, per-user storage.",
    href: "/media-library",
    cta: "Open library →",
    variant: "tool-media",
    image: "/dashboard/media-library-purple.png",
    icon: FolderSimple,
  },
  {
    title: "Character",
    eyebrow: "Identity",
    description: "Open Character Manager to upload references and manage each character profile.",
    href: "/character",
    cta: "Open manager →",
    variant: "tool-character",
    image: "/dashboard/character.png",
    icon: Person,
  },
  {
    title: "AI Studio",
    eyebrow: "Generation",
    description:
      "Generate and iterate images/videos with prompt systems, models, and aspect control.",
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
}> = async () => {
  try {
    const billingCatalog = await loadBillingCatalogSnapshot();
    return {
      props: { billingCatalog },
      revalidate: 60,
    };
  } catch {
    return {
      props: { billingCatalog: emptyBillingCatalogSnapshot() },
      revalidate: 60,
    };
  }
};

/**
 * Renders the public/authenticated dashboard route.
 */
export default function DashboardPage({
  billingCatalog = emptyBillingCatalogSnapshot(),
}: DashboardPageProps) {
  const router = useRouter();
  const { initialized, user } = useSupabaseSessionState();
  const isAuthenticated = Boolean(user);
  const { balanceCents, balanceLoading } = useCredits({ enabled: isAuthenticated });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [resolvedPlan, setResolvedPlan] = useState<{
    id: string;
    label: string;
    className: string;
  } | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [projectCreateError, setProjectCreateError] = useState<string | null>(null);
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
      const supabase = ensureSupabaseClient();
      await supabase.auth.signOut();
      primeSupabaseSession(null);
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

  const handleCreateProject = async () => {
    if (isCreatingProject) return;
    setIsCreatingProject(true);
    setProjectCreateError(null);
    try {
      const response = await fetchWithAuth("/api/projects/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Untitled project",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
        project?: { id?: string };
      };
      if (!response.ok || !payload.project?.id) {
        throw new Error(payload.error || payload.details || "Failed to create project.");
      }
      await openProject(payload.project.id);
    } catch (error) {
      setProjectCreateError(error instanceof Error ? error.message : "Failed to create project.");
    } finally {
      setIsCreatingProject(false);
    }
  };

  const loginHref = `/auth?next=${encodeURIComponent("/dashboard")}`;
  const guestCreateProjectHref = buildPricingPath({ intent: "create-project" });
  const guestOpenProjectsHref = buildPricingPath({ intent: "open-projects" });

  return (
    <>
      <Head>
        <title>ShortPulse · Dashboard</title>
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
          cards={isAuthenticated ? authHeaderCards : buildGuestHeaderCards(billingCatalog)}
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
              void handleCreateProject();
            }}
            onOpenProjects={() => setIsProjectsModalOpen(true)}
          />
        ) : (
          <GuestDashboardView
            billingCatalog={billingCatalog}
            createProjectHref={guestCreateProjectHref}
            openProjectsHref={guestOpenProjectsHref}
          />
        )}
      </main>

      {showLogoutConfirm ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-labelledby="logout-title"
          aria-modal="true"
        >
          <div className="modal-card">
            <h3 id="logout-title">Are you sure?</h3>
            <p className="subdued tiny">You will be signed out of ShortPulse.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowLogoutConfirm(false)}
              >
                No
              </button>
              <button type="button" className="btn-primary" onClick={handleSignOut}>
                Yes, log out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAuthenticated ? (
        <ProjectsModal
          isOpen={isProjectsModalOpen}
          onClose={() => setIsProjectsModalOpen(false)}
          onSelectProject={openProject}
        />
      ) : null}
    </>
  );
}
