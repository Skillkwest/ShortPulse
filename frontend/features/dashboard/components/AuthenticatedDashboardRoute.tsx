/**
 * Authenticated dashboard route surface.
 * Owns authenticated dashboard metrics, actions, modals, and profile-menu behavior behind the signed-in route branch.
 */
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ChartBar, SignOut, Sparkle } from "phosphor-react";
import { useCredits } from "../../ai-studio/hooks/useCredits";
import { buildPlanView, type BillingCatalogSnapshot } from "../../billing/catalog";
import { fetchBillingAccountSummary } from "../../billing/accountSummary";
import { formatStorageBytes } from "../../billing/storage";
import { useMediaStorageQuotaSummary } from "../../billing/useMediaStorageQuotaSummary";
import { buildAccountMenuLinks, CUSTOMER_SUPPORT_MENU_LINK } from "../../profile/accountMenuLinks";
import { buildProfileSectionHref } from "../../profile/profileNavigation";
import { resolveAccountCreditsSummary } from "../../profile/profilePageModel";
import {
  AuthenticatedDashboardView,
  type DashboardAnnouncement,
  type DashboardToolCard,
} from "./AuthenticatedDashboardView";
import type { DashboardTutorial } from "./DashboardTutorialGrid";
import { DashboardAppBar } from "./DashboardAppBar";
import { useProjectCreationDialog } from "../../projects/hooks/useProjectCreationDialog";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { useCustomerSupportDialog } from "../../../components/CustomerSupportDialog";
import { reportAppError } from "../../../lib/appErrorReporter";
import { signOutSupabaseSession } from "../../../lib/supabaseClient";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  extractFailedNextChunk,
  hasNextChunkLoadFailureText,
  toChunkLoadErrorMessage,
} from "../../../lib/chunkLoadErrors";
import { readDashboardTutorialsFromPublicEndpoint } from "../logic/dashboardTutorialEndpointClient";
import {
  SHORTPULSE_COMMUNITY_LINK_REL,
  SHORTPULSE_COMMUNITY_LINK_TARGET,
  SHORTPULSE_COMMUNITY_URL,
} from "../communityLinks";

const DEFAULT_PLAN_TIER = "free";
const DASHBOARD_HIDE_LEGACY_SECTIONS =
  process.env.NEXT_PUBLIC_DASHBOARD_HIDE_LEGACY_SECTIONS !== "false";
const DASHBOARD_FALLBACK_HELPER_COPY =
  "Your next great idea is waiting! Start a project and let's make it happen.";
const DASHBOARD_PROFILE_RETURN_PATH = "/dashboard";

type ProjectsModalComponent =
  (typeof import("../../ai-studio/components/ProjectsModal"))["ProjectsModal"];
type ProjectNameModalComponent =
  (typeof import("../../projects/components/ProjectNameModal"))["ProjectNameModal"];
type DashboardLazyModalKey = "project_name" | "projects";
type DashboardModalLoadFailure = {
  title: string;
};

