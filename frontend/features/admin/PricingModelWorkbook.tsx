/**
 * Model pricing workbook table and inline policy editor for the admin pricing page.
 */
import React from "react";
import type {
  AdminPricingModelRow,
  AdminPricingPreviewVariant,
  AdminPricingStateResponse,
} from "./types";
import {
  MODEL_PRICING_SORT_OPTIONS,
  type CreditScaleDraftByModelId,
  type DurationDraftByModelId,
  type MarkupDraftByModelId,
  type ModelPricingSortOption,
  type RoundingDraftByModelId,
} from "./pricingPageUtils";
import { PricingModelWorkbookTable } from "./PricingModelWorkbookTable";
import { type ModelPricingPolicyDocument } from "../../lib/model-runtime/pricingPolicy";
import styles from "../../styles/admin.module.css";

type PricingModelWorkbookProps = {
  pricingState: AdminPricingStateResponse | null;
  displayedModels: AdminPricingModelRow[];
  selectedModelRow: AdminPricingModelRow | null;
  effectiveModelPolicyDraft: ModelPricingPolicyDocument;
  durationDrafts: DurationDraftByModelId;
  setDurationDrafts: React.Dispatch<React.SetStateAction<DurationDraftByModelId>>;
  creditScaleDrafts: CreditScaleDraftByModelId;
  setCreditScaleDrafts: React.Dispatch<React.SetStateAction<CreditScaleDraftByModelId>>;
  markupDrafts: MarkupDraftByModelId;
  setMarkupDrafts: React.Dispatch<React.SetStateAction<MarkupDraftByModelId>>;
  roundingDrafts: RoundingDraftByModelId;
  setRoundingDrafts: React.Dispatch<React.SetStateAction<RoundingDraftByModelId>>;
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
  setSelectedModelOverrideId: React.Dispatch<React.SetStateAction<string | null>>;
  updateModelPolicyDraft: (
    updater: (current: ModelPricingPolicyDocument) => ModelPricingPolicyDocument
  ) => void;
};

export const PricingModelWorkbook = ({
  pricingState,
  displayedModels,
  selectedModelRow,
  effectiveModelPolicyDraft,
  durationDrafts,
  setDurationDrafts,
  creditScaleDrafts,
  setCreditScaleDrafts,
  markupDrafts,
  setMarkupDrafts,
  roundingDrafts,
  setRoundingDrafts,
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
  setSelectedModelOverrideId,
  updateModelPolicyDraft,
}: PricingModelWorkbookProps) => {
  return (
    <section className={styles.adminSection}>
      <div className={`${styles.adminSectionHead} ${styles.pricingWorkbookActionsHead}`}>
        <div>
          <h2 className={styles.adminSectionTitle}>Pricing Grid</h2>
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
              <span className={styles.pricingConversionLabel}>credit per $</span>
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
            <p className={styles.announcementResult}>{modelPolicyMessage}</p>
          ) : null}
          {modelPolicyError ? <p className={styles.announcementError}>{modelPolicyError}</p> : null}
          <PricingModelWorkbookTable
            displayedModels={displayedModels}
            selectedModelRow={selectedModelRow}
            effectiveModelPolicyDraft={effectiveModelPolicyDraft}
            durationDrafts={durationDrafts}
            setDurationDrafts={setDurationDrafts}
            creditScaleDrafts={creditScaleDrafts}
            setCreditScaleDrafts={setCreditScaleDrafts}
            markupDrafts={markupDrafts}
            setMarkupDrafts={setMarkupDrafts}
            roundingDrafts={roundingDrafts}
            setRoundingDrafts={setRoundingDrafts}
            modelSortOption={modelSortOption}
            showCostDocsPopover={showCostDocsPopover}
            hideCostDocsPopover={hideCostDocsPopover}
            setSelectedModelOverrideId={setSelectedModelOverrideId}
            updateModelPolicyDraft={updateModelPolicyDraft}
          />
        </>
      ) : null}
    </section>
  );
};
