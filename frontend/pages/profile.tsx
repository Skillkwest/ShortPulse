/**
 * Profile/account/billing page for authenticated users.
 * Provides account management, plan state, credit purchases, and billing portal actions.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowsClockwise,
  CheckCircle,
  CreditCard,
  Receipt,
  SignOut,
  Sparkle,
  Stack,
  UserCircle,
  WarningCircle,
} from "phosphor-react";
import {
  annotateCreditPackages,
  buildPlanView,
  type BillingPlanRecord,
  type CreditPackageRecord,
} from "../features/billing/catalog";
import { ProfilePreferenceToggleCard } from "../features/profile/components/ProfilePreferenceToggleCard";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import { useMediaAutosavePreference } from "../features/ai-studio/hooks/useMediaAutosavePreference";
import { fetchWithAuth } from "../lib/authenticatedFetch";
import { useProtectedRoute } from "../lib/authGuard";
import { ensureSupabaseClient, primeSupabaseSession } from "../lib/supabaseClient";

type ProfileSection = "account" | "subscription" | "billing";

type BillingProfile = {
  plan_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
};

type BillingLedgerEvent = {
  id: string;
  change_cents: number;
  reason: string;
  source: string | null;
  source_ref: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type NoticeTone = "info" | "success" | "error";

type NoticeState = {
  tone: NoticeTone;
  message: string;
};

const sections: { key: ProfileSection; label: string; icon: typeof UserCircle }[] = [
  { key: "account", label: "Account", icon: UserCircle },
  { key: "subscription", label: "Subscription", icon: Stack },
  { key: "billing", label: "Billing & credits", icon: CreditCard },
];

const formatCurrencyFromCents = (value: number) => `$${(value / 100).toFixed(2)}`;

const formatDateLabel = (value: string | null) => {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleDateString();
};

const formatDateTimeLabel = (value: string | null) => {
  if (!value) return "Unavailable";
  return new Date(value).toLocaleString();
};

const formatStatusLabel = (status: string | null) => {
  if (!status) return "Inactive";
  return status.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
};

const resolveLedgerReference = (event: BillingLedgerEvent) => {
  if (!event.metadata || typeof event.metadata !== "object") return event.source_ref;
  const metadata = event.metadata as Record<string, unknown>;
  const invoiceId = typeof metadata.invoice_id === "string" ? metadata.invoice_id : null;
  const checkoutSessionId =
    typeof metadata.checkout_session_id === "string" ? metadata.checkout_session_id : null;
  const packageId =
    typeof metadata.credit_package_id === "string" ? metadata.credit_package_id : null;
  return invoiceId ?? checkoutSessionId ?? packageId ?? event.source_ref;
};

const resolveLedgerLabel = (event: BillingLedgerEvent) => {
  if (event.source === "subscription_renewal") return "Subscription renewal";
  if (event.source === "stripe_checkout") return "Credit purchase";
  if (event.source === "signup_seed") return "Initial plan allocation";
  return "Billing activity";
};

export default function ProfilePage() {
  const router = useRouter();
  const { loading, user } = useProtectedRoute(true);
  const { balanceCents, balanceUpdatedAt, balanceLoading, refreshBalance } = useCredits();
  const {
    mediaAutosaveEnabled,
    loading: mediaAutosaveLoading,
    syncState: mediaAutosaveSyncState,
    error: mediaAutosaveError,
    setMediaAutosaveEnabled,
  } = useMediaAutosavePreference();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [, setCancelTargetPlan] = useState<string | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("User");
  const [workspaceEmail, setWorkspaceEmail] = useState("");
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null);
  const [billingProfileLoading, setBillingProfileLoading] = useState(false);
  const [billingPlans, setBillingPlans] = useState<BillingPlanRecord[]>([]);
  const [billingPlansLoading, setBillingPlansLoading] = useState(false);

  const [creditPackages, setCreditPackages] = useState<CreditPackageRecord[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);

  const [billingActivity, setBillingActivity] = useState<BillingLedgerEvent[]>([]);
  const [billingActivityLoading, setBillingActivityLoading] = useState(false);

  const [portalLoading, setPortalLoading] = useState(false);
  const [refreshingCredits, setRefreshingCredits] = useState(false);

  const section = useMemo<ProfileSection>(() => {
    const query = (router.query.section as string | undefined)?.toLowerCase();
    if (query === "profile") return "account";
    if (query === "account" || query === "subscription" || query === "billing")
      return query as ProfileSection;
    return "account";
  }, [router.query.section]);

  const checkoutStatus = useMemo(() => {
    const queryValue = router.query.checkout;
    return typeof queryValue === "string" ? queryValue.toLowerCase() : null;
  }, [router.query.checkout]);

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
        .select("plan_id, subscription_status, current_period_end, stripe_customer_id")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      setBillingProfile((data as BillingProfile | null) ?? null);
    } catch {
      setBillingProfile(null);
    } finally {
      setBillingProfileLoading(false);
    }
  };

  const loadBillingPlans = async () => {
    setBillingPlansLoading(true);
    try {
      const supabase = ensureSupabaseClient();
      const { data, error } = await supabase
        .from("billing_plans")
        .select("id, display_name, monthly_price_cents, monthly_credits_cents, is_active")
        .eq("is_active", true)
        .order("monthly_price_cents", { ascending: true });
      if (error) throw error;
      setBillingPlans(Array.isArray(data) ? (data as BillingPlanRecord[]) : []);
    } catch {
      setBillingPlans([]);
    } finally {
      setBillingPlansLoading(false);
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
      setCreditPackages(
        Array.isArray(data?.packages) ? (data.packages as CreditPackageRecord[]) : []
      );
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to load credit packages.",
      });
      setCreditPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  };

  const loadBillingActivity = async (currentUser: User) => {
    setBillingActivityLoading(true);
    try {
      const supabase = ensureSupabaseClient();
      const { data, error } = await supabase
        .from("ai_credit_ledger")
        .select("id, change_cents, reason, source, source_ref, metadata, created_at")
        .eq("user_id", currentUser.id)
        .in("source", ["stripe_checkout", "subscription_renewal", "signup_seed"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      setBillingActivity(Array.isArray(data) ? (data as BillingLedgerEvent[]) : []);
    } catch {
      // Legacy environments may not have source/source_ref columns yet.
      setBillingActivity([]);
    } finally {
      setBillingActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadBillingProfile(user);
    void loadBillingPlans();
    void loadCreditPackages();
    void loadBillingActivity(user);
  }, [user]);

  useEffect(() => {
    if (!router.isReady || !checkoutStatus) return;

    if (checkoutStatus === "success") {
      setNotice({
        tone: "success",
        message: "Credit purchase completed. Your balance is syncing now.",
      });
      void refreshBalance({ silent: true });
      if (user) {
        void loadBillingActivity(user);
      }
    }

    if (checkoutStatus === "cancel") {
      setNotice({ tone: "info", message: "Checkout canceled. No charge was made." });
    }

    const nextQuery = { ...router.query };
    delete nextQuery.checkout;
    void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true,
    });
  }, [checkoutStatus, refreshBalance, router, user]);

  const displayName = displayNameInput || user?.email || "User";
  const activePlan = buildPlanView({
    planId:
      (billingProfile?.plan_id as string | undefined) ??
      (user?.user_metadata?.plan as string | undefined),
    plans: billingPlans,
  });

  const planLabel = activePlan.displayName;
  const planClass = activePlan.className;
  const subscriptionStatus = billingProfile?.subscription_status ?? "inactive";
  const subscriptionStatusLabel = formatStatusLabel(subscriptionStatus);

  const nextBillingText =
    activePlan.monthlyPriceCents <= 0
      ? "None (Free plan)"
      : billingProfile?.current_period_end
        ? formatDateLabel(billingProfile.current_period_end)
        : "Not scheduled";

  const packageCards = useMemo(() => annotateCreditPackages(creditPackages), [creditPackages]);
  const mediaAutosaveSaving = mediaAutosaveSyncState === "saving";
  const mediaAutosaveDisabled = mediaAutosaveLoading || mediaAutosaveSaving;

  const handleSignOut = async () => {
    try {
      const supabase = ensureSupabaseClient();
      await supabase.auth.signOut();
      primeSupabaseSession(null);
      await router.replace("/auth");
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
      setNotice({ tone: "success", message: "Profile updated." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Profile update failed.",
      });
    }
  };

  const handleEmailUpdate = async () => {
    const nextEmail = workspaceEmail.trim();
    if (!nextEmail) {
      setNotice({ tone: "error", message: "Enter a valid email." });
      return;
    }

    try {
      const supabase = ensureSupabaseClient();
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      setNotice({
        tone: "success",
        message: "Email update requested. Check your inbox to confirm.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Email update failed.",
      });
    }
  };

  const handlePasswordReset = async () => {
    const email = workspaceEmail.trim() || user?.email;
    if (!email) {
      setNotice({ tone: "error", message: "No email is available for reset." });
      return;
    }

    try {
      const supabase = ensureSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setNotice({ tone: "success", message: "Password reset link sent." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Password reset failed.",
      });
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
      setNotice({
        tone: "error",
        message: "Checkout session created, but no redirect URL was returned.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to start checkout.",
      });
    } finally {
      setCheckoutLoadingId(null);
    }
  };

  const handleOpenBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const response = await fetchWithAuth("/api/billing/stripe/portal", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to open billing portal.");
      }
      if (data?.portalUrl) {
        window.location.href = data.portalUrl;
        return;
      }
      setNotice({ tone: "error", message: "Billing portal URL was not returned." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to open billing portal.",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleRefreshCredits = async () => {
    setRefreshingCredits(true);
    const previous = balanceCents ?? 0;
    const next = await refreshBalance();
    setRefreshingCredits(false);

    if (next === null) {
      setNotice({ tone: "error", message: "Unable to sync credits right now. Please try again." });
      return;
    }

    if (next === previous) {
      setNotice({
        tone: "info",
        message: `Credits synced. Balance is still ${next.toLocaleString()}.`,
      });
      return;
    }

    setNotice({
      tone: "success",
      message: `Credits updated from ${previous.toLocaleString()} to ${next.toLocaleString()}.`,
    });
  };

  const content = {
    account: {
      title: "Account settings",
      body: "Manage identity, email, and security controls for your workspace.",
    },
    subscription: {
      title: "Subscription plans",
      body: "Choose the plan that fits your content creation needs. Change or cancel anytime.",
    },
    billing: {
      title: "Billing & credits",
      body: "Manage subscriptions, top-ups, and billing history with clear cost controls.",
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
        <title>ShortPulse · Settings</title>
        <meta
          name="description"
          content="Manage account identity, security, subscription, and credits in ShortPulse."
        />
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
              <button
                type="button"
                className="ghost-btn profile-button"
                onClick={() => setShowLogoutConfirm(true)}
              >
                <SignOut size={16} />
                Log out
              </button>
            </div>
          </aside>

          <section className="profile-content profile-content-simple">
            <div className="profile-heading">
              <h1>{content.title}</h1>
              <p className="subdued">{content.body}</p>
              {notice ? (
                <p className={`tiny profile-notice profile-notice-${notice.tone}`} role="status">
                  {notice.message}
                </p>
              ) : null}
            </div>

            {section === "account" ? (
              <div className="profile-section-grid">
                <div className="profile-card">
                  <h3>Profile</h3>
                  <p className="tiny subdued">
                    This name appears in your dashboard and workspace views.
                  </p>
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
                    <button
                      type="button"
                      className="primary-btn profile-button"
                      onClick={handleProfileSave}
                    >
                      Save changes
                    </button>
                  </div>
                </div>

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
                    <button
                      type="button"
                      className="primary-btn profile-button"
                      onClick={handleEmailUpdate}
                    >
                      Update email
                    </button>
                  </div>
                </div>
                <div className="profile-card">
                  <h3>Security</h3>
                  <p className="tiny subdued">Send a password reset link to your email.</p>
                  <div className="profile-actions">
                    <button
                      type="button"
                      className="ghost-btn profile-button"
                      onClick={handlePasswordReset}
                    >
                      Send reset link
                    </button>
                  </div>
                </div>
                <ProfilePreferenceToggleCard
                  title="AI Studio autosave"
                  description="Control whether eligible generated and reference media are automatically saved to your Media Library."
                  enabled={mediaAutosaveEnabled}
                  disabled={mediaAutosaveDisabled}
                  saving={mediaAutosaveSaving}
                  error={mediaAutosaveError}
                  onToggle={setMediaAutosaveEnabled}
                  enabledHelperText="Autosave is ON. New eligible AI Studio media will save automatically."
                  disabledHelperText="Autosave is OFF. You can still save media manually from AI Studio."
                />
              </div>
            ) : null}

            {section === "subscription" ? (
              <>
                <details className="profile-billing-how">
                  <summary>How subscriptions work</summary>
                  <p>
                    Monthly plans include recurring credits. You can upgrade or downgrade anytime.
                    Upgrades take effect immediately with prorated charges. Downgrades apply at the
                    end of your billing period. Credits never expire.
                  </p>
                </details>

                <div className="profile-summary-grid">
                  <article className="profile-summary-card">
                    <p className="tiny subdued">Current plan</p>
                    <p className="summary-value">{planLabel}</p>
                    <p className="tiny subdued">{activePlan.description}</p>
                  </article>

                  <article className="profile-summary-card">
                    <p className="tiny subdued">Status</p>
                    <p className="summary-value small">{subscriptionStatusLabel}</p>
                    <p className="tiny subdued">
                      {billingProfile?.current_period_end
                        ? `Renews ${formatDateLabel(billingProfile.current_period_end)}`
                        : "No active subscription"}
                    </p>
                  </article>

                  <article className="profile-summary-card">
                    <p className="tiny subdued">Monthly credits</p>
                    <p className="summary-value">
                      {activePlan.monthlyCreditsCents.toLocaleString()}
                    </p>
                    <p className="tiny subdued">Renews automatically each billing cycle</p>
                  </article>
                </div>

                <div className="profile-card">
                  <div className="profile-card-header">
                    <div>
                      <p className="eyebrow">All plans</p>
                      <h3>Choose your subscription</h3>
                      <p className="subdued tiny">
                        Plans are billed monthly. Cancel or change anytime via Stripe portal.
                      </p>
                    </div>
                  </div>

                  <div className="profile-plan-grid">
                    {billingPlansLoading ? (
                      <div className="profile-plan-card">
                        <p className="tiny subdued">Loading plans…</p>
                      </div>
                    ) : billingPlans.length === 0 ? (
                      <div className="profile-plan-card">
                        <p className="tiny subdued">No active plans configured yet.</p>
                      </div>
                    ) : (
                      billingPlans.map((plan) => {
                        const planView = buildPlanView({ planId: plan.id, plans: billingPlans });
                        const isCurrentPlan = activePlan.id === plan.id;
                        const isHigherTier =
                          plan.monthly_price_cents > activePlan.monthlyPriceCents;
                        const isLowerTier = plan.monthly_price_cents < activePlan.monthlyPriceCents;
                        const isFree = plan.monthly_price_cents === 0;

                        // Badge logic
                        let badge = null;
                        if (isCurrentPlan) {
                          badge = "Current Plan";
                        } else if (plan.id === "media") {
                          badge = "Popular";
                        } else if (plan.id === "business") {
                          badge = "Best Value";
                        }

                        return (
                          <div
                            key={plan.id}
                            className={`profile-plan-card ${isCurrentPlan ? "current" : ""}`}
                          >
                            <div className="profile-plan-top">
                              <div>
                                <p className="tiny subdued">
                                  {isFree ? "Free tier" : "Monthly subscription"}
                                </p>
                                <h4>{planView.displayName}</h4>
                              </div>
                              {badge ? (
                                <span className="profile-plan-badge">{badge}</span>
                              ) : (
                                <CheckCircle size={18} />
                              )}
                            </div>

                            <p className="meta-value">
                              {formatCurrencyFromCents(plan.monthly_price_cents)}
                              <span className="tiny subdued"> / month</span>
                            </p>

                            <p className="tiny subdued">{planView.description}</p>

                            <div className="profile-divider" />

                            <div className="profile-card-footer">
                              <p className="tiny subdued">
                                <strong>{plan.monthly_credits_cents.toLocaleString()}</strong>{" "}
                                credits/month
                              </p>
                              <p className="tiny subdued">
                                <strong>{planView.seatsLabel}</strong>
                              </p>
                            </div>

                            <div className="profile-actions">
                              {isCurrentPlan ? (
                                <button type="button" className="profile-button ghost-btn" disabled>
                                  Current Plan
                                </button>
                              ) : isHigherTier ? (
                                <button
                                  type="button"
                                  className="profile-button primary-btn"
                                  onClick={handleOpenBillingPortal}
                                  disabled={portalLoading}
                                >
                                  {portalLoading
                                    ? "Opening portal…"
                                    : `Upgrade to ${planView.displayName}`}
                                </button>
                              ) : isLowerTier && !isFree ? (
                                <button
                                  type="button"
                                  className="profile-button ghost-btn"
                                  onClick={handleOpenBillingPortal}
                                  disabled={portalLoading}
                                >
                                  {portalLoading
                                    ? "Opening portal…"
                                    : `Downgrade to ${planView.displayName}`}
                                </button>
                              ) : isFree && !isCurrentPlan ? (
                                <button
                                  type="button"
                                  className="profile-button ghost-btn"
                                  onClick={() => {
                                    setCancelTargetPlan(plan.id);
                                    setShowCancelConfirm(true);
                                  }}
                                >
                                  Cancel subscription
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="profile-callout">
                  <WarningCircle size={18} />
                  <p className="tiny">
                    Plan changes are managed through Stripe&apos;s secure billing portal. Changes
                    sync automatically to your account.
                  </p>
                </div>
              </>
            ) : null}

            {section === "billing" ? (
              <>
                <details className="profile-billing-how">
                  <summary>How billing works</summary>
                  <p>
                    Plans are monthly subscriptions with recurring credits. Credit packs are
                    one-time top-ups. Every generation debits credits based on model cost, and your
                    balance syncs from Supabase in real time.
                  </p>
                </details>

                <div className="profile-summary-grid">
                  <article className="profile-summary-card">
                    <p className="tiny subdued">Current plan</p>
                    <p className="summary-value">{planLabel}</p>
                    <p className="tiny subdued">{activePlan.description}</p>
                    <div className="profile-summary-meta">
                      <span>{formatCurrencyFromCents(activePlan.monthlyPriceCents)} / month</span>
                      <span>•</span>
                      <span>{activePlan.monthlyCreditsCents.toLocaleString()} credits / month</span>
                    </div>
                  </article>

                  <article className="profile-summary-card">
                    <p className="tiny subdued">Credits</p>
                    <p className="summary-value">
                      {balanceLoading ? "…" : (balanceCents ?? 0).toLocaleString()}
                    </p>
                    <p className="tiny subdued">
                      Last synced: {formatDateTimeLabel(balanceUpdatedAt)}
                    </p>
                  </article>

                  <article className="profile-summary-card">
                    <p className="tiny subdued">Billing identity</p>
                    <p className="summary-value small">{user?.email ?? "No billing email"}</p>
                    <p className="tiny subdued">
                      {billingProfile?.stripe_customer_id
                        ? "Payment method managed in Stripe billing portal"
                        : "No payment method on file yet"}
                    </p>
                  </article>
                </div>

                <div className="profile-section-stack">
                  <div className="profile-card">
                    <div className="profile-card-header">
                      <div>
                        <p className="eyebrow">Subscription & invoices</p>
                        <h3>Manage subscription</h3>
                        <p className="subdued tiny">
                          Use Stripe portal for invoices, payment methods, and plan updates.
                        </p>
                      </div>
                      <span className="pill tiny pill-outline">{subscriptionStatusLabel}</span>
                    </div>

                    <div className="profile-metric-grid">
                      <div>
                        <p className="tiny subdued">Recurring price</p>
                        <p className="meta-value">
                          {formatCurrencyFromCents(activePlan.monthlyPriceCents)} / month
                        </p>
                      </div>
                      <div>
                        <p className="tiny subdued">Monthly credits</p>
                        <p className="meta-value">
                          {activePlan.monthlyCreditsCents.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="tiny subdued">Next billing</p>
                        <p className="meta-value">
                          {billingProfileLoading ? "…" : nextBillingText}
                        </p>
                      </div>
                      <div>
                        <p className="tiny subdued">Seats</p>
                        <p className="meta-value">{activePlan.seatsLabel}</p>
                      </div>
                    </div>

                    <div className="profile-actions">
                      <button
                        type="button"
                        className="profile-button primary-btn"
                        onClick={handleOpenBillingPortal}
                        disabled={portalLoading}
                      >
                        {portalLoading ? "Opening secure portal…" : "Open billing portal"}
                      </button>
                    </div>

                    <div className="profile-receipts">
                      <div className="profile-receipts-header">
                        <h4>Recent billing activity</h4>
                        <Receipt size={16} />
                      </div>

                      {billingActivityLoading ? (
                        <p className="tiny subdued">Loading activity…</p>
                      ) : null}

                      {!billingActivityLoading && billingActivity.length === 0 ? (
                        <p className="tiny subdued">No recent billing events yet.</p>
                      ) : null}

                      {!billingActivityLoading && billingActivity.length > 0 ? (
                        <ul className="profile-receipt-list">
                          {billingActivity.map((event) => {
                            const reference = resolveLedgerReference(event);
                            const amountLabel = `${event.change_cents > 0 ? "+" : ""}${event.change_cents.toLocaleString()} credits`;
                            return (
                              <li key={event.id} className="profile-receipt-item">
                                <div>
                                  <p className="label">{resolveLedgerLabel(event)}</p>
                                  <p className="tiny subdued">
                                    {formatDateTimeLabel(event.created_at)}
                                    {reference ? ` · Ref ${reference}` : ""}
                                  </p>
                                </div>
                                <p className="tiny">{amountLabel}</p>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  </div>

                  <div className="profile-card">
                    <div className="profile-card-header">
                      <div>
                        <p className="eyebrow">Credits & top-ups</p>
                        <h3>Buy credits</h3>
                        <p className="subdued tiny">
                          One-time purchases. Taxes may apply. Receipts are available in Stripe.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="profile-inline-action"
                        onClick={handleRefreshCredits}
                        disabled={refreshingCredits || balanceLoading}
                      >
                        <ArrowsClockwise size={15} />
                        {refreshingCredits ? "Syncing…" : "Refresh credits"}
                      </button>
                    </div>

                    <div className="profile-plan-grid">
                      {packagesLoading ? (
                        <div className="profile-plan-card">
                          <p className="tiny subdued">Loading credit packages…</p>
                        </div>
                      ) : packageCards.length === 0 ? (
                        <div className="profile-plan-card">
                          <p className="tiny subdued">
                            No active credit packages are configured yet.
                          </p>
                        </div>
                      ) : (
                        packageCards.map((pkg) => (
                          <div key={pkg.id} className="profile-plan-card">
                            <div className="profile-plan-top">
                              <div>
                                <p className="tiny subdued">Credit package</p>
                                <h4>{pkg.display_name}</h4>
                              </div>
                              {pkg.badge ? (
                                <span className="profile-plan-badge">{pkg.badge}</span>
                              ) : (
                                <CheckCircle size={18} />
                              )}
                            </div>

                            <p className="meta-value">
                              {pkg.credit_amount_cents.toLocaleString()}{" "}
                              <span className="tiny subdued">credits</span>
                            </p>
                            <p className="tiny subdued">
                              {formatCurrencyFromCents(pkg.price_cents)} one-time purchase
                            </p>
                            <p className="tiny subdued">{`$${pkg.unitUsdPerThousand.toFixed(2)} / 1,000 credits`}</p>

                            <div className="profile-actions">
                              <button
                                type="button"
                                className="profile-button primary-btn"
                                onClick={() => handleCheckout(pkg.id)}
                                aria-label={`Buy ${pkg.display_name} for ${formatCurrencyFromCents(pkg.price_cents)}`}
                                disabled={checkoutLoadingId === pkg.id}
                              >
                                {checkoutLoadingId === pkg.id
                                  ? "Starting checkout…"
                                  : "Buy credits"}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {billingPlansLoading ? (
                    <p className="tiny subdued">Loading catalog details…</p>
                  ) : null}
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
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  No
                </button>
                <button type="button" className="primary-btn" onClick={handleSignOut}>
                  Yes, log out
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showCancelConfirm ? (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3>Cancel subscription?</h3>
              <p className="subdued tiny">
                You&apos;ll be downgraded to the Free plan at the end of your current billing period
                ({formatDateLabel(billingProfile?.current_period_end ?? null)}). You&apos;ll lose
                access to:
              </p>
              <ul className="subdued tiny" style={{ marginLeft: "20px", marginTop: "8px" }}>
                <li>{activePlan.monthlyCreditsCents.toLocaleString()} monthly credits</li>
                <li>{activePlan.seatsLabel}</li>
              </ul>
              <p className="subdued tiny" style={{ marginTop: "12px" }}>
                Any unused credits will remain in your account. You can resubscribe anytime.
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setShowCancelConfirm(false);
                    setCancelTargetPlan(null);
                  }}
                >
                  Keep subscription
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    setShowCancelConfirm(false);
                    setCancelTargetPlan(null);
                    handleOpenBillingPortal();
                  }}
                >
                  Continue to billing portal
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
