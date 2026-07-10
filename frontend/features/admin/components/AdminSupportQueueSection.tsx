/**
 * Admin support queue section.
 * Handles user lookup, row selection, credit adjustment, and recent ledger inspection.
 */
import { type CSSProperties, useRef, useState } from "react";
import Link from "next/link";
import { CaretDown, Check, CopySimple } from "phosphor-react";
import {
  ADMIN_DASHBOARD_ADJUSTMENT_PRESETS,
  ADMIN_DASHBOARD_CREDIT_LEDGER_LIMIT,
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
  if (row.cancelAtPeriodEnd) return "Cancelling...";
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

/**
 * Renders the main admin support workflow without carrying unrelated incident/broadcast tooling.
 */
export function AdminSupportQueueSection({
  userSearch,
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
  };
  type AccountStatusItem = {
    key: string;
    label: string;
    value: string;
    detail: string | null;
    toneClassName: string;
  };
  type QueueSignal = {
    label: string;
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
  const snapshotStatusLabel = formatStatusLabel(snapshotStatus);
  const snapshotCancellationScheduled = Boolean(
    billingDiagnostics?.currentContract?.cancelAtPeriodEnd ?? selectedUser?.cancelAtPeriodEnd
  );
  const snapshotBillingStateLabel = snapshotCancellationScheduled
    ? "Cancellation scheduled"
    : snapshotStatusLabel;
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
    ? [
        {
          key: "plan",
          label: "Access",
          value: planLabel(selectedUser.planId),
          testId: "snapshot-card-plan",
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
          label: "Billing state",
          value:
            snapshotContractSource === "internal_comp"
              ? "Payment exempt"
              : snapshotBillingStateLabel,
          testId: "snapshot-card-billing-state",
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
      ].filter((card): card is SnapshotCard => Boolean(card))
    : [];
  const hasLoadedUsers = users.length > 0;
  const emptyCreditFlagCount = users.reduce(
    (count, row) => count + (row.spendableCredits <= 0 ? 1 : 0),
    0
  );
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
          label: "Billing state",
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
        data-credit-ledger-layout="full-width"
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
                      <span className={styles.accountSnapshotCardValue}>{card.value}</span>
                      {card.helper ? (
                        <span className={styles.accountSnapshotCardHelper}>{card.helper}</span>
                      ) : null}
                    </article>
                  ))}
                </div>
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

        {ledgerVisible ? (
          <section className={styles.adminSubpanel} data-testid="credit-ledger-panel">
            <div className={styles.adminSectionHead}>
              <div>
                <p className="eyebrow">Credit transaction log</p>
                <p className="tiny subdued">
                  Latest {ADMIN_DASHBOARD_CREDIT_LEDGER_LIMIT} rows for the selected account.
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

            <div className={styles.adminTable}>
              <div className={styles.adminLedgerHead}>
                <span>Time</span>
                <span>Source</span>
                <span>Change</span>
                <span>Pricing</span>
                <span>Reason / Ref</span>
              </div>
              {creditLedgerError ? (
                <div className={styles.adminLedgerRow}>
                  <span className="subdued">{creditLedgerError}</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                </div>
              ) : !selectedUserId ? (
                <div className={styles.adminLedgerRow}>
                  <span className="subdued">Pick a user to inspect transactions.</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                </div>
              ) : !creditLedgerLoaded ? (
                <div className={styles.adminLedgerRow}>
                  <span className="subdued">Load the recent ledger for this user.</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                </div>
              ) : creditLedgerRows.length === 0 ? (
                <div className={styles.adminLedgerRow}>
                  <span className="subdued">No recent credit transactions.</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                </div>
              ) : (
                creditLedgerRows.map((row) => (
                  <div key={row.id} className={styles.adminLedgerRow}>
                    <span className="subdued">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                    </span>
                    <span className="mono">{row.source}</span>
                    <span
                      className={
                        row.changeCents < 0 ? styles.ledgerChangeDebit : styles.ledgerChangeCredit
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
                ))
              )}
            </div>
          </section>
        ) : null}
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
          <input
            id="user-search"
            className={styles.searchInput}
            type="search"
            value={userSearch}
            onChange={(event) => handleUserSearchChange(event.target.value)}
            placeholder="Search by email"
          />
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
              <span>Billing</span>
              <span>Payment</span>
              <span>Spendable</span>
              <span>Renews / ends</span>
              <span>Credit flags ({emptyCreditFlagCount})</span>
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
                const queueSignals: QueueSignal[] = [];
                const accessTone = accessPlanTone(row.planId);
                const billingTone = billingStatusTone(row);
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
                if (row.spendableCredits <= 0) {
                  queueSignals.push({
                    label: "Empty",
                    toneClassName: styles.pillCritical,
                  });
                }

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
                        data-label="Billing"
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
                      <span className={styles.adminSupportQueueCell} data-label="Credit flags">
                        {queueSignals.length > 0 ? (
                          <span className={styles.adminSupportQueueSignalList}>
                            {queueSignals.map((signal) => (
                              <span
                                key={`${row.id}-${signal.label}`}
                                className={`${styles.pill} ${styles.adminSupportQueueSignalPill} ${signal.toneClassName}`}
                              >
                                {signal.label}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="subdued">—</span>
                        )}
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
                  userSearchLimited ? " (search limited to the first 10,000 users scanned)" : ""
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
