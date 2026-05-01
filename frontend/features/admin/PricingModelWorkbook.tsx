/**
 * Model pricing workbook table and inline policy editor for the admin pricing page.
 */
import React from "react";
import { getPricingAuthorityClassName, getProviderLabelClassName } from "./PricingPageChrome";
import type {
  AdminPricingModelRow,
  AdminPricingPreviewVariant,
  AdminPricingStateResponse,
} from "./types";
import {
  MODEL_PRICING_SORT_OPTIONS,
  buildDraftPricingPreviewVariants,
  canEditModelDuration,
  formatFractionalCredits,
  formatPercent,
  formatProviderCostUsd,
  getCreditsAtProviderCost,
  getDurationInputStep,
  getModelDefaultDurationSeconds,
  getModelDurationSummary,
  getModelTypeLabel,
  getPricingAuthorityLabel,
  getPricingMargin,
  getVariantSpecSummary,
  getWorkbookBillableCredits,
  getWorkbookBillableUsd,
  normalizeModelOverrideDraft,
  parseDurationSecondsInput,
  parseIntegerInput,
  parsePercentToBps,
  sortAdminPricingPreviewVariants,
  type CreditScaleDraftByModelId,
  type DurationDraftByModelId,
  type MarkupDraftByModelId,
  type ModelPricingSortOption,
  type RoundingDraftByModelId,
} from "./pricingPageUtils";
import {
  resolveModelPricingForModel,
  type ModelPricingPolicyDocument,
} from "../../lib/model-runtime/pricingPolicy";
import styles from "../../styles/admin.module.css";

type PricingModelWorkbookProps = {
  pricingState: AdminPricingStateResponse | null;
  showModelsSection: boolean;
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
  modelPolicySaving: boolean;
  modelPolicyRollbackLoading: boolean;
  canApplyModelPolicy: boolean;
  openModelPolicyApplyConfirmation: () => void;
  openModelPolicyRollbackConfirmation: () => void;
  resetModelPolicyDraft: () => void;
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
  modelPolicyNote: string;
  setModelPolicyNote: React.Dispatch<React.SetStateAction<string>>;
};

