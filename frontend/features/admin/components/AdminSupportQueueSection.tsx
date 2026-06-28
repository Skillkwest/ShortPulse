/**
 * Admin support queue section.
 * Handles user lookup, row selection, credit adjustment, and recent ledger inspection.
 */
import { type CSSProperties, useState } from "react";
import Link from "next/link";
import { Check, CopySimple } from "phosphor-react";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
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
  allowStripeTakeover: boolean;
  billingOverrideSubmitting: boolean;
  billingOverrideResult: string | null;
  billingPortalSubmitting: boolean;
  billingPortalResult: string | null;
  billingCustomerSyncSubmitting: boolean;
  billingCustomerSyncResult: string | null;
  deleteSubmitting: boolean;
  deleteResult: string | null;
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
  handleAllowStripeTakeoverChange: (value: boolean) => void;
  applyAdjustmentPreset: (delta: number) => void;
  handleCreditAdjust: () => Promise<void>;
  handleGrantInternalComp: () => Promise<boolean>;
  handleRevokeInternalComp: () => Promise<boolean>;
  handleOpenSelectedUserBilling: () => Promise<void>;
  handleSyncSelectedUserBillingCustomer: () => Promise<void>;
  handleDeleteUser: (params: { userId: string; confirmationText: string }) => Promise<boolean>;
  clearDeleteResult: () => void;
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

