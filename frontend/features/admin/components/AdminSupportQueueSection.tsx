/**
 * Admin support queue section.
 * Handles user lookup, row selection, credit adjustment, and recent ledger inspection.
 */
import { type CSSProperties, useRef, useState } from "react";
import Link from "next/link";
import { CaretDown, Check, CopySimple, X } from "phosphor-react";
import {
  ADMIN_DASHBOARD_ADJUSTMENT_PRESETS,
  ADMIN_DASHBOARD_USER_SORT_OPTIONS,
  type AdminDashboardUserSort,
} from "../logic/useAdminUsersCreditsController";
import { copyToClipboard } from "../logic/copyToClipboard";
import { formatStorageBytes } from "../../billing/storage";
import type {
  AdminBillingDiagnosticsResponse,
  AdminCreditLedgerRow,
  AdminPagination,
  AdminUserRow,
} from "../types";
import styles from "../../../styles/admin.module.css";

type AdminSupportQueueSectionProps = {
  userSearch: string;
  userSort: AdminDashboardUserSort;
  usersPagination: AdminPagination;
  userSearchLimited: boolean;
  users: AdminUserRow[];
  usersLoading: boolean;
  usersError: string | null;
  currentAdminUserId: string;
  currentAdminEmail: string;
  selectedUserId: string;
  selectedUser: AdminUserRow | null;
  adjustment: string;
  adjustSubmitting: boolean;
  adjustResult: string | null;
  billingOverrideSubmitting: boolean;
  billingOverrideResult: string | null;
  billingPortalSubmitting: boolean;
  billingPortalResult: string | null;
  billingCustomerSyncSubmitting: boolean;
  billingCustomerSyncResult: string | null;
  creditLedgerRows: AdminCreditLedgerRow[];
  creditLedgerLoading: boolean;
  creditLedgerError: string | null;
  creditLedgerLoaded: boolean;
  billingDiagnostics: AdminBillingDiagnosticsResponse | null;
  billingDiagnosticsLoading: boolean;
  billingDiagnosticsError: string | null;
  billingDiagnosticsLoaded: boolean;
  usersResultStart: number;
  usersResultEnd: number;
  setSelectedUserId: (value: string) => void;
  loadUsers: () => Promise<void>;
  loadCreditLedger: () => Promise<void>;
  handleUserSearchChange: (value: string) => void;
  handleUserSortChange: (value: AdminDashboardUserSort) => void;
  handlePreviousUsersPage: () => void;
  handleNextUsersPage: () => void;
  handleAdjustmentChange: (value: string) => void;
  applyAdjustmentPreset: (delta: number) => void;
  handleCreditAdjust: () => Promise<void>;
  handleGrantInternalComp: () => Promise<boolean>;
  handleRevokeInternalComp: () => Promise<boolean>;
  handleOpenSelectedUserBilling: () => Promise<void>;
  handleSyncSelectedUserBillingCustomer: () => Promise<void>;
  planLabel: (planId: string | null) => string;
  formatCreditDelta: (changeCents: number) => string;
  formatUsd: (value: number | null) => string;
};

type CreditLedgerCycleGroup = {
  key: string;
  label: string;
  detail: string;
  rows: AdminCreditLedgerRow[];
  netChangeCents: number;
};

const USER_SORT_LABELS: Record<AdminDashboardUserSort, string> = {
  default: "Default order",
  email_asc: "Email A-Z",
  email_desc: "Email Z-A",
  subscribed_first: "Subscribed first",
  unsubscribed_first: "Not subscribed first",
  plan_tier: "Plan tier",
  renewal_soon: "Renewal soonest",
  renewal_latest: "Renewal latest",
  spendable_low: "Spendable low",
  spendable_high: "Spendable high",
  empty_credits_first: "Empty credits first",
  joined_newest: "Joined newest",
  joined_oldest: "Joined oldest",
};

function formatStatusLabel(value: string | null | undefined): string {
  if (!value) return "Inactive";
  return value
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBillingStatusLabel(
  row: Pick<AdminUserRow, "subscriptionStatus" | "cancelAtPeriodEnd">
): string {
  if (row.cancelAtPeriodEnd) return "Pending cancellation";
  const status = String(row.subscriptionStatus ?? "")
    .trim()
    .toLowerCase();
  if (status === "canceled" || status === "cancelled") {
    return "Canceled";
  }
  return formatStatusLabel(row.subscriptionStatus);
}

function billingStatusTone(
  row: Pick<AdminUserRow, "subscriptionStatus" | "cancelAtPeriodEnd">
): "active" | "warning" | "canceled" | "neutral" {
  if (row.cancelAtPeriodEnd) return "warning";
  const status = String(row.subscriptionStatus ?? "")
    .trim()
    .toLowerCase();
  if (status === "active") return "active";
  if (status === "canceled" || status === "cancelled") return "canceled";
  return "neutral";
}

function hasActivePaidSubscription(
  row: Pick<
    AdminUserRow,
    | "billingSource"
    | "contractSource"
    | "planId"
    | "recurringPriceCents"
    | "subscriptionStatus"
    | "cancelAtPeriodEnd"
  >
): boolean {
  if (row.contractSource === "internal_comp") return false;
  if (row.billingSource !== "subscription_contract") return false;
  if (row.planId === "free" || row.planId === "baseline" || !row.planId) return false;
  if (row.recurringPriceCents == null || row.recurringPriceCents <= 0) return false;

  const status = String(row.subscriptionStatus ?? "")
    .trim()
    .toLowerCase();
  return row.cancelAtPeriodEnd || status === "active" || status === "trialing";
}

function accessPlanTone(
  planId: string | null | undefined
): "baseline" | "starter" | "media" | "studio" | "business" | "neutral" {
  const normalized = String(planId ?? "")
    .trim()
    .toLowerCase();
  if (!normalized || normalized === "free" || normalized === "baseline") return "baseline";
  if (normalized === "starter") return "starter";
  if (normalized === "media") return "media";
  if (normalized === "studio") return "studio";
  if (normalized === "business") return "business";
  return "neutral";
}

function pickPositiveNumber(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (value != null && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

function formatRecurringPriceLabel(
  valueCents: number | null | undefined,
  billingInterval: "month" | "year" | null | undefined,
  formatUsd: (value: number | null) => string
): string | null {
  if (valueCents == null) return null;
  return `${formatUsd(valueCents / 100)}/${billingInterval === "year" ? "yr" : "mo"}`;
}

function formatCompactDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function addMonthsUtc(value: Date, months: number): Date {
  const target = new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth() + months,
      1,
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds()
    )
  );
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(value.getUTCDate(), daysInTargetMonth));
  return target;
}

function formatLedgerCycleDetail(start: Date, endExclusive: Date): string {
  const endInclusive = new Date(endExclusive.getTime() - 1);
  return `${formatCompactDate(start.toISOString())} - ${formatCompactDate(
    endInclusive.toISOString()
  )}`;
}

