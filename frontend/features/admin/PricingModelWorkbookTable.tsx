import React from "react";
import { getPricingAuthorityClassName, getProviderLabelClassName } from "./PricingPageChrome";
import type { AdminPricingModelRow, AdminPricingPreviewVariant } from "./types";
import {
  canEditModelDuration,
  formatFractionalCredits,
  formatPercent,
  formatProviderCostUsd,
  getEffectiveProviderCostUsd,
  getEffectiveProviderCostUsdPerSecond,
  getCreditsAtProviderCost,
  getModelDurationSecondsForUsage,
  getModelRateSourceInputMode,
  getModelUsageControl,
  getModelUsageDisplayValue,
  getModelUsageRateMultiplier,
  getModelUsageValue,
  getModelTypeLabel,
  getPricingAuthorityLabel,
  getPricingMargin,
  getRateSourceCostUsd,
  getVariantSpecSummary,
  getWorkbookBillableCredits,
  getWorkbookBillableUsd,
  normalizeModelOverrideDraft,
  normalizeVariantOverrideDraft,
  parsePositiveDecimalInput,
  parsePercentToBps,
  type DurationDraftByModelId,
  type MarkupDraftByModelId,
  type ModelPricingSortOption,
  type VariantMarkupDraftByVariantKey,
  type VariantProviderCostDraftByVariantKey,
  type VariantProviderCostPerSecondDraftByVariantKey,
} from "./pricingPageUtils";
import type {
  AdminPricingCustomRow,
  AdminPricingCustomRowsDocument,
} from "../../lib/model-runtime/adminPricingCustomRows";
import {
  resolveModelPricingForModel,
  type ModelPricingPolicyDocument,
} from "../../lib/model-runtime/pricingPolicy";
import { getAdminPricingStrategyLabel } from "../../lib/model-runtime/modelPricingStrategyLabel";
import type { PricingStrategyId } from "../../lib/model-runtime/pricingTypes";
import {
  buildAdminPricingCustomRowSpec,
  buildAdminPricingCustomRowSpecOptions,
  buildMergedPricingPreviewVariants,
  resolveAdminPricingCustomRowCandidate,
  sortMergedPricingPreviewVariantRows,
  type AdminPricingCustomRowDraft,
} from "./pricingCustomRows";
import styles from "../../styles/admin.module.css";

const NULL_SELECT_VALUE = "__null__";

const encodeNullableString = (value: string | null): string => value ?? NULL_SELECT_VALUE;

const decodeNullableString = (value: string): string | null =>
  value === NULL_SELECT_VALUE ? null : value;

const encodeNullableBoolean = (value: boolean | null): string =>
  value == null ? NULL_SELECT_VALUE : value ? "true" : "false";

const decodeNullableBoolean = (value: string): boolean | null =>
  value === NULL_SELECT_VALUE ? null : value === "true";

const getFiniteValues = (values: Array<number | null | undefined>): number[] =>
  values.filter((value): value is number => value != null && Number.isFinite(value));

const formatValueRange = (
  values: Array<number | null | undefined>,
  formatter: (value: number) => string
): string => {
  const finiteValues = getFiniteValues(values);
  if (!finiteValues.length) return "Unavailable";
  const minValue = Math.min(...finiteValues);
  const maxValue = Math.max(...finiteValues);
  if (Math.abs(maxValue - minValue) < 0.000001) {
    return formatter(minValue);
  }
  return `${formatter(minValue)} to ${formatter(maxValue)}`;
};

const formatPercentRange = (values: Array<number | null | undefined>): string | null => {
  const finiteValues = getFiniteValues(values);
  if (!finiteValues.length) return null;
  const minValue = Math.min(...finiteValues);
  const maxValue = Math.max(...finiteValues);
  if (Math.abs(maxValue - minValue) < 0.000001) {
    return formatPercent(minValue);
  }
  return `${formatPercent(minValue)} to ${formatPercent(maxValue)}`;
};

const getWeightedMarkupPercent = (
  rows: Array<{
    activeCreditsAtCost: number | null;
    resolvedVariantPolicy: { markupBps: number };
  }>
): number | null => {
  const weightedRows = rows.filter(
    (row) =>
      row.activeCreditsAtCost != null &&
      Number.isFinite(row.activeCreditsAtCost) &&
      row.activeCreditsAtCost > 0
  );
  if (weightedRows.length) {
    const totalCreditsAtCost = weightedRows.reduce(
      (sum, row) => sum + (row.activeCreditsAtCost ?? 0),
      0
    );
    if (totalCreditsAtCost > 0) {
      const weightedMarkupPercent = weightedRows.reduce(
        (sum, row) =>
          sum + ((row.activeCreditsAtCost ?? 0) * row.resolvedVariantPolicy.markupBps) / 100,
        0
      );
      return weightedMarkupPercent / totalCreditsAtCost;
    }
  }

  const markupPercents = rows
    .map((row) => row.resolvedVariantPolicy.markupBps / 100)
    .filter((value) => Number.isFinite(value));
  if (!markupPercents.length) return null;
  return markupPercents.reduce((sum, value) => sum + value, 0) / markupPercents.length;
};

const getVariantTypeSummary = (
  model: AdminPricingModelRow,
  variants: Array<AdminPricingPreviewVariant | null>
): string => {
  const labels = Array.from(
    new Set(variants.map((variant) => getModelTypeLabel(model, variant)).filter(Boolean))
  );
  if (labels.length <= 1) return labels[0] ?? getModelTypeLabel(model);
  return `${labels[0]} + ${labels.length - 1} more`;
};

const getDisplayedPricingStrategyLabel = (model: AdminPricingModelRow): string =>
  getAdminPricingStrategyLabel(model.id, model.pricingStrategy as PricingStrategyId);

const getMarginToneClassName = (marginUsd: number | null | undefined): string => {
  if (marginUsd == null || !Number.isFinite(marginUsd)) return "";
  if (marginUsd < 0) return styles.pricingMetricNegative;
  if (marginUsd > 0) return styles.pricingMetricPositive;
  return styles.pricingMetricNeutral;
};

const getPricingSourceUrl = (model: AdminPricingModelRow): string =>
  model.provider === "kie" ? "https://kie.ai/pricing" : model.sourceUrl;

