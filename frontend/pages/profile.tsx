import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, CheckCircle, CreditCard, LockKey, SignOut, Sparkle, UserCircle } from "phosphor-react";
import { ensureSupabaseClient } from "../lib/supabaseClient";

type ProfileSection = "profile" | "account" | "billing" | "subscription";

const sections: { key: ProfileSection; label: string; icon: typeof UserCircle }[] = [
  { key: "profile", label: "Profile", icon: UserCircle },
  { key: "account", label: "Account", icon: LockKey },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "subscription", label: "Subscription", icon: CreditCard },
];

const planDetails: Record<string, { price: number; limit: string; description: string }> = {
  Free: { price: 0, limit: "1 workspace seat", description: "Starter access for exploration." },
  Media: { price: 10, limit: "2 seats", description: "Ideal for creators testing cadence." },
  Pro: { price: 29, limit: "Up to 5 seats", description: "Full analytics with refreshes." },
  "Creative Suite": { price: 99, limit: "Team access", description: "All signals plus AI helpers." },
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("User");
  const [workspaceEmail, setWorkspaceEmail] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const section = useMemo<ProfileSection>(() => {
    const query = (router.query.section as string | undefined)?.toLowerCase();
    if (query === "account" || query === "billing" || query === "subscription") return query as ProfileSection;
    return "profile";
  }, [router.query.section]);

  useEffect(() => {
    try {
      const supabase = ensureSupabaseClient();
      supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const defaultName = user?.user_metadata?.full_name || user?.email || "User";
    setDisplayNameInput(defaultName);
    setWorkspaceEmail(user?.email || "");
  }, [user]);

  const displayName = displayNameInput || user?.email || "User";
  const planTier = (user?.user_metadata?.plan as string | undefined)?.toLowerCase() || "creative";
  const planLabel =
    planTier === "media" ? "Media" : planTier === "pro" ? "Pro" : planTier === "creative" ? "Creative Suite" : "Free";
  const planClass =
    planTier === "media" ? "plan-media" : planTier === "pro" ? "plan-pro" : planTier === "creative" ? "plan-creative" : "plan-free";
  const activePlan = planDetails[planLabel] || planDetails["Creative Suite"];

  const handleSignOut = async () => {
    try {
      const supabase = ensureSupabaseClient();
      await supabase.auth.signOut();
      router.replace("/auth");
    } catch {
      // silent fail for now
    } finally {
      setShowLogoutConfirm(false);
    }
  };

  const handleProfileSave = async () => {
    const newName = displayNameInput.trim() || user?.email || "User";
    setDisplayNameInput(newName);
    try {
      const supabase = ensureSupabaseClient();
      await supabase.auth.updateUser({
        data: { full_name: newName, display_name: newName },
      });
      setUser((prev) =>
        prev
          ? ({
              ...prev,
              user_metadata: {
                ...prev.user_metadata,
                full_name: newName,
                display_name: newName,
              },
            } as User)
          : prev
      );
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch {
      setProfileSaved(false);
    }
  };

  const handleEmailUpdate = () => {
    setEmailSaved(true);
    setTimeout(() => setEmailSaved(false), 2000);
  };

  const handlePasswordReset = () => {
    setPasswordResetSent(true);
    setTimeout(() => setPasswordResetSent(false), 2500);
  };

  const activeCopy: Record<ProfileSection, { title: string; body: string; cta?: string }> = {
    profile: {
      title: "Profile & presence",
      body: "Control your workspace identity, avatar, and how you show up across dashboards.",
    },
    account: {
      title: "Account",
      body: "Email and security settings.",
    },
    billing: {
      title: "Billing & subscription",
      body: "Review your plan, update payment info, and see what’s next on your billing cycle.",
      cta: "View invoices & receipts",
    },
    subscription: {
      title: "Subscription",
      body: "Manage your plan and billing.",
      cta: "View invoices & receipts",
    },
  };

  const content = activeCopy[section];
  const planOptions = [
    { name: "Free", price: 0, description: "For quick checks and trials.", tag: "Starter" },
    { name: "Media", price: 10, description: "For creators testing cadence.", tag: "Steady" },
    { name: "Pro", price: 29, description: "Signal-rich analytics each week.", tag: "Core" },
    { name: "Creative Suite", price: 99, description: "Full ShortPulse stack with AI.", tag: "Premium" },
  ];

  const renderSectionContent = () => {
    if (section === "profile") {
      return (
        <div className="profile-section-stack">
          <div className="profile-card profile-card-rowed">
            <div className="profile-card-main">
              <div className="profile-avatar-lg">{displayName.slice(0, 2).toUpperCase()}</div>
              <div className="profile-card-text">
                <h3>{displayName}</h3>
                <p className="subdued">{workspaceEmail || "Not provided"}</p>
                <span className={`pill tiny pill-solid ${planClass}`}>{planLabel} Plan</span>
              </div>
            </div>
            <div className="profile-divider" />
            <div className="profile-card-footer">
              <p className="label">Upload a profile photo</p>
              <p className="tiny subdued">JPG or PNG · Square works best</p>
            </div>
          </div>

          <div className="profile-card">
            <h3>Edit Profile</h3>
            <div className="profile-field">
              <label htmlFor="display-name">Display name</label>
              <input
                id="display-name"
                type="text"
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                className="profile-input"
                placeholder="Your display name"
              />
            </div>
            <div className="profile-actions">
              <button type="button" className="primary-btn profile-button" onClick={handleProfileSave}>
                {profileSaved ? (
                  <>
                    <CheckCircle size={18} />
                    Saved
                  </>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (section === "account") {
      return (
        <div className="profile-section-stack">
          <div className="profile-card">
            <h3>Email</h3>
            <p className="tiny subdued">Changes are confirmed by email.</p>
            <div className="profile-field">
              <label htmlFor="workspace-email">Email address</label>
              <input
                id="workspace-email"
                type="email"
                value={workspaceEmail}
                onChange={(e) => setWorkspaceEmail(e.target.value)}
                className="profile-input"
                placeholder="you@example.com"
              />
            </div>
            <div className="profile-actions">
              <button type="button" className="primary-btn profile-button" onClick={handleEmailUpdate}>
                {emailSaved ? (
                  <>
                    <CheckCircle size={18} />
                    Email updated
                  </>
                ) : (
                  "Update email"
                )}
              </button>
            </div>
          </div>

          <div className="profile-card">
            <h3>Security</h3>
            <p className="tiny subdued">Send a password reset link to your email.</p>
            {passwordResetSent ? (
              <div className="profile-callout">
                <CheckCircle size={18} />
                <span>Password reset email sent.</span>
              </div>
            ) : null}
            <div className="profile-actions">
              <button type="button" className="ghost-btn profile-button" onClick={handlePasswordReset}>
                Send reset link
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="profile-section-stack">
          <div className="profile-card">
            <div className="profile-card-header">
              <div>
                <p className="eyebrow">Current Plan</p>
                <h3>{planLabel}</h3>
                <p className="subdued tiny">{activePlan.description}</p>
              </div>
              <span className="pill tiny pill-outline">Active</span>
            </div>
            <div className="profile-metric-grid">
              <div>
                <p className="tiny subdued">Price</p>
                <p className="meta-value">
                  ${activePlan.price} <span className="tiny subdued">/ month</span>
                </p>
              </div>
              <div>
                <p className="tiny subdued">Seats</p>
                <p className="meta-value">{activePlan.limit}</p>
              </div>
              <div>
                <p className="tiny subdued">Next billing</p>
                <p className="meta-value">January 15, 2026</p>
              </div>
            </div>
          </div>

          <div className="profile-card profile-card-actions">
            <div className="profile-card-header">
              <div>
                <p className="eyebrow">Billing actions</p>
                <h3>Payments & history</h3>
                <p className="subdued tiny">Update payment details or pull past receipts.</p>
              </div>
              <CreditCard size={18} />
            </div>
            <div className="profile-action-list">
              <button type="button" className="profile-action">
                <div>
                  <p className="label">Update payment method</p>
                  <p className="tiny subdued">Swap cards or manage expiry.</p>
                </div>
                <ArrowRight size={16} />
              </button>
              <button type="button" className="profile-action">
                <div>
                  <p className="label">View billing history</p>
                  <p className="tiny subdued">Invoices, receipts, and tax IDs.</p>
                </div>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="profile-plan-grid">
          {planOptions.map((plan) => (
            <div
              key={plan.name}
              className={`profile-plan-card ${plan.name === planLabel ? "current" : ""}`}
            >
              <div className="profile-plan-top">
                <div>
                  <p className="tiny subdued">{plan.tag}</p>
                  <h4>{plan.name}</h4>
                </div>
                {plan.name === planLabel ? <CheckCircle size={18} /> : null}
              </div>
              <p className="meta-value">
                ${plan.price} <span className="tiny subdued">/ month</span>
              </p>
              <p className="tiny subdued">{plan.description}</p>
              <div className="profile-actions">
                <button
                  type="button"
                  className={`profile-button ${plan.name === planLabel ? "ghost-btn" : "primary-btn"}`}
                  disabled={plan.name === planLabel}
                >
                  {plan.name === planLabel ? "Current plan" : "Switch plan"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <Head>
        <title>ShortPulse · Profile</title>
        <meta name="description" content="Manage your ShortPulse profile, account settings, and billing." />
      </Head>
      <main className="page page-wide dashboard-refresh profile-page profile-page-shell">
        <section className="profile-shell profile-shell-modern">
          <aside className="profile-nav">
            <div className="profile-nav-header">
              <div className="profile-avatar-chip">{displayName.slice(0, 2).toUpperCase()}</div>
              <div>
                <p className="user-name">{displayName}</p>
                <div className="profile-plan-row">
                  <span className={`pill tiny ${planClass}`}>{planLabel}</span>
                  <Sparkle size={16} weight="bold" />
                </div>
              </div>
            </div>
            <Link href="/dashboard" className="ghost-btn profile-button nav-back-btn">
              ← Back to dashboard
            </Link>

            <div className="profile-nav-list">
              {sections.map((item) => (
                <Link
                  key={item.key}
                  href={`/profile?section=${item.key}`}
                  className={`profile-nav-item ${section === item.key ? "active" : ""}`}
                >
                  <div className="profile-nav-item-icon">
                    <item.icon size={18} />
                  </div>
                  <div className="profile-nav-copy">
                    <p className="label">{item.label}</p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="profile-nav-footer">
              <button type="button" className="ghost-btn profile-button" onClick={() => setShowLogoutConfirm(true)}>
                <SignOut size={16} />
                Log out
              </button>
            </div>
          </aside>

          <section className="profile-content profile-content-simple">
            <div className="profile-heading">
              <h1>{content.title}</h1>
              <p className="subdued">{content.body}</p>
              {content.cta ? (
                <button type="button" className="ghost-btn small profile-button inline">
                  {content.cta}
                  <ArrowRight size={14} />
                </button>
              ) : null}
            </div>
            {renderSectionContent()}
          </section>
        </section>
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
      </main>
    </>
  );
}
