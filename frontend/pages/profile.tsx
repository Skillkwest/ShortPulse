/**
 * Profile/account/billing page for authenticated users.
 * Orchestrates account management, plan state, credit purchases, and billing portal actions.
 */
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CreditCard, HardDrives, Receipt, Stack, UserCircle } from "phosphor-react";
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
import { ProfileTransactionsSection } from "../features/profile/components/ProfileTransactionsSection";
import { ProfileWorkspaceShell } from "../features/profile/components/ProfileWorkspaceShell";
import {
  formatDateLabel,
  formatLongDateLabel,
  getProfileSectionContent,
  resolveProfileActivePlanId,
  resolveRecurringPaymentSummary,
  type BillingCatalogResponse,
  type BillingLedgerEvent,
  type BillingProfile,
  type BillingSubscriptionContract,
  type BillingSubscriptionStorageAddon,
  type NoticeState,
  type ProfileSection,
  type ProfileSectionItem,
  type SubscriptionTransaction,
} from "../features/profile/profilePageModel";
import { profileClass } from "../features/profile/profileRouteStyles";
import { formatStorageUsageValue } from "../features/billing/storage";
import { fetchWithAuth } from "../lib/authenticatedFetch";
import { fetchCanonicalAuthCallbackUrl } from "../lib/authRedirects";
import {
  resolveEmailChangeErrorMessage,
  resolvePasswordResetErrorMessage,
} from "../lib/authErrorMessages";
import { useProtectedRoute } from "../lib/authGuard";
import { trackBillingPricingViewed, trackBillingUpgradeClicked } from "../lib/growthTelemetry";
import {
  ensureSupabaseClient,
  refreshSupabaseSession,
  signOutSupabaseSession,
} from "../lib/supabaseClient";

const sections: readonly ProfileSectionItem[] = [
  { key: "account", label: "Account", icon: UserCircle },
  { key: "subscription", label: "Subscription", icon: Stack },
  { key: "credits", label: "Credits", icon: CreditCard },
  { key: "storage", label: "Media storage", icon: HardDrives },
  { key: "transactions", label: "Transactions", icon: Receipt },
];

const PROFILE_SUCCESS_NOTICE_AUTO_DISMISS_MS = 6000;

type BillingSyncScope = "credits" | "subscription" | "storage";

function resolveFallbackMonthlyRenewalDate(startedAt: string | null): string | null {
  if (!startedAt) return null;

  const startedDate = new Date(startedAt);
  if (Number.isNaN(startedDate.getTime())) return null;

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const anchorDay = startedDate.getUTCDate();
  const daysInCurrentMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const currentMonthDay = Math.min(anchorDay, daysInCurrentMonth);

  let renewalDate = new Date(
    Date.UTC(
      year,
      month,
      currentMonthDay,
      startedDate.getUTCHours(),
      startedDate.getUTCMinutes(),
      startedDate.getUTCSeconds(),
      startedDate.getUTCMilliseconds()
    )
  );

  if (renewalDate.getTime() <= now.getTime()) {
    const nextMonthDays = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
    renewalDate = new Date(
      Date.UTC(
        year,
        month + 1,
        Math.min(anchorDay, nextMonthDays),
        startedDate.getUTCHours(),
        startedDate.getUTCMinutes(),
        startedDate.getUTCSeconds(),
        startedDate.getUTCMilliseconds()
      )
    );
  }

  return renewalDate.toISOString();
}

