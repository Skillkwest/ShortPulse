/**
 * Dashboard shell for logged-in users.
 * Provides entry points to performance analytics, saved creators, and other workspace modules.
 */
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  ChartBar,
  CloudArrowUp,
  FolderSimple,
  Person,
  Plus,
  ShieldCheck,
  Sparkle,
  type IconProps,
} from "phosphor-react";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import {
  buildPlanView,
  normalizePlanId,
  type BillingPlanRecord,
} from "../features/billing/catalog";
import { formatStorageUsageValue } from "../features/billing/storage";
import { useMediaStorageQuotaSummary } from "../features/billing/useMediaStorageQuotaSummary";
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

const PLAN_MAP: Record<string, { id: string; label: string; className: string }> = {
  free: { id: "free", label: "Free", className: "plan-free" },
  media: { id: "media", label: "Media", className: "plan-media" },
  studio: { id: "studio", label: "Studio", className: "plan-studio" },
  business: { id: "business", label: "Business", className: "plan-business" },
};

type DashboardAnnouncement = {
  id: string;
  title: string;
  message: string;
  publishedAt: string | null;
  updatedAt: string | null;
};

type CurrentSubscriptionContractRow = {
  plan_id: string | null;
};

type BillingProfilePlanRow = {
  plan_id: string | null;
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

/**
 * Render the dashboard tiles and workspace chrome for the current user.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { balanceCents, balanceLoading } = useCredits();
  const { user } = useSupabaseSessionState();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [resolvedPlan, setResolvedPlan] = useState<{
    id: string;
    label: string;
    className: string;
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [dashboardAnnouncement, setDashboardAnnouncement] = useState<DashboardAnnouncement | null>(
    null
  );
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "Guest";
  const firstName = (displayName || "creator").split(" ")[0];
  const fallbackPlanTier = DEFAULT_PLAN_TIER;
  const fallbackPlanMeta = PLAN_MAP[fallbackPlanTier] ?? PLAN_MAP.business;
  const planMeta = resolvedPlan ?? fallbackPlanMeta;
  const { quotaSummary, loading: quotaLoading } = useMediaStorageQuotaSummary({
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
        const normalizedBillingProfilePlanId = normalizePlanId(billingPlanId);
        const effectivePlanId =
          contractPlanId ??
          (normalizedBillingProfilePlanId === "free" ? "free" : null) ??
          DEFAULT_PLAN_TIER;
        const normalizedPlanId = normalizePlanId(effectivePlanId);
        const plans =
          !billingPlansResponse.error && Array.isArray(billingPlansResponse.data)
            ? (billingPlansResponse.data as BillingPlanRecord[])
            : [];
        const planView = buildPlanView({
          planId: normalizedPlanId,
          plans,
        });
        const planFallback = PLAN_MAP[normalizedPlanId] ?? PLAN_MAP.business;
        const nextPlanLabel = plans.length > 0 ? planView.displayName : planFallback.label;

        if (!active) return;
        setResolvedPlan({
          id: normalizedPlanId,
          label: nextPlanLabel,
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
      : `${(balanceCents ?? 0).toLocaleString()} credits`;

  type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;
  type ToolCard = {
    title: string;
    eyebrow?: string;
    description: string;
    href: string;
    cta: string;
    variant: string;
    image?: string;
    icon?: IconComponent;
    disabled?: boolean;
  };

  const toolCards: ToolCard[] = [
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

  const heroCards = [
    {
      label: "Media Storage",
      value: storageUsageValue,
      icon: CloudArrowUp,
    },
    ...(DASHBOARD_HIDE_LEGACY_SECTIONS
      ? []
      : [
          {
            label: "Searches",
            value: "0 / 100",
            icon: ChartBar,
          },
        ]),
    {
      label: "AI credits",
      value: aiCreditsValue,
      icon: Sparkle,
    },
    {
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
      // no-op for now
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

  return (
    <>
      <Head>
        <title>ShortPulse · Dashboard</title>
        <meta
          name="description"
          content="ShortPulse dashboard with performance analytics, creator studio, and media library."
        />
      </Head>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <main id="main-content" className="page page-wide dashboard-refresh">
        <header className="app-bar">
          <Link href="/" className="brand-mark brand-mark-logo" aria-label="ShortPulse home">
            <Image
              src="/small good d.png"
              alt="ShortPulse logo"
              className="brand-logo"
              width={203}
              height={64}
              style={{ height: "auto" }}
            />
          </Link>
          <div className="app-bar-right">
            <div className="header-cards">
              {heroCards.map((item) => (
                <div key={item.label} className="header-stat-card">
                  <div className="status-icon compact">
                    <item.icon size={16} weight="bold" />
                  </div>
                  <div className="header-card-body">
                    <p className="metric-label tiny">{item.label}</p>
                    <p className={`status-value small ${item.className ?? ""}`}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="user-cluster profile-menu" ref={profileMenuRef}>
              <button
                className="avatar-card"
                onClick={() => setProfileMenuOpen((v) => !v)}
                aria-label="Profile menu"
              >
                <div className="avatar">{initials}</div>
              </button>
              {profileMenuOpen && (
                <div className="profile-dropdown">
                  <Link href="/profile?section=account" onClick={() => setProfileMenuOpen(false)}>
                    Account & profile settings
                  </Link>
                  <Link href="/profile?section=billing" onClick={() => setProfileMenuOpen(false)}>
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
              )}
            </div>
          </div>
        </header>

        <section className="dashboard-hero minimal-hero">
          <div className="hero-primary">
            <div className="hero-copy">
              <h1>
                Welcome back, <span>{firstName}</span>
              </h1>
              {dashboardAnnouncement ? (
                <div className="hero-announcement" role="status" aria-live="polite">
                  <p className="hero-announcement-title">{dashboardAnnouncement.title}</p>
                  <p className="hero-announcement-message">{dashboardAnnouncement.message}</p>
                </div>
              ) : (
                <p className="hero-subtext">{DASHBOARD_FALLBACK_HELPER_COPY}</p>
              )}
            </div>
            <div className="hero-visual">
              <Image
                src="/dashboard/welcome-art.png"
                alt="Dashboard visual"
                className="hero-graphic"
                width={960}
                height={540}
              />
            </div>
            <div className="hero-quick-row">
              {DASHBOARD_HIDE_LEGACY_SECTIONS ? (
                <>
                  <Link
                    href="/ai-studio"
                    className="hero-onboarding hero-new-project-card"
                    aria-label="New Project: Start a new project in AI Studio"
                  >
                    <span className="hero-new-project-content">
                      <span className="hero-new-project-icon-column" aria-hidden="true">
                        <Plus size={30} weight="bold" className="hero-new-project-icon" />
                      </span>
                      <span className="hero-new-project-text-column">
                        <span className="hero-new-project-label">New Project</span>
                        <p className="hero-new-project-helper">Open the AI Studio.</p>
                      </span>
                    </span>
                  </Link>
                  <section className="hero-sessions-group" aria-label="Sessions placeholders">
                    <p className="hero-sessions-title">Sessions</p>
                    <div className="hero-sessions-wrapper" aria-hidden="true">
                      <div className="hero-session-square" />
                      <div className="hero-session-square" />
                      <div className="hero-session-square" />
                    </div>
                    <p className="hero-sessions-note">Session persistence coming soon.</p>
                  </section>
                </>
              ) : (
                <>
                  <Link
                    href="/onboarding"
                    className="hero-onboarding"
                    aria-label="Onboarding Courses: Guided walkthroughs for Creator Studio workflows"
                  >
                    <div>
                      <p className="eyebrow tiny">Quick start</p>
                      <h3>Onboarding Courses</h3>
                      <p className="subdued tiny">
                        Guided walkthroughs for Creator Studio workflows.
                      </p>
                    </div>
                    <span>Enter →</span>
                  </Link>
                  <Link
                    href="/onboarding?section=workflows"
                    className="hero-onboarding hero-workflow-card"
                    aria-label="AI Workflow Lessons: Deep dives on creation playbooks and applied prompts"
                  >
                    <div>
                      <p className="eyebrow tiny">Workflows</p>
                      <h3>AI Workflow Lessons</h3>
                      <p className="subdued tiny">
                        Deep dives on creation playbooks and applied prompts.
                      </p>
                    </div>
                    <span>Explore →</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
        {!DASHBOARD_HIDE_LEGACY_SECTIONS ? (
          <section className="tools-section" aria-labelledby="tools-heading">
            <h2 id="tools-heading" className="eyebrow">
              Tools
            </h2>
            <div className="tool-card-grid">
              {toolCards.map((tool) => {
                return (
                  <Link
                    href={tool.href}
                    key={tool.title}
                    className={`tool-card ${tool.variant ?? ""} ${tool.disabled ? "is-disabled" : ""}`}
                    aria-disabled={tool.disabled}
                    tabIndex={tool.disabled ? -1 : undefined}
                    role="article"
                    aria-label={`${tool.title}: ${tool.description}`}
                  >
                    {tool.image ? (
                      <div className="tool-card-hero">
                        <Image
                          src={tool.image}
                          alt={`${tool.title} visual`}
                          width={1200}
                          height={300}
                          unoptimized
                        />
                      </div>
                    ) : null}
                    <div className="tool-card-body">
                      {tool.eyebrow ? <p className="tool-card-eyebrow">{tool.eyebrow}</p> : null}
                      <div className="tool-card-title-row">
                        <h3>{tool.title}</h3>
                        {tool.icon ? (
                          <span className="tool-card-title-icon" aria-hidden="true">
                            <tool.icon size={19} weight="duotone" />
                          </span>
                        ) : null}
                      </div>
                      <p>{tool.description}</p>
                    </div>
                    <div className="tool-card-footer">{tool.cta}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
        {!DASHBOARD_HIDE_LEGACY_SECTIONS ? (
          <div className="footer">
            ShortPulse keeps your performance data and media private to your account.
          </div>
        ) : null}
      </main>
      {showLogoutConfirm && (
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
      )}
    </>
  );
}
