/**
 * Dashboard shell for logged-in users.
 * Provides entry points to performance analytics, saved creators, and other workspace modules.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ChartBar, CloudArrowUp, FolderSimpleOpen, ShieldCheck, Sparkle, UsersThree } from "phosphor-react";
import { ensureSupabaseClient } from "../lib/supabaseClient";

/**
 * Render the dashboard tiles and workspace chrome for the current user.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const supabase = ensureSupabaseClient();
      supabase.auth.getUser().then(({ data }) => {
        setUser(data.user ?? null);
      });
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "USER_UPDATED" || event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
          setUser(session?.user ?? null);
        }
        if (event === "SIGNED_OUT") {
          setUser(null);
        }
      });
      return () => {
        authListener?.subscription?.unsubscribe();
      };
    } catch {
      setUser(null);
    }
  }, []);
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
    user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "Guest";
  const firstName = (displayName || "creator").split(" ")[0];
  const planTier = (user?.user_metadata?.plan as string | undefined)?.toLowerCase() || "creative";
  const planMap: Record<string, { label: string; className: string }> = {
    free: { label: "Free", className: "plan-free" },
    media: { label: "Media", className: "plan-media" },
    pro: { label: "Pro", className: "plan-pro" },
    creative: { label: "Creative Suite", className: "plan-creative" },
  };
  const planMeta = planMap[planTier] || planMap.free;
  const initials =
    (displayName || "")
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SP";
  const toolCards = [
    {
      title: "Saved Creators",
      description: "Curate the handles you monitor for benchmarking and alerts.",
      href: "/saved-creators",
      cta: "Review list →",
      variant: "tool-saved",
      image: "/Gray.png",
      icon: UsersThree,
    },
    {
      title: "Media Library",
      description: "Upload and organize private assets with per-user Supabase storage.",
      href: "/media-library",
      cta: "Open library →",
      variant: "tool-media",
      image: "/dashboard/media-library.png",
      icon: FolderSimpleOpen,
    },
    {
      title: "Performance Analytics",
      description: "Compare high-performing Reels, TikToks, and Shorts across niches.",
      href: "/performance",
      cta: "Open analytics →",
      variant: "tool-performance",
      image: "/dashboard/performance-analytics.png",
      icon: ChartBar,
    },
    {
      title: "AI Content Studio",
      description: "AI-assisted hooks and prompts. Arriving soon for workspace pilots.",
      href: "/creator-studio",
      cta: "Go to studio →",
      variant: "tool-creator",
      image: "/dashboard/creator-studio.png",
      icon: Sparkle,
    },
  ];

  const heroCards = [
    {
      label: "Plan",
      value: planMeta.label,
      className: planMeta.className,
      icon: ShieldCheck,
    },
    {
      label: "Media Storage",
      value: "0 / 1 GB",
      icon: CloudArrowUp,
    },
    {
      label: "Searches",
      value: "0 / 100",
      icon: ChartBar,
    },
    {
      label: "AI credits",
      value: "0 credits",
      icon: Sparkle,
    },
  ];

  const handleSignOut = async () => {
    try {
      const supabase = ensureSupabaseClient();
      await supabase.auth.signOut();
      setUser(null);
      setShowLogoutConfirm(false);
      setProfileMenuOpen(false);
      router.replace("/");
    } catch {
      // no-op for now
    }
  };

  return (
    <>
      <Head>
        <title>ShortPulse · Dashboard</title>
        <meta
          name="description"
          content="ShortPulse dashboard with performance analytics, creator studio, and media library."
        />
      </Head>
      <main className="page page-wide dashboard-refresh">
        <header className="app-bar">
          <Link href="/" className="brand-mark">
            <span className="logo-dot" />
            <span className="brand-name">ShortPulse</span>
            <span className="brand-sub">Dashboard</span>
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
              <button className="avatar-card" onClick={() => setProfileMenuOpen((v) => !v)} aria-label="Profile menu">
                <div className="avatar">{initials}</div>
              </button>
              {profileMenuOpen && (
                <div className="profile-dropdown">
                  <Link href="/profile?section=profile" onClick={() => setProfileMenuOpen(false)}>
                    Profile settings
                  </Link>
                  <Link href="/profile?section=account" onClick={() => setProfileMenuOpen(false)}>
                    Account settings
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
              <p className="hero-subtext">
                Your dashboard is the launch surface for analytics, creator ops, and storage—built for fast decisions and
                secure tooling.
              </p>
            </div>
            <div className="hero-visual">
              <img src="/dashboard/welcome-art.png" alt="Dashboard visual" className="hero-graphic" />
              <Link href="/onboarding" className="hero-onboarding">
                <div>
                  <p className="eyebrow tiny">Quick start</p>
                  <h3>Onboarding Courses</h3>
                  <p className="subdued tiny">Guided walkthroughs for Creator Studio workflows.</p>
                </div>
                <span>Enter →</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="tools-section">
          <p className="eyebrow">Tools</p>
          <div className="tool-card-grid">
            {toolCards.map((tool) => {
              return (
                <Link
                  href={tool.href}
                  key={tool.title}
                  className={`tool-card ${tool.variant ?? ""} ${tool.disabled ? "is-disabled" : ""}`}
                  aria-disabled={tool.disabled}
                  tabIndex={tool.disabled ? -1 : undefined}
                >
                  {tool.icon ? (
                    <div className="tool-card-icon" aria-hidden="true" />
                  ) : null}
                  {tool.image ? (
                    <div className="tool-card-hero">
                      <img src={tool.image} alt={`${tool.title} visual`} />
                    </div>
                  ) : null}
                  <div className="tool-card-body">
                    <h3>{tool.title}</h3>
                    <p>{tool.description}</p>
                  </div>
                  <div className="tool-card-footer">{tool.cta}</div>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="footer">
          ShortPulse keeps your performance data and media private to your account.
        </div>
      </main>
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Are you sure?</h3>
            <p className="subdued tiny">You will be signed out of ShortPulse.</p>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setShowLogoutConfirm(false)}>
                No
              </button>
              <button type="button" className="primary-btn" onClick={handleSignOut}>
                Yes, log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
