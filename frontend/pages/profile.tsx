/**
 * Profile/account/billing page for authenticated users.
 * Provides account management, plan state, credit purchases, and billing portal actions.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, CheckCircle, CreditCard, LockKey, SignOut, Sparkle, UserCircle } from "phosphor-react";
import { ensureSupabaseClient } from "../lib/supabaseClient";
import { fetchWithAuth } from "../lib/authenticatedFetch";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import { useProtectedRoute } from "../lib/authGuard";

type ProfileSection = "profile" | "account" | "billing" | "subscription";

type BillingProfile = {
  plan_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
};

type CreditPackage = {
  id: string;
  display_name: string;
  credit_amount_cents: number;
  price_cents: number;
  sort_order: number;
};

const sections: { key: ProfileSection; label: string; icon: typeof UserCircle }[] = [
  { key: "profile", label: "Profile", icon: UserCircle },
  { key: "account", label: "Account", icon: LockKey },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "subscription", label: "Subscription", icon: CreditCard },
];

const planDetails: Record<string, { price: number; limit: string; description: string; className: string; label: string }> = {
  free: { price: 0, limit: "1 workspace seat", description: "Starter access for exploration.", className: "plan-free", label: "Free" },
  media: { price: 10, limit: "2 seats", description: "Ideal for creators testing cadence.", className: "plan-media", label: "Media" },
  pro: { price: 29, limit: "Up to 5 seats", description: "Full analytics with refreshes.", className: "plan-pro", label: "Pro" },
  creative_suite: {
    price: 99,
    limit: "Team access",
    description: "All signals plus AI helpers.",
    className: "plan-creative",
    label: "Creative Suite",
  },
};

const normalizePlanId = (value: string | undefined | null): keyof typeof planDetails => {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "creative") return "creative_suite";
  if (normalized === "creative_suite") return "creative_suite";
  if (normalized === "media") return "media";
  if (normalized === "pro") return "pro";
  if (normalized === "free") return "free";
  return "creative_suite";
};

export default function ProfilePage() {
  const router = useRouter();
  const { loading, user } = useProtectedRoute(true);
  const { balanceCents, balanceLoading, refreshBalance } = useCredits();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("User");
  const [workspaceEmail, setWorkspaceEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null);
  const [billingProfileLoading, setBillingProfileLoading] = useState(false);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const section = useMemo<ProfileSection>(() => {
    const query = (router.query.section as string | undefined)?.toLowerCase();
    if (query === "account" || query === "billing" || query === "subscription") return query as ProfileSection;
    return "profile";
  }, [router.query.section]);

  useEffect(() => {
    const defaultName = user?.user_metadata?.full_name || user?.email || "User";
    setDisplayNameInput(defaultName);
    setWorkspaceEmail(user?.email || "");
  }, [user]);

  const loadBillingProfile = async (currentUser: User) => {
    setBillingProfileLoading(true);
    try {
      const supabase = ensureSupabaseClient();
      const { data } = await supabase
        .from("billing_profiles")
        .select("plan_id, subscription_status, current_period_end")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      setBillingProfile((data as BillingProfile | null) ?? null);
    } catch {
      setBillingProfile(null);
    } finally {
      setBillingProfileLoading(false);
    }
  };

  const loadCreditPackages = async () => {
    setPackagesLoading(true);
    try {
      const response = await fetchWithAuth("/api/billing/credit-packages", { method: "GET" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load credit packages.");
      }
      setCreditPackages(Array.isArray(data?.packages) ? data.packages : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load credit packages.");
    } finally {
      setPackagesLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadBillingProfile(user);
    loadCreditPackages();
  }, [user]);

  const displayName = displayNameInput || user?.email || "User";
  const planId = normalizePlanId((billingProfile?.plan_id as string | undefined) ?? (user?.user_metadata?.plan as string | undefined));
  const activePlan = planDetails[planId];
  const planLabel = activePlan.label;
  const planClass = activePlan.className;

  const handleSignOut = async () => {
    try {
      const supabase = ensureSupabaseClient();
      await supabase.auth.signOut();
      router.replace("/auth");
    } finally {
      setShowLogoutConfirm(false);
    }
  };

  const handleProfileSave = async () => {
    const nextName = displayNameInput.trim() || user?.email || "User";
    try {
      const supabase = ensureSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        data: { full_name: nextName, display_name: nextName },
      });
      if (error) throw error;
      setDisplayNameInput(nextName);
      setNotice("Profile updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Profile update failed.");
    }
  };

  const handleEmailUpdate = async () => {
    const nextEmail = workspaceEmail.trim();
    if (!nextEmail) {
      setNotice("Enter a valid email.");
      return;
    }
    try {
      const supabase = ensureSupabaseClient();
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      setNotice("Email update requested. Check your inbox to confirm.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Email update failed.");
    }
  };

  const handlePasswordReset = async () => {
    const email = workspaceEmail.trim() || user?.email;
    if (!email) {
      setNotice("No email is available for reset.");
      return;
    }
    try {
      const supabase = ensureSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setNotice("Password reset link sent.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Password reset failed.");
    }
  };

  const handleCheckout = async (packageId: string) => {
    setCheckoutLoadingId(packageId);
    try {
      const response = await fetchWithAuth("/api/billing/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to create checkout session.");
      }
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setNotice("Checkout session created, but no redirect URL was returned.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to start checkout.");
    } finally {
      setCheckoutLoadingId(null);
    }
  };

  const handleOpenBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const response = await fetchWithAuth("/api/billing/stripe/portal", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to open billing portal.");
      }
      if (data?.portalUrl) {
        window.location.href = data.portalUrl;
        return;
      }
      setNotice("Billing portal URL was not returned.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  };

  const nextBillingText = billingProfile?.current_period_end
    ? new Date(billingProfile.current_period_end).toLocaleDateString()
    : "Not scheduled";
  const subscriptionStatus = billingProfile?.subscription_status ?? "inactive";

  const content = {
    profile: {
      title: "Profile & presence",
      body: "Control your workspace identity, avatar, and how you show up across dashboards.",
    },
    account: {
      title: "Account",
      body: "Email and security settings.",
    },
    billing: {
      title: "Billing & credits",
      body: "Manage your plan, purchases, and recurring billing.",
    },
    subscription: {
      title: "Subscription",
      body: "Review plan status and recurring credit allocation.",
    },
  }[section];

  if (loading) {
    return (
      <main className="page page-wide dashboard-refresh profile-page profile-page-shell">
        <p className="subdued">Checking your session…</p>
      </main>
    );
  }

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
                <Link key={item.key} href={`/profile?section=${item.key}`} className={`profile-nav-item ${section === item.key ? "active" : ""}`}>
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
              {notice ? <p className="tiny subdued">{notice}</p> : null}
            </div>

            {section === "profile" ? (
              <div className="profile-section-stack">
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
                      Save changes
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {section === "account" ? (
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
                      Update email
                    </button>
                  </div>
                </div>
                <div className="profile-card">
                  <h3>Security</h3>
                  <p className="tiny subdued">Send a password reset link to your email.</p>
                  <div className="profile-actions">
                    <button type="button" className="ghost-btn profile-button" onClick={handlePasswordReset}>
                      Send reset link
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {(section === "billing" || section === "subscription") ? (
              <>
                <div className="profile-section-stack">
                  <div className="profile-card">
                    <div className="profile-card-header">
                      <div>
                        <p className="eyebrow">Current Plan</p>
                        <h3>{planLabel}</h3>
                        <p className="subdued tiny">{activePlan.description}</p>
                      </div>
                      <span className="pill tiny pill-outline">{subscriptionStatus}</span>
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
                        <p className="meta-value">{billingProfileLoading ? "…" : nextBillingText}</p>
                      </div>
                      <div>
                        <p className="tiny subdued">Credits</p>
                        <p className="meta-value">{balanceLoading ? "…" : (balanceCents ?? 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="profile-card profile-card-actions">
                    <div className="profile-card-header">
                      <div>
                        <p className="eyebrow">Billing actions</p>
                        <h3>Payments & history</h3>
                        <p className="subdued tiny">Open your Stripe billing portal for invoices and subscriptions.</p>
                      </div>
                      <CreditCard size={18} />
                    </div>
                    <div className="profile-action-list">
                      <button type="button" className="profile-action" onClick={handleOpenBillingPortal} disabled={portalLoading}>
                        <div>
                          <p className="label">{portalLoading ? "Opening portal…" : "Open billing portal"}</p>
                          <p className="tiny subdued">Manage cards, plan, and invoice history.</p>
                        </div>
                        <ArrowRight size={16} />
                      </button>
                      <button type="button" className="profile-action" onClick={() => refreshBalance()} disabled={balanceLoading}>
                        <div>
                          <p className="label">Refresh credits</p>
                          <p className="tiny subdued">Sync your latest credit balance from Supabase.</p>
                        </div>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="profile-plan-grid">
                  {packagesLoading ? (
                    <div className="profile-plan-card">
                      <p className="tiny subdued">Loading credit packages…</p>
                    </div>
                  ) : creditPackages.length === 0 ? (
                    <div className="profile-plan-card">
                      <p className="tiny subdued">No active credit packages are configured yet.</p>
                    </div>
                  ) : (
                    creditPackages.map((pkg) => (
                      <div key={pkg.id} className="profile-plan-card">
                        <div className="profile-plan-top">
                          <div>
                            <p className="tiny subdued">Credit package</p>
                            <h4>{pkg.display_name}</h4>
                          </div>
                          <CheckCircle size={18} />
                        </div>
                        <p className="meta-value">
                          {pkg.credit_amount_cents.toLocaleString()} <span className="tiny subdued">credits</span>
                        </p>
                        <p className="tiny subdued">
                          ${(pkg.price_cents / 100).toFixed(2)} one-time purchase
                        </p>
                        <div className="profile-actions">
                          <button
                            type="button"
                            className="profile-button primary-btn"
                            onClick={() => handleCheckout(pkg.id)}
                            disabled={checkoutLoadingId === pkg.id}
                          >
                            {checkoutLoadingId === pkg.id ? "Starting checkout…" : "Buy credits"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : null}
          </section>
        </section>

        {showLogoutConfirm ? (
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
        ) : null}
      </main>
    </>
  );
}
