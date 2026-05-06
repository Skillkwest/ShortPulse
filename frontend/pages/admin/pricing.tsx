import React from "react";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import {
  PricingConfirmationDialog,
  PricingCostDocsPopover,
  PricingHealthSection,
  PricingWorkspaceNotice,
} from "../../features/admin/PricingPageChrome";
import { PricingCalculatorSupportStrip } from "../../features/admin/PricingCalculatorSupportStrip";
import { PricingCatalogSections } from "../../features/admin/PricingCatalogSections";
import { PricingModelWorkbook } from "../../features/admin/PricingModelWorkbook";
import { PricingPolicyStatusBar } from "../../features/admin/PricingPolicyStatusBar";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useAdminPricingController } from "../../features/admin/logic/useAdminPricingController";
import { useAdminPricingPageState } from "../../features/admin/logic/useAdminPricingPageState";
import { useProtectedRoute } from "../../lib/authGuard";
import styles from "../../styles/admin.module.css";

export default function AdminPricingPage() {
  const { loading, user } = useProtectedRoute(true);
  const {
    status: adminAccessStatus,
    isLoading: isAdminAccessLoading,
    isAdmin: adminEnabled,
    error: adminAccessError,
    refresh: refreshAdminAccess,
  } = useAdminAccess({
    enabled: Boolean(user),
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
      documentTitle="ShortPulse · Admin Pricing"
      metaDescription="Grid-first admin pricing calculator for draft runtime pricing and live policy saves."
      pageTitle="Pricing"
      pageDescription="Edit draft runtime pricing in the truth grid and save it live when the math looks right."
      userEmail={user?.email}
      currentPath="/admin/pricing"
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
            <p className={styles.announcementError}>{pageState.pricingRefreshWarning}</p>
          ) : null}

          <PricingPolicyStatusBar
            activePolicyVersion={pageState.modelPolicySnapshot?.activePolicyVersion}
            updatedAt={pageState.modelPolicySnapshot?.updatedAt}
            updatedByEmail={pageState.modelPolicySnapshot?.updatedByEmail}
            isDraftDirty={pageState.canApplyModelPolicy}
            draftPolicyDiffDescriptions={pageState.draftPolicyDiffDescriptions}
            saveDisabled={
              Boolean(pageState.hasInvalidModelPolicyDraft) ||
              pageState.modelPolicySaving ||
              pageState.modelPolicyRollbackLoading ||
              !pageState.canApplyModelPolicy
            }
            resetDisabled={
              pageState.modelPolicySaving ||
              pageState.modelPolicyRollbackLoading ||
              !pageState.canApplyModelPolicy
            }
            rollbackDisabled={pageState.modelPolicySaving || pageState.modelPolicyRollbackLoading}
            saveLoading={pageState.modelPolicySaving}
            rollbackLoading={pageState.modelPolicyRollbackLoading}
            onSave={pageState.openModelPolicyApplyConfirmation}
            onReset={pageState.resetModelPolicyDraft}
            onRollback={pageState.openModelPolicyRollbackConfirmation}
          />

          <PricingHealthSection health={pricingState?.health} />

          <PricingModelWorkbook
            pricingState={pricingState}
            displayedModels={pageState.displayedModels}
            effectiveModelPolicyDraft={pageState.effectiveModelPolicyDraft}
            durationDrafts={pageState.durationDrafts}
            setDurationDrafts={pageState.setDurationDrafts}
            aspectDrafts={pageState.aspectDrafts}
            updateAspectDraft={pageState.updateAspectDraft}
            resolutionDrafts={pageState.resolutionDrafts}
            updateResolutionDraft={pageState.updateResolutionDraft}
            audioDrafts={pageState.audioDrafts}
            updateAudioDraft={pageState.updateAudioDraft}
            creditScaleDrafts={pageState.creditScaleDrafts}
            setCreditScaleDrafts={pageState.setCreditScaleDrafts}
            markupDrafts={pageState.markupDrafts}
            setMarkupDrafts={pageState.setMarkupDrafts}
            variantMarkupDrafts={pageState.variantMarkupDrafts}
            setVariantMarkupDrafts={pageState.setVariantMarkupDrafts}
            providerCostDrafts={pageState.providerCostDrafts}
            setProviderCostDrafts={pageState.setProviderCostDrafts}
            providerCostPerSecondDrafts={pageState.providerCostPerSecondDrafts}
            setProviderCostPerSecondDrafts={pageState.setProviderCostPerSecondDrafts}
            variantProviderCostDrafts={pageState.variantProviderCostDrafts}
            setVariantProviderCostDrafts={pageState.setVariantProviderCostDrafts}
            variantProviderCostPerSecondDrafts={pageState.variantProviderCostPerSecondDrafts}
            setVariantProviderCostPerSecondDrafts={pageState.setVariantProviderCostPerSecondDrafts}
            modelSortOption={pageState.modelSortOption}
            setModelSortOption={pageState.setModelSortOption}
            modelSearchQuery={pageState.modelSearchQuery}
            setModelSearchQuery={pageState.setModelSearchQuery}
            globalCreditScaleDraft={pageState.globalCreditScaleDraft}
            updateGlobalCreditScaleDraft={pageState.updateGlobalCreditScaleDraft}
            globalCreditUsdAmountDraft={pageState.globalCreditUsdAmountDraft}
            updateGlobalCreditUsdAmountDraft={pageState.updateGlobalCreditUsdAmountDraft}
            resetInvalidGlobalConversionDraft={pageState.resetInvalidGlobalConversionDraft}
            modelPolicyMessage={pageState.modelPolicyMessage}
            modelPolicyError={pageState.modelPolicyError}
            canApplyModelPolicy={pageState.canApplyModelPolicy}
            showCostDocsPopover={pageState.showCostDocsPopover}
            hideCostDocsPopover={pageState.hideCostDocsPopover}
            updateModelPolicyDraft={pageState.updateModelPolicyDraft}
          />

          <PricingCalculatorSupportStrip
            plans={pricingState?.plans ?? []}
            selectedPlanId={pageState.selectedUsagePlanId}
            setSelectedPlanId={pageState.setSelectedUsagePlanId}
            selectedPlanDraft={
              pageState.selectedUsagePlan
                ? pageState.planEconomicsDrafts[pageState.selectedUsagePlan.planId]
                : null
            }
            updatePlanDraft={pageState.updatePlanEconomicsDraft}
            usageMixRows={pageState.usageMixRows}
            updateUsageMixRow={pageState.updateUsageMixRow}
            addUsageMixRow={pageState.addUsageMixRow}
            removeUsageMixRow={pageState.removeUsageMixRow}
            models={pricingState?.models ?? []}
            modelRows={pageState.modelEconomicsRows}
            pricingPolicy={pageState.effectiveModelPolicyDraft}
            aspectDrafts={pageState.aspectDrafts}
            resolutionDrafts={pageState.resolutionDrafts}
            audioDrafts={pageState.audioDrafts}
            isDraftDirty={pageState.canApplyModelPolicy}
          />

          <PricingCatalogSections
            pricingState={pricingState}
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

          <PricingCostDocsPopover popover={pageState.costDocsPopover} />
          <PricingConfirmationDialog
            pendingConfirmation={pageState.pendingConfirmation}
            onCancel={pageState.cancelPendingPricingAction}
            onConfirm={pageState.confirmPendingPricingAction}
            confirmDisabled={
              Boolean(pageState.pendingConfirmation?.hasInvalidDraft) ||
              pageState.modelPolicySaving ||
              pageState.modelPolicyRollbackLoading ||
              pageState.planSaving ||
              pageState.creditSaving ||
              pageState.storageSaving
            }
            cancelDisabled={
              pageState.modelPolicySaving ||
              pageState.modelPolicyRollbackLoading ||
              pageState.planSaving ||
              pageState.creditSaving ||
              pageState.storageSaving
            }
          />
        </>
      )}
    </AdminRouteShell>
  );
}
