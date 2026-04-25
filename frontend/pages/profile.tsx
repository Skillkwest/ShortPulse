/**
 * Profile/account/billing page for authenticated users.
 * Orchestrates account management, plan state, credit purchases, and billing portal actions.
 */
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CreditCard, HardDrives, Stack, UserCircle } from "phosphor-react";
import {
  annotateCreditPackages,
  buildPlanView,
  getPlanTierRank,
  type BillingPlanRecord,
  type BillingStorageAddonRecord,
  type CreditPackageRecord,
} from "../features/billing/catalog";
import { useMediaStorageQuotaSummary } from "../features/billing/useMediaStorageQuotaSummary";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import { useMediaAutosavePreference } from "../features/ai-studio/hooks/useMediaAutosavePreference";
import { ProfileAccountSection } from "../features/profile/components/ProfileAccountSection";
import { ProfileConfirmModal } from "../features/profile/components/ProfileConfirmModal";
import { ProfileCreditsSection } from "../features/profile/components/ProfileCreditsSection";
import { ProfileStorageSection } from "../features/profile/components/ProfileStorageSection";
import { ProfileSubscriptionSection } from "../features/profile/components/ProfileSubscriptionSection";
import { ProfileWorkspaceShell } from "../features/profile/components/ProfileWorkspaceShell";
import {
  formatDateLabel,
  formatStatusLabel,
  getProfileSectionContent,
  resolveContractDescriptor,
  resolveProfileActivePlanId,
  type BillingCatalogResponse,
  type BillingLedgerEvent,
  type BillingProfile,
  type BillingSubscriptionContract,
  type NoticeState,
  type ProfileSection,
  type ProfileSectionItem,
} from "../features/profile/profilePageModel";
import { fetchWithAuth } from "../lib/authenticatedFetch";
import { useProtectedRoute } from "../lib/authGuard";
import { trackBillingPricingViewed, trackBillingUpgradeClicked } from "../lib/growthTelemetry";
import { ensureSupabaseClient, primeSupabaseSession } from "../lib/supabaseClient";