export const PricingModelWorkbook = ({
  pricingState,
  showModelsSection,
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
  modelPolicySaving,
  modelPolicyRollbackLoading,
  canApplyModelPolicy,
  openModelPolicyApplyConfirmation,
  openModelPolicyRollbackConfirmation,
  resetModelPolicyDraft,
  showCostDocsPopover,
  hideCostDocsPopover,
  setSelectedModelOverrideId,
  updateModelPolicyDraft,
  modelPolicyNote,
  setModelPolicyNote,
}: PricingModelWorkbookProps) => {
  return showModelsSection ? (
    <section className={styles.adminSection}>
      <div className={`${styles.adminSectionHead} ${styles.pricingWorkbookActionsHead}`}>
        <h2 className={styles.adminSectionTitle}>Model Pricing Workbook</h2>
        <div className={styles.pricingEditorActions}>
          {canApplyModelPolicy ? (
            <span className={styles.pricingUnsavedCue} role="status">
              Unsaved changes
            </span>
          ) : null}
          <button
            type="button"
            className={`ghost-btn mini ${canApplyModelPolicy ? styles.pricingSaveButtonDirty : ""}`}
            onClick={openModelPolicyApplyConfirmation}
            disabled={modelPolicySaving || modelPolicyRollbackLoading || !canApplyModelPolicy}
          >
            {modelPolicySaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={resetModelPolicyDraft}
            disabled={modelPolicySaving || modelPolicyRollbackLoading || !canApplyModelPolicy}
          >
            Reset draft
          </button>
        </div>
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
          <div className={styles.adminTableScroller}>
            <div className={`${styles.adminTable} ${styles.pricingWorkbookTable}`}>
              <div className={`${styles.pricingModelsHead} ${styles.adminTableHead}`}>
                <span>Provider</span>
                <span>Model</span>
                <span>Type</span>
                <span>Dur</span>
                <span>Spec</span>
                <span>Cost unit</span>
                <span>$ at cost</span>
                <span>SP credits at cost</span>
                <span>Model markup</span>
                <span>Round Nearest</span>
                <span>SP credits billed</span>
                <span>$ billed</span>
                <span>Margin</span>
              </div>
              {displayedModels.length === 0 ? (
                <div className={`${styles.pricingModelsRow} ${styles.adminTableRow}`}>
                  <span className={styles.pricingPrimaryCell}>
                    <strong>No models found</strong>
                    <small>Try a different search.</small>
                  </span>
                </div>
              ) : null}
              {displayedModels.map((model) => {
                const durationDraftValue = durationDrafts[model.id];
                const defaultDurationSeconds = getModelDefaultDurationSeconds(model);
                const durationInputValue =
                  durationDraftValue ??
                  (defaultDurationSeconds != null ? String(defaultDurationSeconds) : "");
                const draftDurationSeconds =
                  durationDraftValue !== undefined
                    ? parseDurationSecondsInput(durationDraftValue)
                    : null;
                const previewVariants = buildDraftPricingPreviewVariants(
                  model,
                  effectiveModelPolicyDraft,
                  draftDurationSeconds
                );
                const isSelected = selectedModelRow?.id === model.id;
                const draftOverride = effectiveModelPolicyDraft.perModel[model.id] ?? null;
                const resolvedModelPolicy = resolveModelPricingForModel(
                  effectiveModelPolicyDraft,
                  model.id
                );
                const creditScaleDraftValue = creditScaleDrafts[model.id];
                const creditScaleInputValue =
                  creditScaleDraftValue ??
                  (draftOverride?.creditUsdScale != null
                    ? String(draftOverride.creditUsdScale)
                    : "");
                const markupDraftValue = markupDrafts[model.id];
                const markupInputValue =
                  markupDraftValue ??
                  (draftOverride?.markupBps != null ? String(draftOverride.markupBps / 100) : "0");
                const parsedMarkupDraftBps =
                  markupDraftValue !== undefined ? parsePercentToBps(markupDraftValue) : null;
                const previewMarkupBps =
                  markupDraftValue !== undefined &&
                  parsedMarkupDraftBps != null &&
                  parsedMarkupDraftBps >= 0
                    ? parsedMarkupDraftBps
                    : resolvedModelPolicy.markupBps;
                const roundingDraftValue = roundingDrafts[model.id];
                const roundingInputValue =
                  roundingDraftValue ??
                  (draftOverride?.roundingIncrement != null
                    ? String(draftOverride.roundingIncrement)
                    : "");
                const parsedRoundingDraft =
                  roundingDraftValue !== undefined ? parseIntegerInput(roundingDraftValue) : null;
                const previewRoundingIncrement =
                  roundingDraftValue !== undefined
                    ? parsedRoundingDraft != null && parsedRoundingDraft > 0
                      ? parsedRoundingDraft
                      : null
                    : (draftOverride?.roundingIncrement ?? null);
                const canEditSharedPolicy = model.pricingAuthority === "shared_policy";
                const rowVariants = sortAdminPricingPreviewVariants({
                  model,
                  variants: previewVariants.length ? previewVariants : [null],
                  sortOption: modelSortOption,
                });
                return (
                  <React.Fragment key={model.id}>
                    {rowVariants.map((variant) => {
                      const activePreview = variant?.breakdown ?? null;
                      const activeCreditsAtCost = getCreditsAtProviderCost(
                        activePreview,
                        resolvedModelPolicy.creditUsdScale
                      );
                      const workbookBillableCredits = getWorkbookBillableCredits({
                        creditsAtCost: activeCreditsAtCost,
                        markupBps: previewMarkupBps,
                        roundingIncrement: previewRoundingIncrement,
                      });
                      const workbookBillableUsd = getWorkbookBillableUsd(
                        workbookBillableCredits,
                        resolvedModelPolicy.creditUsdScale
                      );
                      const activeMargin = getPricingMargin(activePreview, workbookBillableUsd);
                      const markupLabel =
                        rowVariants.length > 1 && variant
                          ? `Model markup for ${model.label} ${variant.label}`
                          : `Model markup for ${model.label}`;
                      const roundingLabel =
                        rowVariants.length > 1 && variant
                          ? `Round nearest for ${model.label} ${variant.label}`
                          : `Round nearest for ${model.label}`;
                      return (
                        <div
                          key={`${model.id}:${variant?.id ?? "unavailable"}`}
                          className={`${styles.pricingModelsRow} ${
                            isSelected ? styles.adminTableRowActive : ""
                          }`}
                        >
                          <span
                            className={`${styles.pricingProviderLabel} ${getProviderLabelClassName(
                              model.provider
                            )}`.trim()}
                          >
                            {model.provider}
                          </span>
                          <span className={styles.pricingPrimaryCell}>
                            <button
                              type="button"
                              className={styles.pricingModelCellButton}
                              onClick={() =>
                                setSelectedModelOverrideId((current) =>
                                  current === model.id ? null : model.id
                                )
                              }
                              aria-expanded={isSelected}
                              aria-label={`Configure pricing override for ${model.label}`}
                            >
                              <strong>{model.label}</strong>
                            </button>
                          </span>
                          <span
                            className={`${styles.pricingPrimaryCell} ${styles.pricingTypeCell}`}
                          >
                            <strong>{getModelTypeLabel(model, variant)}</strong>
                          </span>
                          <span className={styles.pricingPrimaryCell}>
                            {canEditModelDuration(model) ? (
                              <label className={styles.pricingDurationInputWrap}>
                                <span className="sr-only">
                                  {`Duration seconds for ${model.label}`}
                                </span>
                                <input
                                  aria-label={`Duration seconds for ${model.label}`}
                                  className={`${styles.searchInput} ${styles.pricingSheetInput}`}
                                  type="number"
                                  inputMode="decimal"
                                  min={model.minDurationSeconds ?? undefined}
                                  max={model.maxDurationSeconds ?? undefined}
                                  step={getDurationInputStep(model)}
                                  value={durationInputValue}
                                  onChange={(event) =>
                                    setDurationDrafts((current) => ({
                                      ...current,
                                      [model.id]: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                            ) : (
                              <strong>{getModelDurationSummary(model)}</strong>
                            )}
                          </span>
                          <span className={styles.pricingPrimaryCell}>
                            <strong>
                              {getVariantSpecSummary(model, variant, rowVariants.length)}
                            </strong>
                          </span>
                          <span className={styles.pricingPrimaryCell}>
                            <button
                              type="button"
                              className={styles.pricingCostUnitButton}
                              aria-label={`Show provider pricing docs for ${model.label}${
                                variant && variant.id !== "default" ? ` ${variant.label}` : ""
                              }`}
                              onMouseEnter={(event) =>
                                showCostDocsPopover(event.clientX, event.clientY, model, variant)
                              }
                              onMouseMove={(event) =>
                                showCostDocsPopover(event.clientX, event.clientY, model, variant)
                              }
                              onMouseLeave={hideCostDocsPopover}
                              onFocus={(event) => {
                                const rect = event.currentTarget.getBoundingClientRect();
                                showCostDocsPopover(rect.right, rect.top, model, variant);
                              }}
                              onBlur={hideCostDocsPopover}
                            >
                              <strong>{model.pricingStrategyLabel}</strong>
                            </button>
                          </span>
                          <span className={styles.pricingPrimaryCell}>
                            {activePreview ? (
                              <strong>{formatProviderCostUsd(activePreview.usdRaw)}</strong>
                            ) : (
                              <small>Unavailable</small>
                            )}
                          </span>
                          <span className={styles.pricingPrimaryCell}>
                            {activeCreditsAtCost != null ? (
                              <strong>{formatFractionalCredits(activeCreditsAtCost)}</strong>
                            ) : (
                              <small>Unavailable</small>
                            )}
                          </span>
                          <span className={styles.pricingPrimaryCell}>
                            {canEditSharedPolicy ? (
                              <label className={styles.pricingSheetInputWrap}>
                                <span className="sr-only">{markupLabel}</span>
                                <input
                                  aria-label={markupLabel}
                                  className={`${styles.searchInput} ${styles.pricingSheetInput}`}
                                  value={markupInputValue}
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    setMarkupDrafts((current) => ({
                                      ...current,
                                      [model.id]: nextValue,
                                    }));
                                    updateModelPolicyDraft((current) =>
                                      normalizeModelOverrideDraft(current, model.id, {
                                        markupBps: parsePercentToBps(nextValue),
                                      })
                                    );
                                  }}
                                />
                                <span>%</span>
                              </label>
                            ) : (
                              <span
                                className={getPricingAuthorityClassName(model.pricingAuthority)}
                              >
                                {getPricingAuthorityLabel(model.pricingAuthority)}
                              </span>
                            )}
                          </span>
                          <span className={styles.pricingPrimaryCell}>
                            {canEditSharedPolicy ? (
                              <label className={styles.pricingRoundInputWrap}>
                                <span className="sr-only">{roundingLabel}</span>
                                <input
                                  aria-label={roundingLabel}
                                  className={`${styles.searchInput} ${styles.pricingSheetInput}`}
                                  type="text"
                                  inputMode="numeric"
                                  value={roundingInputValue}
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    setRoundingDrafts((current) => ({
                                      ...current,
                                      [model.id]: nextValue,
                                    }));
                                    updateModelPolicyDraft((current) =>
                                      normalizeModelOverrideDraft(current, model.id, {
                                        roundingIncrement: parseIntegerInput(nextValue),
                                      })
                                    );
                                  }}
                                />
                              </label>
                            ) : (
                              <span
                                className={getPricingAuthorityClassName(model.pricingAuthority)}
                              >
                                {getPricingAuthorityLabel(model.pricingAuthority)}
                              </span>
                            )}
                            {draftOverride?.roundingIncrement != null ? (
                              <small>override</small>
                            ) : null}
                          </span>
                          <span className={styles.pricingPrimaryCell}>
                            {workbookBillableCredits != null ? (
                              <strong>{formatFractionalCredits(workbookBillableCredits)}</strong>
                            ) : (
                              <small>Unavailable</small>
                            )}
                          </span>
                          <span className={styles.pricingPrimaryCell}>
                            {workbookBillableUsd != null ? (
                              <strong>{formatProviderCostUsd(workbookBillableUsd)}</strong>
                            ) : (
                              <small>Unavailable</small>
                            )}
                          </span>
                          <span className={styles.pricingPrimaryCell}>
                            {activeMargin ? (
                              <>
                                <strong>{formatProviderCostUsd(activeMargin.usd)}</strong>
                                {activeMargin.percent != null ? (
                                  <small>{formatPercent(activeMargin.percent)}</small>
                                ) : null}
                              </>
                            ) : (
                              <small>Unavailable</small>
                            )}
                          </span>
                        </div>
                      );
                    })}
                    {isSelected ? (
                      <div className={styles.pricingInlineEditorCard}>
                        <p className="eyebrow">Edit model pricing policy</p>
                        {model.pricingAuthority !== "shared_policy" ? (
                          <p className={styles.pricingInlineNotice}>
                            This ElevenLabs model is metadata-only. It stays visible for operator
                            inventory, but shared model-pricing overrides do not control billing for
                            this provider-preview lane.
                          </p>
                        ) : (
                          <>
                            <div className={styles.pricingInlineEditorTopRow}>
                              <div className={styles.pricingInlineOverridesGrid}>
                                <label className={styles.manualAdjustField}>
                                  <span className="tiny subdued">Credit conversion override</span>
                                  <input
                                    className={`${styles.searchInput} ${styles.pricingOverrideInput}`}
                                    value={creditScaleInputValue}
                                    placeholder="none"
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      setCreditScaleDrafts((current) => ({
                                        ...current,
                                        [model.id]: nextValue,
                                      }));
                                      updateModelPolicyDraft((current) =>
                                        normalizeModelOverrideDraft(current, model.id, {
                                          creditUsdScale: parseIntegerInput(nextValue),
                                        })
                                      );
                                    }}
                                  />
                                </label>
                                <label className={styles.manualAdjustField}>
                                  <span className="tiny subdued">Model markup</span>
                                  <input
                                    className={`${styles.searchInput} ${styles.pricingOverrideInput}`}
                                    value={markupInputValue}
                                    placeholder="none"
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      setMarkupDrafts((current) => ({
                                        ...current,
                                        [model.id]: nextValue,
                                      }));
                                      updateModelPolicyDraft((current) =>
                                        normalizeModelOverrideDraft(current, model.id, {
                                          markupBps: parsePercentToBps(nextValue),
                                        })
                                      );
                                    }}
                                  />
                                </label>
                                <label className={styles.manualAdjustField}>
                                  <span className="tiny subdued">Roundup increment override</span>
                                  <input
                                    className={`${styles.searchInput} ${styles.pricingOverrideInput}`}
                                    value={roundingInputValue}
                                    placeholder="none"
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      setRoundingDrafts((current) => ({
                                        ...current,
                                        [model.id]: nextValue,
                                      }));
                                      updateModelPolicyDraft((current) =>
                                        normalizeModelOverrideDraft(current, model.id, {
                                          roundingIncrement: parseIntegerInput(nextValue),
                                        })
                                      );
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                            <div className={styles.pricingInlineEditorBottomRow}>
                              <div className={styles.pricingEditorActionsColumn}>
                                <div className={styles.pricingEditorActions}>
                                  {canApplyModelPolicy ? (
                                    <span className={styles.pricingUnsavedCue} role="status">
                                      Unsaved changes
                                    </span>
                                  ) : null}
                                  <button
                                    type="button"
                                    className={`ghost-btn mini ${canApplyModelPolicy ? styles.pricingSaveButtonDirty : ""}`}
                                    onClick={openModelPolicyApplyConfirmation}
                                    disabled={
                                      modelPolicySaving ||
                                      modelPolicyRollbackLoading ||
                                      !canApplyModelPolicy
                                    }
                                  >
                                    {modelPolicySaving ? "Saving…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    className="ghost-btn mini"
                                    onClick={resetModelPolicyDraft}
                                    disabled={
                                      modelPolicySaving ||
                                      modelPolicyRollbackLoading ||
                                      !canApplyModelPolicy
                                    }
                                  >
                                    Reset draft
                                  </button>
                                  <button
                                    type="button"
                                    className="ghost-btn mini"
                                    onClick={openModelPolicyRollbackConfirmation}
                                    disabled={modelPolicySaving || modelPolicyRollbackLoading}
                                  >
                                    {modelPolicyRollbackLoading
                                      ? "Rolling back…"
                                      : "Rollback active policy"}
                                  </button>
                                </div>
                              </div>
                              <label
                                className={`${styles.manualAdjustField} ${styles.pricingEditorNoteField}`}
                              >
                                <span className="tiny subdued">Change note</span>
                                <textarea
                                  className={`${styles.searchInput} ${styles.pricingNoteInput}`}
                                  value={modelPolicyNote}
                                  onChange={(event) => setModelPolicyNote(event.target.value)}
                                  placeholder="Short operator note for this version"
                                  rows={3}
                                />
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </section>
  ) : null;
};
