/**
 * Authenticated dashboard route surface.
 * Owns authenticated dashboard metrics, actions, modals, and profile-menu behavior behind the signed-in route branch.
 */
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ChartBar, Sparkle } from "phosphor-react";
import { useCredits } from "../../ai-studio/hooks/useCredits";
import {
  buildPlanView,
  type BillingCatalogSnapshot,
  type BillingPlanRecord,
} from "../../billing/catalog";
import { formatStorageBytes } from "../../billing/storage";
import { useMediaStorageQuotaSummary } from "../../billing/useMediaStorageQuotaSummary";
import { ACCOUNT_MENU_LINKS } from "../../profile/accountMenuLinks";
import {
  AuthenticatedDashboardView,
  type DashboardAnnouncement,
  type DashboardToolCard,
} from "./AuthenticatedDashboardView";
import type { DashboardTutorial } from "./DashboardTutorialGrid";
import { DashboardAppBar } from "./DashboardAppBar";
import { useProjectCreationDialog } from "../../projects/hooks/useProjectCreationDialog";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { ensureSupabaseQueryClient, signOutSupabaseSession } from "../../../lib/supabaseClient";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { readDashboardTutorialsFromPublicEndpoint } from "../logic/dashboardTutorialEndpointClient";
import { SHORTPULSE_COMMUNITY_URL } from "../communityLinks";

const DEFAULT_PLAN_TIER = "free";
const DASHBOARD_HIDE_LEGACY_SECTIONS =
  process.env.NEXT_PUBLIC_DASHBOARD_HIDE_LEGACY_SECTIONS !== "false";
const DASHBOARD_FALLBACK_HELPER_COPY =
  "Your next great idea is waiting! Start a project and let's make it happen.";

type CurrentSubscriptionContractRow = {
  plan_id: string | null;
  monthly_credits_cents: number | null;
};

type BillingProfilePlanRow = {
  plan_id: string | null;
};

type ProjectsModalComponent =
  (typeof import("../../ai-studio/components/ProjectsModal"))["ProjectsModal"];
type ProjectNameModalComponent =
  (typeof import("../../projects/components/ProjectNameModal"))["ProjectNameModal"];