const sections: readonly ProfileSectionItem[] = [
  { key: "account", label: "Account", icon: UserCircle },
  { key: "subscription", label: "Subscription", icon: Stack },
  { key: "credits", label: "Credits", icon: CreditCard },
  { key: "storage", label: "Media storage", icon: HardDrives },
];

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
  const [displayNameInput, setDisplayNameInput] = useState("User");
  const [workspaceEmail, setWorkspaceEmail] = useState("");
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null);
  const [, setBillingProfileLoading] = useState(false);
  const [billingContract, setBillingContract] = useState<BillingSubscriptionContract | null>(null);
  const [billingContractLoading, setBillingContractLoading] = useState(false);
  const [billingPlans, setBillingPlans] = useState<BillingPlanRecord[]>([]);
  const [billingPlansLoading, setBillingPlansLoading] = useState(false);
  const [storageAddons, setStorageAddons] = useState<BillingStorageAddonRecord[]>([]);

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
    if (query === "billing") return "credits";
    if (
      query === "account" ||
      query === "subscription" ||
      query === "credits" ||
      query === "storage"
    ) {
      return query;
    }
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

  const loadBillingContract = async (currentUser: User) => {
    setBillingContractLoading(true);
    try {
      const supabase = ensureSupabaseClient();
      const { data, error } = await supabase
        .from("billing_subscription_contracts")
        .select(
          "id, plan_id, offer_id, stripe_price_id, contract_source, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, status, current_period_start, current_period_end, cancel_at_period_end, started_at, ended_at"
        )
        .eq("user_id", currentUser.id)
        .is("ended_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setBillingContract((data as BillingSubscriptionContract | null) ?? null);
    } catch {
      setBillingContract(null);
    } finally {
      setBillingContractLoading(false);
    }
  };

  const loadBillingCatalog = async () => {
    setBillingPlansLoading(true);
    setPackagesLoading(true);
    try {
      const response = await fetchWithAuth("/api/billing/catalog", { method: "GET" });
      const data = (await response.json().catch(() => ({}))) as BillingCatalogResponse;
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load billing catalog.");
      }
      setBillingPlans(Array.isArray(data.plans) ? (data.plans as BillingPlanRecord[]) : []);
      setCreditPackages(
        Array.isArray(data.packages) ? (data.packages as CreditPackageRecord[]) : []
      );
      setStorageAddons(
        Array.isArray(data.storageAddons) ? (data.storageAddons as BillingStorageAddonRecord[]) : []
      );
    } catch (error) {
      setBillingPlans([]);
      setCreditPackages([]);
      setStorageAddons([]);
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to load billing catalog.",
      });
    } finally {
      setBillingPlansLoading(false);
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
      setBillingActivity([]);
    } finally {
      setBillingActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadBillingProfile(user);
    void loadBillingContract(user);
    void loadBillingCatalog();
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

  useEffect(() => {
    if (!user || section !== "credits") return;
    trackBillingPricingViewed({
      pricing_surface: "profile_billing",
    });
  }, [section, user]);

  const displayName = displayNameInput || user?.email || "User";
  const displayInitials = displayName.slice(0, 2).toUpperCase();
  const activePlan = buildPlanView({
    planId: resolveProfileActivePlanId({ billingContract, billingProfile }),
    plans: billingPlans,
  });
  const { quotaSummary } = useMediaStorageQuotaSummary({
    fallbackPlanId: activePlan.id,
  });

  const planLabel = activePlan.displayName;
  const subscriptionStatus =
    billingContract?.status ?? billingProfile?.subscription_status ?? "inactive";
  const subscriptionStatusLabel = formatStatusLabel(subscriptionStatus);
  const currentSubscriptionPriceCents =
    billingContract?.recurring_price_cents ?? activePlan.monthlyPriceCents;
  const currentSubscriptionCreditsCents =
    billingContract?.monthly_credits_cents ?? activePlan.monthlyCreditsCents;
  const currentSubscriptionStorageLimitBytes =
    billingContract?.storage_limit_bytes ?? activePlan.storageLimitBytes;
  const currentSubscriptionOfferId = billingContract?.offer_id ?? null;
  const isLegacyContract =
    billingContract !== null &&
    (currentSubscriptionPriceCents !== activePlan.monthlyPriceCents ||
      currentSubscriptionCreditsCents !== activePlan.monthlyCreditsCents);
  const activePlanRank = getPlanTierRank(activePlan.id, billingPlans);
  const contractDescriptor = resolveContractDescriptor({
    billingContract,
    billingProfile,
    isLegacyContract,
    hasOfferId: Boolean(currentSubscriptionOfferId),
  });
  const isInternalCompContract = billingContract?.contract_source === "internal_comp";
  const subscriptionRenewalText = isInternalCompContract
    ? "Managed internally"
    : billingContract?.current_period_end
      ? `Renews ${formatDateLabel(billingContract.current_period_end)}`
      : billingProfile?.current_period_end
        ? `Renews ${formatDateLabel(billingProfile.current_period_end)}`
        : "Not scheduled";

  const packageCards = useMemo(() => annotateCreditPackages(creditPackages), [creditPackages]);
  const activeAddonStorageBytes = quotaSummary?.addonLimitBytes ?? 0;
  const totalStorageLimitBytes =
    quotaSummary?.totalLimitBytes ?? currentSubscriptionStorageLimitBytes;
  const usedStorageBytes = quotaSummary?.usedBytes ?? 0;
  const mediaAutosaveSaving = mediaAutosaveSyncState === "saving";
  const mediaAutosaveDisabled = mediaAutosaveLoading || mediaAutosaveSaving;
  const content = getProfileSectionContent(section);
  const portalManagementAvailable = !isInternalCompContract;
  const billingIdentityDescription = portalManagementAvailable
    ? billingProfile?.stripe_customer_id
      ? "Payment method managed in Stripe billing portal"
      : "No payment method on file yet"
    : "Subscription managed internally outside Stripe";
  const portalActionLabel = portalManagementAvailable
    ? "Manage card, invoices, and subscription"
    : "Managed internally";

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
      const response = await fetchWithAuth("/api/account/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nextName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Profile update failed.");
      }

      const supabase = ensureSupabaseClient();
      void supabase.auth
        .refreshSession()
        .then((refreshResult) => {
          primeSupabaseSession(refreshResult.data.session ?? null);
        })
        .catch(() => {});
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
      const response = await fetchWithAuth("/api/account/email/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Email update failed.");
      }
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
    trackBillingUpgradeClicked({
      upgrade_surface: "profile_billing",
      upgrade_target: "credit_package",
      package_id: packageId,
    });
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
        <ProfileWorkspaceShell
          displayName={displayName}
          displayInitials={displayInitials}
          planLabel={planLabel}
          planClass={activePlan.className}
          subscriptionStatusLabel={subscriptionStatusLabel}
          workspaceEmail={workspaceEmail}
          section={section}
          sections={sections}
          title={content.title}
          body={content.body}
          notice={notice}
          onRequestLogout={() => setShowLogoutConfirm(true)}
        >
          {section === "account" ? (
            <ProfileAccountSection
              displayNameInput={displayNameInput}
              workspaceEmail={workspaceEmail}
              mediaAutosaveEnabled={mediaAutosaveEnabled}
              mediaAutosaveDisabled={mediaAutosaveDisabled}
              mediaAutosaveSaving={mediaAutosaveSaving}
              mediaAutosaveError={mediaAutosaveError}
              onDisplayNameInputChange={setDisplayNameInput}
              onWorkspaceEmailChange={setWorkspaceEmail}
              onProfileSave={handleProfileSave}
              onEmailUpdate={handleEmailUpdate}
              onPasswordReset={handlePasswordReset}
              onMediaAutosaveToggle={setMediaAutosaveEnabled}
            />
          ) : null}

          {section === "subscription" ? (
            <ProfileSubscriptionSection
              activePlan={activePlan}
              activePlanRank={activePlanRank}
              activeAddonStorageBytes={activeAddonStorageBytes}
              currentSubscriptionCreditsCents={currentSubscriptionCreditsCents}
              currentSubscriptionPriceCents={currentSubscriptionPriceCents}
              currentSubscriptionStorageLimitBytes={currentSubscriptionStorageLimitBytes}
              planLabel={planLabel}
              subscriptionStatusLabel={subscriptionStatusLabel}
              subscriptionRenewalText={subscriptionRenewalText}
              contractDescriptor={contractDescriptor}
              billingPlans={billingPlans}
              billingPlansLoading={billingPlansLoading}
              portalActionLabel={portalActionLabel}
              portalLoading={portalLoading}
              portalManagementAvailable={portalManagementAvailable}
              onOpenBillingPortal={handleOpenBillingPortal}
              onRequestCancel={() => setShowCancelConfirm(true)}
            />
          ) : null}

          {section === "credits" ? (
            <ProfileCreditsSection
              balanceCents={balanceCents}
              balanceLoading={balanceLoading}
              balanceUpdatedAt={balanceUpdatedAt}
              billingActivity={billingActivity}
              billingActivityLoading={billingActivityLoading}
              billingIdentityDescription={billingIdentityDescription}
              checkoutLoadingId={checkoutLoadingId}
              packageCards={packageCards}
              packagesLoading={packagesLoading}
              portalActionLabel={portalActionLabel}
              portalLoading={portalLoading}
              portalManagementAvailable={portalManagementAvailable}
              refreshingCredits={refreshingCredits}
              userEmail={user?.email}
              onCheckout={handleCheckout}
              onOpenBillingPortal={handleOpenBillingPortal}
              onRefreshCredits={handleRefreshCredits}
            />
          ) : null}

          {section === "storage" ? (
            <ProfileStorageSection
              activeAddonStorageBytes={activeAddonStorageBytes}
              billingContractLoading={billingContractLoading}
              billingPlansLoading={billingPlansLoading}
              currentSubscriptionStorageLimitBytes={currentSubscriptionStorageLimitBytes}
              planLabel={planLabel}
              portalActionLabel={portalActionLabel}
              portalLoading={portalLoading}
              portalManagementAvailable={portalManagementAvailable}
              storageAddons={storageAddons}
              totalStorageLimitBytes={totalStorageLimitBytes}
              usedStorageBytes={usedStorageBytes}
              onOpenBillingPortal={handleOpenBillingPortal}
            />
          ) : null}
        </ProfileWorkspaceShell>

        {showLogoutConfirm ? (
          <ProfileConfirmModal
            title="Are you sure?"
            cancelLabel="No"
            confirmLabel="Yes, log out"
            onCancel={() => setShowLogoutConfirm(false)}
            onConfirm={handleSignOut}
          >
            <p className="subdued tiny">You will be signed out of ShortPulse.</p>
          </ProfileConfirmModal>
        ) : null}

        {showCancelConfirm ? (
          <ProfileConfirmModal
            title="Cancel subscription?"
            cancelLabel="Keep subscription"
            confirmLabel="Continue to billing portal"
            onCancel={() => setShowCancelConfirm(false)}
            onConfirm={() => {
              setShowCancelConfirm(false);
              handleOpenBillingPortal();
            }}
          >
            <p className="subdued tiny">
              You&apos;ll be downgraded to the Free plan at the end of your current billing period (
              {formatDateLabel(billingProfile?.current_period_end ?? null)}). You&apos;ll lose
              access to:
            </p>
            <ul className="subdued tiny profile-modal-list">
              <li>{activePlan.monthlyCreditsCents.toLocaleString()} monthly credits</li>
              <li>{activePlan.seatsLabel}</li>
            </ul>
            <p className="subdued tiny profile-modal-copy">
              Any unused credits will remain in your account. You can resubscribe anytime.
            </p>
          </ProfileConfirmModal>
        ) : null}
      </main>
    </>
  );
}
