/**
 * Admin support home.
 * Focuses the landing page on user support and credit workflows, with deep links to specialized admin routes.
 */
import React, { useMemo } from "react";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { AdminSupportQueueSection } from "../../features/admin/components/AdminSupportQueueSection";
import { useAdminUsersCreditsController } from "../../features/admin/logic/useAdminUsersCreditsController";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useProtectedRoute } from "../../lib/authGuard";

const planLabel = (planId: string | null): string => {
  if (!planId) return "—";
  if (planId === "creative_suite" || planId === "creative") return "Business";
  if (planId === "pro") return "Studio";
  if (planId === "business") return "Business";
  if (planId === "studio") return "Studio";
  return planId.charAt(0).toUpperCase() + planId.slice(1);
};

const formatCreditDelta = (changeCents: number): string =>
  `${changeCents > 0 ? "+" : ""}${Math.trunc(changeCents).toLocaleString()}`;

const formatUsd = (value: number | null): string => (value == null ? "—" : `$${value.toFixed(2)}`);

export default function AdminDashboardPage() {
  const { loading, user } = useProtectedRoute(true);
  const {
    status: adminAccessStatus,
    isLoading: isAdminAccessLoading,
    isAdmin: adminEnabled,
    error: adminAccessError,
    refresh: refreshAdminAccess,
  } = useAdminAccess({
    enabled: Boolean(user),
    userId: user?.id ?? null,
  });
  const {
    userSearch,
    usersPagination,
    userSearchLimited,
    users,
    usersLoading,
    usersError,
    selectedUserId,
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
  } = useAdminUsersCreditsController({
    enabled: Boolean(user && adminEnabled),
    currentAdminUserId: user?.id ?? "",
  });

  const selectedUser = useMemo(
    () => users.find((row) => row.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  return (
    <AdminRouteShell
      loading={loading}
      isAdminEnabled={adminEnabled}
      isAdminAccessLoading={isAdminAccessLoading}
      adminAccessStatus={adminAccessStatus}
      adminAccessError={adminAccessError}
      onRetryAccessCheck={refreshAdminAccess}
      documentTitle="ShortPulse · Admin Support"
      metaDescription="Admin support workspace for user lookup, credits, and operator drill-downs."
      pageTitle="Support console"
      pageDescription="Search users, make account adjustments, inspect recent ledger entries when needed, and jump into deeper admin tools from the shared nav."
      userEmail={user?.email}
      currentPath="/admin"
    >
      <AdminSupportQueueSection
        userSearch={userSearch}
        usersPagination={usersPagination}
        userSearchLimited={userSearchLimited}
        users={users}
        usersLoading={usersLoading}
        usersError={usersError}
        currentAdminUserId={user?.id ?? ""}
        currentAdminEmail={user?.email ?? ""}
        selectedUserId={selectedUserId}
        selectedUser={selectedUser}
        adjustment={adjustment}
        adjustSubmitting={adjustSubmitting}
        adjustResult={adjustResult}
        allowStripeTakeover={allowStripeTakeover}
        billingOverrideSubmitting={billingOverrideSubmitting}
        billingOverrideResult={billingOverrideResult}
        billingPortalSubmitting={billingPortalSubmitting}
        billingPortalResult={billingPortalResult}
        billingCustomerSyncSubmitting={billingCustomerSyncSubmitting}
        billingCustomerSyncResult={billingCustomerSyncResult}
        creditLedgerRows={creditLedgerRows}
        creditLedgerLoading={creditLedgerLoading}
        creditLedgerError={creditLedgerError}
        creditLedgerLoaded={creditLedgerLoaded}
        billingDiagnostics={billingDiagnostics}
        billingDiagnosticsLoading={billingDiagnosticsLoading}
        billingDiagnosticsError={billingDiagnosticsError}
        billingDiagnosticsLoaded={billingDiagnosticsLoaded}
        usersResultStart={usersResultStart}
        usersResultEnd={usersResultEnd}
        setSelectedUserId={setSelectedUserId}
        loadUsers={loadUsers}
        loadCreditLedger={loadCreditLedger}
        handleUserSearchChange={handleUserSearchChange}
        handlePreviousUsersPage={handlePreviousUsersPage}
        handleNextUsersPage={handleNextUsersPage}
        handleAdjustmentChange={handleAdjustmentChange}
        handleAllowStripeTakeoverChange={handleAllowStripeTakeoverChange}
        applyAdjustmentPreset={applyAdjustmentPreset}
        handleCreditAdjust={handleCreditAdjust}
        handleGrantInternalComp={handleGrantInternalComp}
        handleRevokeInternalComp={handleRevokeInternalComp}
        handleOpenSelectedUserBilling={handleOpenSelectedUserBilling}
        handleSyncSelectedUserBillingCustomer={handleSyncSelectedUserBillingCustomer}
        planLabel={planLabel}
        formatCreditDelta={formatCreditDelta}
        formatUsd={formatUsd}
      />
    </AdminRouteShell>
  );
}