type AuthenticatedDashboardRouteProps = {
  billingCatalog: BillingCatalogSnapshot;
  dashboardTutorials?: DashboardTutorial[];
  user: User;
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

const DASHBOARD_MODAL_FAILURE_COPY: Record<DashboardLazyModalKey, DashboardModalLoadFailure> = {
  project_name: {
    title: "New Project could not open",
  },
  projects: {
    title: "Projects could not open",
  },
};

const reportDashboardModalLoadFailure = ({
  error,
  modal,
}: {
  error: unknown;
  modal: DashboardLazyModalKey;
}) => {
  const message = toChunkLoadErrorMessage(error) || "Dashboard modal failed to load.";
  const stack = error instanceof Error ? error.stack : null;
  const haystack = `${message}\n${stack ?? ""}`;
  void reportAppError({
    source: `client.dashboard.${modal}_modal_load_failure`,
    scope: "app",
    severity: "high",
    message,
    stack,
    route:
      typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : null,
    metadata: {
      modal,
      failed_chunk: extractFailedNextChunk(haystack),
      is_next_chunk_load_failure: hasNextChunkLoadFailureText(haystack),
    },
  });
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
  const { customerSupportDialog, openCustomerSupportDialog } = useCustomerSupportDialog();
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
  const [dashboardModalLoadFailure, setDashboardModalLoadFailure] =
    useState<DashboardModalLoadFailure | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [dashboardAnnouncement, setDashboardAnnouncement] = useState<DashboardAnnouncement | null>(
    null
  );
  const [dashboardAnnouncementLoading, setDashboardAnnouncementLoading] = useState(true);
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
  const {
    quotaStatus,
    quotaSummary,
    loading: quotaLoading,
  } = useMediaStorageQuotaSummary({
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
        const summary = await fetchBillingAccountSummary({ expectedUserId: user.id });
        if (!summary?.resolvedPlan || summary.userId !== user.id) {
          throw new Error("Unable to load billing account summary.");
        }

        if (!active) return;
        setResolvedPlan(summary.resolvedPlan);
      } catch {
        if (!active) return;
        const fallbackPlanView = buildPlanView({
          planId: DEFAULT_PLAN_TIER,
          plans: billingCatalog.plans,
        });
        setResolvedPlan({
          id: fallbackPlanView.id,
          label: fallbackPlanView.displayName,
          className: fallbackPlanView.className,
          monthlyCreditsCents: fallbackPlanView.monthlyCreditsCents,
        });
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
  }, [billingCatalog.plans, user.id]);

  useEffect(() => {
    let active = true;

    const loadDashboardAnnouncement = async () => {
      setDashboardAnnouncementLoading(true);
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
      } finally {
        if (active) {
          setDashboardAnnouncementLoading(false);
        }
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
    if (quotaStatus === "unavailable" || !quotaSummary) return "Unavailable";
    const usedStorage = formatStorageBytes(quotaSummary?.usedBytes ?? 0);
    const totalStorage = formatStorageBytes(quotaSummary?.totalLimitBytes ?? 0);
    return `${usedStorage} /\n${totalStorage}`;
  }, [quotaLoading, quotaStatus, quotaSummary, usageLoading]);

  const aiCreditsValue =
    balanceLoading && balanceCents == null
      ? "…"
      : formatCreditUsageValue(balanceCents, planMeta.monthlyCreditsCents);
  const aiCreditsSummary =
    balanceLoading && balanceCents == null
      ? null
      : resolveAccountCreditsSummary({
          balanceCents,
          balanceLoading: false,
          planCreditsCents: planMeta.monthlyCreditsCents,
        });
  const aiCreditsValueNode =
    planMeta.monthlyCreditsCents > 0 &&
    aiCreditsSummary?.state === "ready" &&
    aiCreditsSummary.isSurplus ? (
      <>
        <span className="dashboard-credit-surplus-value">{aiCreditsSummary.currentLabel}</span>
        {" /\n"}
        {aiCreditsSummary.planLabel}
      </>
    ) : undefined;
  const accountMenuLinks = useMemo(
    () => buildAccountMenuLinks({ fromPath: DASHBOARD_PROFILE_RETURN_PATH }),
    []
  );

  const authHeaderCards = [
    {
      key: "auth-community",
      label: "Creator hub",
      value: "Community",
      href: SHORTPULSE_COMMUNITY_URL,
      target: SHORTPULSE_COMMUNITY_LINK_TARGET,
      rel: SHORTPULSE_COMMUNITY_LINK_REL,
      iconSrc: "/Community.svg",
    },
    {
      key: "auth-storage",
      label: "Media Storage",
      value: storageUsageValue,
      href: buildProfileSectionHref({
        section: "storage",
        fromPath: DASHBOARD_PROFILE_RETURN_PATH,
      }),
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
      valueNode: aiCreditsValueNode,
      href: buildProfileSectionHref({
        section: "credits",
        fromPath: DASHBOARD_PROFILE_RETURN_PATH,
      }),
      iconSrc: "/Credits.svg",
    },
    {
      key: "auth-plan",
      label: "Plan",
      value: planMeta.label,
      className: planMeta.className,
      href: buildProfileSectionHref({
        section: "subscription",
        fromPath: DASHBOARD_PROFILE_RETURN_PATH,
      }),
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
                <div
                  className="profile-dropdown toolbar-account-menu"
                  role="menu"
                  aria-label="Account settings"
                >
                  <div className="toolbar-account-menu__identity" aria-label="Signed-in account">
                    <span className="toolbar-account-menu__avatar" aria-hidden="true">
                      {initials}
                    </span>
                    <span className="toolbar-account-menu__identity-copy">
                      <strong>{displayName}</strong>
                      {user.email ? <span>{user.email}</span> : null}
                    </span>
                  </div>
                  <div className="toolbar-account-menu__links">
                    {accountMenuLinks.map((item) => (
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
                  <div className="toolbar-account-menu__actions">
                    <button
                      type="button"
                      role="menuitem"
                      className="toolbar-account-menu__support-action"
                      onClick={(event) => {
                        setProfileMenuOpen(false);
                        openCustomerSupportDialog(event);
                      }}
                    >
                      {CUSTOMER_SUPPORT_MENU_LINK.label}
                    </button>
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
                      <SignOut size={15} weight="regular" />
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
          dashboardAnnouncementLoading={dashboardAnnouncementLoading}
          dashboardFallbackHelperCopy={DASHBOARD_FALLBACK_HELPER_COPY}
          dashboardTutorials={dashboardTutorials}
          firstName={firstName}
          hideLegacySections={DASHBOARD_HIDE_LEGACY_SECTIONS}
          isCreatingProject={isCreatingProject}
          projectCreateError={projectCreateError}
          toolCards={dashboardToolCards}
          onCreateProject={() => {
            if (!ProjectNameModalComponent) {
              void loadProjectNameModal()
                .then((component) => {
                  setProjectNameModalComponent(() => component);
                })
                .catch((error) => {
                  closeProjectNameModal();
                  setDashboardModalLoadFailure(DASHBOARD_MODAL_FAILURE_COPY.project_name);
                  reportDashboardModalLoadFailure({ error, modal: "project_name" });
                });
            }
            openProjectNameModal();
          }}
          onOpenProjects={() => {
            if (!ProjectsModalComponent) {
              void loadProjectsModal()
                .then((component) => {
                  setProjectsModalComponent(() => component);
                })
                .catch((error) => {
                  setIsProjectsModalOpen(false);
                  setDashboardModalLoadFailure(DASHBOARD_MODAL_FAILURE_COPY.projects);
                  reportDashboardModalLoadFailure({ error, modal: "projects" });
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

      {dashboardModalLoadFailure ? (
        <ConfirmationModal
          title={dashboardModalLoadFailure.title}
          body={
            <p>
              ShortPulse could not load the latest dashboard code for this action. Reload the
              dashboard and try again.
            </p>
          }
          confirmLabel="Reload dashboard"
          tone="primary"
          onCancel={() => setDashboardModalLoadFailure(null)}
          onConfirm={() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }}
        />
      ) : null}
      {customerSupportDialog}
    </>
  );
}
