/**
 * Model pricing workbook table and inline policy editor for the admin pricing page.
 */
import React from "react";
import { AppMessage } from "../../components/AppMessage";
import type {
  AdminPricingModelRow,
  AdminPricingPreviewVariant,
  AdminPricingStateResponse,
} from "./types";
import {
  MODEL_PRICING_SORT_OPTIONS,
  type DurationDraftByModelId,
  type MarkupDraftByModelId,
  type ModelPricingSortOption,
  type VariantMarkupDraftByVariantKey,
  type VariantProviderCostDraftByVariantKey,
  type VariantProviderCostPerSecondDraftByVariantKey,
} from "./pricingPageUtils";
import { PricingModelWorkbookTable } from "./PricingModelWorkbookTable";
import type { AdminPricingCustomRowsDocument } from "../../lib/model-runtime/adminPricingCustomRows";
import { type ModelPricingPolicyDocument } from "../../lib/model-runtime/pricingPolicy";
import styles from "../../styles/admin.module.css";

type PricingModelWorkbookProps = {
  pricingState: AdminPricingStateResponse | null;
  displayedModels: AdminPricingModelRow[];
  effectiveModelPolicyDraft: ModelPricingPolicyDocument;
  effectiveCustomRowsDraft: AdminPricingCustomRowsDocument;
  durationDrafts: DurationDraftByModelId;
  setDurationDrafts: React.Dispatch<React.SetStateAction<DurationDraftByModelId>>;
  markupDrafts: MarkupDraftByModelId;
  setMarkupDrafts: React.Dispatch<React.SetStateAction<MarkupDraftByModelId>>;
  variantMarkupDrafts: VariantMarkupDraftByVariantKey;
  setVariantMarkupDrafts: React.Dispatch<React.SetStateAction<VariantMarkupDraftByVariantKey>>;
  variantProviderCostDrafts: VariantProviderCostDraftByVariantKey;
  setVariantProviderCostDrafts: React.Dispatch<
    React.SetStateAction<VariantProviderCostDraftByVariantKey>
  >;
  variantProviderCostPerSecondDrafts: VariantProviderCostPerSecondDraftByVariantKey;
  setVariantProviderCostPerSecondDrafts: React.Dispatch<
    React.SetStateAction<VariantProviderCostPerSecondDraftByVariantKey>
  >;
  modelSortOption: ModelPricingSortOption;
  setModelSortOption: React.Dispatch<React.SetStateAction<ModelPricingSortOption>>;
  modelSearchQuery: string;
  setModelSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  globalCreditScaleDraft: string;
  updateGlobalCreditScaleDraft: (value: string) => void;
  globalCreditUsdAmountDraft: string;
  updateGlobalCreditUsdAmountDraft: (value: string) => void;
  resetInvalidGlobalConversionDraft: () => void;
  modelPolicyMessage: string | null;
  modelPolicyError: string | null;
  canApplyModelPolicy: boolean;
  showCostDocsPopover: (
    clientX: number,
    clientY: number,
    model: AdminPricingModelRow,
    variant: AdminPricingPreviewVariant | null
  ) => void;
  hideCostDocsPopover: () => void;
  updateModelPolicyDraft: (
    updater: (current: ModelPricingPolicyDocument) => ModelPricingPolicyDocument
  ) => void;
  updateCustomRowsDraft: (
    updater: (current: AdminPricingCustomRowsDocument) => AdminPricingCustomRowsDocument
  ) => void;
};

