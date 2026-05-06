import React from "react";
import { getPricingAuthorityClassName, getProviderLabelClassName } from "./PricingPageChrome";
import type { AdminPricingModelRow, AdminPricingPreviewVariant } from "./types";
import {
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
import type {
  AudioDraftByModelId,
  AspectDraftByModelId,
  ResolutionDraftByModelId,
} from "./pricingDrafts";
import {
  resolveModelPricingForModel,
  type ModelPricingPolicyDocument,
} from "../../lib/model-runtime/pricingPolicy";
import styles from "../../styles/admin.module.css";

type PricingModelWorkbookTableProps = {
  displayedModels: AdminPricingModelRow[];
  selectedModelRow: AdminPricingModelRow | null;
  effectiveModelPolicyDraft: ModelPricingPolicyDocument;
  durationDrafts: DurationDraftByModelId;
  setDurationDrafts: React.Dispatch<React.SetStateAction<DurationDraftByModelId>>;
  aspectDrafts: AspectDraftByModelId;
  updateAspectDraft: (modelId: string, value: string) => void;
  resolutionDrafts: ResolutionDraftByModelId;
  updateResolutionDraft: (modelId: string, value: string) => void;
  audioDrafts: AudioDraftByModelId;
  updateAudioDraft: (
    modelId: string,
    value: AudioDraftByModelId[string],
    model: AdminPricingModelRow
  ) => void;
  creditScaleDrafts: CreditScaleDraftByModelId;
  setCreditScaleDrafts: React.Dispatch<React.SetStateAction<CreditScaleDraftByModelId>>;
  markupDrafts: MarkupDraftByModelId;
  setMarkupDrafts: React.Dispatch<React.SetStateAction<MarkupDraftByModelId>>;
  roundingDrafts: RoundingDraftByModelId;
  setRoundingDrafts: React.Dispatch<React.SetStateAction<RoundingDraftByModelId>>;
  modelSortOption: ModelPricingSortOption;
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

export function PricingModelWorkbookTable({
  displayedModels,
  selectedModelRow,
  effectiveModelPolicyDraft,
  durationDrafts,
  setDurationDrafts,
  aspectDrafts,
  updateAspectDraft,
  resolutionDrafts,
  updateResolutionDraft,
  audioDrafts,
  updateAudioDraft,
  creditScaleDrafts,
  setCreditScaleDrafts,
  markupDrafts,
  setMarkupDrafts,
  roundingDrafts,
  setRoundingDrafts,
  modelSortOption,
  showCostDocsPopover,
  hideCostDocsPopover,
  setSelectedModelOverrideId,
  updateModelPolicyDraft,
}: PricingModelWorkbookTableProps) {
  return (
    <div className={styles.adminTableScroller}>
      <div className={`${styles.adminTable} ${styles.pricingWorkbookTable}`}>
        <div className={`${styles.pricingModelsHead} ${styles.adminTableHead}`}>
          <span>Provider</span>
          <span>Model</span>
          <span>Type</span>
          <span>Duration</span>
          <span>Spec</span>
          <span>Rate source</span>
          <span>$ at cost</span>
          <span>Credits at cost</span>
          <span>Markup</span>
          <span>Round up</span>
          <span>Billed credits</span>
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
            durationDraftValue !== undefined ? parseDurationSecondsInput(durationDraftValue) : null;
          const previewVariants = buildDraftPricingPreviewVariants(
            model,
            effectiveModelPolicyDraft,
            {
              durationSeconds: draftDurationSeconds,
            }
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
            (draftOverride?.creditUsdScale != null ? String(draftOverride.creditUsdScale) : "");
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
                  breakdown: activePreview,
                  creditsAtCost: activeCreditsAtCost,
                  markupBps: previewMarkupBps,
                  roundingIncrement: previewRoundingIncrement,
                });
                const workbookBillableUsd = getWorkbookBillableUsd(
                  workbookBillableCredits,
                  resolvedModelPolicy.creditUsdScale,
                  activePreview?.billedUsd
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
                    <span className={`${styles.pricingPrimaryCell} ${styles.pricingTypeCell}`}>
                      <strong>{getModelTypeLabel(model, variant)}</strong>
                    </span>
                    <span className={styles.pricingPrimaryCell}>
                      {canEditModelDuration(model) ? (
                        <label className={styles.pricingDurationInputWrap}>
                          <span className="sr-only">{`Duration seconds for ${model.label}`}</span>
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
                      <strong>{getVariantSpecSummary(model, variant, rowVariants.length)}</strong>
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
                        <span className={getPricingAuthorityClassName(model.pricingAuthority)}>
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
                        <span className={getPricingAuthorityClassName(model.pricingAuthority)}>
                          {getPricingAuthorityLabel(model.pricingAuthority)}
                        </span>
                      )}
                      {draftOverride?.roundingIncrement != null ? <small>override</small> : null}
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
                  <p className={styles.pricingInlineNotice}>
                    Blank override fields keep inheriting the current shared policy values shown in
                    the grid.
                  </p>
                  {model.pricingAuthority !== "shared_policy" ? (
                    <p className={styles.pricingInlineNotice}>
                      Metadata-only lane. Grid overrides do not control billing here.
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
                            <span className="tiny subdued">Round up to credits</span>
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
                    </>
                  )}
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