function resolveLedgerCycleWindow(
  createdAt: string | null,
  selectedUser: AdminUserRow | null
): { key: string; label: string; detail: string; sortAt: number } {
  const createdDate = createdAt ? new Date(createdAt) : null;
  const transactionDate =
    createdDate && Number.isFinite(createdDate.getTime()) ? createdDate : new Date(0);
  const renewalDate = selectedUser?.planRenewalAt ? new Date(selectedUser.planRenewalAt) : null;
  const hasRenewalAnchor = renewalDate && Number.isFinite(renewalDate.getTime());

  if (hasRenewalAnchor) {
    const cycleMonths = selectedUser?.billingInterval === "year" ? 12 : 1;
    let endExclusive = renewalDate;
    let start = addMonthsUtc(endExclusive, -cycleMonths);

    for (let index = 0; transactionDate >= endExclusive && index < 240; index += 1) {
      start = endExclusive;
      endExclusive = addMonthsUtc(endExclusive, cycleMonths);
    }
    for (let index = 0; transactionDate < start && index < 240; index += 1) {
      endExclusive = start;
      start = addMonthsUtc(endExclusive, -cycleMonths);
    }

    return {
      key: `${start.toISOString()}::${endExclusive.toISOString()}`,
      label: "Billing cycle",
      detail: formatLedgerCycleDetail(start, endExclusive),
      sortAt: start.getTime(),
    };
  }

  const start = new Date(
    Date.UTC(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth(), 1)
  );
  const endExclusive = addMonthsUtc(start, 1);
  return {
    key: `${start.toISOString()}::${endExclusive.toISOString()}`,
    label: transactionDate.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    }),
    detail: "Calendar-month group",
    sortAt: start.getTime(),
  };
}

function buildCreditLedgerCycleGroups(
  rows: AdminCreditLedgerRow[],
  selectedUser: AdminUserRow | null
): CreditLedgerCycleGroup[] {
  const groups = new Map<string, CreditLedgerCycleGroup & { sortAt: number }>();

  for (const row of rows) {
    const cycle = resolveLedgerCycleWindow(row.createdAt, selectedUser);
    const existing = groups.get(cycle.key);
    if (existing) {
      existing.rows.push(row);
      existing.netChangeCents += row.changeCents;
      continue;
    }

    groups.set(cycle.key, {
      key: cycle.key,
      label: cycle.label,
      detail: cycle.detail,
      rows: [row],
      netChangeCents: row.changeCents,
      sortAt: cycle.sortAt,
    });
  }

  return Array.from(groups.values())
    .sort((left, right) => right.sortAt - left.sortAt)
    .map((group) => ({
      key: group.key,
      label: group.label,
      detail: group.detail,
      netChangeCents: group.netChangeCents,
      rows: [...group.rows].sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime;
      }),
    }));
}

function formatExpiringCreditsSnapshot(
  row: Pick<AdminUserRow, "expiringCredits" | "nextExpiresAt">
): { value: string; helper?: string } {
  if (row.expiringCredits <= 0) return { value: "None" };
  return {
    value: row.expiringCredits.toLocaleString(),
    helper: row.nextExpiresAt ? formatCompactDate(row.nextExpiresAt) : "No date",
  };
}

function resolveBillingIdentityStateLabel(params: {
  contractSource: "stripe" | "internal_comp" | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}): string {
  if (params.contractSource === "internal_comp") {
    return params.stripeCustomerId ? "Internal comp + Stripe customer" : "Internal comp only";
  }
  if (params.stripeSubscriptionId) {
    return "Stripe subscription";
  }
  if (params.stripeCustomerId) {
    return "Stripe customer only";
  }
  return "No Stripe billing";
}

function accountFindingToneClassName(
  severity: AdminBillingDiagnosticsResponse["findings"][number]["severity"]
): string {
  if (severity === "critical") return styles.accountStatusRowCritical;
  if (severity === "warning") return styles.accountStatusRowWarning;
  return styles.accountStatusRowOk;
}

function accountSnapshotPlanValueClassName(tone: ReturnType<typeof accessPlanTone>): string {
  if (tone === "baseline") return styles.accountSnapshotCardValuePlanBaseline;
  if (tone === "starter") return styles.accountSnapshotCardValuePlanStarter;
  if (tone === "media") return styles.accountSnapshotCardValuePlanMedia;
  if (tone === "studio") return styles.accountSnapshotCardValuePlanStudio;
  if (tone === "business") return styles.accountSnapshotCardValuePlanBusiness;
  return styles.accountSnapshotCardValuePlanNeutral;
}

function accountSnapshotStatusValueClassName(tone: ReturnType<typeof billingStatusTone>): string {
  if (tone === "active") return styles.adminSupportBillingStatusActive;
  if (tone === "warning") return styles.adminSupportBillingStatusWarning;
  if (tone === "canceled") return styles.adminSupportBillingStatusCanceled;
  return styles.adminSupportBillingStatusNeutral;
}

/**
 * Renders the main admin support workflow without carrying unrelated incident/broadcast tooling.
 */