const renderTypeSourceLink = (model: AdminPricingModelRow, label: string) => (
  <a
    href={getPricingSourceUrl(model)}
    target="_blank"
    rel="noreferrer"
    className={styles.pricingTypeLink}
    title={`Open source page for ${model.label}`}
  >
    <strong>{label}</strong>
  </a>
);

type PricingModelWorkbookTableProps = {
  displayedModels: AdminPricingModelRow[];
  effectiveModelPolicyDraft: ModelPricingPolicyDocument;
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
  showCostDocsPopover: (
    clientX: number,
    clientY: number,
    model: AdminPricingModelRow,
    variant: AdminPricingPreviewVariant | null
  ) => void;
  hideCostDocsPopover: () => void;
  effectiveCustomRowsDraft: AdminPricingCustomRowsDocument;
  updateModelPolicyDraft: (
    updater: (current: ModelPricingPolicyDocument) => ModelPricingPolicyDocument
  ) => void;
  updateCustomRowsDraft: (
    updater: (current: AdminPricingCustomRowsDocument) => AdminPricingCustomRowsDocument
  ) => void;
};

export function PricingModelWorkbookTable({
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
  showCostDocsPopover,
  hideCostDocsPopover,
  updateModelPolicyDraft,
  updateCustomRowsDraft,
}: PricingModelWorkbookTableProps) {
  const [expandedModelIds, setExpandedModelIds] = React.useState<Record<string, boolean>>({});
  const [pinnedHeaderLayout, setPinnedHeaderLayout] = React.useState<{
    active: boolean;
    left: number;
    width: number;
    height: number;
  }>({
    active: false,
    left: 0,
    width: 0,
    height: 0,
  });
  const workbookShellRef = React.useRef<HTMLDivElement | null>(null);
  const tableScrollerRef = React.useRef<HTMLDivElement | null>(null);
  const stickyHeaderViewportRef = React.useRef<HTMLDivElement | null>(null);
  const stickyHeaderTrackRef = React.useRef<HTMLDivElement | null>(null);

  const toggleModelExpanded = React.useCallback((modelId: string) => {
    setExpandedModelIds((current) => ({
      ...current,
      [modelId]: !current[modelId],
    }));
  }, []);

  const syncStickyHeaderScroll = React.useCallback(() => {
    const scroller = tableScrollerRef.current;
    const headerTrack = stickyHeaderTrackRef.current;
    if (!scroller || !headerTrack) return;
    headerTrack.style.transform = `translateX(-${scroller.scrollLeft}px)`;
  }, []);

  React.useEffect(() => {
    syncStickyHeaderScroll();
  }, [syncStickyHeaderScroll]);

  React.useEffect(() => {
    const updatePinnedHeaderLayout = () => {
      const shell = workbookShellRef.current;
      const headerViewport = stickyHeaderViewportRef.current;
      if (!shell || !headerViewport) return;

      const shellRect = shell.getBoundingClientRect();
      const headerHeight = headerViewport.offsetHeight;
      const pinTop = 12;
      const shouldPin = shellRect.top <= pinTop && shellRect.bottom - headerHeight > pinTop;

      setPinnedHeaderLayout((current) => {
        if (!shouldPin) {
          if (!current.active && current.height === headerHeight) return current;
          return {
            active: false,
            left: 0,
            width: 0,
            height: headerHeight,
          };
        }

        const next = {
          active: true,
          left: shellRect.left,
          width: shellRect.width,
          height: headerHeight,
        };
        if (
          current.active === next.active &&
          Math.abs(current.left - next.left) < 0.5 &&
          Math.abs(current.width - next.width) < 0.5 &&
          current.height === next.height
        ) {
          return current;
        }
        return next;
      });
    };

    updatePinnedHeaderLayout();
    window.addEventListener("scroll", updatePinnedHeaderLayout, { passive: true });
    window.addEventListener("resize", updatePinnedHeaderLayout);
    return () => {
      window.removeEventListener("scroll", updatePinnedHeaderLayout);
      window.removeEventListener("resize", updatePinnedHeaderLayout);
    };
  }, []);

  const buildCustomRowDraftFromRow = React.useCallback(
    (row: AdminPricingCustomRow): AdminPricingCustomRowDraft => ({
      baseVariantId: row.spec.baseVariantId ?? null,
      aspect: row.spec.aspect ?? null,
      resolution: row.spec.resolution ?? null,
      audio: row.spec.audio ?? null,
      videoInput: row.spec.videoInput ?? null,
    }),
    []
  );

  const updateCustomRow = React.useCallback(
    (
      modelId: string,
      displayRowId: string,
      updater: (row: AdminPricingCustomRow) => AdminPricingCustomRow
    ) => {
      updateCustomRowsDraft((current) => {
        const rows = current.rowsByModel[modelId] ?? [];
        const nextRows = rows.map((row) =>
          row.displayRowId === displayRowId ? updater(row) : row
        );
        return {
          ...current,
          rowsByModel: {
            ...current.rowsByModel,
            [modelId]: nextRows,
          },
        };
      });
    },
    [updateCustomRowsDraft]
  );

  const removeCustomRow = React.useCallback(
    (modelId: string, displayRowId: string) => {
      updateCustomRowsDraft((current) => {
        const rows = current.rowsByModel[modelId] ?? [];
        const nextRows = rows.filter((row) => row.displayRowId !== displayRowId);
        const nextRowsByModel = { ...current.rowsByModel };
        if (nextRows.length) {
          nextRowsByModel[modelId] = nextRows;
        } else {
          delete nextRowsByModel[modelId];
        }
        return {
          ...current,
          rowsByModel: nextRowsByModel,
        };
      });
    },
    [updateCustomRowsDraft]
  );

  const updateCustomRowSpecDraft = React.useCallback(
    (
      model: AdminPricingModelRow,
      row: AdminPricingCustomRow,
      patch: Partial<AdminPricingCustomRowDraft>
    ) => {
      const nextDraft = {
        ...buildCustomRowDraftFromRow(row),
        ...patch,
      };
      const candidate = resolveAdminPricingCustomRowCandidate({
        model,
        pricingPolicy: effectiveModelPolicyDraft,
        draft: nextDraft,
      });
      if (!candidate) return;
      updateCustomRow(model.id, row.displayRowId, (currentRow) => ({
        ...currentRow,
        variantId: candidate.variantId,
        spec: buildAdminPricingCustomRowSpec(nextDraft),
      }));
    },
    [buildCustomRowDraftFromRow, effectiveModelPolicyDraft, updateCustomRow]
  );

  const workbookHeadCells = (
    <>
      <span>Provider</span>
      <span>Model</span>
      <span>Type</span>
      <span>Usage</span>
      <span>Spec</span>
      <span>Rate source</span>
      <span>$ at cost</span>
      <span>Credits at cost</span>
      <span>Markup</span>
      <span>Billed credits</span>
      <span>$ billed</span>
      <span>Margin</span>
    </>
  );

  return (
    <div
      ref={workbookShellRef}
      className={styles.pricingWorkbookShell}
      style={{
        paddingTop: pinnedHeaderLayout.active ? `${pinnedHeaderLayout.height}px` : undefined,
      }}
    >
      <div
        ref={stickyHeaderViewportRef}
        className={styles.pricingWorkbookStickyHeadViewport}
        style={
          pinnedHeaderLayout.active
            ? {
                position: "fixed",
                top: "12px",
                left: `${pinnedHeaderLayout.left}px`,
                width: `${pinnedHeaderLayout.width}px`,
                zIndex: 30,
              }
            : undefined
        }
      >
        <div
          ref={stickyHeaderTrackRef}
          className={`${styles.adminTableHead} ${styles.pricingModelsHead} ${styles.pricingWorkbookStickyHeadTrack}`}
        >
          {workbookHeadCells}
        </div>
      </div>
      <div
        ref={tableScrollerRef}
        className={styles.adminTableScroller}
        onScroll={syncStickyHeaderScroll}
      >
        <div
          className={`${styles.adminTable} ${styles.pricingWorkbookTable} ${styles.pricingWorkbookBody}`}
        >
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
            const usageControl = getModelUsageControl(model);
            const defaultUsageValue = usageControl.defaultValue;
            const usageInputValue =
              durationDraftValue ?? (defaultUsageValue != null ? String(defaultUsageValue) : "");
            const draftUsageAmount =
              durationDraftValue !== undefined
                ? getModelUsageValue(model, durationDraftValue)
                : null;
            const resolvedUsageAmount = draftUsageAmount ?? defaultUsageValue;
            const resolvedDurationSeconds = getModelDurationSecondsForUsage(
              model,
              resolvedUsageAmount
            );
            const usageRateMultiplier = getModelUsageRateMultiplier(model, resolvedUsageAmount);
            const usageDisplayLabel = getModelUsageDisplayValue(model, resolvedUsageAmount);
            const mergedPreviewVariantRows = sortMergedPricingPreviewVariantRows({
              model,
              rows: buildMergedPricingPreviewVariants({
                model,
                pricingPolicy: effectiveModelPolicyDraft,
                customRowsDocument: effectiveCustomRowsDraft,
                usageAmount: draftUsageAmount,
              }),
              sortOption: modelSortOption,
            });
            const draftOverride = effectiveModelPolicyDraft.perModel[model.id] ?? null;
            const resolvedModelPolicy = resolveModelPricingForModel(
              effectiveModelPolicyDraft,
              model.id
            );
            const markupDraftValue = markupDrafts[model.id];
            const markupInputValue =
              markupDraftValue ?? String(resolvedModelPolicy.markupBps / 100);
            const canEditSharedPolicy = model.pricingAuthority === "shared_policy";
            const customRowSpecOptions = buildAdminPricingCustomRowSpecOptions(
              model,
              effectiveModelPolicyDraft
            );
            const isExpanded = expandedModelIds[model.id] ?? false;
            const variantRows = mergedPreviewVariantRows.map((variantRow, index) => {
              const { variant, displayRowId, isCustomRow, customRow } = variantRow;
              const variantId = variant?.id ?? null;
              const variantDraftKey = isCustomRow
                ? `${model.id}:${displayRowId}`
                : `${model.id}:${variantId ?? "default"}`;
              const resolvedVariantPolicy = resolveModelPricingForModel(
                effectiveModelPolicyDraft,
                model.id,
                variantId
              );
              const variantOverride = variantId
                ? (draftOverride?.variants?.[variantId] ?? null)
                : null;
              const activePreview = variant?.breakdown ?? null;
              const customRowOverrides = customRow?.overrides ?? null;
              const effectiveRowMarkupBps =
                customRowOverrides?.markupBps ?? resolvedVariantPolicy.markupBps;
              const effectiveRowProviderUsdOverride =
                customRowOverrides?.providerUsdOverride ??
                resolvedVariantPolicy.providerUsdOverride;
              const effectiveRowProviderUsdPerSecondOverride =
                customRowOverrides?.providerUsdPerSecondOverride ??
                resolvedVariantPolicy.providerUsdPerSecondOverride;
              const effectiveRowPolicy = {
                ...resolvedVariantPolicy,
                markupBps: effectiveRowMarkupBps,
                providerUsdOverride: effectiveRowProviderUsdOverride,
                providerUsdPerSecondOverride: effectiveRowProviderUsdPerSecondOverride,
              };
              const variantMarkupDraftValue = variantMarkupDrafts[variantDraftKey];
              const variantMarkupInputValue =
                variantMarkupDraftValue ??
                (isCustomRow
                  ? customRowOverrides?.markupBps != null
                    ? String(customRowOverrides.markupBps / 100)
                    : ""
                  : variantOverride?.markupBps != null
                    ? String(variantOverride.markupBps / 100)
                    : "");
              const rateSourceInputMode = getModelRateSourceInputMode(model);
              const variantProviderCostDraftValue = variantProviderCostDrafts[variantDraftKey];
              const variantProviderCostPerSecondDraftValue =
                variantProviderCostPerSecondDrafts[variantDraftKey];
              const variantProviderCostPerSecondInputValue =
                variantProviderCostPerSecondDraftValue ??
                (isCustomRow
                  ? customRowOverrides?.providerUsdPerSecondOverride != null
                    ? String(customRowOverrides.providerUsdPerSecondOverride)
                    : ""
                  : variantOverride?.providerUsdPerSecondOverride != null
                    ? String(variantOverride.providerUsdPerSecondOverride)
                    : "");
              const parsedVariantMarkupDraftBps =
                variantMarkupDraftValue !== undefined
                  ? parsePercentToBps(variantMarkupDraftValue)
                  : null;
              const previewVariantMarkupBps =
                variantMarkupDraftValue !== undefined &&
                parsedVariantMarkupDraftBps != null &&
                parsedVariantMarkupDraftBps >= 0
                  ? parsedVariantMarkupDraftBps
                  : effectiveRowMarkupBps;
              const parsedVariantProviderCostDraft =
                variantProviderCostDraftValue !== undefined
                  ? parsePositiveDecimalInput(variantProviderCostDraftValue)
                  : null;
              const parsedVariantProviderCostPerSecondDraftRaw =
                variantProviderCostPerSecondDraftValue !== undefined
                  ? parsePositiveDecimalInput(variantProviderCostPerSecondDraftValue)
                  : null;
              const parsedVariantProviderCostPerSecondDraft =
                parsedVariantProviderCostPerSecondDraftRaw == null
                  ? null
                  : rateSourceInputMode === "per_minute"
                    ? parsedVariantProviderCostPerSecondDraftRaw / 60
                    : rateSourceInputMode === "per_second"
                      ? parsedVariantProviderCostPerSecondDraftRaw
                      : null;
              const previewVariantProviderUsdOverride =
                variantProviderCostDraftValue !== undefined
                  ? parsedVariantProviderCostDraft
                  : effectiveRowProviderUsdOverride;
              const previewVariantProviderUsdPerSecondOverride =
                variantProviderCostPerSecondDraftValue !== undefined
                  ? parsedVariantProviderCostPerSecondDraft
                  : effectiveRowProviderUsdPerSecondOverride;
              const rowDurationSeconds = variant?.durationSeconds ?? resolvedDurationSeconds;
              const activeProviderCostUsd = getEffectiveProviderCostUsd({
                breakdown: activePreview,
                providerUsdOverride: previewVariantProviderUsdOverride,
                providerUsdPerSecondOverride: previewVariantProviderUsdPerSecondOverride,
                durationSeconds: rowDurationSeconds,
                usageRateMultiplier,
              });
              const activeProviderCostUsdPerSecond = getEffectiveProviderCostUsdPerSecond({
                providerCostUsd: activeProviderCostUsd,
                providerUsdPerSecondOverride: previewVariantProviderUsdPerSecondOverride,
                durationSeconds: rowDurationSeconds,
              });
              const activeRateSourceCostUsd = getRateSourceCostUsd({
                rateSourceInputMode,
                providerCostUsd: activeProviderCostUsd,
                providerCostUsdPerSecond: activeProviderCostUsdPerSecond,
                durationSeconds: rowDurationSeconds,
                usageRateMultiplier,
              });
              const variantProviderCostInputValue =
                rateSourceInputMode !== "flat"
                  ? activeProviderCostUsd != null
                    ? String(Number(activeProviderCostUsd.toFixed(4)))
                    : ""
                  : (variantProviderCostDraftValue ??
                    (variantOverride?.providerUsdOverride != null
                      ? String(variantOverride.providerUsdOverride)
                      : ""));
              const rateSourceInputValue =
                rateSourceInputMode === "per_minute"
                  ? (variantProviderCostPerSecondDraftValue ??
                    (variantOverride?.providerUsdPerSecondOverride != null
                      ? String(variantOverride.providerUsdPerSecondOverride * 60)
                      : ""))
                  : rateSourceInputMode === "per_second"
                    ? variantProviderCostPerSecondInputValue
                    : rateSourceInputMode === "flat"
                      ? variantProviderCostInputValue
                      : (variantProviderCostDraftValue ??
                        (activeRateSourceCostUsd != null
                          ? String(Number(activeRateSourceCostUsd.toFixed(4)))
                          : ""));
              const activeCreditsAtCost = getCreditsAtProviderCost(
                activePreview,
                resolvedVariantPolicy.creditUsdScale,
                {
                  preferRuntimeCredits: !canEditSharedPolicy,
                  providerCostUsd: canEditSharedPolicy ? activeProviderCostUsd : null,
                }
              );
              const workbookBillableCredits = getWorkbookBillableCredits({
                breakdown: activePreview,
                creditsAtCost: activeCreditsAtCost,
                markupBps: previewVariantMarkupBps,
                roundingIncrement: effectiveRowPolicy.roundingIncrement,
                preferRuntimeBilledCredits: !canEditSharedPolicy,
              });
              const workbookBillableUsd = getWorkbookBillableUsd(
                workbookBillableCredits,
                effectiveRowPolicy.creditUsdScale,
                activePreview?.billedUsd,
                {
                  preferRuntimeBilledUsd: !canEditSharedPolicy,
                }
              );
              const activeMargin = getPricingMargin(
                activePreview,
                workbookBillableUsd,
                activeProviderCostUsd
              );
              const rowLabel = customRow?.label ?? `Custom variant ${index + 1}`;
              const markupLabel = isCustomRow
                ? `Custom variant markup for ${model.label} ${rowLabel}`
                : mergedPreviewVariantRows.length > 1 && variant
                  ? `Model markup for ${model.label} ${variant.label}`
                  : `Model markup for ${model.label}`;

              return {
                key: isCustomRow
                  ? `${model.id}:${displayRowId}`
                  : `${model.id}:${variant?.id ?? "unavailable"}`,
                index,
                variant,
                displayRowId,
                isCustomRow,
                activePreview,
                activeProviderCostUsd,
                activeProviderCostUsdPerSecond,
                activeRateSourceCostUsd,
                activeCreditsAtCost,
                workbookBillableCredits,
                workbookBillableUsd,
                activeMargin,
                resolvedVariantPolicy: effectiveRowPolicy,
                variantDraftKey,
                variantId,
                rowLabel,
                resolvedDurationSeconds: rowDurationSeconds,
                usageRateMultiplier,
                variantMarkupInputValue,
                variantProviderCostInputValue,
                variantProviderCostPerSecondInputValue,
                rateSourceInputMode,
                rateSourceInputValue,
                markupLabel,
                customRow,
                specLabel: getVariantSpecSummary(model, variant, mergedPreviewVariantRows.length),
              };
            });
            const usageDisplayValue = usageInputValue || usageDisplayLabel;
            const variantCountLabel =
              variantRows.length === 1 ? "1 price variant" : `${variantRows.length} price variants`;
            const summarySpecLabel =
              variantRows.length === 1
                ? (variantRows[0]?.specLabel ?? getVariantSpecSummary(model, null, 1))
                : variantCountLabel;
            const summaryMarginPercent = formatPercentRange(
              variantRows.map((row) => row.activeMargin?.percent)
            );
            const hasVariantMarkupOverrides = variantRows.some(
              (row) => row.resolvedVariantPolicy.markupBps !== resolvedModelPolicy.markupBps
            );
            const summaryBlendedMarkupPercent = getWeightedMarkupPercent(variantRows);
            const summaryMarkupRange = hasVariantMarkupOverrides
              ? formatPercentRange(
                  variantRows.map((row) => row.resolvedVariantPolicy.markupBps / 100)
                )
              : null;
            const shouldShowBlendedMarkupSummary = canEditSharedPolicy && hasVariantMarkupOverrides;
            const summaryMarkupHelperText =
              variantRows.length === 1
                ? "Variant override"
                : (summaryMarkupRange ?? "Blended from variants");
            const summaryTypeLabel = getVariantTypeSummary(
              model,
              variantRows.map((row) => row.variant)
            );
            const summaryVariant = variantRows[0]?.variant ?? null;
            const summaryMarginToneClass =
              variantRows.length === 1
                ? getMarginToneClassName(variantRows[0]?.activeMargin?.usd)
                : "";

            return (
              <React.Fragment key={model.id}>
                <div className={`${styles.pricingModelsRow} ${styles.pricingModelSummaryRow}`}>
                  <span
                    className={`${styles.pricingProviderLabel} ${getProviderLabelClassName(
                      model.provider
                    )}`.trim()}
                  >
                    {model.provider}
                  </span>
                  <span className={`${styles.pricingPrimaryCell} ${styles.pricingRateSourceCell}`}>
                    <div className={styles.pricingModelSummaryCell}>
                      <button
                        type="button"
                        className={styles.pricingModelToggleButton}
                        onClick={() => toggleModelExpanded(model.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`pricing-variants-${model.id}`}
                      >
                        <span className={styles.pricingExpandGlyph}>{isExpanded ? "-" : "+"}</span>
                        <strong>{model.label}</strong>
                      </button>
                      <small>{variantCountLabel}</small>
                    </div>
                  </span>
                  <span className={`${styles.pricingPrimaryCell} ${styles.pricingTypeCell}`}>
                    {renderTypeSourceLink(model, summaryTypeLabel)}
                  </span>
                  <span className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}>
                    {canEditModelDuration(model) ? (
                      <label className={styles.pricingDurationInputWrap}>
                        <span className="sr-only">{`${usageControl.label} for ${model.label}`}</span>
                        <input
                          aria-label={`${usageControl.label} for ${model.label}`}
                          className={`${styles.searchInput} ${styles.pricingSheetInput}`}
                          type="number"
                          inputMode={usageControl.inputMode}
                          min={usageControl.minValue ?? undefined}
                          max={usageControl.maxValue ?? undefined}
                          step={usageControl.step}
                          value={usageInputValue}
                          onChange={(event) =>
                            setDurationDrafts((current) => ({
                              ...current,
                              [model.id]: event.target.value,
                            }))
                          }
                        />
                        {usageControl.unitLabel ? <small>{usageControl.unitLabel}</small> : null}
                      </label>
                    ) : (
                      <>
                        <strong>{usageDisplayLabel || "—"}</strong>
                        {usageControl.kind !== "none" ? <small>{usageControl.label}</small> : null}
                      </>
                    )}
                  </span>
                  <span className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}>
                    <strong>{summarySpecLabel}</strong>
                    {variantRows.length > 1 ? <small>Expand to inspect each tier.</small> : null}
                  </span>
                  <span className={`${styles.pricingPrimaryCell} ${styles.pricingControlCell}`}>
                    <button
                      type="button"
                      className={styles.pricingCostUnitButton}
                      aria-label={`Show provider pricing docs for ${model.label}`}
                      onMouseEnter={(event) =>
                        showCostDocsPopover(event.clientX, event.clientY, model, summaryVariant)
                      }
                      onMouseMove={(event) =>
                        showCostDocsPopover(event.clientX, event.clientY, model, summaryVariant)
                      }
                      onMouseLeave={hideCostDocsPopover}
                      onFocus={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        showCostDocsPopover(rect.right, rect.top, model, summaryVariant);
                      }}
                      onBlur={hideCostDocsPopover}
                    >
                      <strong>{getDisplayedPricingStrategyLabel(model)}</strong>
                    </button>
                    <small>
                      {formatValueRange(
                        variantRows.map((row) => row.activeRateSourceCostUsd),
                        formatProviderCostUsd
                      )}
                    </small>
                    {canEditSharedPolicy ? (
                      <small>
                        {variantRows.length === 1
                          ? "Expand to edit this variant."
                          : "Expand to edit each tier."}
                      </small>
                    ) : null}
                  </span>
                  <span className={`${styles.pricingPrimaryCell} ${styles.pricingControlCell}`}>
                    <strong>
                      {formatValueRange(
                        variantRows.map((row) => row.activeProviderCostUsd),
                        formatProviderCostUsd
                      )}
                    </strong>
                  </span>
                  <span className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}>
                    <strong>
                      {formatValueRange(
                        variantRows.map((row) => row.activeCreditsAtCost),
                        formatFractionalCredits
                      )}
                    </strong>
                  </span>
                  <span className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}>
                    {shouldShowBlendedMarkupSummary ? (
                      <>
                        <strong>
                          {summaryBlendedMarkupPercent != null
                            ? formatPercent(summaryBlendedMarkupPercent)
                            : formatPercent(resolvedModelPolicy.markupBps / 100)}
                        </strong>
                        <small>{summaryMarkupHelperText}</small>
                      </>
                    ) : canEditSharedPolicy ? (
                      <label className={styles.pricingSheetInputWrap}>
                        <span className="sr-only">{`Model markup for ${model.label}`}</span>
                        <input
                          aria-label={`Model markup for ${model.label}`}
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
                      <>
                        <strong>{formatPercent(resolvedModelPolicy.markupBps / 100)}</strong>
                        <small className={getPricingAuthorityClassName(model.pricingAuthority)}>
                          {getPricingAuthorityLabel(model.pricingAuthority)}
                        </small>
                      </>
                    )}
                  </span>
                  <span className={styles.pricingPrimaryCell}>
                    <strong>
                      {formatValueRange(
                        variantRows.map((row) => row.workbookBillableCredits),
                        formatFractionalCredits
                      )}
                    </strong>
                  </span>
                  <span className={styles.pricingPrimaryCell}>
                    <strong>
                      {formatValueRange(
                        variantRows.map((row) => row.workbookBillableUsd),
                        formatProviderCostUsd
                      )}
                    </strong>
                  </span>
                  <span className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}>
                    <strong className={summaryMarginToneClass}>
                      {formatValueRange(
                        variantRows.map((row) => row.activeMargin?.usd),
                        formatProviderCostUsd
                      )}
                    </strong>
                    {summaryMarginPercent ? <small>{summaryMarginPercent}</small> : null}
                  </span>
                </div>
                {isExpanded ? (
                  <div id={`pricing-variants-${model.id}`} className={styles.pricingVariantGroup}>
                    {variantRows.map((row) => (
                      <div
                        key={row.key}
                        className={`${styles.pricingModelsRow} ${styles.pricingVariantRow}`}
                      >
                        <span className={styles.pricingVariantPlaceholder} />
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingRateSourceCell}`}
                        >
                          <strong>
                            {row.isCustomRow ? row.rowLabel : `Variant ${row.index + 1}`}
                          </strong>
                          <small>
                            {row.isCustomRow ? `${model.label} · custom row` : model.label}
                          </small>
                          {row.isCustomRow && row.customRow ? (
                            <button
                              type="button"
                              className={styles.pricingModelSecondaryButton}
                              onClick={() => removeCustomRow(model.id, row.customRow!.displayRowId)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </span>
                        <span className={`${styles.pricingPrimaryCell} ${styles.pricingTypeCell}`}>
                          {renderTypeSourceLink(model, getModelTypeLabel(model, row.variant))}
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                        >
                          <strong>{usageDisplayValue || "—"}</strong>
                          {usageControl.kind !== "none" ? (
                            <small>{usageControl.label}</small>
                          ) : null}
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                        >
                          {row.isCustomRow && row.customRow ? (
                            <div className={styles.pricingSpecEditor}>
                              {customRowSpecOptions.baseOptions.length > 1 ? (
                                <label className={styles.pricingSpecControl}>
                                  <span className="sr-only">{`Base type for ${row.rowLabel}`}</span>
                                  <select
                                    aria-label={`Base type for ${row.rowLabel}`}
                                    className={`${styles.searchInput} ${styles.pricingSpecSelect}`}
                                    value={encodeNullableString(
                                      row.customRow.spec.baseVariantId ?? null
                                    )}
                                    onChange={(event) =>
                                      updateCustomRowSpecDraft(model, row.customRow!, {
                                        baseVariantId: decodeNullableString(event.target.value),
                                      })
                                    }
                                  >
                                    {customRowSpecOptions.baseOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}
                              {customRowSpecOptions.aspectOptions.length > 1 ? (
                                <label className={styles.pricingSpecControl}>
                                  <span className="sr-only">{`Aspect for ${row.rowLabel}`}</span>
                                  <select
                                    aria-label={`Aspect for ${row.rowLabel}`}
                                    className={`${styles.searchInput} ${styles.pricingSpecSelect}`}
                                    value={encodeNullableString(row.customRow.spec.aspect ?? null)}
                                    onChange={(event) =>
                                      updateCustomRowSpecDraft(model, row.customRow!, {
                                        aspect: decodeNullableString(event.target.value),
                                      })
                                    }
                                  >
                                    {customRowSpecOptions.aspectOptions.map((option) => (
                                      <option
                                        key={`${option.label}-${option.value ?? "null"}`}
                                        value={encodeNullableString(option.value)}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}
                              {customRowSpecOptions.resolutionOptions.length > 1 ? (
                                <label className={styles.pricingSpecControl}>
                                  <span className="sr-only">{`Resolution for ${row.rowLabel}`}</span>
                                  <select
                                    aria-label={`Resolution for ${row.rowLabel}`}
                                    className={`${styles.searchInput} ${styles.pricingSpecSelect}`}
                                    value={encodeNullableString(
                                      row.customRow.spec.resolution ?? null
                                    )}
                                    onChange={(event) =>
                                      updateCustomRowSpecDraft(model, row.customRow!, {
                                        resolution: decodeNullableString(event.target.value),
                                      })
                                    }
                                  >
                                    {customRowSpecOptions.resolutionOptions.map((option) => (
                                      <option
                                        key={`${option.label}-${option.value ?? "null"}`}
                                        value={encodeNullableString(option.value)}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}
                              {customRowSpecOptions.audioOptions.length > 1 ? (
                                <label className={styles.pricingSpecControl}>
                                  <span className="sr-only">{`Audio for ${row.rowLabel}`}</span>
                                  <select
                                    aria-label={`Audio for ${row.rowLabel}`}
                                    className={`${styles.searchInput} ${styles.pricingSpecSelect}`}
                                    value={encodeNullableBoolean(row.customRow.spec.audio ?? null)}
                                    onChange={(event) =>
                                      updateCustomRowSpecDraft(model, row.customRow!, {
                                        audio: decodeNullableBoolean(event.target.value),
                                      })
                                    }
                                  >
                                    {customRowSpecOptions.audioOptions.map((option) => (
                                      <option
                                        key={`${option.label}-${String(option.value)}`}
                                        value={encodeNullableBoolean(option.value)}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}
                              {customRowSpecOptions.videoInputOptions.length > 1 ? (
                                <label className={styles.pricingSpecControl}>
                                  <span className="sr-only">{`Video input for ${row.rowLabel}`}</span>
                                  <select
                                    aria-label={`Video input for ${row.rowLabel}`}
                                    className={`${styles.searchInput} ${styles.pricingSpecSelect}`}
                                    value={encodeNullableBoolean(
                                      row.customRow.spec.videoInput ?? null
                                    )}
                                    onChange={(event) =>
                                      updateCustomRowSpecDraft(model, row.customRow!, {
                                        videoInput: decodeNullableBoolean(event.target.value),
                                      })
                                    }
                                  >
                                    {customRowSpecOptions.videoInputOptions.map((option) => (
                                      <option
                                        key={`${option.label}-${String(option.value)}`}
                                        value={encodeNullableBoolean(option.value)}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}
                            </div>
                          ) : (
                            <strong>{row.specLabel}</strong>
                          )}
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingControlCell}`}
                        >
                          <button
                            type="button"
                            className={styles.pricingCostUnitButton}
                            aria-label={`Show provider pricing docs for ${model.label}${
                              row.variant && row.variant.id !== "default"
                                ? ` ${row.variant.label}`
                                : ""
                            }`}
                            onMouseEnter={(event) =>
                              showCostDocsPopover(event.clientX, event.clientY, model, row.variant)
                            }
                            onMouseMove={(event) =>
                              showCostDocsPopover(event.clientX, event.clientY, model, row.variant)
                            }
                            onMouseLeave={hideCostDocsPopover}
                            onFocus={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              showCostDocsPopover(rect.right, rect.top, model, row.variant);
                            }}
                            onBlur={hideCostDocsPopover}
                          >
                            <strong>{getDisplayedPricingStrategyLabel(model)}</strong>
                          </button>
                          {canEditSharedPolicy && row.variantId ? (
                            <label className={styles.pricingSheetInputWrap}>
                              <span className="sr-only">{`Rate source cost for ${model.label} ${row.rowLabel ?? row.specLabel}`}</span>
                              <input
                                aria-label={`Rate source cost for ${model.label} ${row.rowLabel ?? row.specLabel}`}
                                className={`${styles.searchInput} ${styles.pricingSheetInput}`}
                                value={row.rateSourceInputValue}
                                placeholder={
                                  row.activeRateSourceCostUsd != null
                                    ? String(Number(row.activeRateSourceCostUsd.toFixed(4)))
                                    : ""
                                }
                                onChange={(event) => {
                                  const variantId = row.variantId;
                                  if (!variantId) return;
                                  const nextValue = event.target.value;
                                  const parsedRateCost = parsePositiveDecimalInput(nextValue);
                                  const isTimeRateMode =
                                    row.rateSourceInputMode === "per_minute" ||
                                    row.rateSourceInputMode === "per_second";
                                  const providerUsdPerSecondOverride =
                                    row.rateSourceInputMode === "per_minute" &&
                                    parsedRateCost != null
                                      ? parsedRateCost / 60
                                      : row.rateSourceInputMode === "per_second"
                                        ? parsedRateCost
                                        : null;
                                  const providerUsdOverride = isTimeRateMode
                                    ? null
                                    : parsedRateCost;
                                  if (isTimeRateMode) {
                                    setVariantProviderCostPerSecondDrafts((current) => ({
                                      ...current,
                                      [row.variantDraftKey]: nextValue,
                                    }));
                                    setVariantProviderCostDrafts((current) => {
                                      const next = { ...current };
                                      delete next[row.variantDraftKey];
                                      return next;
                                    });
                                  } else {
                                    setVariantProviderCostDrafts((current) => ({
                                      ...current,
                                      [row.variantDraftKey]: nextValue,
                                    }));
                                    setVariantProviderCostPerSecondDrafts((current) => {
                                      const next = { ...current };
                                      delete next[row.variantDraftKey];
                                      return next;
                                    });
                                  }
                                  if (row.isCustomRow && row.customRow) {
                                    updateCustomRow(
                                      model.id,
                                      row.customRow!.displayRowId,
                                      (currentRow) => ({
                                        ...currentRow,
                                        overrides: {
                                          ...currentRow.overrides,
                                          providerUsdOverride,
                                          providerUsdPerSecondOverride,
                                        },
                                      })
                                    );
                                  } else {
                                    updateModelPolicyDraft((current) =>
                                      normalizeVariantOverrideDraft(current, model.id, variantId, {
                                        providerUsdOverride,
                                        providerUsdPerSecondOverride,
                                      })
                                    );
                                  }
                                }}
                              />
                            </label>
                          ) : row.activeRateSourceCostUsd != null ? (
                            <small>{formatProviderCostUsd(row.activeRateSourceCostUsd)}</small>
                          ) : (
                            <small>Unavailable</small>
                          )}
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                        >
                          {canEditSharedPolicy && row.variantId ? (
                            <label className={styles.pricingSheetInputWrap}>
                              <span className="sr-only">{`Provider cost for ${model.label} ${row.rowLabel ?? row.specLabel}`}</span>
                              <input
                                aria-label={`Provider cost for ${model.label} ${row.rowLabel ?? row.specLabel}`}
                                className={`${styles.searchInput} ${styles.pricingSheetInput}`}
                                value={row.variantProviderCostInputValue}
                                placeholder={
                                  row.activePreview?.usdRaw != null
                                    ? row.activePreview.usdRaw.toFixed(4)
                                    : ""
                                }
                                onChange={(event) => {
                                  const variantId = row.variantId;
                                  if (!variantId) return;
                                  const nextValue = event.target.value;
                                  const parsedProviderCost = parsePositiveDecimalInput(nextValue);
                                  const isTimeRateMode =
                                    row.rateSourceInputMode === "per_minute" ||
                                    row.rateSourceInputMode === "per_second";
                                  const derivedProviderUsdPerSecondOverride =
                                    isTimeRateMode &&
                                    parsedProviderCost != null &&
                                    row.resolvedDurationSeconds != null &&
                                    Number.isFinite(row.resolvedDurationSeconds) &&
                                    row.resolvedDurationSeconds > 0
                                      ? parsedProviderCost / row.resolvedDurationSeconds
                                      : null;
                                  const derivedProviderUsdOverride =
                                    !isTimeRateMode &&
                                    parsedProviderCost != null &&
                                    row.usageRateMultiplier != null &&
                                    Number.isFinite(row.usageRateMultiplier) &&
                                    row.usageRateMultiplier > 0 &&
                                    row.rateSourceInputMode !== "flat"
                                      ? parsedProviderCost / row.usageRateMultiplier
                                      : !isTimeRateMode
                                        ? parsedProviderCost
                                        : null;
                                  if (isTimeRateMode) {
                                    setVariantProviderCostDrafts((current) => {
                                      const next = { ...current };
                                      delete next[row.variantDraftKey];
                                      return next;
                                    });
                                    setVariantProviderCostPerSecondDrafts((current) => {
                                      const next = { ...current };
                                      if (
                                        derivedProviderUsdPerSecondOverride != null &&
                                        Number.isFinite(derivedProviderUsdPerSecondOverride) &&
                                        derivedProviderUsdPerSecondOverride > 0
                                      ) {
                                        next[row.variantDraftKey] =
                                          row.rateSourceInputMode === "per_minute"
                                            ? String(
                                                Number(
                                                  (
                                                    derivedProviderUsdPerSecondOverride * 60
                                                  ).toFixed(4)
                                                )
                                              )
                                            : String(
                                                Number(
                                                  derivedProviderUsdPerSecondOverride.toFixed(4)
                                                )
                                              );
                                      } else {
                                        delete next[row.variantDraftKey];
                                      }
                                      return next;
                                    });
                                  } else {
                                    setVariantProviderCostDrafts((current) => ({
                                      ...current,
                                      [row.variantDraftKey]:
                                        derivedProviderUsdOverride != null &&
                                        Number.isFinite(derivedProviderUsdOverride) &&
                                        derivedProviderUsdOverride > 0
                                          ? String(Number(derivedProviderUsdOverride.toFixed(4)))
                                          : nextValue,
                                    }));
                                    setVariantProviderCostPerSecondDrafts((current) => {
                                      const next = { ...current };
                                      delete next[row.variantDraftKey];
                                      return next;
                                    });
                                  }
                                  if (row.isCustomRow && row.customRow) {
                                    updateCustomRow(
                                      model.id,
                                      row.customRow!.displayRowId,
                                      (currentRow) => ({
                                        ...currentRow,
                                        overrides: {
                                          ...currentRow.overrides,
                                          providerUsdOverride: derivedProviderUsdOverride,
                                          providerUsdPerSecondOverride:
                                            derivedProviderUsdPerSecondOverride,
                                        },
                                      })
                                    );
                                  } else {
                                    updateModelPolicyDraft((current) =>
                                      normalizeVariantOverrideDraft(current, model.id, variantId, {
                                        providerUsdOverride: derivedProviderUsdOverride,
                                        providerUsdPerSecondOverride:
                                          derivedProviderUsdPerSecondOverride,
                                      })
                                    );
                                  }
                                }}
                              />
                            </label>
                          ) : row.activeProviderCostUsd != null ? (
                            <strong>{formatProviderCostUsd(row.activeProviderCostUsd)}</strong>
                          ) : (
                            <small>Unavailable</small>
                          )}
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingControlCell}`}
                        >
                          {row.activeCreditsAtCost != null ? (
                            <strong>{formatFractionalCredits(row.activeCreditsAtCost)}</strong>
                          ) : (
                            <small>Unavailable</small>
                          )}
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                        >
                          {canEditSharedPolicy && row.variantId ? (
                            <label className={styles.pricingSheetInputWrap}>
                              <span className="sr-only">{row.markupLabel}</span>
                              <input
                                aria-label={row.markupLabel}
                                className={`${styles.searchInput} ${styles.pricingSheetInput}`}
                                value={row.variantMarkupInputValue}
                                placeholder={String(row.resolvedVariantPolicy.markupBps / 100)}
                                onChange={(event) => {
                                  const variantId = row.variantId;
                                  if (!variantId) return;
                                  const nextValue = event.target.value;
                                  setVariantMarkupDrafts((current) => ({
                                    ...current,
                                    [row.variantDraftKey]: nextValue,
                                  }));
                                  if (row.isCustomRow && row.customRow) {
                                    updateCustomRow(
                                      model.id,
                                      row.customRow!.displayRowId,
                                      (currentRow) => ({
                                        ...currentRow,
                                        overrides: {
                                          ...currentRow.overrides,
                                          markupBps: parsePercentToBps(nextValue),
                                        },
                                      })
                                    );
                                  } else {
                                    updateModelPolicyDraft((current) =>
                                      normalizeVariantOverrideDraft(current, model.id, variantId, {
                                        markupBps: parsePercentToBps(nextValue),
                                      })
                                    );
                                  }
                                }}
                              />
                              <span>%</span>
                            </label>
                          ) : (
                            <strong>
                              {formatPercent(row.resolvedVariantPolicy.markupBps / 100)}
                            </strong>
                          )}
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                        >
                          {row.workbookBillableCredits != null ? (
                            <strong>{formatFractionalCredits(row.workbookBillableCredits)}</strong>
                          ) : (
                            <small>Unavailable</small>
                          )}
                        </span>
                        <span className={styles.pricingPrimaryCell}>
                          {row.workbookBillableUsd != null ? (
                            <strong>{formatProviderCostUsd(row.workbookBillableUsd)}</strong>
                          ) : (
                            <small>Unavailable</small>
                          )}
                        </span>
                        <span className={styles.pricingPrimaryCell}>
                          {row.activeMargin ? (
                            <>
                              <strong className={getMarginToneClassName(row.activeMargin.usd)}>
                                {formatProviderCostUsd(row.activeMargin.usd)}
                              </strong>
                              {row.activeMargin.percent != null ? (
                                <small>{formatPercent(row.activeMargin.percent)}</small>
                              ) : null}
                            </>
                          ) : (
                            <small>Unavailable</small>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