function pickPositiveNumber(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (value != null && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

function formatCompactDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function findingToneClassName(
  severity: AdminBillingDiagnosticsResponse["findings"][number]["severity"]
): string {
  if (severity === "critical") return styles.pillCritical;
  if (severity === "warning") return styles.pillWarn;
  return styles.pillOk;
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
  currentAdminUserId,
  currentAdminEmail,
  selectedUserId,
  selectedUser,
  adjustment,
  adjustSubmitting,
  adjustResult,
  allowStripeTakeover,
  billingOverrideSubmitting,
  billingOverrideResult,
  billingPortalSubmitting,
  billingPortalResult,
  billingCustomerSyncSubmitting,
  billingCustomerSyncResult,
  deleteSubmitting,
  deleteResult,
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
  handleAllowStripeTakeoverChange,
  applyAdjustmentPreset,
  handleCreditAdjust,
  handleGrantInternalComp,
  handleRevokeInternalComp,
  handleOpenSelectedUserBilling,
  handleSyncSelectedUserBillingCustomer,
  handleDeleteUser,
  clearDeleteResult,
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
  type QueueSignal = {
    label: string;
    toneClassName: string;
  };

  const [ledgerUserId, setLedgerUserId] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUserRow | null>(null);
  const [deleteConfirmationValue, setDeleteConfirmationValue] = useState("");
  const [copiedEmailUserId, setCopiedEmailUserId] = useState<string | null>(null);
  const [copyFailedEmailUserId, setCopyFailedEmailUserId] = useState<string | null>(null);
  const [paymentExemptDraft, setPaymentExemptDraft] = useState<{
    userId: string;
    value: boolean;
  } | null>(null);
  const prioritizedUsers = [
    ...users.filter((row) => row.id === currentAdminUserId),
    ...users.filter((row) => row.id !== currentAdminUserId),
  ];
  const ledgerVisible = Boolean(selectedUserId) && ledgerUserId === selectedUserId;
  const deleteConfirmationTarget = pendingDeleteUser?.email ?? pendingDeleteUser?.id ?? "";
  const deleteConfirmationMatches =
    deleteConfirmationTarget.length > 0 &&
    deleteConfirmationValue.trim() === deleteConfirmationTarget;
  const selectedUserPriceLabel =
    selectedUser?.recurringPriceCents == null
      ? null
      : `${formatUsd(selectedUser.recurringPriceCents / 100)}/mo`;
  const billingFindings = billingDiagnostics?.findings ?? [];
  const adminIdentityEmail =
    currentAdminEmail.trim() ||
    prioritizedUsers.find((row) => row.id === currentAdminUserId)?.email ||
    "";
  const adminUserPresent = prioritizedUsers.some((row) => row.id === currentAdminUserId);
  const snapshotStatus = billingDiagnostics?.stripeSubscription?.subscriptionId
    ? billingDiagnostics.stripeSubscription.status
    : selectedUser?.subscriptionStatus;
  const snapshotContractSource =
    billingDiagnostics?.currentContract?.contractSource ?? selectedUser?.contractSource ?? null;
  const snapshotMonthlyCredits =
    billingDiagnostics?.currentContract?.monthlyCreditsCents ??
    billingDiagnostics?.linkedOffer?.monthlyCreditsCents ??
    billingDiagnostics?.currentPublicOffer?.monthlyCreditsCents ??
    selectedUser?.monthlyCreditsCents ??
    null;
  const snapshotStorageSummary = billingDiagnostics?.storageSummary ?? null;
  const snapshotStorageTotalBytes = pickPositiveNumber(
    snapshotStorageSummary?.totalLimitBytes,
    billingDiagnostics?.currentContract?.storageLimitBytes,
    billingDiagnostics?.linkedOffer?.storageLimitBytes,
    billingDiagnostics?.currentPublicOffer?.storageLimitBytes
  );
  const snapshotStorageLabel =
    snapshotStorageTotalBytes != null ? formatStorageBytes(snapshotStorageTotalBytes) : null;
  const snapshotStorageHelper = snapshotStorageSummary
    ? snapshotStorageSummary.addonLimitBytes > 0
      ? `${formatStorageBytes(snapshotStorageSummary.usedBytes)} used · ${formatStorageBytes(snapshotStorageSummary.addonLimitBytes)} add-ons`
      : `${formatStorageBytes(snapshotStorageSummary.usedBytes)} used`
    : undefined;
  const snapshotPriceLabel =
    billingDiagnostics?.stripeSubscription?.subscriptionId &&
    billingDiagnostics.stripeSubscription.recurringPriceCents != null
      ? `${formatUsd(billingDiagnostics.stripeSubscription.recurringPriceCents / 100)}/mo`
      : selectedUserPriceLabel;
  const snapshotStatusLabel = formatStatusLabel(snapshotStatus);
  const snapshotCreditsHelper = [
    `available ${selectedUser?.availableCredits.toLocaleString() ?? "0"}`,
    selectedUser && selectedUser.reservedCredits > 0
      ? `held ${selectedUser.reservedCredits.toLocaleString()}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const visibleBillingFindings = billingFindings.filter(
    (finding) => finding.code !== "internal_comp_contract"
  );
  const pricingObservability = billingDiagnostics?.pricingObservability ?? null;
  const pricingObservabilityCoverageLabel = pricingObservability
    ? `${pricingObservability.observedRows.reservations}/${pricingObservability.rowsScanned.reservations} reservation rows · ${pricingObservability.observedRows.ledgerEntries}/${pricingObservability.rowsScanned.ledgerEntries} ledger rows`
    : null;
  const showPricingObservabilityCard =
    pricingObservability != null && pricingObservability.mismatchCount > 0;
  const hasLinkedStripeSubscription = Boolean(
    billingDiagnostics?.stripeSubscription?.subscriptionId ||
    billingDiagnostics?.billingProfile?.stripeSubscriptionId
  );
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
  const snapshotCards: SnapshotCard[] = selectedUser
    ? [
        {
          key: "plan",
          label: "Plan",
          value: planLabel(selectedUser.planId),
          testId: "snapshot-card-plan",
        },
        {
          key: "subscription",
          label: "Subscription",
          value: snapshotPriceLabel ?? "—",
          helper:
            snapshotMonthlyCredits != null
              ? `${snapshotMonthlyCredits.toLocaleString()} credits / month`
              : undefined,
          testId: "snapshot-card-price",
        },
        snapshotStorageLabel
          ? {
              key: "storage",
              label: "Storage",
              value: snapshotStorageLabel,
              helper: snapshotStorageHelper,
              testId: "snapshot-card-storage",
            }
          : null,
        {
          key: "credits",
          value: selectedUser.spendableCredits.toLocaleString(),
          label: "Spendable",
          helper: snapshotCreditsHelper,
          testId: "snapshot-card-credits",
        },
        {
          key: "billing-state",
          label: "Billing state",
          value:
            snapshotContractSource === "internal_comp" ? "Payment exempt" : snapshotStatusLabel,
          helper:
            snapshotContractSource === "internal_comp"
              ? `Manual ${planLabel(selectedUser.planId)} access without Stripe billing.`
              : hasLinkedStripeSubscription
                ? "Stripe-linked billing is configured."
                : "No linked Stripe subscription.",
          testId: "snapshot-card-billing-state",
        },
        {
          key: "renewal",
          label: "Next renewal",
          value: snapshotRenewalAt ? formatCompactDate(snapshotRenewalAt) : "No renewal",
          helper: snapshotRenewalAt ? "Current billing period end." : "No active billing cycle.",
          testId: "snapshot-card-renewal",
        },
        {
          key: "joined",
          label: "Joined",
          value: formatCompactDate(selectedUser.createdAt),
          helper: selectedUser.createdAt
            ? "Account creation date."
            : "Creation date is not available.",
          testId: "snapshot-card-joined",
        },
      ].filter((card): card is SnapshotCard => Boolean(card))
    : [];
  const hasLoadedUsers = prioritizedUsers.length > 0;
  const pinnedAdminLabel = adminIdentityEmail || "The current admin account";
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
        ? {
            eyebrow: "Loading accounts",
            title: "Preparing the selected account workspace",
            description:
              "We’re loading the current support queue and will auto-select the active operator account when it appears.",
            helper:
              "You can start scanning the queue as soon as rows load. Credits, access controls, and Stripe actions stay hidden until a real account is selected.",
          }
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
                helper: adminUserPresent
                  ? `${pinnedAdminLabel} stays pinned to the top of the loaded user list for quick access.`
                  : `${pinnedAdminLabel} will pin to the top when it appears in the loaded user list.`,
              }
    : null;
  const snapshotNote = !selectedUserId
    ? "Select an account from the list below."
    : billingDiagnosticsError
      ? billingDiagnosticsError
      : billingDiagnosticsLoading && !billingDiagnosticsLoaded
        ? "Loading latest account snapshot…"
        : visibleBillingFindings.length > 0
          ? `${visibleBillingFindings[0]?.summary}${
              visibleBillingFindings.length > 1
                ? ` + ${visibleBillingFindings.length - 1} more`
                : ""
            }`
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

  const openDeleteModal = (user: AdminUserRow) => {
    if (user.id === currentAdminUserId) return;
    clearDeleteResult();
    setPendingDeleteUser(user);
    setDeleteConfirmationValue("");
  };

  const closeDeleteModal = () => {
    if (deleteSubmitting) return;
    setPendingDeleteUser(null);
    setDeleteConfirmationValue("");
  };
  const deleteModalBackdropDismiss = useGuardedBackdropDismiss<HTMLElement>(closeDeleteModal);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteUser || !deleteConfirmationMatches) return;
    const deleted = await handleDeleteUser({
      userId: pendingDeleteUser.id,
      confirmationText: deleteConfirmationValue.trim(),
    });
    if (deleted) {
      closeDeleteModal();
    }
  };

  return (
    <>
      <section className={styles.adminSection}>
        <div className={styles.accountControlsHeader}>
          <p className="eyebrow">Account controls</p>
          <h2 className={styles.adminSectionTitle}>Selected account</h2>
        </div>
        <div className={styles.adminSupportStack}>
          <div
            className={`${styles.adminSplitGrid} ${
              !ledgerVisible ? styles.adminSplitGridSingle : ""
            }`}
          >
            <section className={`${styles.adminSubpanel} ${styles.adminPrimaryPanel}`}>
              {selectedAccountState ? (
                <div className={styles.adminStatePanel}>
                  <p className={styles.adminStateEyebrow}>{selectedAccountState.eyebrow}</p>
                  <h3 className={styles.adminStateTitle}>{selectedAccountState.title}</h3>
                  <p className={styles.adminStateDescription}>{selectedAccountState.description}</p>
                  {selectedAccountState.helper ? (
                    <p className={styles.adminStateDescriptionMuted}>
                      {selectedAccountState.helper}
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className={styles.accountSnapshot}>
                    <div className={styles.accountSnapshotHead}>
                      <div className={styles.accountSnapshotIdentity}>
                        <div className={styles.accountSnapshotTitleRow}>
                          <span className={styles.accountSnapshotTitle}>
                            {selectedUser?.email ??
                              selectedUser?.id ??
                              "Select an account from the list below"}
                          </span>
                          {selectedUserId ? (
                            <div className={styles.accountSnapshotHeaderBadges}>
                              <span
                                className={styles.accountSnapshotHeaderBadge}
                                data-testid="snapshot-status-badge"
                              >
                                {snapshotStatusLabel}
                              </span>
                              {snapshotContractSource === "internal_comp" ? (
                                <span
                                  className={`${styles.accountSnapshotHeaderBadge} ${styles.accountSnapshotHeaderBadgeAccent}`}
                                  data-testid="snapshot-payment-exempt-badge"
                                >
                                  ✓ Payment exempt
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className={styles.accountSnapshotHeadAside}>
                        {snapshotNote ? (
                          <span className={styles.accountSnapshotNote}>{snapshotNote}</span>
                        ) : null}
                        {selectedUserId ? (
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
                        ) : null}
                      </div>
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

                  {selectedUserId ? (
                    <div className={styles.manualAdjustPanel}>
                      <div className={styles.panelHeaderRow}>
                        <h3 className={styles.panelTitle}>Support findings</h3>
                      </div>
                      {billingDiagnosticsLoading && !billingDiagnosticsLoaded ? (
                        <p className={styles.controlNote}>
                          Loading billing diagnostics and support findings…
                        </p>
                      ) : billingDiagnosticsError ? (
                        <p className={styles.controlNote}>{billingDiagnosticsError}</p>
                      ) : visibleBillingFindings.length > 0 ? (
                        <div className={styles.adminBillingFindingList}>
                          {visibleBillingFindings.map((finding) => (
                            <article key={finding.code} className={styles.adminBillingFindingCard}>
                              <div className={styles.healthFindingMetaRow}>
                                <span
                                  className={`${styles.pill} ${findingToneClassName(finding.severity)}`}
                                >
                                  {finding.severity}
                                </span>
                              </div>
                              <p className={styles.healthFindingSummary}>{finding.summary}</p>
                              <p className={styles.controlNote}>{finding.details}</p>
                              {finding.recommendedActions.length > 0 ? (
                                <ul className={styles.healthActionList}>
                                  {finding.recommendedActions.map((action) => (
                                    <li key={`${finding.code}-${action}`}>{action}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.controlNote}>
                          No immediate billing anomalies are flagged for this account right now.
                        </p>
                      )}
                      {showPricingObservabilityCard ? (
                        <div className={styles.adminBillingFindingCard}>
                          <div className={styles.healthFindingMetaRow}>
                            <span
                              className={`${styles.pill} ${
                                pricingObservability.mismatchCount > 0
                                  ? styles.pillWarn
                                  : styles.pillOk
                              }`}
                            >
                              {pricingObservability.mismatchCount > 0
                                ? `${pricingObservability.mismatchCount} mismatch${
                                    pricingObservability.mismatchCount === 1 ? "" : "es"
                                  }`
                                : "No recent mismatches"}
                            </span>
                          </div>
                          <p className={styles.healthFindingSummary}>Pricing observability</p>
                          <p className={styles.controlNote}>
                            {pricingObservabilityCoverageLabel}
                            {pricingObservability.lastObservedAt
                              ? ` · last observed ${formatCompactDate(
                                  pricingObservability.lastObservedAt
                                )}`
                              : " · no recent observed rows yet"}
                          </p>
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
                      ) : null}
                    </div>
                  ) : null}

                  <div className={styles.manualAdjustPanel}>
                    <div className={styles.panelHeaderRow}>
                      <h3 className={styles.panelTitle}>Credits & access</h3>
                    </div>

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

                        {hasLinkedStripeSubscription ? (
                          <label
                            className={`${styles.controlToggleCard} ${styles.controlToggleCompact}`}
                          >
                            <span className={styles.controlToggleTitle}>Stripe takeover</span>
                            <span className={styles.controlToggleInput}>
                              <input
                                type="checkbox"
                                checked={allowStripeTakeover}
                                onChange={(event) =>
                                  handleAllowStripeTakeoverChange(event.target.checked)
                                }
                                disabled={!selectedUserId || billingOverrideSubmitting}
                              />{" "}
                              Clear the saved Stripe link after external Stripe handling.
                            </span>
                          </label>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className={styles.manualAdjustPanel}>
                    <div className={styles.panelHeaderRow}>
                      <h3 className={styles.panelTitle}>Stripe billing</h3>
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
                    <p className={styles.controlNote}>
                      {hasLinkedStripeSubscription
                        ? "Use this for billed subscriptions and invoices."
                        : "Use this to inspect Stripe-linked accounts, customer identity, and saved payment methods."}
                    </p>
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
              <section className={styles.adminSubpanel}>
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
                  Search the user index, select a row once, and delete accounts only when support
                  policy requires it.
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

            <div className={styles.adminTable}>
              <div className={`${styles.adminTableHead} ${styles.adminSupportQueueHead}`}>
                <span>User</span>
                <span>Copy</span>
                <span>Flags</span>
                <span>Spendable</span>
                <span>Billing</span>
                <span>Actions</span>
              </div>
              {usersError ? (
                <div className={`${styles.adminTableRow} ${styles.adminSupportQueueRow}`}>
                  <span className="subdued">{usersError}</span>
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
                </div>
              ) : (
                prioritizedUsers.map((row) => {
                  const rowLabel = row.email ?? row.id;
                  const isCurrentAdmin = row.id === currentAdminUserId;
                  const queueSignals: QueueSignal[] = [];
                  if (row.spendableCredits <= 0) {
                    queueSignals.push({
                      label: "Credits empty",
                      toneClassName: styles.pillCritical,
                    });
                  }

                  return (
                    <div
                      key={row.id}
                      className={`${styles.adminTableRow} ${styles.adminSupportQueueRow} ${
                        selectedUserId === row.id ? styles.adminTableRowActive : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={styles.adminSupportQueueSelectButton}
                        onClick={() => setSelectedUserId(row.id)}
                        aria-label={`Select ${rowLabel}`}
                        aria-pressed={selectedUserId === row.id}
                      />
                      <div className={styles.adminSupportQueueRowContent}>
                        <span className={styles.adminSupportQueueCell} data-label="User">
                          <span className={styles.adminSupportQueueEmail}>
                            <span className={styles.adminSupportQueueEmailText}>{rowLabel}</span>
                          </span>
                        </span>
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
                        <span className={styles.adminSupportQueueCell} data-label="Flags">
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
                        <span className={styles.adminSupportQueueCell} data-label="Spendable">
                          <span className="mono">{row.spendableCredits.toLocaleString()}</span>
                        </span>
                        <span
                          className={`${styles.adminSupportQueueCell} subdued`}
                          data-label="Billing"
                        >
                          <span>{formatStatusLabel(row.subscriptionStatus)}</span>
                          {row.contractSource !== "internal_comp" &&
                          row.recurringPriceCents != null ? (
                            <span className={styles.adminCreditMeta}>
                              {formatUsd(row.recurringPriceCents / 100)}/mo
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className={styles.adminSupportQueueActions}>
                        {!isCurrentAdmin ? (
                          <button
                            type="button"
                            className={`ghost-btn mini ${styles.adminDangerButton}`}
                            onClick={() => openDeleteModal(row)}
                            disabled={deleteSubmitting}
                            aria-label={`Delete ${rowLabel}`}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
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

            {deleteResult ? <p className="tiny subdued">{deleteResult}</p> : null}
          </section>
        </div>
      </section>

      {pendingDeleteUser ? (
        <section
          {...deleteModalBackdropDismiss}
          className={styles.adminModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
        >
          <div className={styles.adminModalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.adminSectionHead}>
              <div>
                <p className="eyebrow">Delete user</p>
                <h3 id="delete-user-title" className={styles.adminSectionTitle}>
                  Permanently delete this ShortPulse account?
                </h3>
                <p className="tiny subdued">
                  This action is destructive and should only be used when you are certain the
                  account should be removed from the product.
                </p>
              </div>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={closeDeleteModal}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
            </div>

            <div className={styles.adminModalGrid}>
              <div className={styles.errorCell}>
                <span className="tiny subdued">User</span>
                <span>{pendingDeleteUser.email ?? pendingDeleteUser.id}</span>
              </div>
              <div className={styles.errorCell}>
                <span className="tiny subdued">User ID</span>
                <span className="mono">{pendingDeleteUser.id}</span>
              </div>
              <div className={styles.errorCell}>
                <span className="tiny subdued">Plan</span>
                <span>{planLabel(pendingDeleteUser.planId)}</span>
              </div>
              <div className={styles.errorCell}>
                <span className="tiny subdued">Spendable credits</span>
                <span>{pendingDeleteUser.spendableCredits.toLocaleString()}</span>
              </div>
            </div>

            <div className={styles.adminDeleteWarning}>
              <p className={styles.adminDeleteWarningTitle}>
                This permanently removes product access.
              </p>
              <p className="tiny subdued">
                ShortPulse will delete the auth account and any user-linked product records that
                cascade from it. Review external billing separately before deleting an active
                subscriber.
              </p>
            </div>

            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">
                Type <span className="mono">{deleteConfirmationTarget}</span> exactly to confirm
              </span>
              <input
                className={styles.searchInput}
                type="text"
                value={deleteConfirmationValue}
                onChange={(event) => setDeleteConfirmationValue(event.target.value)}
                placeholder={deleteConfirmationTarget}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </label>

            {deleteResult ? <p className="tiny subdued">{deleteResult}</p> : null}

            <div className={styles.manualAdjustActions}>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={closeDeleteModal}
                disabled={deleteSubmitting}
              >
                Keep user
              </button>
              <button
                type="button"
                className={styles.adminDangerConfirmButton}
                onClick={() => {
                  void handleConfirmDelete();
                }}
                disabled={!deleteConfirmationMatches || deleteSubmitting}
              >
                {deleteSubmitting ? "Deleting…" : "Delete user permanently"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
