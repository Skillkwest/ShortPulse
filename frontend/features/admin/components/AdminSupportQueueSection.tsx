/**
 * Admin support queue section.
 * Handles user lookup, row selection, credit adjustment, and recent ledger inspection.
 */
import { useState } from "react";
import Link from "next/link";
import {
  ADMIN_DASHBOARD_ADJUSTMENT_PRESETS,
  ADMIN_DASHBOARD_CREDIT_LEDGER_LIMIT,
} from "../logic/useAdminUsersCreditsController";
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
  internalCompPlan: string;
  internalCompReason: string;
  allowStripeTakeover: boolean;
  billingOverrideSubmitting: boolean;
  billingOverrideResult: string | null;
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
  handleInternalCompPlanChange: (value: string) => void;
  handleInternalCompReasonChange: (value: string) => void;
  handleAllowStripeTakeoverChange: (value: boolean) => void;
  applyAdjustmentPreset: (delta: number) => void;
  handleCreditAdjust: () => Promise<void>;
  handleGrantInternalComp: () => Promise<void>;
  handleRevokeInternalComp: () => Promise<void>;
  handleDeleteUser: (params: { userId: string; confirmationText: string }) => Promise<boolean>;
  clearDeleteResult: () => void;
  planLabel: (planId: string | null) => string;
  formatCreditDelta: (changeCents: number) => string;
  formatUsd: (value: number | null) => string;
};

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
  internalCompPlan,
  internalCompReason,
  allowStripeTakeover,
  billingOverrideSubmitting,
  billingOverrideResult,
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
  handleInternalCompPlanChange,
  handleInternalCompReasonChange,
  handleAllowStripeTakeoverChange,
  applyAdjustmentPreset,
  handleCreditAdjust,
  handleGrantInternalComp,
  handleRevokeInternalComp,
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

  const [ledgerUserId, setLedgerUserId] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUserRow | null>(null);
  const [deleteConfirmationValue, setDeleteConfirmationValue] = useState("");
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
  const snapshotPriceLabel =
    billingDiagnostics?.stripeSubscription?.subscriptionId &&
    billingDiagnostics.stripeSubscription.recurringPriceCents != null
      ? `${formatUsd(billingDiagnostics.stripeSubscription.recurringPriceCents / 100)}/mo`
      : selectedUserPriceLabel;
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
        {
          key: "status",
          label: "Status",
          value: snapshotStatus ?? "inactive",
          testId: "snapshot-card-status",
        },
        {
          key: "spendable",
          value: selectedUser.spendableCredits.toLocaleString(),
          label: "spendable",
          testId: "snapshot-metric-spendable",
        },
        selectedUser.availableCredits !== selectedUser.spendableCredits
          ? {
              key: "available",
              value: selectedUser.availableCredits.toLocaleString(),
              label: "available",
              testId: "snapshot-metric-available",
            }
          : null,
        selectedUser.reservedCredits > 0
          ? {
              key: "held",
              value: selectedUser.reservedCredits.toLocaleString(),
              label: "held",
              testId: "snapshot-metric-held",
            }
          : null,
      ].filter((card): card is SnapshotCard => Boolean(card))
    : [];
  const snapshotNote = !selectedUserId
    ? "Pick a user from the list below."
    : billingDiagnosticsError
      ? billingDiagnosticsError
      : billingDiagnosticsLoading && !billingDiagnosticsLoaded
        ? "Loading latest account snapshot…"
        : billingFindings.length > 0
          ? `${billingFindings[0]?.summary}${
              billingFindings.length > 1 ? ` + ${billingFindings.length - 1} more` : ""
            }`
          : null;

  const handleShowLedger = async () => {
    if (!selectedUserId) return;
    setLedgerUserId(selectedUserId);
    if (!creditLedgerLoaded && !creditLedgerLoading) {
      await loadCreditLedger();
    }
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
        <div className={styles.adminSectionHead}>
          <div>
            <p className="eyebrow">Support console</p>
            <h2 className={styles.adminSectionTitle}>Support queue</h2>
            <p className="tiny subdued">
              Review the selected account, inspect billing drift, and make support-side credit
              changes from one primary workspace before drilling into the user list below.
            </p>
          </div>
        </div>
        <div className={styles.adminSupportStack}>
          <div
            className={`${styles.adminSplitGrid} ${
              !ledgerVisible ? styles.adminSplitGridSingle : ""
            }`}
          >
            <section className={`${styles.adminSubpanel} ${styles.adminPrimaryPanel}`}>
              <div className={styles.accountSnapshot}>
                <div className={styles.accountSnapshotHead}>
                  <div className={styles.accountSnapshotIdentity}>
                    <span className={styles.accountSnapshotTitle}>
                      {selectedUser?.email ?? selectedUser?.id ?? "Pick a user from the list below"}
                    </span>
                  </div>
                  {snapshotNote ? (
                    <span className={styles.accountSnapshotNote}>{snapshotNote}</span>
                  ) : null}
                </div>
                {snapshotCards.length > 0 ? (
                  <div className={styles.accountSnapshotCards} data-testid="snapshot-plan-card">
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
              </div>

              <div className={styles.manualAdjustPanel}>
                <label className={styles.manualAdjustField}>
                  <input
                    className={styles.searchInput}
                    type="text"
                    value={adjustment}
                    pattern="[+-]?[0-9]*"
                    inputMode="numeric"
                    autoComplete="off"
                    onChange={(event) => handleAdjustmentChange(event.target.value)}
                    placeholder="+500 or -100"
                    disabled={!selectedUserId}
                  />
                </label>

                <div className={styles.manualAdjustFooter}>
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

                  <div className={styles.manualAdjustActions}>
                    <button
                      type="button"
                      className={`ghost-btn mini ${styles.manualAdjustPrimaryAction}`}
                      onClick={() => void handleCreditAdjust()}
                      disabled={adjustSubmitting || !selectedUserId}
                    >
                      {adjustSubmitting ? "Applying…" : "Apply"}
                    </button>
                    {selectedUserId ? (
                      <Link
                        href={`/admin/user-health?lookup=${encodeURIComponent(
                          selectedUserId
                        )}&lookupMode=user_id`}
                        className={`ghost-btn mini ${styles.manualAdjustSecondaryAction}`}
                      >
                        Open health check
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={`ghost-btn mini ${styles.manualAdjustSecondaryAction}`}
                        disabled
                      >
                        Open health check
                      </button>
                    )}
                    <button
                      type="button"
                      className={`ghost-btn mini ${styles.manualAdjustSecondaryAction}`}
                      onClick={() => {
                        void handleShowLedger();
                      }}
                      disabled={!selectedUserId || creditLedgerLoading || ledgerVisible}
                    >
                      {creditLedgerLoading ? "Loading log…" : "Show log"}
                    </button>
                  </div>
                </div>
              </div>

              {adjustResult ? <p className="tiny subdued">{adjustResult}</p> : null}

              <div className={styles.manualAdjustPanel}>
                <div className={styles.adminSectionHead}>
                  <div>
                    <p className="eyebrow">Internal access</p>
                    <p className="tiny subdued">
                      Grant non-public Media, Studio, or Business access without a Stripe
                      subscription. This is intended for internal/admin comp scenarios.
                    </p>
                  </div>
                </div>

                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Internal comp tier</span>
                  <select
                    className={styles.searchInput}
                    value={internalCompPlan}
                    onChange={(event) => handleInternalCompPlanChange(event.target.value)}
                    disabled={!selectedUserId || billingOverrideSubmitting}
                  >
                    <option value="media">Media</option>
                    <option value="studio">Studio</option>
                    <option value="business">Business</option>
                  </select>
                </label>

                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Reason</span>
                  <input
                    className={styles.searchInput}
                    type="text"
                    value={internalCompReason}
                    onChange={(event) => handleInternalCompReasonChange(event.target.value)}
                    placeholder="Internal test, founder access, support comp"
                    disabled={!selectedUserId || billingOverrideSubmitting}
                  />
                </label>

                <label className="tiny subdued">
                  <input
                    type="checkbox"
                    checked={allowStripeTakeover}
                    onChange={(event) => handleAllowStripeTakeoverChange(event.target.checked)}
                    disabled={!selectedUserId || billingOverrideSubmitting}
                  />{" "}
                  I already handled any live Stripe subscription outside ShortPulse and want this
                  action to clear the local Stripe linkage.
                </label>

                <div className={styles.manualAdjustActions}>
                  <button
                    type="button"
                    className={`ghost-btn mini ${styles.manualAdjustPrimaryAction}`}
                    onClick={() => {
                      void handleGrantInternalComp();
                    }}
                    disabled={!selectedUserId || billingOverrideSubmitting}
                  >
                    {billingOverrideSubmitting ? "Applying…" : "Apply internal comp"}
                  </button>
                  <button
                    type="button"
                    className={`ghost-btn mini ${styles.manualAdjustSecondaryAction}`}
                    onClick={() => {
                      void handleRevokeInternalComp();
                    }}
                    disabled={
                      !selectedUserId ||
                      billingOverrideSubmitting ||
                      snapshotContractSource !== "internal_comp"
                    }
                  >
                    Return to Free
                  </button>
                </div>
              </div>

              {billingOverrideResult ? (
                <p className="tiny subdued">{billingOverrideResult}</p>
              ) : null}
            </section>

            {ledgerVisible ? (
              <section className={styles.adminSubpanel}>
                <div className={styles.adminSectionHead}>
                  <div>
                    <p className="eyebrow">Credit transaction log</p>
                    <p className="tiny subdued">
                      Latest {ADMIN_DASHBOARD_CREDIT_LEDGER_LIMIT} rows for the selected user.
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

            <div className={styles.adminEmailPanel}>
              <div className={styles.adminEmailPanelHeader}>
                <span className={styles.selectionSummaryLabel}>Admin emails</span>
                <span className={styles.adminEmailBadge}>Current session</span>
              </div>
              <div className={styles.adminEmailList}>
                <article className={styles.adminEmailCard}>
                  <span className={styles.adminEmailValue}>
                    {adminIdentityEmail || "No admin email resolved"}
                  </span>
                  <span className="tiny subdued">
                    This account is pinned to the top of the loaded user list
                    {adminUserPresent ? "." : " when it appears in the current results."}
                  </span>
                </article>
              </div>
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
                <span>Plan</span>
                <span>Spendable</span>
                <span>Subscription</span>
                <span>Actions</span>
              </div>
              {usersError ? (
                <div className={`${styles.adminTableRow} ${styles.adminSupportQueueRow}`}>
                  <span className="subdued">{usersError}</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                </div>
              ) : users.length === 0 ? (
                <div className={`${styles.adminTableRow} ${styles.adminSupportQueueRow}`}>
                  <span className="subdued">No users match.</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                  <span className="subdued">—</span>
                </div>
              ) : (
                prioritizedUsers.map((row) => {
                  const rowLabel = row.email ?? row.id;
                  const isCurrentAdmin = row.id === currentAdminUserId;

                  return (
                    <div
                      key={row.id}
                      className={`${styles.adminTableRow} ${styles.adminSupportQueueRow} ${
                        selectedUserId === row.id ? styles.adminTableRowActive : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={styles.adminSupportQueueRowButton}
                        onClick={() => setSelectedUserId(row.id)}
                        aria-label={`Select ${rowLabel}`}
                        aria-pressed={selectedUserId === row.id}
                      >
                        <span className={styles.adminSupportQueueCell} data-label="User">
                          <span>{rowLabel}</span>
                          {isCurrentAdmin ? (
                            <span className={styles.adminInlineBadge}>Admin email</span>
                          ) : null}
                        </span>
                        <span className={styles.adminSupportQueueCell} data-label="Plan">
                          {planLabel(row.planId)}
                        </span>
                        <span
                          className={`${styles.adminSupportQueueCell} ${styles.adminCreditCell}`}
                          data-label="Spendable"
                        >
                          <span className="mono">{row.spendableCredits.toLocaleString()}</span>
                          <span className={styles.adminCreditMeta}>
                            avail {row.availableCredits.toLocaleString()} · holds{" "}
                            {row.reservedCredits.toLocaleString()}
                          </span>
                        </span>
                        <span
                          className={`${styles.adminSupportQueueCell} subdued`}
                          data-label="Subscription"
                        >
                          <span>{row.subscriptionStatus ?? "inactive"}</span>
                          {row.recurringPriceCents != null ? (
                            <span className={styles.adminCreditMeta}>
                              {formatUsd(row.recurringPriceCents / 100)}/mo
                            </span>
                          ) : null}
                          {row.contractSource ? (
                            <span className={styles.adminCreditMeta}>
                              {row.contractSource === "internal_comp" ? "internal comp" : "stripe"}
                            </span>
                          ) : null}
                        </span>
                      </button>
                      <div className={styles.adminSupportQueueActions}>
                        <button
                          type="button"
                          className={`ghost-btn mini ${styles.adminDangerButton}`}
                          onClick={() => openDeleteModal(row)}
                          disabled={deleteSubmitting || isCurrentAdmin}
                          aria-label={`Delete ${rowLabel}`}
                        >
                          {isCurrentAdmin ? "Current admin" : "Delete"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.searchRow}>
              <p className="tiny subdued">
                Showing {usersResultStart}-{usersResultEnd} of {usersPagination.totalCount}
                {userSearchLimited ? " (search limited to the first 10,000 users scanned)" : ""}
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
          className={styles.adminModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
          onClick={closeDeleteModal}
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