export default function ProfilePage() {
  const router = useRouter();
  const { loading, user } = useProtectedRoute(true);
  const { balanceCents, balanceError, balanceUpdatedAt, balanceLoading, refreshBalance } =
    useCredits();
  const {
    mediaAutosaveEnabled,
    loading: mediaAutosaveLoading,
    syncState: mediaAutosaveSyncState,
    error: mediaAutosaveError,
    setMediaAutosaveEnabled,
  } = useMediaAutosavePreference();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingCancelPlanId, setPendingCancelPlanId] = useState<string | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("User");
  const [workspaceEmail, setWorkspaceEmail] = useState("");
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null);
  const [, setBillingProfileLoading] = useState(false);
  const [billingContract, setBillingContract] = useState<BillingSubscriptionContract | null>(null);
  const [billingContractLoading, setBillingContractLoading] = useState(false);
  const [billingPlans, setBillingPlans] = useState<BillingPlanRecord[]>([]);
  const [billingPlansLoading, setBillingPlansLoading] = useState(false);
  const [storageAddons, setStorageAddons] = useState<BillingStorageAddonRecord[]>([]);
  const [activeStorageAddons, setActiveStorageAddons] = useState<BillingSubscriptionStorageAddon[]>(
    []
  );

  const [creditPackages, setCreditPackages] = useState<CreditPackageRecord[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);

  const [billingActivity, setBillingActivity] = useState<BillingLedgerEvent[]>([]);
  const [billingActivityLoading, setBillingActivityLoading] = useState(false);
  const [subscriptionTransactions, setSubscriptionTransactions] = useState<
    SubscriptionTransaction[]
  >([]);
  const [subscriptionTransactionsLoading, setSubscriptionTransactionsLoading] = useState(false);
  const [subscriptionTransactionsError, setSubscriptionTransactionsError] = useState<string | null>(
    null
  );
  const [storageTransactions, setStorageTransactions] = useState<SubscriptionTransaction[]>([]);
  const [storageTransactionsLoading, setStorageTransactionsLoading] = useState(false);
  const [storageTransactionsError, setStorageTransactionsError] = useState<string | null>(null);
  const [allTransactions, setAllTransactions] = useState<SubscriptionTransaction[]>([]);
  const [allTransactionsLoading, setAllTransactionsLoading] = useState(false);
  const [allTransactionsError, setAllTransactionsError] = useState<string | null>(null);
  const pendingWorkspaceEmail = typeof user?.new_email === "string" ? user.new_email.trim() : "";

  const [portalLoading, setPortalLoading] = useState(false);
  const [planChangeLoadingPlanId, setPlanChangeLoadingPlanId] = useState<string | null>(null);
  const [storageAddonChangeLoadingId, setStorageAddonChangeLoadingId] = useState<string | null>(
    null
  );
  const [refreshingCredits, setRefreshingCredits] = useState(false);
  const [billingSyncRequest, setBillingSyncRequest] = useState<{
    scope: BillingSyncScope;
    key: number;
  } | null>(null);

  const section = useMemo<ProfileSection>(() => {
    const query = (router.query.section as string | undefined)?.toLowerCase();
    if (query === "profile") return "account";
    if (query === "billing") return "credits";
    if (
      query === "account" ||
      query === "subscription" ||
      query === "credits" ||
      query === "storage" ||
      query === "transactions"
    ) {
      return query;
    }
    return "account";
  }, [router.query.section]);

  const checkoutStatus = useMemo(() => {
    const queryValue = router.query.checkout;
    return typeof queryValue === "string" ? queryValue.toLowerCase() : null;
  }, [router.query.checkout]);

  const planChangeStatus = useMemo(() => {
    const queryValue = router.query.plan_change;
    return typeof queryValue === "string" ? queryValue.toLowerCase() : null;
  }, [router.query.plan_change]);

  const requestBillingSync = (scope: BillingSyncScope) => {
    setBillingSyncRequest({ scope, key: Date.now() });
  };

  useEffect(() => {
    const defaultName = user?.user_metadata?.full_name || user?.email || "User";
    setDisplayNameInput(defaultName);
    setWorkspaceEmail(user?.email || "");
  }, [user]);

  useEffect(() => {
    if (notice?.tone !== "success") return undefined;

    const timeoutId = window.setTimeout(() => {
      setNotice((currentNotice) => (currentNotice === notice ? null : currentNotice));
    }, PROFILE_SUCCESS_NOTICE_AUTO_DISMISS_MS);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const loadBillingProfile = async (currentUser: User) => {
    setBillingProfileLoading(true);
    try {
      const supabase = ensureSupabaseClient();
      const { data } = await supabase
        .from("billing_profiles")
        .select(
          "plan_id, subscription_status, current_period_end, stripe_customer_id, stripe_subscription_id"
        )
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
          "id, plan_id, offer_id, billing_interval, stripe_subscription_id, stripe_price_id, contract_source, recurring_price_cents, monthly_credits_cents, storage_limit_bytes, status, current_period_start, current_period_end, cancel_at_period_end, started_at, ended_at"
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
        .in("source", [
          "stripe_checkout",
          "subscription_renewal",
          "annual_contract_monthly_allocation",
          "signup_seed",
        ])
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

  const loadSubscriptionTransactions = async () => {
    setSubscriptionTransactionsLoading(true);
    setSubscriptionTransactionsError(null);
    try {
      const response = await fetchWithAuth("/api/billing/stripe/subscription-transactions", {
        method: "GET",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        transactions?: unknown[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load recent subscription payments.");
      }
      setSubscriptionTransactions(
        Array.isArray(payload.transactions)
          ? (payload.transactions as SubscriptionTransaction[])
          : []
      );
    } catch (error) {
      setSubscriptionTransactions([]);
      setSubscriptionTransactionsError(
        error instanceof Error ? error.message : "Unable to load recent subscription payments."
      );
    } finally {
      setSubscriptionTransactionsLoading(false);
    }
  };

  const loadStorageTransactions = async () => {
    setStorageTransactionsLoading(true);
    setStorageTransactionsError(null);
    try {
      const response = await fetchWithAuth(
        "/api/billing/stripe/subscription-transactions?kind=storage",
        {
          method: "GET",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        transactions?: unknown[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load recent storage payments.");
      }
      setStorageTransactions(
        Array.isArray(payload.transactions)
          ? (payload.transactions as SubscriptionTransaction[])
          : []
      );
    } catch (error) {
      setStorageTransactions([]);
      setStorageTransactionsError(
        error instanceof Error ? error.message : "Unable to load recent storage payments."
      );
    } finally {
      setStorageTransactionsLoading(false);
    }
  };

  const loadAllTransactions = async () => {
    setAllTransactionsLoading(true);
    setAllTransactionsError(null);
    try {
      const response = await fetchWithAuth("/api/billing/stripe/transactions", {
        method: "GET",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        transactions?: unknown[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load recent transactions.");
      }
      setAllTransactions(
        Array.isArray(payload.transactions)
          ? (payload.transactions as SubscriptionTransaction[])
          : []
      );
    } catch (error) {
      setAllTransactions([]);
      setAllTransactionsError(
        error instanceof Error ? error.message : "Unable to load recent transactions."
      );
    } finally {
      setAllTransactionsLoading(false);
    }
  };

  const loadActiveStorageAddons = async (currentUser: User) => {
    try {
      const supabase = ensureSupabaseClient();
      const { data, error } = await supabase
        .from("billing_subscription_storage_addons")
        .select(
          "id, storage_addon_id, offer_id, stripe_subscription_item_id, storage_limit_bytes, quantity, recurring_price_cents, status"
        )
        .eq("user_id", currentUser.id)
        .is("ended_at", null)
        .eq("status", "active");
      if (error) throw error;
      const nextAddons = Array.isArray(data)
        ? data
            .map((row) => {
              if (!row || typeof row !== "object") return null;
              const typedRow = row as Record<string, unknown>;
              const id = typeof typedRow.id === "string" ? typedRow.id : "";
              const storageAddonId =
                typeof typedRow.storage_addon_id === "string" ? typedRow.storage_addon_id : "";
              if (!id || !storageAddonId) return null;
              return {
                id,
                storageAddonId,
                offerId: typeof typedRow.offer_id === "string" ? typedRow.offer_id : null,
                stripeSubscriptionItemId:
                  typeof typedRow.stripe_subscription_item_id === "string"
                    ? typedRow.stripe_subscription_item_id
                    : null,
                storageLimitBytes: Number(typedRow.storage_limit_bytes ?? 0) || 0,
                quantity: Math.max(1, Number(typedRow.quantity ?? 1) || 1),
                recurringPriceCents: Number(typedRow.recurring_price_cents ?? 0) || 0,
                status: typeof typedRow.status === "string" ? typedRow.status : null,
              } satisfies BillingSubscriptionStorageAddon;
            })
            .filter((row): row is BillingSubscriptionStorageAddon => Boolean(row))
        : [];
      setActiveStorageAddons(nextAddons);
    } catch {
      setActiveStorageAddons([]);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadBillingProfile(user);
    void loadBillingContract(user);
    void loadBillingCatalog();
    void loadBillingActivity(user);
    void loadActiveStorageAddons(user);
  }, [user]);

  useEffect(() => {
    if (!user || section !== "subscription") return;
    void loadSubscriptionTransactions();
  }, [section, user]);

  useEffect(() => {
    if (!user || section !== "storage") return;
    void loadStorageTransactions();
  }, [section, user]);

  useEffect(() => {
    if (!user || section !== "transactions") return;
    void loadAllTransactions();
  }, [section, user]);

  const activePlan = buildPlanView({
    planId: resolveProfileActivePlanId({ billingContract, billingProfile }),
    plans: billingPlans,
  });
  const { quotaSummary, refreshQuotaSummary } = useMediaStorageQuotaSummary({
    fallbackPlanId: activePlan.id,
  });

  useEffect(() => {
    if (!billingSyncRequest || !user) return;

    const requestKey = billingSyncRequest.key;
    let cancelled = false;
    let timeoutId: number | null = null;

    const runSyncAttempt = async (attempt: number) => {
      const refreshTasks: Promise<unknown>[] = [];

      if (billingSyncRequest.scope === "credits") {
        refreshTasks.push(refreshBalance({ silent: true }));
        refreshTasks.push(loadBillingActivity(user));
      } else {
        refreshTasks.push(loadBillingProfile(user));
        refreshTasks.push(loadBillingContract(user));
        refreshTasks.push(loadBillingActivity(user));
        refreshTasks.push(refreshQuotaSummary());

        if (billingSyncRequest.scope === "subscription") {
          refreshTasks.push(loadSubscriptionTransactions());
        }

        if (billingSyncRequest.scope === "storage") {
          refreshTasks.push(loadActiveStorageAddons(user));
          refreshTasks.push(loadStorageTransactions());
        }
      }

      await Promise.allSettled(refreshTasks);

      if (cancelled) return;

      if (attempt >= 2) {
        setBillingSyncRequest((current) => (current?.key === requestKey ? null : current));
        return;
      }

      timeoutId = window.setTimeout(() => {
        void runSyncAttempt(attempt + 1);
      }, 1500);
    };

    void runSyncAttempt(0);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [billingSyncRequest, refreshBalance, refreshQuotaSummary, user]);

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
      requestBillingSync("credits");
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
    if (!router.isReady || !planChangeStatus) return;

    if (planChangeStatus === "checkout_success") {
      setNotice({
        tone: "success",
        message: "Subscription checkout completed. Your plan is syncing now.",
      });
      requestBillingSync("subscription");
    } else if (planChangeStatus === "checkout_cancel") {
      setNotice({
        tone: "info",
        message: "Plan change canceled. No charge was made.",
      });
    } else if (planChangeStatus === "updated") {
      setNotice({
        tone: "success",
        message: "Plan change submitted. Your subscription is syncing now.",
      });
      requestBillingSync("subscription");
    } else if (planChangeStatus === "canceled") {
      setNotice({
        tone: "success",
        message: "Downgrade requested. Stripe will update your subscription shortly.",
      });
      requestBillingSync("subscription");
    } else if (planChangeStatus === "switched_free") {
      setNotice({
        tone: "success",
        message: "Your paid plan has ended.",
      });
      requestBillingSync("subscription");
    }

    const nextQuery = { ...router.query };
    delete nextQuery.plan_change;
    void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true,
    });
  }, [planChangeStatus, router]);

  useEffect(() => {
    if (!user || section !== "credits") return;
    trackBillingPricingViewed({
      pricing_surface: "profile_billing",
    });
  }, [section, user]);

  const currentSubscriptionPriceCents =
    billingContract?.recurring_price_cents ?? activePlan.monthlyPriceCents;
  const currentSubscriptionBillingInterval =
    billingContract?.billing_interval === "year" ? "year" : "month";
  const currentSubscriptionCreditsCents =
    billingContract?.monthly_credits_cents ?? activePlan.monthlyCreditsCents;
  const currentSubscriptionStorageLimitBytes =
    billingContract?.storage_limit_bytes ?? activePlan.storageLimitBytes;
  const nextCreditRenewalAt =
    billingContract?.current_period_end ?? billingProfile?.current_period_end ?? null;
  const activePlanRank = getPlanTierRank(activePlan.id, billingPlans);
  const isInternalCompContract = billingContract?.contract_source === "internal_comp";
  const resolvedSubscriptionRenewalAt =
    billingContract?.current_period_end ??
    billingProfile?.current_period_end ??
    (isInternalCompContract
      ? resolveFallbackMonthlyRenewalDate(billingContract?.started_at ?? null)
      : null);
  const subscriptionRenewalText = resolvedSubscriptionRenewalAt
    ? formatLongDateLabel(resolvedSubscriptionRenewalAt)
    : "Not scheduled";

  const packageCards = useMemo(() => annotateCreditPackages(creditPackages), [creditPackages]);
  const activeAddonStorageBytes = quotaSummary?.addonLimitBytes ?? 0;
  const activeAddonRecurringPriceCents = activeStorageAddons.reduce(
    (total, addon) => total + Math.max(0, addon.recurringPriceCents),
    0
  );
  const recurringPaymentSummary = resolveRecurringPaymentSummary({
    baseRecurringPriceCents: currentSubscriptionPriceCents,
    billingInterval: currentSubscriptionBillingInterval,
    activeAddonRecurringPriceCents,
    isInternalCompContract,
  });
  const totalStorageLimitBytes =
    quotaSummary?.totalLimitBytes ?? currentSubscriptionStorageLimitBytes;
  const usedStorageBytes = quotaSummary?.usedBytes ?? 0;
  const mediaAutosaveSaving = mediaAutosaveSyncState === "saving";
  const mediaAutosaveDisabled = mediaAutosaveLoading || mediaAutosaveSaving;
  const content = getProfileSectionContent(section);
  const accountCreditsLabel = balanceLoading
    ? "Syncing"
    : balanceCents == null
      ? "Unavailable"
      : balanceCents.toLocaleString();
  const accountStorageLabel = formatStorageUsageValue(usedStorageBytes, totalStorageLimitBytes);
  const portalManagementAvailable = !isInternalCompContract;
  const stripeManagedSubscriptionId =
    billingContract?.stripe_subscription_id ?? billingProfile?.stripe_subscription_id ?? null;
  const storageAddonManagementState:
    | "eligible"
    | "requires_paid_plan"
    | "syncing"
    | "managed_internally" = isInternalCompContract
    ? "managed_internally"
    : stripeManagedSubscriptionId
      ? "eligible"
      : activePlan.id === "free"
        ? "requires_paid_plan"
        : "syncing";
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
      await signOutSupabaseSession();
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

      const savedDisplayName =
        typeof data?.displayName === "string" && data.displayName.trim().length > 0
          ? data.displayName.trim()
          : nextName;
      void refreshSupabaseSession({ preserveSnapshotOnError: true }).catch(() => null);
      setDisplayNameInput(savedDisplayName);
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
    if (!currentPasswordInput.trim()) {
      setNotice({ tone: "error", message: "Enter your current password." });
      return;
    }

    try {
      const response = await fetchWithAuth("/api/account/email/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail, currentPassword: currentPasswordInput }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Email update failed.");
      }
      void refreshSupabaseSession({ preserveSnapshotOnError: true }).catch(() => null);
      setCurrentPasswordInput("");
      setNotice({
        tone: "success",
        message: "Email update requested. Check your inbox to confirm.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: resolveEmailChangeErrorMessage(error, "Email update failed."),
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
      const redirectTo =
        (await fetchCanonicalAuthCallbackUrl({
          flow: "recovery",
          nextPath: `${window.location.pathname}${window.location.search}`,
        })) ?? null;
      if (!redirectTo) {
        throw new Error(
          "Unable to resolve the public password reset link destination. Please try again in a moment."
        );
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
      setNotice({ tone: "success", message: "Password reset link sent." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: resolvePasswordResetErrorMessage(error, "Password reset failed."),
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

  const handleSubscriptionPlanChange = async (
    targetPlanId: string,
    billingInterval: "month" | "year"
  ) => {
    setPlanChangeLoadingPlanId(targetPlanId);
    trackBillingUpgradeClicked({
      upgrade_surface: "profile_billing",
      upgrade_target: "subscription_plan",
      current_plan_id: activePlan.id,
      plan_id: targetPlanId,
    });
    try {
      const response = await fetchWithAuth("/api/billing/subscription/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlanId, billingInterval }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to start the subscription change.");
      }
      if (typeof data?.redirectUrl === "string" && data.redirectUrl.length > 0) {
        window.location.href = data.redirectUrl;
        return;
      }
      setNotice({
        tone: "error",
        message: "Subscription change started, but no redirect URL was returned.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to start the subscription change.",
      });
    } finally {
      setPlanChangeLoadingPlanId(null);
    }
  };

  const handleRefreshCredits = async () => {
    setRefreshingCredits(true);
    const previous = balanceCents;
    const next = await refreshBalance();
    setRefreshingCredits(false);

    if (next === null) {
      setNotice({ tone: "error", message: "Unable to sync credits right now. Please try again." });
      return;
    }
    if (previous != null && next === previous) {
      setNotice({
        tone: "info",
        message: `Credits synced. Balance is still ${next.toLocaleString()}.`,
      });
      return;
    }
    if (previous == null) {
      setNotice({
        tone: "success",
        message: `Credits synced. Balance is ${next.toLocaleString()}.`,
      });
      return;
    }
    setNotice({
      tone: "success",
      message: `Credits updated from ${previous.toLocaleString()} to ${next.toLocaleString()}.`,
    });
  };

  const handleStorageAddonChange = async ({
    storageAddonId,
    action,
  }: {
    storageAddonId: string;
    action: "add" | "remove";
  }) => {
    if (!user) return;

    setStorageAddonChangeLoadingId(storageAddonId);
    try {
      const response = await fetchWithAuth("/api/billing/storage-addon/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageAddonId, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to update recurring storage.");
      }

      setNotice({
        tone: "success",
        message:
          typeof data?.message === "string" && data.message.trim()
            ? data.message
            : "Storage add-on update submitted. Stripe is syncing your workspace now.",
      });

      await Promise.allSettled([
        loadBillingProfile(user),
        loadBillingContract(user),
        loadActiveStorageAddons(user),
        loadStorageTransactions(),
      ]);
      void refreshQuotaSummary();
      requestBillingSync("storage");
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to update recurring storage.",
      });
    } finally {
      setStorageAddonChangeLoadingId(null);
    }
  };

  if (loading) {
    return (
      <main
        className={profileClass(
          "page",
          "page-wide",
          "dashboard-refresh",
          "profile-page",
          "profile-page-shell"
        )}
      >
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

      <main
        className={profileClass(
          "page",
          "page-wide",
          "dashboard-refresh",
          "profile-page",
          "profile-page-shell"
        )}
      >
        <ProfileWorkspaceShell
          planLabel={activePlan.displayName}
          paymentLabel={recurringPaymentSummary.primaryLabel}
          paymentHelper={recurringPaymentSummary.shortHelperLabel}
          creditsLabel={accountCreditsLabel}
          storageLabel={accountStorageLabel}
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
              currentPasswordInput={currentPasswordInput}
              pendingWorkspaceEmail={pendingWorkspaceEmail}
              mediaAutosaveEnabled={mediaAutosaveEnabled}
              mediaAutosaveDisabled={mediaAutosaveDisabled}
              mediaAutosaveSaving={mediaAutosaveSaving}
              mediaAutosaveError={mediaAutosaveError}
              onDisplayNameInputChange={setDisplayNameInput}
              onWorkspaceEmailChange={setWorkspaceEmail}
              onCurrentPasswordInputChange={setCurrentPasswordInput}
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
              currentSubscriptionBillingInterval={currentSubscriptionBillingInterval}
              currentSubscriptionPriceCents={currentSubscriptionPriceCents}
              currentSubscriptionStorageLimitBytes={currentSubscriptionStorageLimitBytes}
              recurringPaymentLabel={recurringPaymentSummary.primaryLabel}
              recurringPaymentHelper={recurringPaymentSummary.breakdownLabel}
              subscriptionRenewalText={subscriptionRenewalText}
              billingPlans={billingPlans}
              billingPlansLoading={billingPlansLoading}
              isInternalCompContract={isInternalCompContract}
              planChangeLoadingPlanId={planChangeLoadingPlanId}
              subscriptionTransactions={subscriptionTransactions}
              subscriptionTransactionsLoading={subscriptionTransactionsLoading}
              subscriptionTransactionsError={subscriptionTransactionsError}
              onRequestPlanChange={handleSubscriptionPlanChange}
              onRequestCancel={setPendingCancelPlanId}
            />
          ) : null}

          {section === "credits" ? (
            <ProfileCreditsSection
              activePlanClassName={activePlan.className}
              balanceCents={balanceCents}
              balanceError={balanceError}
              balanceLoading={balanceLoading}
              balanceUpdatedAt={balanceUpdatedAt}
              nextCreditRenewalAmount={currentSubscriptionCreditsCents}
              nextCreditRenewalAt={nextCreditRenewalAt}
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
              onCheckout={handleCheckout}
              onOpenBillingPortal={handleOpenBillingPortal}
              onRefreshCredits={handleRefreshCredits}
            />
          ) : null}

          {section === "storage" ? (
            <ProfileStorageSection
              activeAddonStorageBytes={activeAddonStorageBytes}
              activePlanClassName={activePlan.className}
              activeStorageAddons={activeStorageAddons}
              billingContractLoading={billingContractLoading}
              billingPlansLoading={billingPlansLoading}
              currentSubscriptionStorageLimitBytes={currentSubscriptionStorageLimitBytes}
              storageAddonChangeLoadingId={storageAddonChangeLoadingId}
              storageAddonManagementState={storageAddonManagementState}
              storageAddons={storageAddons}
              storageTransactions={storageTransactions}
              storageTransactionsError={storageTransactionsError}
              storageTransactionsLoading={storageTransactionsLoading}
              totalStorageLimitBytes={totalStorageLimitBytes}
              usedStorageBytes={usedStorageBytes}
              onStorageAddonChange={handleStorageAddonChange}
            />
          ) : null}

          {section === "transactions" ? (
            <ProfileTransactionsSection
              portalActionLabel={portalActionLabel}
              portalLoading={portalLoading}
              portalManagementAvailable={portalManagementAvailable}
              transactions={allTransactions}
              transactionsError={allTransactionsError}
              transactionsLoading={allTransactionsLoading}
              userEmail={user?.email}
              onOpenBillingPortal={handleOpenBillingPortal}
            />
          ) : null}
        </ProfileWorkspaceShell>

        {showLogoutConfirm ? (
          <ProfileConfirmModal
            title="Log out?"
            confirmLabel="Log out"
            onCancel={() => setShowLogoutConfirm(false)}
            onConfirm={handleSignOut}
          >
            <p>You will be signed out of ShortPulse.</p>
          </ProfileConfirmModal>
        ) : null}

        {pendingCancelPlanId ? (
          <ProfileConfirmModal
            title={isInternalCompContract ? "End paid access?" : "Manage your downgrade?"}
            confirmLabel={isInternalCompContract ? "End paid access" : "Continue to Stripe"}
            onCancel={() => setPendingCancelPlanId(null)}
            onConfirm={() => {
              const nextPlanId = pendingCancelPlanId;
              setPendingCancelPlanId(null);
              if (nextPlanId) {
                handleSubscriptionPlanChange(nextPlanId, currentSubscriptionBillingInterval);
              }
            }}
          >
            <p>
              {isInternalCompContract
                ? "Ending paid access changes the workspace immediately. Unused credits stay available."
                : `Your paid subscription ends after ${formatDateLabel(
                    billingContract?.current_period_end ??
                      billingProfile?.current_period_end ??
                      null
                  )}. Unused credits stay available until then.`}
            </p>
          </ProfileConfirmModal>
        ) : null}
      </main>
    </>
  );
}