export const PricingModelWorkbook = ({
  pricingState,
  displayedModels,
  effectiveModelPolicyDraft,
  effectiveCustomRowsDraft,
  durationDrafts,
  setDurationDrafts,
  markupDrafts,
  setMarkupDrafts,
  variantMarkupDrafts,
  setVariantMarkupDrafts,
  variantProviderCostDrafts,
  setVariantProviderCostDrafts,
  variantProviderCostPerSecondDrafts,
  setVariantProviderCostPerSecondDrafts,
  modelSortOption,
  setModelSortOption,
  modelSearchQuery,
  setModelSearchQuery,
  globalCreditScaleDraft,
  updateGlobalCreditScaleDraft,
  globalCreditUsdAmountDraft,
  updateGlobalCreditUsdAmountDraft,
  resetInvalidGlobalConversionDraft,
  modelPolicyMessage,
  modelPolicyError,
  canApplyModelPolicy,
  showCostDocsPopover,
  hideCostDocsPopover,
  updateModelPolicyDraft,
  updateCustomRowsDraft,
}: PricingModelWorkbookProps) => {
  return (
    <section className={styles.adminSection}>
      <div className={`${styles.adminSectionHead} ${styles.pricingWorkbookActionsHead}`}>
        <div>
          <h2 className={styles.adminSectionTitle}>Pricing Grid</h2>
          <p className="tiny subdued">
            Runtime preview values stay aligned with the same draft policy used for live model
            debits.
          </p>
        </div>
        {canApplyModelPolicy ? (
          <span className={styles.pricingUnsavedCue} role="status">
            Unsaved changes
          </span>
        ) : null}
      </div>

      {pricingState ? (
        <>
          <div className={styles.searchRow}>
            <label className={styles.pricingConversionControl}>
              <span className={styles.pricingConversionLabel}>Credit conversion</span>
              <input
                aria-label="Global credit conversion"
                className={`${styles.searchInput} ${styles.pricingConversionInput}`}
                type="text"
                inputMode="numeric"
                value={globalCreditScaleDraft}
                onChange={(event) => updateGlobalCreditScaleDraft(event.target.value)}
                onBlur={resetInvalidGlobalConversionDraft}
              />
              <span className={styles.pricingConversionUnit}>credits /</span>
              <span className={styles.pricingConversionCurrency}>$</span>
              <input
                aria-label="Global conversion dollar amount"
                className={`${styles.searchInput} ${styles.pricingConversionInput} ${styles.pricingConversionDollarInput}`}
                type="text"
                inputMode="decimal"
                value={globalCreditUsdAmountDraft}
                onChange={(event) => updateGlobalCreditUsdAmountDraft(event.target.value)}
                onBlur={resetInvalidGlobalConversionDraft}
              />
            </label>
            <div className={styles.pricingWorkbookControls}>
              <label className={styles.pricingSortLabel} htmlFor="pricing-model-sort">
                Sort models
              </label>
              <select
                id="pricing-model-sort"
                className={`${styles.searchInput} ${styles.pricingSortSelect}`}
                value={modelSortOption}
                onChange={(event) =>
                  setModelSortOption(event.target.value as ModelPricingSortOption)
                }
              >
                {MODEL_PRICING_SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="search"
                className={styles.searchInput}
                value={modelSearchQuery}
                onChange={(event) => setModelSearchQuery(event.target.value)}
                placeholder="Search models, providers, ids, or strategies"
                aria-label="Search pricing models"
              />
            </div>
          </div>
          {modelPolicyMessage ? (
            <AppMessage
              className={styles.announcementResult}
              tone="success"
              mode="banner"
              message={modelPolicyMessage}
            />
          ) : null}
          {modelPolicyError ? (
            <AppMessage
              className={styles.announcementError}
              tone="error"
              mode="banner"
              message={modelPolicyError}
            />
          ) : null}
          <PricingModelWorkbookTable
            displayedModels={displayedModels}
            effectiveModelPolicyDraft={effectiveModelPolicyDraft}
            effectiveCustomRowsDraft={effectiveCustomRowsDraft}
            durationDrafts={durationDrafts}
            setDurationDrafts={setDurationDrafts}
            markupDrafts={markupDrafts}
            setMarkupDrafts={setMarkupDrafts}
            variantMarkupDrafts={variantMarkupDrafts}
            setVariantMarkupDrafts={setVariantMarkupDrafts}
            variantProviderCostDrafts={variantProviderCostDrafts}
            setVariantProviderCostDrafts={setVariantProviderCostDrafts}
            variantProviderCostPerSecondDrafts={variantProviderCostPerSecondDrafts}
            setVariantProviderCostPerSecondDrafts={setVariantProviderCostPerSecondDrafts}
            modelSortOption={modelSortOption}
            showCostDocsPopover={showCostDocsPopover}
            hideCostDocsPopover={hideCostDocsPopover}
            updateModelPolicyDraft={updateModelPolicyDraft}
            updateCustomRowsDraft={updateCustomRowsDraft}
          />
        </>
      ) : null}
    </section>
  );
};