type AuthenticatedDashboardRouteProps = {
  billingCatalog: BillingCatalogSnapshot;
  dashboardTutorials?: DashboardTutorial[];
  user: User;
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

const getUserDisplayName = (user: User) => {
  const displayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  const fullName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const email = user.email?.trim() ?? "";
  return displayName || fullName || email || "Guest";
};

const getDashboardGreetingName = (displayName: string) => {
  const firstToken = displayName
    .split(/\s+/)
    .find((part) => part.trim().length > 0)
    ?.trim();
  if (!firstToken) return "creator";
  if (!firstToken.includes("@")) return firstToken;
  return firstToken.split("@")[0]?.trim() || "creator";
};

const formatCreditUsageValue = (
  balanceCents: number | null,
  monthlyCreditsCents: number
): string => {
  if (balanceCents == null) return "Credits unavailable";
  const balanceLabel = Math.max(0, balanceCents).toLocaleString();
  if (monthlyCreditsCents <= 0) return balanceLabel;
  return `${balanceLabel} /\n${monthlyCreditsCents.toLocaleString()}`;
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
];

const loadProjectsModal = async (): Promise<ProjectsModalComponent> => {
  const loadedModule = await import("../../ai-studio/components/ProjectsModal");
  return loadedModule.ProjectsModal;
};

const loadProjectNameModal = async (): Promise<ProjectNameModalComponent> => {
  const loadedModule = await import("../../projects/components/ProjectNameModal");
  return loadedModule.ProjectNameModal;
};

/**
 * Renders the signed-in dashboard surface and keeps its authenticated-only logic out of the public route entry bundle.
 */
export function AuthenticatedDashboardRoute({
  billingCatalog,
  dashboardTutorials: initialDashboardTutorials = [],
  user,
}: AuthenticatedDashboardRouteProps) {
  const router = useRouter();
  const { balanceCents, balanceLoading } = useCredits({ enabled: true });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [resolvedPlan, setResolvedPlan] = useState<{
    id: string;
    label: string;
    className: string;
    monthlyCreditsCents: number;
  } | null>(null);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [ProjectsModalComponent, setProjectsModalComponent] =
    useState<ProjectsModalComponent | null>(null);
  const [ProjectNameModalComponent, setProjectNameModalComponent] =
    useState<ProjectNameModalComponent | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [dashboardAnnouncement, setDashboardAnnouncement] = useState<DashboardAnnouncement | null>(
    null
  );
  const [dashboardTutorials, setDashboardTutorials] =
    useState<DashboardTutorial[]>(initialDashboardTutorials);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;

    function handleClick(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen]);

  const fallbackPlanView = buildPlanView({
    planId: DEFAULT_PLAN_TIER,
    plans: billingCatalog.plans,
  });
  const planMeta = resolvedPlan ?? {
    id: fallbackPlanView.id,
    label: fallbackPlanView.displayName,
    className: fallbackPlanView.className,
    monthlyCreditsCents: fallbackPlanView.monthlyCreditsCents,
  };
  const { quotaSummary, loading: quotaLoading } = useMediaStorageQuotaSummary({
    enabled: true,
    fallbackPlanId: planMeta.id,
  });
  const displayName = getUserDisplayName(user);
  const firstName = getDashboardGreetingName(displayName);
  const initials =
    displayName
      .split(/\s+/)
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
      setUsageLoading(true);
      try {
        const supabase = ensureSupabaseQueryClient();
        const [billingContractResponse, billingProfileResponse, billingPlansResponse] =
          await Promise.all([
            supabase
              .from("billing_subscription_contracts")
              .select("plan_id, monthly_credits_cents")
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
        const contractMonthlyCreditsCents =
          !billingContractResponse.error && billingContractResponse.data
            ? ((billingContractResponse.data as CurrentSubscriptionContractRow)
                .monthly_credits_cents ?? null)
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
          monthlyCreditsCents: contractMonthlyCreditsCents ?? planView.monthlyCreditsCents,
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
  }, [user.id]);

  useEffect(() => {
    let active = true;

    const loadDashboardAnnouncement = async () => {
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
  }, []);

  useEffect(() => {
    if (dashboardTutorials.length > 0) return undefined;
    let active = true;

    const loadDashboardTutorials = async () => {
      try {
        const tutorials = await readDashboardTutorialsFromPublicEndpoint();
        if (!active) return;
        setDashboardTutorials(tutorials);
      } catch {
        if (!active) return;
        setDashboardTutorials([]);
      }
    };

    void loadDashboardTutorials();
    return () => {
      active = false;
    };
  }, [dashboardTutorials.length]);

  const storageUsageValue = useMemo(() => {
    if (usageLoading || quotaLoading) return "…";
    const usedStorage = formatStorageBytes(quotaSummary?.usedBytes ?? 0);
    const totalStorage = formatStorageBytes(quotaSummary?.totalLimitBytes ?? 0);
    return `${usedStorage} /\n${totalStorage}`;
  }, [quotaLoading, quotaSummary, usageLoading]);

  const aiCreditsValue =
    balanceLoading && balanceCents == null
      ? "…"
      : formatCreditUsageValue(balanceCents, planMeta.monthlyCreditsCents);

  const authHeaderCards = [
    {
      key: "auth-community",
      label: "Creator hub",
      value: "Community",
      href: SHORTPULSE_COMMUNITY_URL,
      iconSrc: "/Community.svg",
    },
    {
      key: "auth-storage",
      label: "Media Storage",
      value: storageUsageValue,
      href: "/profile?section=storage",
      iconSrc: "/Media.svg",
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
      href: "/profile?section=credits",
      iconSrc: "/Credits.svg",
    },
    {
      key: "auth-plan",
      label: "Plan",
      value: planMeta.label,
      className: planMeta.className,
      href: "/profile?section=subscription",
      iconSrc: "/Plan.svg",
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

  return (
    <>
      <main
        id="main-content"
        className="page page-wide dashboard-refresh authenticated-dashboard-page"
      >
        <DashboardAppBar
          brandHref={null}
          cards={authHeaderCards}
          actionSlot={
            <div className="user-cluster profile-menu" ref={profileMenuRef}>
              <button
                className="avatar-card"
                onClick={() => setProfileMenuOpen((open) => !open)}
                aria-label="Profile menu"
              >
                <div className="avatar">{initials}</div>
              </button>
              {profileMenuOpen ? (
                <div className="profile-dropdown" role="menu" aria-label="Account settings">
                  <div className="profile-dropdown__identity" aria-label="Signed-in account">
                    <span className="profile-dropdown__avatar" aria-hidden="true">
                      {initials}
                    </span>
                    <span className="profile-dropdown__identity-copy">
                      <strong>{displayName}</strong>
                      {user.email ? <span>{user.email}</span> : null}
                    </span>
                  </div>
                  <div className="profile-dropdown__links">
                    {ACCOUNT_MENU_LINKS.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        onClick={() => setProfileMenuOpen(false)}
                        prefetch={false}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                  <div className="profile-dropdown__actions">
                    <Link
                      href="/report-issue?from=%2Fdashboard"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      prefetch={false}
                    >
                      Report an issue
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setShowLogoutConfirm(true);
                      }}
                    >
                      Log out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          }
        />

        <AuthenticatedDashboardView
          dashboardAnnouncement={dashboardAnnouncement}
          dashboardFallbackHelperCopy={DASHBOARD_FALLBACK_HELPER_COPY}
          dashboardTutorials={dashboardTutorials}
          firstName={firstName}
          hideLegacySections={DASHBOARD_HIDE_LEGACY_SECTIONS}
          isCreatingProject={isCreatingProject}
          projectCreateError={projectCreateError}
          toolCards={dashboardToolCards}
          onCreateProject={() => {
            if (!ProjectNameModalComponent) {
              void loadProjectNameModal().then((component) => {
                setProjectNameModalComponent(() => component);
              });
            }
            openProjectNameModal();
          }}
          onOpenProjects={() => {
            if (!ProjectsModalComponent) {
              void loadProjectsModal().then((component) => {
                setProjectsModalComponent(() => component);
              });
            }
            setIsProjectsModalOpen(true);
          }}
        />
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

      {isProjectNameModalOpen && ProjectNameModalComponent ? (
        <ProjectNameModalComponent
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

      {ProjectsModalComponent ? (
        <ProjectsModalComponent
          isOpen={isProjectsModalOpen}
          onClose={() => setIsProjectsModalOpen(false)}
          onSelectProject={openProject}
          onCreateProject={openProject}
        />
      ) : null}
    </>
  );
}
