import React from "react";
import { AppMessage } from "../../components/AppMessage";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import {
  PricingConfirmationDialog,
  PricingHealthSection,
  PricingWorkspaceNotice,
} from "../../features/admin/PricingPageChrome";
import { PricingCatalogSections } from "../../features/admin/PricingCatalogSections";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useAdminPricingController } from "../../features/admin/logic/useAdminPricingController";
import { useAdminPricingPageState } from "../../features/admin/logic/useAdminPricingPageState";
import { useProtectedRoute } from "../../lib/authGuard";
import styles from "../../styles/admin.module.css";

export default function AdminCatalogPage() {
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
  const { pricingState, pricingLoading, pricingRefreshing, pricingError, refreshPricingState } =
    useAdminPricingController({
      enabled: Boolean(user && adminEnabled),
    });

  const pageState = useAdminPricingPageState({
    pricingState,
    pricingLoading,
    pricingError,
    refreshPricingState,
  });

  return (
    <AdminRouteShell
      loading={loading}
      isAdminEnabled={adminEnabled}
      isAdminAccessLoading={isAdminAccessLoading}
      adminAccessStatus={adminAccessStatus}
      adminAccessError={adminAccessError}
      onRetryAccessCheck={refreshAdminAccess}
      documentTitle="ShortPulse · Admin Catalog"
      metaDescription="Admin catalog workspace for public plans, credit packages, and storage add-ons."
      pageTitle="Catalog"
      pageDescription="Manage public plans, credit top-ups, storage add-ons, and Stripe linkage warnings."
      userEmail={user?.email}
      currentPath="/admin/catalog"
      mainClassName={styles.adminPricingPageWide}
    >
      {pageState.pricingWorkspaceState ? (
        <PricingWorkspaceNotice
          workspaceState={pageState.pricingWorkspaceState}
          pricingLoading={pricingLoading}
          pricingRefreshing={pricingRefreshing}
          onRefresh={() => void refreshPricingState()}
        />
      ) : (
        <>
          {pageState.pricingRefreshWarning ? (
            <AppMessage
              className={styles.announcementError}
              tone="warning"
              mode="banner"
              message={pageState.pricingRefreshWarning}
            />
          ) : null}

          <PricingHealthSection health={pricingState?.health} />

          <PricingCatalogSections
            pricingState={pricingState}
            defaultExpanded
            showToggle={false}
            planDraft={pageState.planDraft}
            setPlanDraft={pageState.setPlanDraft}
            planOfferDraft={pageState.planOfferDraft}
            setPlanOfferDraft={pageState.setPlanOfferDraft}
            planSaving={pageState.planSaving}
            planMessage={pageState.planMessage}
            planError={pageState.planError}
            setPlanMessage={pageState.setPlanMessage}
            setPlanError={pageState.setPlanError}
            onConfirmPlanCreate={pageState.openPlanCreateConfirmation}
            onConfirmPlanOffer={pageState.openPlanOfferConfirmation}
            creditDraft={pageState.creditDraft}
            setCreditDraft={pageState.setCreditDraft}
            creditSaving={pageState.creditSaving}
            creditMessage={pageState.creditMessage}
            creditError={pageState.creditError}
            setCreditMessage={pageState.setCreditMessage}
            setCreditError={pageState.setCreditError}
            onConfirmCreditPackage={pageState.openCreditPackageConfirmation}
            storageDraft={pageState.storageDraft}
            setStorageDraft={pageState.setStorageDraft}
            storageSaving={pageState.storageSaving}
            storageMessage={pageState.storageMessage}
            storageError={pageState.storageError}
            setStorageMessage={pageState.setStorageMessage}
            setStorageError={pageState.setStorageError}
            onConfirmStorageOffer={pageState.openStorageOfferConfirmation}
          />

          <PricingConfirmationDialog
            pendingConfirmation={pageState.pendingConfirmation}
            onCancel={pageState.cancelPendingPricingAction}
            onConfirm={pageState.confirmPendingPricingAction}
            confirmDisabled={
              Boolean(pageState.pendingConfirmation?.hasInvalidDraft) ||
              pageState.planSaving ||
              pageState.creditSaving ||
              pageState.storageSaving
            }
            cancelDisabled={
              pageState.planSaving || pageState.creditSaving || pageState.storageSaving
            }
          />
        </>
      )}
    </AdminRouteShell>
  );
}