export function AdminSupportQueueSection({
  userSearch,
  userSort,
  usersPagination,
  userSearchLimited,
  users,
  usersLoading,
  usersError,
  selectedUserId,
  selectedUser,
  adjustment,
  adjustSubmitting,
  adjustResult,
  billingOverrideSubmitting,
  billingOverrideResult,
  billingPortalSubmitting,
  billingPortalResult,
  billingCustomerSyncSubmitting,
  billingCustomerSyncResult,
  creditLedgerRows,
  creditLedgerLoading,
  creditLedgerError,
  creditLedgerLoaded,
  billingDiagnostics,
  billingDiagnosticsLoading,
  billingDiagnosticsError,
  billingDiagnosticsLoaded,
  usersResultStart,
  usersResultEnd,
  setSelectedUserId,
  loadUsers,
  loadCreditLedger,
  handleUserSearchChange,
  handleUserSortChange,
  handlePreviousUsersPage,
  handleNextUsersPage,
  handleAdjustmentChange,
  applyAdjustmentPreset,
  handleCreditAdjust,
  handleGrantInternalComp,
  handleRevokeInternalComp,
  handleOpenSelectedUserBilling,
  handleSyncSelectedUserBillingCustomer,
  planLabel,
  formatCreditDelta,
  formatUsd,
}: AdminSupportQueueSectionProps) {
  type SnapshotCard = {
    key: string;
    value: string;
    label: string;
    helper?: string;
    testId: string;
    valueClassName?: string;
  };
  type AccountStatusItem = {
    key: string;
    label: string;
    value: string;
    detail: string | null;
    toneClassName: string;
  };

  const selectedAccountSectionRef = useRef<HTMLElement | null>(null);
  const [ledgerUserId, setLedgerUserId] = useState<string | null>(null);
  const [copiedEmailUserId, setCopiedEmailUserId] = useState<string | null>(null);
  const [copyFailedEmailUserId, setCopyFailedEmailUserId] = useState<string | null>(null);
  const [paymentExemptDraft, setPaymentExemptDraft] = useState<{
    userId: string;
    value: boolean;
  } | null>(null);
  const [stripeBillingExpanded, setStripeBillingExpanded] = useState(false);
  const [supportFindingsExpanded, setSupportFindingsExpanded] = useState(false);
  const [creditsAccessExpanded, setCreditsAccessExpanded] = useState(false);
  const ledgerVisible = Boolean(selectedUserId) && ledgerUserId === selectedUserId;
  const creditLedgerCycleGroups = buildCreditLedgerCycleGroups(creditLedgerRows, selectedUser);
  const selectedUserPriceLabel = formatRecurringPriceLabel(
    selectedUser?.recurringPriceCents,
    selectedUser?.billingInterval,
    formatUsd
  );
  const billingFindings = billingDiagnostics?.findings ?? [];
  const snapshotStatus = billingDiagnostics?.stripeSubscription?.subscriptionId
    ? billingDiagnostics.stripeSubscription.status
    : selectedUser?.subscriptionStatus;
  const snapshotContractSource =
    billingDiagnostics?.currentContract?.contractSource ?? selectedUser?.contractSource ?? null;
  const snapshotStorageSummary = billingDiagnostics?.storageSummary ?? null;
  const snapshotStorageTotalBytes = pickPositiveNumber(
    snapshotStorageSummary?.totalLimitBytes,
    billingDiagnostics?.currentContract?.storageLimitBytes,
    billingDiagnostics?.linkedOffer?.storageLimitBytes,
    billingDiagnostics?.currentPublicOffer?.storageLimitBytes
  );
  const snapshotStorageLabel =
    snapshotStorageTotalBytes != null ? formatStorageBytes(snapshotStorageTotalBytes) : null;
  const snapshotStorageUsedLabel =
    snapshotStorageSummary != null ? formatStorageBytes(snapshotStorageSummary.usedBytes) : null;
  const snapshotPriceLabel =
    billingDiagnostics?.stripeSubscription?.subscriptionId &&
    billingDiagnostics.stripeSubscription.recurringPriceCents != null
      ? formatRecurringPriceLabel(
          billingDiagnostics.stripeSubscription.recurringPriceCents,
          billingDiagnostics.stripeSubscription.billingInterval ??
            billingDiagnostics.currentContract?.billingInterval ??
            selectedUser?.billingInterval,
          formatUsd
        )
      : selectedUserPriceLabel;
  const snapshotMonthlyCredits =
    billingDiagnostics?.currentContract?.monthlyCreditsCents ??
    billingDiagnostics?.linkedOffer?.monthlyCreditsCents ??
    billingDiagnostics?.currentPublicOffer?.monthlyCreditsCents ??
    selectedUser?.monthlyCreditsCents ??
    null;
  const snapshotAccountStatus = selectedUser?.subscriptionStatus ?? snapshotStatus ?? null;
  const snapshotStatusLabel = formatStatusLabel(snapshotAccountStatus);
  const snapshotCancellationScheduled = Boolean(
    selectedUser?.cancelAtPeriodEnd ?? billingDiagnostics?.currentContract?.cancelAtPeriodEnd
  );
  const snapshotBillingStateLabel = snapshotCancellationScheduled
    ? "Pending cancellation"
    : snapshotStatusLabel;
  const snapshotBillingStatusTone = billingStatusTone({
    subscriptionStatus: snapshotAccountStatus,
    cancelAtPeriodEnd: snapshotCancellationScheduled,
  });
  const selectedUserAccessPlanTone = accessPlanTone(selectedUser?.planId);
  const visibleBillingFindings = billingFindings.filter(
    (finding) => finding.code !== "internal_comp_contract"
  );
  const pricingObservability = billingDiagnostics?.pricingObservability ?? null;
  const pricingObservabilityCoverageLabel = pricingObservability
    ? `${pricingObservability.observedRows.reservations}/${pricingObservability.rowsScanned.reservations} reservation rows · ${pricingObservability.observedRows.ledgerEntries}/${pricingObservability.rowsScanned.ledgerEntries} ledger rows`
    : null;
  const showPricingObservabilityCard =
    pricingObservability != null && pricingObservability.mismatchCount > 0;
  const snapshotStripeCustomerId = billingDiagnostics?.billingProfile?.stripeCustomerId ?? null;
  const snapshotStripeSubscriptionId =
    billingDiagnostics?.stripeSubscription?.subscriptionId ??
    billingDiagnostics?.billingProfile?.stripeSubscriptionId ??
    null;
  const billingIdentityStateLabel = resolveBillingIdentityStateLabel({
    contractSource: snapshotContractSource,
    stripeCustomerId: snapshotStripeCustomerId,
    stripeSubscriptionId: snapshotStripeSubscriptionId,
  });
  const authIdentityDisplayName = billingDiagnostics?.authIdentity?.displayName ?? null;
  const stripeCustomerName = billingDiagnostics?.stripeCustomer?.name ?? null;
  const stripeCustomerEmail = billingDiagnostics?.stripeCustomer?.email ?? null;
  const snapshotRenewalAt =
    billingDiagnostics?.stripeSubscription?.currentPeriodEnd ??
    billingDiagnostics?.currentContract?.currentPeriodEnd ??
    null;
  const snapshotExpiringCredits = selectedUser
    ? formatExpiringCreditsSnapshot(selectedUser)
    : { value: "None" };
  const snapshotCards: SnapshotCard[] = selectedUser
    ? (
        [
          {
            key: "plan",
            label: "Access",
            value: planLabel(selectedUser.planId),
            testId: "snapshot-card-plan",
            valueClassName: accountSnapshotPlanValueClassName(selectedUserAccessPlanTone),
          },
          {
            key: "subscription",
            label: "Subscription",
            value: snapshotPriceLabel ?? "—",
            testId: "snapshot-card-price",
          },
          snapshotStorageLabel
            ? {
                key: "storage",
                label: "Storage",
                value: snapshotStorageUsedLabel ?? "—",
                helper: `/ ${snapshotStorageLabel}`,
                testId: "snapshot-card-storage",
              }
            : null,
          {
            key: "credits",
            value: selectedUser.spendableCredits.toLocaleString(),
            helper:
              snapshotMonthlyCredits != null
                ? `/ ${snapshotMonthlyCredits.toLocaleString()}`
                : undefined,
            label: "Spendable",
            testId: "snapshot-card-credits",
          },
          {
            key: "expiring-credits",
            value: snapshotExpiringCredits.value,
            helper: snapshotExpiringCredits.helper,
            label: "Expiring credits",
            testId: "snapshot-card-expiring-credits",
          },
          {
            key: "billing-state",
            label: "Account status",
            value:
              snapshotContractSource === "internal_comp"
                ? "Payment exempt"
                : snapshotBillingStateLabel,
            testId: "snapshot-card-billing-state",
            valueClassName: accountSnapshotStatusValueClassName(snapshotBillingStatusTone),
          },
          {
            key: "renewal",
            label: snapshotCancellationScheduled ? "Access ends" : "Next renewal",
            value: snapshotRenewalAt ? formatCompactDate(snapshotRenewalAt) : "No renewal",
            testId: "snapshot-card-renewal",
          },
          {
            key: "joined",
            label: "Joined",
            value: formatCompactDate(selectedUser.createdAt),
            testId: "snapshot-card-joined",
          },
        ] as Array<SnapshotCard | null>
      ).filter((card): card is SnapshotCard => card !== null)
    : [];
  const hasLoadedUsers = users.length > 0;
  const selectedAccountState = !selectedUserId
    ? usersError
      ? {
          eyebrow: "User index unavailable",
          title: "We could not load the support queue",
          description: usersError,
          helper:
            "Retry the user list below after access or network issues clear. The selected-account workspace will re-open once a row is available again.",
        }
      : usersLoading && !hasLoadedUsers
        ? null
        : userSearch.trim() && !hasLoadedUsers
          ? {
              eyebrow: "No matches",
              title: "No accounts matched this search",
              description: `No users matched “${userSearch.trim()}”.`,
              helper:
                "Try a broader email fragment or clear the search to return to the full support queue.",
            }
          : !hasLoadedUsers
            ? {
                eyebrow: "No accounts loaded",
                title: "No accounts are available in this result set",
                description:
                  "The support queue is empty for the current page and filters, so there is no account to inspect yet.",
                helper:
                  "Refresh the queue or move to a different page once accounts are available again.",
              }
            : {
                eyebrow: "Choose an account",
                title: "Pick an account from the queue below",
                description:
                  "Select a user to open credits, billing access, Stripe controls, and recent support context.",
                helper: "Rows follow the natural user index order for the current page and search.",
              }
    : null;
  const effectivePaymentExemptPlanId =
    selectedUser?.planId === "media" ||
    selectedUser?.planId === "studio" ||
    selectedUser?.planId === "business"
      ? selectedUser.planId
      : "business";
  const effectivePaymentExemptPlanLabel = planLabel(effectivePaymentExemptPlanId);
  const paymentExemptEnabled =
    paymentExemptDraft?.userId === selectedUserId
      ? paymentExemptDraft.value
      : snapshotContractSource === "internal_comp";
  const paymentExemptNote = paymentExemptEnabled
    ? `Manual ${effectivePaymentExemptPlanLabel} access without Stripe billing.`
    : selectedUser?.planId === "free" || !selectedUser?.planId
      ? `Enable this to grant ${effectivePaymentExemptPlanLabel} access without Stripe billing.`
      : `Enable this to keep the ${effectivePaymentExemptPlanLabel} plan active without Stripe billing.`;
  const accountStatusItems: AccountStatusItem[] = selectedUserId
    ? [
        {
          key: "billing-state",
          label: "Account status",
          value:
            snapshotContractSource === "internal_comp"
              ? "Payment exempt"
              : snapshotBillingStateLabel,
          detail: snapshotCancellationScheduled
            ? snapshotRenewalAt
              ? `Access ends ${formatCompactDate(snapshotRenewalAt)}.`
              : "Cancellation is scheduled."
            : snapshotRenewalAt
              ? `Current billing period ends ${formatCompactDate(snapshotRenewalAt)}.`
              : "No active billing cycle.",
          toneClassName:
            snapshotCancellationScheduled || snapshotBillingStateLabel !== "Active"
              ? styles.accountStatusRowWarning
              : styles.accountStatusRowActive,
        },
        {
          key: "billing-identity",
          label: "Billing identity",
          value: billingIdentityStateLabel,
          detail:
            snapshotContractSource === "internal_comp" && snapshotStripeCustomerId
              ? "Internal-comp account still has historical Stripe customer linkage."
              : snapshotStripeSubscriptionId
                ? "Stripe subscription linkage is present."
                : snapshotStripeCustomerId
                  ? "Stripe customer linkage is present without an active subscription id."
                  : "No Stripe billing identity is linked.",
          toneClassName:
            snapshotContractSource === "internal_comp" && snapshotStripeCustomerId
              ? styles.accountStatusRowWarning
              : styles.accountStatusRowOk,
        },
        {
          key: "payment-exempt",
          label: "Payment exempt",
          value: paymentExemptEnabled ? "Enabled" : "Disabled",
          detail: paymentExemptNote,
          toneClassName: paymentExemptEnabled
            ? styles.accountStatusRowOk
            : styles.accountStatusRowNeutral,
        },
      ]
    : [];
  const handleShowLedger = async () => {
    if (!selectedUserId) return;
    setLedgerUserId(selectedUserId);
    if (!creditLedgerLoaded && !creditLedgerLoading) {
      await loadCreditLedger();
    }
  };

  const handlePaymentExemptToggle = async (nextChecked: boolean) => {
    if (!selectedUserId || billingOverrideSubmitting) return;
    const previousValue = paymentExemptEnabled;
    setPaymentExemptDraft({
      userId: selectedUserId,
      value: nextChecked,
    });
    const saved = nextChecked ? await handleGrantInternalComp() : await handleRevokeInternalComp();
    if (!saved) {
      setPaymentExemptDraft({
        userId: selectedUserId,
        value: previousValue,
      });
    }
  };

  const handleCopyUserEmail = async (row: AdminUserRow) => {
    if (!row.email) return;

    const copied = await copyToClipboard(row.email);
    setCopiedEmailUserId(copied ? row.id : null);
    setCopyFailedEmailUserId(copied ? null : row.id);

    window.setTimeout(() => {
      setCopiedEmailUserId((current) => (current === row.id ? null : current));
      setCopyFailedEmailUserId((current) => (current === row.id ? null : current));
    }, 1600);
  };

  const scrollSelectedAccountIntoView = () => {
    const target = selectedAccountSectionRef.current;
    const scrollIntoView = target?.scrollIntoView;
    if (!target || typeof scrollIntoView !== "function") return;

    window.setTimeout(() => {
      const prefersReducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollIntoView.call(target, {
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
        inline: "nearest",
      });
    }, 0);
  };

  const handleSelectUserRow = (userId: string) => {
    setStripeBillingExpanded(false);
    setSupportFindingsExpanded(false);
    setCreditsAccessExpanded(false);
    setSelectedUserId(userId);
    scrollSelectedAccountIntoView();
  };

  return (
    <section
      ref={selectedAccountSectionRef}
      className={`${styles.adminSection} ${styles.adminSupportDetailsSection}`}
    >
      <div className={styles.accountControlsHeader}>
        <p className="eyebrow">Account controls</p>
        <h2 className={styles.adminSectionTitle}>Selected account</h2>
      </div>
      <div
        className={styles.adminSelectedAccountWorkspace}
        data-credit-ledger-layout="inline-before-credits-access"
        data-testid="selected-account-workspace"
      >
        <section className={`${styles.adminSubpanel} ${styles.adminPrimaryPanel}`}>
          {usersLoading && !hasLoadedUsers && !selectedUserId ? (
            <p className={styles.selectedAccountLoadingText}>Loading selected account…</p>
          ) : selectedAccountState ? (
            <div className={styles.adminStatePanel}>
              <p className={styles.adminStateEyebrow}>{selectedAccountState.eyebrow}</p>
              <h3 className={styles.adminStateTitle}>{selectedAccountState.title}</h3>
              <p className={styles.adminStateDescription}>{selectedAccountState.description}</p>
              {selectedAccountState.helper ? (
                <p className={styles.adminStateDescriptionMuted}>{selectedAccountState.helper}</p>
              ) : null}
            </div>
          ) : (
            <>
              <div className={styles.accountSnapshotHead}>
                <div className={styles.accountSnapshotIdentity}>
                  <div className={styles.accountSnapshotTitleRow}>
                    <span className={styles.accountSnapshotTitle}>
                      {selectedUser?.email ??
                        selectedUser?.id ??
                        "Select an account from the list below"}
                    </span>
                  </div>
                </div>
                <div className={styles.accountSnapshotHeadAside}>
                  {selectedUserId ? (
                    <div className={styles.tabRow}>
                      <Link
                        href={`/admin/stats?customerId=${encodeURIComponent(selectedUserId)}`}
                        className={`ghost-btn mini ${styles.manualAdjustSecondaryAction}`}
                      >
                        Open analytics
                      </Link>
                      <button
                        type="button"
                        className={`ghost-btn mini ${styles.manualAdjustSecondaryAction}`}
                        onClick={() => {
                          void handleShowLedger();
                        }}
                        disabled={!selectedUserId || creditLedgerLoading || ledgerVisible}
                      >
                        {creditLedgerLoading
                          ? "Loading log…"
                          : ledgerVisible
                            ? "Credit log open"
                            : "Open full credit log"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              {snapshotCards.length > 0 ? (
                <div
                  className={styles.accountSnapshotCards}
                  data-testid="snapshot-plan-card"
                  style={
                    {
                      "--snapshot-card-columns": snapshotCards.length,
                    } as CSSProperties
                  }
                >
                  {snapshotCards.map((card) => (
                    <article
                      key={card.key}
                      className={styles.accountSnapshotCard}
                      data-testid={card.testId}
                    >
                      <span className={styles.accountSnapshotCardLabel}>{card.label}</span>
                      <span
                        className={`${styles.accountSnapshotCardValue} ${
                          card.valueClassName ?? ""
                        }`.trim()}
                      >
                        {card.value}
                      </span>
                      {card.helper ? (
                        <span className={styles.accountSnapshotCardHelper}>{card.helper}</span>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}

              {ledgerVisible ? (
                <section
                  className={`${styles.creditLedgerPanel} ${styles.creditLedgerInlinePanel}`}
                  data-testid="credit-ledger-panel"
                >
                  <div className={styles.adminSectionHead}>
                    <div>
                      <p className="eyebrow">Credit transaction log</p>
                      <p className="tiny subdued">
                        All transactions for the selected account, grouped by billing cycle.
                      </p>
                    </div>
                    <div className={styles.tabRow}>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => void loadCreditLedger()}
                        disabled={creditLedgerLoading || !selectedUserId}
                      >
                        {creditLedgerLoading ? "Refreshing…" : "Refresh log"}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => setLedgerUserId(null)}
                      >
                        Hide
                      </button>
                    </div>
                  </div>

                  {creditLedgerError ||
                  !selectedUserId ||
                  !creditLedgerLoaded ||
                  creditLedgerRows.length === 0 ? (
                    <div className={`${styles.adminTable} ${styles.adminLedgerTable}`}>
                      <div className={styles.adminLedgerHead}>
                        <span>Time</span>
                        <span>Source</span>
                        <span>Change</span>
                        <span>Pricing</span>
                        <span>Reason / Ref</span>
                      </div>
                      <div className={styles.adminLedgerRow}>
                        <span className="subdued">
                          {creditLedgerError
                            ? creditLedgerError
                            : !selectedUserId
                              ? "Pick a user to inspect transactions."
                              : !creditLedgerLoaded
                                ? "Load the full ledger for this user."
                                : "No credit transactions found."}
                        </span>
                        <span className="subdued">—</span>
                        <span className="subdued">—</span>
                        <span className="subdued">—</span>
                        <span className="subdued">—</span>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.creditLedgerScroll} data-testid="credit-ledger-scroll">
                      {creditLedgerCycleGroups.map((group) => (
                        <section key={group.key} className={styles.ledgerCycleGroup}>
                          <div className={styles.ledgerCycleHeader}>
                            <div>
                              <p className={styles.ledgerCycleTitle}>{group.label}</p>
                              <p className={styles.ledgerCycleDetail}>{group.detail}</p>
                            </div>
                            <div className={styles.ledgerCycleStats}>
                              <span
                                className={
                                  group.netChangeCents < 0
                                    ? styles.ledgerChangeDebit
                                    : styles.ledgerChangeCredit
                                }
                              >
                                Net {formatCreditDelta(group.netChangeCents)}
                              </span>
                              <span>
                                {group.rows.length} transaction{group.rows.length === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>
                          <div className={`${styles.adminTable} ${styles.adminLedgerTable}`}>
                            <div className={styles.adminLedgerHead}>
                              <span>Time</span>
                              <span>Source</span>
                              <span>Change</span>
                              <span>Pricing</span>
                              <span>Reason / Ref</span>
                            </div>
                            {group.rows.map((row) => (
                              <div
                                key={row.id}
                                className={`${styles.adminLedgerRow} ${
                                  row.changeCents < 0
                                    ? styles.adminLedgerRowDebit
                                    : styles.adminLedgerRowCredit
                                }`}
                              >
                                <span className={styles.ledgerTime}>
                                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                                </span>
                                <span className={styles.ledgerSourceCell}>
                                  <span className={`${styles.ledgerSource} mono`}>
                                    {row.source}
                                  </span>
                                </span>
                                <span
                                  className={
                                    row.changeCents < 0
                                      ? styles.ledgerChangeDebit
                                      : styles.ledgerChangeCredit
                                  }
                                >
                                  {formatCreditDelta(row.changeCents)}
                                </span>
                                <span className={styles.ledgerPricing}>
                                  {row.pricingBreakdown ? (
                                    <>
                                      <span className={styles.ledgerPricingLine}>
                                        billed {row.pricingBreakdown.billedCredits ?? "—"} cr (
                                        {formatUsd(row.pricingBreakdown.billedUsd)})
                                      </span>
                                      <span className={styles.ledgerPricingLine}>
                                        raw {row.pricingBreakdown.rawCredits ?? "—"} cr (
                                        {formatUsd(row.pricingBreakdown.usdRaw)})
                                      </span>
                                    </>
                                  ) : (
                                    <span className="subdued">—</span>
                                  )}
                                </span>
                                <span className={styles.ledgerReason}>
                                  <span>{row.reason || "—"}</span>
                                  {row.sourceRef ? (
                                    <span className={styles.ledgerRef}>ref: {row.sourceRef}</span>
                                  ) : null}
                                </span>
                              </div>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              <div className={styles.manualAdjustPanel}>
                <button
                  type="button"
                  className={styles.adminStripeBillingToggle}
                  onClick={() => setCreditsAccessExpanded((current) => !current)}
                  aria-expanded={creditsAccessExpanded}
                  aria-controls="admin-credits-access-details"
                >
                  <span>
                    <span className={styles.panelTitle}>Credits & access</span>
                  </span>
                  <CaretDown
                    size={16}
                    weight="bold"
                    className={`${styles.adminStripeBillingToggleIcon} ${
                      creditsAccessExpanded ? styles.adminStripeBillingToggleIconExpanded : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {creditsAccessExpanded ? (
                  <div id="admin-credits-access-details" className={styles.adminStripeBillingBody}>
                    <div className={styles.compactControlStack}>
                      <div className={styles.compactControlSection}>
                        <div className={styles.panelHeaderRow}>
                          <h4 className={styles.compactControlTitle}>Credits</h4>
                          {adjustResult ? (
                            <span className={styles.inlineResult}>{adjustResult}</span>
                          ) : null}
                        </div>

                        <div className={styles.creditAdjustmentInputRow}>
                          <label
                            className={`${styles.manualAdjustField} ${styles.controlFieldCompact}`}
                          >
                            <input
                              className={styles.searchInput}
                              type="text"
                              aria-label="Credit change"
                              value={adjustment}
                              pattern="[+-]?[0-9]*"
                              inputMode="numeric"
                              autoComplete="off"
                              onChange={(event) => handleAdjustmentChange(event.target.value)}
                              placeholder="+500 credits or -100 credits"
                              disabled={!selectedUserId}
                            />
                          </label>

                          <div className={styles.compactControlActions}>
                            <button
                              type="button"
                              className={`ghost-btn mini ${styles.manualAdjustPrimaryAction}`}
                              onClick={() => void handleCreditAdjust()}
                              disabled={adjustSubmitting || !selectedUserId}
                            >
                              {adjustSubmitting ? "Saving…" : "Save credit change"}
                            </button>
                            {selectedUserId ? (
                              <Link
                                href={`/admin/user-health?lookup=${encodeURIComponent(
                                  selectedUserId
                                )}&lookupMode=user_id`}
                                className={`ghost-btn mini ${styles.manualAdjustSecondaryAction}`}
                              >
                                Open account health
                              </Link>
                            ) : (
                              <button
                                type="button"
                                className={`ghost-btn mini ${styles.manualAdjustSecondaryAction}`}
                                disabled
                              >
                                Open account health
                              </button>
                            )}
                          </div>
                        </div>

                        <div className={styles.manualAdjustPresets}>
                          {ADMIN_DASHBOARD_ADJUSTMENT_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className={`ghost-btn mini ${styles.manualAdjustPresetButton}`}
                              onClick={() => applyAdjustmentPreset(preset)}
                              disabled={adjustSubmitting || !selectedUserId}
                            >
                              {preset > 0 ? `+${preset}` : String(preset)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className={styles.compactControlSection}>
                        <div className={styles.panelHeaderRow}>
                          <h4 className={styles.compactControlTitle}>Payment exempt</h4>
                          {billingOverrideResult ? (
                            <span className={styles.inlineResult}>{billingOverrideResult}</span>
                          ) : null}
                        </div>

                        <div className={styles.compactToggleRow}>
                          <label className={`${styles.controlToggleCard} tiny subdued`}>
                            <span className={styles.controlToggleTitle}>Payment exempt</span>
                            <span className={styles.controlToggleInput}>
                              <input
                                type="checkbox"
                                aria-label="Payment exempt"
                                checked={paymentExemptEnabled}
                                onChange={(event) => {
                                  void handlePaymentExemptToggle(event.target.checked);
                                }}
                                disabled={!selectedUserId || billingOverrideSubmitting}
                              />{" "}
                              {billingOverrideSubmitting
                                ? "Saving…"
                                : paymentExemptEnabled
                                  ? "Enabled"
                                  : "Disabled"}
                            </span>
                          </label>
                        </div>

                        <p className={styles.controlNote}>{paymentExemptNote}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {selectedUserId ? (
                <div className={styles.manualAdjustPanel}>
                  <button
                    type="button"
                    className={styles.adminStripeBillingToggle}
                    onClick={() => setSupportFindingsExpanded((current) => !current)}
                    aria-expanded={supportFindingsExpanded}
                    aria-controls="admin-account-status-details"
                  >
                    <span>
                      <span className={styles.panelTitle}>Status</span>
                    </span>
                    <CaretDown
                      size={16}
                      weight="bold"
                      className={`${styles.adminStripeBillingToggleIcon} ${
                        supportFindingsExpanded ? styles.adminStripeBillingToggleIconExpanded : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {supportFindingsExpanded ? (
                    <div
                      id="admin-account-status-details"
                      className={styles.adminStripeBillingBody}
                    >
                      {billingDiagnosticsLoading && !billingDiagnosticsLoaded ? (
                        <p className={styles.controlNote}>Loading account status…</p>
                      ) : billingDiagnosticsError ? (
                        <p className={styles.controlNote}>{billingDiagnosticsError}</p>
                      ) : accountStatusItems.length > 0 || visibleBillingFindings.length > 0 ? (
                        <div className={styles.accountStatusList}>
                          {accountStatusItems.map((item) => (
                            <article
                              key={item.key}
                              className={`${styles.accountStatusRow} ${item.toneClassName}`}
                              data-testid={`account-status-${item.key}`}
                            >
                              <span className={styles.accountStatusRail} aria-hidden="true" />
                              <span className={styles.accountStatusLabel}>{item.label}</span>
                              <div className={styles.accountStatusCopy}>
                                <strong className={styles.accountStatusValue}>{item.value}</strong>
                                {item.detail ? (
                                  <span className={styles.accountStatusDetail}>{item.detail}</span>
                                ) : null}
                              </div>
                            </article>
                          ))}
                          {visibleBillingFindings.map((finding) => (
                            <article
                              key={finding.code}
                              className={`${styles.accountStatusRow} ${accountFindingToneClassName(
                                finding.severity
                              )}`}
                            >
                              <span className={styles.accountStatusRail} aria-hidden="true" />
                              <span className={styles.accountStatusLabel}>{finding.severity}</span>
                              <div className={styles.accountStatusCopy}>
                                <strong className={styles.accountStatusValue}>
                                  {finding.summary}
                                </strong>
                                <span className={styles.accountStatusDetail}>
                                  {finding.details}
                                </span>
                              </div>
                              {finding.recommendedActions.length > 0 ? (
                                <ul className={styles.accountStatusActions}>
                                  {finding.recommendedActions.map((action) => (
                                    <li key={`${finding.code}-${action}`}>{action}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </article>
                          ))}
                          {showPricingObservabilityCard ? (
                            <article
                              className={`${styles.accountStatusRow} ${
                                pricingObservability.mismatchCount > 0
                                  ? styles.accountStatusRowWarning
                                  : styles.accountStatusRowOk
                              }`}
                            >
                              <span className={styles.accountStatusRail} aria-hidden="true" />
                              <span className={styles.accountStatusLabel}>Pricing</span>
                              <div className={styles.accountStatusCopy}>
                                <strong className={styles.accountStatusValue}>
                                  {pricingObservability.mismatchCount > 0
                                    ? `${pricingObservability.mismatchCount} mismatch${
                                        pricingObservability.mismatchCount === 1 ? "" : "es"
                                      }`
                                    : "No recent mismatches"}
                                </strong>
                                <span className={styles.accountStatusDetail}>
                                  {pricingObservabilityCoverageLabel}
                                  {pricingObservability.lastObservedAt
                                    ? ` · last observed ${formatCompactDate(
                                        pricingObservability.lastObservedAt
                                      )}`
                                    : " · no recent observed rows yet"}
                                </span>
                                {selectedUserId ? (
                                  <Link
                                    href={`/admin/generation-trace?userId=${encodeURIComponent(
                                      selectedUserId
                                    )}`}
                                    className={`ghost-btn mini ${styles.manualAdjustSecondaryAction}`}
                                  >
                                    Open pricing trace
                                  </Link>
                                ) : null}
                              </div>
                            </article>
                          ) : null}
                        </div>
                      ) : (
                        <p className={styles.controlNote}>
                          No account status items are available for this account right now.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.manualAdjustPanel}>
                <button
                  type="button"
                  className={styles.adminStripeBillingToggle}
                  onClick={() => setStripeBillingExpanded((current) => !current)}
                  aria-expanded={stripeBillingExpanded}
                  aria-controls="admin-stripe-billing-details"
                >
                  <span>
                    <span className={styles.panelTitle}>Stripe billing</span>
                  </span>
                  <CaretDown
                    size={16}
                    weight="bold"
                    className={`${styles.adminStripeBillingToggleIcon} ${
                      stripeBillingExpanded ? styles.adminStripeBillingToggleIconExpanded : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {stripeBillingExpanded ? (
                  <div id="admin-stripe-billing-details" className={styles.adminStripeBillingBody}>
                    <div className={styles.panelHeaderRow}>
                      <div className={styles.tabRow}>
                        <button
                          type="button"
                          className={`ghost-btn mini ${styles.manualAdjustSecondaryAction}`}
                          onClick={() => {
                            void handleSyncSelectedUserBillingCustomer();
                          }}
                          disabled={!selectedUserId || billingCustomerSyncSubmitting}
                        >
                          {billingCustomerSyncSubmitting
                            ? "Syncing customer…"
                            : "Resync Stripe customer"}
                        </button>
                        <button
                          type="button"
                          className={`ghost-btn mini ${styles.manualAdjustPrimaryAction}`}
                          onClick={() => {
                            void handleOpenSelectedUserBilling();
                          }}
                          disabled={!selectedUserId || billingPortalSubmitting}
                        >
                          {billingPortalSubmitting ? "Opening Stripe…" : "Open Stripe billing"}
                        </button>
                      </div>
                    </div>
                    {selectedUserId ? (
                      <div className={styles.adminBillingFindingList}>
                        <article className={styles.adminBillingFindingCard}>
                          <p className={styles.healthFindingSummary}>Billing identity state</p>
                          <p className={styles.controlNote}>{billingIdentityStateLabel}</p>
                          <p className={styles.controlNote}>
                            Auth name: {authIdentityDisplayName ?? "—"} · Stripe name:{" "}
                            {stripeCustomerName ?? "—"}
                          </p>
                          <p className={styles.controlNote}>
                            Auth email: {billingDiagnostics?.authIdentity?.email ?? "—"} · Stripe
                            email: {stripeCustomerEmail ?? "—"}
                          </p>
                          <p className={styles.controlNote}>
                            Stripe customer id: {snapshotStripeCustomerId ?? "—"}
                          </p>
                          <p className={styles.controlNote}>
                            Stripe subscription id: {snapshotStripeSubscriptionId ?? "—"}
                          </p>
                          <p className={styles.controlNote}>
                            Contract offer id: {billingDiagnostics?.currentContract?.offerId ?? "—"}
                          </p>
                          <p className={styles.controlNote}>
                            Contract price id:{" "}
                            {billingDiagnostics?.currentContract?.stripePriceId ?? "—"}
                          </p>
                        </article>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {billingPortalResult ? (
                <p className={styles.inlineResult}>{billingPortalResult}</p>
              ) : null}
              {billingCustomerSyncResult ? (
                <p className={styles.inlineResult}>{billingCustomerSyncResult}</p>
              ) : null}
            </>
          )}
        </section>
      </div>

      <section className={styles.adminSubpanel}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className="eyebrow">Users & credits</p>
            <h3 className={styles.adminSectionTitle}>User list</h3>
            <p className="tiny subdued">
              Search the user index and select a row once to inspect support details.
            </p>
          </div>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => void loadUsers()}
            disabled={usersLoading}
          >
            {usersLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className={styles.searchRow}>
          <label htmlFor="user-search" className="tiny subdued">
            Search users
          </label>
          <div className={styles.userSearchControls}>
            <input
              id="user-search"
              className={styles.searchInput}
              type="search"
              value={userSearch}
              onChange={(event) => handleUserSearchChange(event.target.value)}
              placeholder="Search by email"
            />
            <label className={styles.userSortField} htmlFor="user-sort">
              <span>Sort</span>
              <select
                id="user-sort"
                value={userSort}
                onChange={(event) =>
                  handleUserSortChange(event.target.value as AdminDashboardUserSort)
                }
                disabled={usersLoading}
              >
                {ADMIN_DASHBOARD_USER_SORT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {USER_SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className={styles.adminTableScroller}>
          <div
            className={`${styles.adminTable} ${styles.adminSupportQueueTable}`}
            data-testid="admin-support-user-grid"
          >
            <div className={`${styles.adminTableHead} ${styles.adminSupportQueueHead}`}>
              <span>Copy</span>
              <span>User</span>
              <span>Access</span>
              <span>Status</span>
              <span>Payment</span>
              <span>Spendable</span>
              <span>Renews / ends</span>
              <span>Subscribed</span>
            </div>
            {usersError ? (
              <div className={`${styles.adminTableRow} ${styles.adminSupportQueueRow}`}>
                <span className="subdued">{usersError}</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
              </div>
            ) : usersLoading && users.length === 0 ? (
              <div className={`${styles.adminTableRow} ${styles.adminSupportQueueRow}`}>
                <span className="subdued">Loading users…</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
              </div>
            ) : users.length === 0 ? (
              <div className={`${styles.adminTableRow} ${styles.adminSupportQueueRow}`}>
                <span className="subdued">
                  {userSearch.trim() ? "No users match." : "No users loaded yet."}
                </span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
                <span className="subdued">—</span>
              </div>
            ) : (
              users.map((row) => {
                const rowLabel = row.email ?? row.id;
                const accessTone = accessPlanTone(row.planId);
                const billingTone = billingStatusTone(row);
                const isSubscribed = hasActivePaidSubscription(row);
                const accessToneClass =
                  accessTone === "baseline"
                    ? styles.adminSupportQueueRowBaseline
                    : accessTone === "starter"
                      ? styles.adminSupportQueueRowStarter
                      : accessTone === "media"
                        ? styles.adminSupportQueueRowMedia
                        : accessTone === "studio"
                          ? styles.adminSupportQueueRowStudio
                          : accessTone === "business"
                            ? styles.adminSupportQueueRowBusiness
                            : styles.adminSupportQueueRowNeutral;
                return (
                  <div
                    key={row.id}
                    className={`${styles.adminTableRow} ${styles.adminSupportQueueRow} ${accessToneClass} ${
                      selectedUserId === row.id ? styles.adminTableRowActive : ""
                    }`}
                  >
                    <button
                      type="button"
                      className={styles.adminSupportQueueSelectButton}
                      onClick={() => handleSelectUserRow(row.id)}
                      aria-label={`Select ${rowLabel}`}
                      aria-pressed={selectedUserId === row.id}
                    />
                    <div className={styles.adminSupportQueueRowContent}>
                      <span
                        className={`${styles.adminSupportQueueCell} ${styles.adminSupportQueueCopyCell}`}
                        data-label="Copy"
                      >
                        <span className={styles.adminSupportQueueCopySlot}>
                          {row.email ? (
                            <button
                              type="button"
                              className={styles.adminSupportQueueCopyButton}
                              onClick={() => void handleCopyUserEmail(row)}
                              aria-label={`Copy ${row.email} to clipboard`}
                              title={
                                copiedEmailUserId === row.id
                                  ? "Copied"
                                  : copyFailedEmailUserId === row.id
                                    ? "Copy failed"
                                    : "Copy email"
                              }
                            >
                              {copiedEmailUserId === row.id ? (
                                <Check size={14} weight="bold" aria-hidden="true" />
                              ) : (
                                <CopySimple size={14} weight="bold" aria-hidden="true" />
                              )}
                            </button>
                          ) : (
                            <span className="subdued">—</span>
                          )}
                        </span>
                      </span>
                      <span className={styles.adminSupportQueueCell} data-label="User">
                        <span className={styles.adminSupportQueueEmail}>
                          <span className={styles.adminSupportQueueEmailText}>{rowLabel}</span>
                        </span>
                      </span>
                      <span className={styles.adminSupportQueueCell} data-label="Access">
                        <span
                          className={`${styles.adminSupportAccessPlan} ${
                            accessTone === "baseline"
                              ? styles.adminSupportAccessPlanBaseline
                              : accessTone === "starter"
                                ? styles.adminSupportAccessPlanStarter
                                : accessTone === "media"
                                  ? styles.adminSupportAccessPlanMedia
                                  : accessTone === "studio"
                                    ? styles.adminSupportAccessPlanStudio
                                    : accessTone === "business"
                                      ? styles.adminSupportAccessPlanBusiness
                                      : styles.adminSupportAccessPlanNeutral
                          }`}
                          data-access-plan-tone={accessTone}
                          data-testid={`access-plan-${row.id}`}
                        >
                          {planLabel(row.planId)}
                        </span>
                      </span>
                      <span
                        className={`${styles.adminSupportQueueCell} subdued`}
                        data-label="Status"
                      >
                        <span
                          className={`${styles.adminSupportBillingStatus} ${
                            billingTone === "active"
                              ? styles.adminSupportBillingStatusActive
                              : billingTone === "warning"
                                ? styles.adminSupportBillingStatusWarning
                                : billingTone === "canceled"
                                  ? styles.adminSupportBillingStatusCanceled
                                  : styles.adminSupportBillingStatusNeutral
                          }`}
                          data-billing-status-tone={billingTone}
                          data-testid={`billing-status-${row.id}`}
                        >
                          {formatBillingStatusLabel(row)}
                        </span>
                      </span>
                      <span
                        className={`${styles.adminSupportQueueCell} subdued`}
                        data-label="Payment"
                      >
                        {row.contractSource !== "internal_comp" &&
                        row.recurringPriceCents != null ? (
                          <span>
                            {formatRecurringPriceLabel(
                              row.recurringPriceCents,
                              row.billingInterval,
                              formatUsd
                            )}
                          </span>
                        ) : (
                          <span className="subdued">—</span>
                        )}
                      </span>
                      <span className={styles.adminSupportQueueCell} data-label="Spendable">
                        <span className="mono">{row.spendableCredits.toLocaleString()}</span>
                      </span>
                      <span
                        className={`${styles.adminSupportQueueCell} subdued`}
                        data-label="Renews / ends"
                      >
                        <span>
                          {row.cancelAtPeriodEnd && row.planRenewalAt
                            ? `Ends ${formatCompactDate(row.planRenewalAt)}`
                            : formatCompactDate(row.planRenewalAt)}
                        </span>
                      </span>
                      <span className={styles.adminSupportQueueCell} data-label="Subscribed">
                        <span
                          className={
                            isSubscribed
                              ? styles.adminSupportSubscribedYes
                              : styles.adminSupportSubscribedNo
                          }
                          data-testid={`subscribed-indicator-${row.id}`}
                          title={isSubscribed ? "Subscribed" : "Not subscribed"}
                          role="img"
                          aria-label={isSubscribed ? "Subscribed" : "Not subscribed"}
                        >
                          {isSubscribed ? (
                            <Check size={15} weight="bold" aria-hidden="true" />
                          ) : (
                            <X size={15} weight="bold" aria-hidden="true" />
                          )}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.searchRow}>
          <p className="tiny subdued">
            {usersLoading && users.length === 0
              ? "Loading user index…"
              : `Showing ${usersResultStart}-${usersResultEnd} of ${usersPagination.totalCount}${
                  userSearchLimited ? " (result set limited to the first 10,000 users scanned)" : ""
                }`}
          </p>
          <div className={styles.tabRow}>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={handlePreviousUsersPage}
              disabled={usersLoading || !usersPagination.hasPrevPage}
            >
              Prev
            </button>
            <span className="tiny subdued">
              Page {usersPagination.page} of {usersPagination.totalPages}
            </span>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={handleNextUsersPage}
              disabled={usersLoading || !usersPagination.hasNextPage}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
