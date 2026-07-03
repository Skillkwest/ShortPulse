import React from "react";
import { AppMessage } from "../../components/AppMessage";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import {
  PricingConfirmationDialog,
  PricingCostDocsPopover,
  PricingWorkspaceNotice,
} from "../../features/admin/PricingPageChrome";
import { PricingCalculatorSupportStrip } from "../../features/admin/PricingCalculatorSupportStrip";
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
      documentTitle="ShortPulse · Admin Model Pricing"
      metaDescription="Model-pricing calculator for draft runtime pricing and live policy saves."
      pageTitle="Model Pricing"
      pageDescription="Edit draft model pricing in the truth grid and save it live when the math looks right."
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
            <AppMessage
              className={styles.announcementError}
              tone="warning"
              mode="banner"
              message={pageState.pricingRefreshWarning}
            />
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

          <PricingModelWorkbook
            pricingState={pricingState}
            displayedModels={pageState.displayedModels}
            effectiveModelPolicyDraft={pageState.effectiveModelPolicyDraft}
            effectiveCustomRowsDraft={pageState.effectiveCustomRowsDraft}
            durationDrafts={pageState.durationDrafts}
            setDurationDrafts={pageState.setDurationDrafts}
            markupDrafts={pageState.markupDrafts}
            setMarkupDrafts={pageState.setMarkupDrafts}
            variantMarkupDrafts={pageState.variantMarkupDrafts}
            setVariantMarkupDrafts={pageState.setVariantMarkupDrafts}
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
            updateCustomRowsDraft={pageState.updateCustomRowsDraft}
          />

          <PricingCalculatorSupportStrip
            plans={pricingState?.plans ?? []}
            displayedModels={pageState.displayedModels}
            effectiveModelPolicyDraft={pageState.effectiveModelPolicyDraft}
            durationDrafts={pageState.durationDrafts}
            aspectDrafts={pageState.aspectDrafts}
            resolutionDrafts={pageState.resolutionDrafts}
            audioDrafts={pageState.audioDrafts}
            customRowsDocument={pageState.effectiveCustomRowsDraft}
            modelSortOption={pageState.modelSortOption}
            planDraftsByPlanId={pageState.planEconomicsDrafts}
            simulatorPlanIds={pageState.simulatorPlanIds}
            updatePlanDraft={pageState.updatePlanEconomicsDraft}
            addSimulatorPlan={pageState.addSimulatorPlan}
            removeSimulatorPlan={pageState.removeSimulatorPlan}
            reorderSimulatorPlans={pageState.reorderSimulatorPlans}
            isDraftDirty={pageState.canApplyModelPolicy}
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
