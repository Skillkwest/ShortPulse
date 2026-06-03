/**
 * Plan margin simulator for the admin pricing page.
 * Mirrors the current pricing grid shape and translates billed credits into
 * plan-earned revenue after discount and affiliate adjustments.
 */
import React from "react";
import {
  buildDefaultPlanEconomicsDraft,
  buildModelEconomicsRows,
  buildPlanMarginModelRows,
  computePlanMarginSummary,
  type PlanEconomicsDraft,
  type PlanMarginModelRow,
} from "./pricingAnalysis";
import { formatFractionalCredits, formatPercent, formatProviderCostUsd } from "./pricingFormatting";
import type {
  AudioDraftByModelId,
  AspectDraftByModelId,
  DurationDraftByModelId,
  ModelPricingSortOption,
  ResolutionDraftByModelId,
} from "./pricingDrafts";
import type { AdminPricingCustomRowsDocument } from "../../lib/model-runtime/adminPricingCustomRows";
import type { ModelPricingPolicyDocument } from "../../lib/model-runtime/pricingPolicy";
import type { AdminPricingModelRow, AdminPricingPlanRow } from "./types";
import styles from "../../styles/admin.module.css";

type PricingCalculatorSupportStripProps = {
  plans: AdminPricingPlanRow[];
  displayedModels: AdminPricingModelRow[];
  effectiveModelPolicyDraft: ModelPricingPolicyDocument;
  durationDrafts: DurationDraftByModelId;
  aspectDrafts: AspectDraftByModelId;
  resolutionDrafts: ResolutionDraftByModelId;
  audioDrafts: AudioDraftByModelId;
  customRowsDocument: AdminPricingCustomRowsDocument;
  modelSortOption: ModelPricingSortOption;
  planDraftsByPlanId: Record<string, PlanEconomicsDraft>;
  simulatorPlanIds: string[];
  updatePlanDraft: (planId: string, field: keyof PlanEconomicsDraft, value: string) => void;
  addSimulatorPlan: () => void;
  removeSimulatorPlan: (planId: string) => void;
  reorderSimulatorPlans: (fromPlanId: string, targetIndex: number) => void;
  isDraftDirty: boolean;
};

type PlanMarginModelGroup = {
  key: string;
  providerLabel: string;
  modelLabel: string;
  typeSummary: string;
  usageLabel: string;
  usageValueLabel: string;
  summarySpecLabel: string;
  variantCountLabel: string;
  rows: PlanMarginModelRow[];
};

type PlanMarginPlanCardProps = {
  planId: string;
  plan: AdminPricingPlanRow | null;
  planDraft: PlanEconomicsDraft;
  planSummary: ReturnType<typeof computePlanMarginSummary>;
  modelGroups: PlanMarginModelGroup[];
  expandedModelKeys: Record<string, boolean>;
  toggleModelExpanded: (planId: string, modelId: string) => void;
  updatePlanDraft: (planId: string, field: keyof PlanEconomicsDraft, value: string) => void;
  removeSimulatorPlan: (planId: string) => void;
  isDragging: boolean;
  onDragStartCard: (planId: string) => void;
  onDragEndCard: () => void;
};

const getFiniteValues = (values: Array<number | null | undefined>): number[] =>
  values.filter((value): value is number => value != null && Number.isFinite(value));

const formatValueRange = (
  values: Array<number | null | undefined>,
  formatter: (value: number) => string
): string => {
  const finiteValues = getFiniteValues(values);
  if (!finiteValues.length) return "-";
  const minValue = Math.min(...finiteValues);
  const maxValue = Math.max(...finiteValues);
  if (Math.abs(maxValue - minValue) < 0.000001) {
    return formatter(minValue);
  }
  return `${formatter(minValue)} to ${formatter(maxValue)}`;
};

const formatPercentRange = (values: Array<number | null | undefined>): string => {
  const finiteValues = getFiniteValues(values);
  if (!finiteValues.length) return "-";
  const minValue = Math.min(...finiteValues);
  const maxValue = Math.max(...finiteValues);
  if (Math.abs(maxValue - minValue) < 0.000001) {
    return formatPercent(minValue);
  }
  return `${formatPercent(minValue)} to ${formatPercent(maxValue)}`;
};

const getMarginToneStyle = (
  values: Array<number | null | undefined>
): React.CSSProperties | undefined => {
  const finiteValues = getFiniteValues(values);
  if (!finiteValues.length) return undefined;
  const averageMargin = finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
  const normalized = Math.max(0, Math.min(1, (averageMargin - 10) / 40));
  const hue = 6 + normalized * 142;
  const saturation = 76 + normalized * 10;
  const lightness = 62 + normalized * 10;
  return {
    color: `hsl(${hue.toFixed(1)}deg ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`,
  };
};

const formatNegativeProviderCostUsd = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "—";
  return `-${formatProviderCostUsd(value)}`;
};

const getTypeSummary = (rows: PlanMarginModelRow[]): string => {
  const labels = Array.from(new Set(rows.map((row) => row.typeLabel).filter(Boolean)));
  if (labels.length <= 1) return labels[0] ?? "-";
  return `${labels[0]} + ${labels.length - 1} more`;
};

const buildPlanMarginGroups = (
  displayedModels: AdminPricingModelRow[],
  marginRows: PlanMarginModelRow[]
): PlanMarginModelGroup[] => {
  const rowsByModelId = marginRows.reduce<Record<string, PlanMarginModelRow[]>>((acc, row) => {
    if (!acc[row.modelId]) acc[row.modelId] = [];
    acc[row.modelId].push(row);
    return acc;
  }, {});

  return displayedModels.flatMap((model) => {
    const rows = rowsByModelId[model.id] ?? [];
    if (!rows.length) return [];
    const variantCountLabel =
      rows.length === 1 ? "1 price variant" : `${rows.length} price variants`;
    return [
      {
        key: model.id,
        providerLabel: rows[0]?.providerLabel ?? model.provider,
        modelLabel: rows[0]?.modelLabel ?? model.label,
        typeSummary: getTypeSummary(rows),
        usageLabel: rows[0]?.usageLabel ?? "Usage",
        usageValueLabel: rows[0]?.usageValueLabel ?? "",
        summarySpecLabel: rows.length === 1 ? (rows[0]?.specLabel ?? "-") : variantCountLabel,
        variantCountLabel,
        rows,
      },
    ];
  });
};

function PlanMarginPlanCard({
  planId,
  plan,
  planDraft,
  planSummary,
  modelGroups,
  expandedModelKeys,
  toggleModelExpanded,
  updatePlanDraft,
  removeSimulatorPlan,
  isDragging,
  onDragStartCard,
  onDragEndCard,
}: PlanMarginPlanCardProps) {
  const tableShellRef = React.useRef<HTMLDivElement | null>(null);
  const tableScrollerRef = React.useRef<HTMLDivElement | null>(null);
  const stickyHeaderViewportRef = React.useRef<HTMLDivElement | null>(null);
  const stickyHeaderTrackRef = React.useRef<HTMLDivElement | null>(null);
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
      const shell = tableShellRef.current;
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

  const headerCells = (
    <>
      <span>Provider</span>
      <span>Model</span>
      <span>Type</span>
      <span>Usage</span>
      <span>Spec</span>
      <span>$ at cost</span>
      <span>Credits at cost</span>
      <span>Markup</span>
      <span>Credits w/ markup</span>
      <span>$ after markup</span>
      <span>$ after disc & aff</span>
      <span>Profit</span>
      <span>Margin</span>
    </>
  );

  const planLabel = plan?.displayName ?? "Simulation Plan";
  const fallbackSimulatorTitle = `${formatProviderCostUsd(planSummary.grossUsd)}/mo ${planLabel}`;

  return (
    <details
      className={`${styles.pricingPlanMarginCard} ${isDragging ? styles.pricingPlanMarginCardDragging : ""}`}
      open
      role="group"
      aria-label={`${planDraft.simulatedName || fallbackSimulatorTitle} simulator plan`}
    >
      <summary className={styles.pricingPlanMarginSummary}>
        <span
          className={styles.pricingPlanMarginSummaryTitle}
          onClick={(event) => event.stopPropagation()}
        >
          <span className={styles.pricingPlanMarginSummaryEditor}>
            <input
              aria-label={`${planLabel} simulator title`}
              className={`${styles.searchInput} ${styles.pricingPlanMarginSummaryNameInput}`}
              value={planDraft.simulatedName || fallbackSimulatorTitle}
              onChange={(event) => updatePlanDraft(planId, "simulatedName", event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </span>
        </span>
        <span className={styles.pricingPlanMarginSummaryActions}>
          <button
            type="button"
            className={styles.pricingPlanMarginDragHandle}
            aria-label={`Reorder ${planDraft.simulatedName || fallbackSimulatorTitle} simulator plan`}
            title="Drag to reorder simulator plan"
            draggable
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDragStart={(event) => {
              event.stopPropagation();
              onDragStartCard(planId);
            }}
            onDragEnd={(event) => {
              event.stopPropagation();
              onDragEndCard();
            }}
          >
            Drag
          </button>
          <span className={styles.pricingPlanMarginSummaryMeta}>{modelGroups.length} models</span>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              removeSimulatorPlan(planId);
            }}
          >
            Remove
          </button>
        </span>
      </summary>

      <div className={styles.pricingPlanMarginBody}>
        <aside className={styles.pricingPlanMarginSidebar}>
          <label className={styles.pricingPlanMarginField}>
            <span>Plan price</span>
            <input
              aria-label={`${planLabel} plan price`}
              className={styles.searchInput}
              value={planDraft.priceUsd}
              onChange={(event) => updatePlanDraft(planId, "priceUsd", event.target.value)}
            />
          </label>

          <label className={styles.pricingPlanMarginField}>
            <span>Credits included</span>
            <input
              aria-label={`${planLabel} credits included`}
              className={styles.searchInput}
              value={planDraft.includedCredits}
              onChange={(event) => updatePlanDraft(planId, "includedCredits", event.target.value)}
            />
          </label>

          <label className={styles.pricingPlanMarginField}>
            <span>Discount</span>
            <div className={styles.pricingPlanMarginInputWrap}>
              <input
                aria-label={`${planLabel} discount`}
                className={styles.searchInput}
                value={planDraft.discountPct}
                onChange={(event) => updatePlanDraft(planId, "discountPct", event.target.value)}
              />
              <span>%</span>
            </div>
          </label>

          <label className={styles.pricingPlanMarginField}>
            <span>Affiliate cut</span>
            <div className={styles.pricingPlanMarginInputWrap}>
              <input
                aria-label={`${planLabel} affiliate cut`}
                className={styles.searchInput}
                value={planDraft.affiliatePct}
                onChange={(event) => updatePlanDraft(planId, "affiliatePct", event.target.value)}
              />
              <span>%</span>
            </div>
          </label>

          <div className={styles.pricingPlanMarginSummaryCard}>
            <div className={styles.pricingPlanMarginSummaryRow}>
              <span>Price after discount</span>
              <strong>{formatProviderCostUsd(planSummary.afterDiscountUsd)}</strong>
            </div>
            <div className={styles.pricingPlanMarginSummaryRow}>
              <span>Affiliate deduction</span>
              <strong>{formatNegativeProviderCostUsd(planSummary.affiliateCostUsd)}</strong>
            </div>
            <div className={styles.pricingPlanMarginSummaryRow}>
              <span>Money kept</span>
              <strong>{formatProviderCostUsd(planSummary.moneyKeptUsd)}</strong>
            </div>
            <div className={styles.pricingPlanMarginSummaryRow}>
              <span>$ / credit</span>
              <strong>{formatProviderCostUsd(planSummary.dollarPerCredit)}</strong>
            </div>
            <p className={styles.pricingPlanMarginSummaryNote}>
              Every billed credit from the pricing grid is worth{" "}
              {formatProviderCostUsd(planSummary.dollarPerCredit)} after{" "}
              {planDraft.discountPct || "0"}% discount and {planDraft.affiliatePct || "0"}%
              affiliate cut.
            </p>
          </div>
        </aside>

        <div className={styles.pricingPlanMarginMain}>
          <div className={styles.pricingPlanMarginTableHead}>
            <div>
              <h3 className={styles.pricingSupportTitle}>
                Model economics (mirrors pricing grid variants)
              </h3>
            </div>
            <span className="tiny subdued">{modelGroups.length} models</span>
          </div>

          <div
            ref={tableShellRef}
            className={styles.pricingWorkbookShell}
            style={{
              paddingTop: pinnedHeaderLayout.active ? `${pinnedHeaderLayout.height}px` : undefined,
            }}
          >
            <div
              ref={stickyHeaderViewportRef}
              className={`${styles.pricingWorkbookStickyHeadViewport} ${styles.pricingPlanMarginStickyHeadViewport}`}
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
                className={`${styles.adminTableHead} ${styles.pricingPlanMarginGrid} ${styles.pricingWorkbookStickyHeadTrack} ${styles.pricingPlanMarginStickyHeadTrack}`}
              >
                {headerCells}
              </div>
            </div>

            <div
              ref={tableScrollerRef}
              className={styles.adminTableScroller}
              onScroll={syncStickyHeaderScroll}
            >
              <div
                className={`${styles.adminTable} ${styles.pricingPlanMarginTable} ${styles.pricingPlanMarginBodyTable}`}
              >
                {modelGroups.length === 0 ? (
                  <div className={`${styles.pricingModelsRow} ${styles.pricingPlanMarginGrid}`}>
                    <span className={styles.pricingPrimaryCell}>
                      <strong>No models in the current grid view</strong>
                      <small>Clear the model search or adjust the grid filters.</small>
                    </span>
                  </div>
                ) : null}

                {modelGroups.map((group) => {
                  const compositeKey = `${planId}:${group.key}`;
                  const isExpanded = expandedModelKeys[compositeKey] ?? false;
                  const groupMarginToneStyle = getMarginToneStyle(
                    group.rows.map((row) => row.marginPercent)
                  );
                  return (
                    <React.Fragment key={compositeKey}>
                      <div
                        className={`${styles.pricingModelsRow} ${styles.pricingModelSummaryRow} ${styles.pricingPlanMarginGrid}`}
                      >
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingPlanMarginProviderCell}`}
                        >
                          <strong>{group.providerLabel}</strong>
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingRateSourceCell}`}
                        >
                          <div className={styles.pricingModelSummaryCell}>
                            <button
                              type="button"
                              className={styles.pricingModelToggleButton}
                              onClick={() => toggleModelExpanded(planId, group.key)}
                              aria-expanded={isExpanded}
                              aria-controls={`plan-margin-${planId}-${group.key}`}
                            >
                              <span className={styles.pricingExpandGlyph}>
                                {isExpanded ? "-" : "+"}
                              </span>
                              <strong>{group.modelLabel}</strong>
                            </button>
                            <small>{group.variantCountLabel}</small>
                          </div>
                        </span>
                        <span className={`${styles.pricingPrimaryCell} ${styles.pricingTypeCell}`}>
                          <strong>{group.typeSummary}</strong>
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                        >
                          <strong>{group.usageValueLabel || "-"}</strong>
                          {group.usageLabel ? <small>{group.usageLabel}</small> : null}
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingRateSourceCell}`}
                        >
                          <strong>{group.summarySpecLabel}</strong>
                          {group.rows.length > 1 ? (
                            <small>Expand to inspect each variant.</small>
                          ) : null}
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                        >
                          <strong>
                            {formatValueRange(
                              group.rows.map((row) => row.providerCostUsd),
                              formatProviderCostUsd
                            )}
                          </strong>
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                        >
                          <strong>
                            {formatValueRange(
                              group.rows.map((row) => row.creditsAtCost),
                              formatFractionalCredits
                            )}
                          </strong>
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                        >
                          <strong>
                            {formatPercentRange(group.rows.map((row) => row.markupPercent))}
                          </strong>
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                        >
                          <strong>
                            {formatValueRange(
                              group.rows.map((row) => row.creditsWithMarkup),
                              formatFractionalCredits
                            )}
                          </strong>
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                        >
                          <strong>
                            {formatValueRange(
                              group.rows.map((row) => row.afterMarkupUsd),
                              formatProviderCostUsd
                            )}
                          </strong>
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                        >
                          <strong>
                            {formatValueRange(
                              group.rows.map((row) => row.afterDiscountAffiliateUsd),
                              formatProviderCostUsd
                            )}
                          </strong>
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell} ${styles.pricingPlanMarginProfitCell}`}
                        >
                          <strong>
                            {formatValueRange(
                              group.rows.map((row) => row.profitAfterDiscountAffiliateUsd),
                              formatProviderCostUsd
                            )}
                          </strong>
                        </span>
                        <span
                          className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell} ${styles.pricingPlanMarginMarginCell}`}
                        >
                          <strong style={groupMarginToneStyle}>
                            {formatPercentRange(group.rows.map((row) => row.marginPercent))}
                          </strong>
                        </span>
                      </div>

                      {isExpanded ? (
                        <div
                          id={`plan-margin-${planId}-${group.key}`}
                          className={styles.pricingVariantGroup}
                        >
                          {group.rows.map((row, index) => (
                            <div
                              key={`${compositeKey}:${row.variantId}`}
                              className={`${styles.pricingModelsRow} ${styles.pricingVariantRow} ${styles.pricingPlanMarginGrid}`}
                            >
                              <span className={styles.pricingVariantPlaceholder} />
                              <span
                                className={`${styles.pricingPrimaryCell} ${styles.pricingRateSourceCell}`}
                              >
                                <strong>{`Variant ${index + 1}`}</strong>
                                <small>{group.modelLabel}</small>
                              </span>
                              <span
                                className={`${styles.pricingPrimaryCell} ${styles.pricingTypeCell}`}
                              >
                                <strong>{row.typeLabel}</strong>
                              </span>
                              <span
                                className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                              >
                                <strong>{row.usageValueLabel || "-"}</strong>
                                {row.usageLabel ? <small>{row.usageLabel}</small> : null}
                              </span>
                              <span
                                className={`${styles.pricingPrimaryCell} ${styles.pricingRateSourceCell}`}
                              >
                                <strong>{row.specLabel}</strong>
                              </span>
                              <span
                                className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                              >
                                <strong>{formatProviderCostUsd(row.providerCostUsd)}</strong>
                              </span>
                              <span
                                className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                              >
                                <strong>
                                  {row.creditsAtCost != null
                                    ? formatFractionalCredits(row.creditsAtCost)
                                    : "-"}
                                </strong>
                              </span>
                              <span
                                className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                              >
                                <strong>
                                  {row.markupPercent != null
                                    ? formatPercent(row.markupPercent)
                                    : "-"}
                                </strong>
                              </span>
                              <span
                                className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                              >
                                <strong>
                                  {row.creditsWithMarkup != null
                                    ? formatFractionalCredits(row.creditsWithMarkup)
                                    : "-"}
                                </strong>
                              </span>
                              <span
                                className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                              >
                                <strong>{formatProviderCostUsd(row.afterMarkupUsd)}</strong>
                              </span>
                              <span
                                className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell}`}
                              >
                                <strong>
                                  {formatProviderCostUsd(row.afterDiscountAffiliateUsd)}
                                </strong>
                              </span>
                              <span
                                className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell} ${styles.pricingPlanMarginProfitCell}`}
                              >
                                <strong>
                                  {formatProviderCostUsd(row.profitAfterDiscountAffiliateUsd)}
                                </strong>
                              </span>
                              <span
                                className={`${styles.pricingPrimaryCell} ${styles.pricingNumberCell} ${styles.pricingPlanMarginMarginCell}`}
                              >
                                <strong>
                                  <span style={getMarginToneStyle([row.marginPercent])}>
                                    {row.marginPercent != null
                                      ? formatPercent(row.marginPercent)
                                      : "-"}
                                  </span>
                                </strong>
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
        </div>
      </div>
    </details>
  );
}

export function PricingCalculatorSupportStrip({
  plans,
  displayedModels,
  effectiveModelPolicyDraft,
  durationDrafts,
  aspectDrafts,
  resolutionDrafts,
  audioDrafts,
  customRowsDocument,
  modelSortOption,
  planDraftsByPlanId,
  simulatorPlanIds,
  updatePlanDraft,
  addSimulatorPlan,
  removeSimulatorPlan,
  reorderSimulatorPlans,
  isDraftDirty,
}: PricingCalculatorSupportStripProps) {
  const [expandedModelKeys, setExpandedModelKeys] = React.useState<Record<string, boolean>>({});
  const [draggedPlanId, setDraggedPlanId] = React.useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(null);

  const orderedPlans = React.useMemo(
    () => [...plans].sort((left, right) => left.sortOrder - right.sortOrder),
    [plans]
  );
  const plansById = React.useMemo(
    () =>
      orderedPlans.reduce<Record<string, AdminPricingPlanRow>>((acc, plan) => {
        acc[plan.planId] = plan;
        return acc;
      }, {}),
    [orderedPlans]
  );

  const syncedModelRows = React.useMemo(
    () =>
      buildModelEconomicsRows({
        models: displayedModels,
        pricingPolicy: effectiveModelPolicyDraft,
        customRowsDocument,
        durationDrafts,
        aspectDrafts,
        resolutionDrafts,
        audioDrafts,
        sortOption: modelSortOption,
      }),
    [
      aspectDrafts,
      audioDrafts,
      customRowsDocument,
      displayedModels,
      durationDrafts,
      effectiveModelPolicyDraft,
      modelSortOption,
      resolutionDrafts,
    ]
  );

  const toggleModelExpanded = React.useCallback((planId: string, modelId: string) => {
    const compositeKey = `${planId}:${modelId}`;
    setExpandedModelKeys((current) => ({
      ...current,
      [compositeKey]: !current[compositeKey],
    }));
  }, []);

  const handleDragStartCard = React.useCallback((planId: string) => {
    setDraggedPlanId(planId);
    setDropTargetIndex(null);
  }, []);

  const handleDragEnterSlot = React.useCallback((targetIndex: number) => {
    setDropTargetIndex(targetIndex);
  }, []);

  const handleDropSlot = React.useCallback(
    (targetIndex: number) => {
      if (draggedPlanId) {
        reorderSimulatorPlans(draggedPlanId, targetIndex);
      }
      setDraggedPlanId(null);
      setDropTargetIndex(null);
    },
    [draggedPlanId, reorderSimulatorPlans]
  );

  const handleDragEndCard = React.useCallback(() => {
    setDraggedPlanId(null);
    setDropTargetIndex(null);
  }, []);

  return (
    <section className={`${styles.adminSection} ${styles.pricingCalculatorSupportStrip}`}>
      <div className={styles.adminSectionHead}>
        <div>
          <h2 className={styles.adminSectionTitle}>Plan Margin Simulator</h2>
          <p className="tiny subdued">
            Mirror the current pricing grid, then translate billed credits into plan-earned revenue
            after discount and affiliate adjustments.
          </p>
        </div>
        <span className={`${styles.pill} ${isDraftDirty ? styles.pillWarn : styles.pillOk}`}>
          {isDraftDirty ? "Using draft grid" : "Using live grid"}
        </span>
      </div>

      <div className={styles.pricingPlanMarginToolbar}>
        <button type="button" className="ghost-btn mini" onClick={addSimulatorPlan}>
          Add simulator plan
        </button>
      </div>

      <div className={styles.pricingPlanMarginList}>
        {simulatorPlanIds.length === 0 ? (
          <div className={styles.pricingPlanMarginEmptyState}>
            <strong>No simulator plans yet.</strong>
            <span>Add a simulator plan to start modeling margin scenarios.</span>
          </div>
        ) : null}

        {simulatorPlanIds.map((planId, index) => {
          const plan = plansById[planId] ?? null;
          const planDraft = planDraftsByPlanId[planId] ?? buildDefaultPlanEconomicsDraft(plan);
          const planSummary = computePlanMarginSummary({
            ...planDraft,
            processorPct: "0",
            processorFlatUsd: "0",
          });
          const marginRows = buildPlanMarginModelRows({
            modelRows: syncedModelRows,
            planSummary,
          });
          const modelGroups = buildPlanMarginGroups(displayedModels, marginRows);

          return (
            <React.Fragment key={planId}>
              <div
                className={`${styles.pricingPlanMarginDropSlot} ${dropTargetIndex === index ? styles.pricingPlanMarginDropSlotActive : ""}`}
                aria-hidden="true"
                onDragEnter={() => handleDragEnterSlot(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDropSlot(index)}
              />
              <PlanMarginPlanCard
                planId={planId}
                plan={plan}
                planDraft={planDraft}
                planSummary={planSummary}
                modelGroups={modelGroups}
                expandedModelKeys={expandedModelKeys}
                toggleModelExpanded={toggleModelExpanded}
                updatePlanDraft={updatePlanDraft}
                removeSimulatorPlan={removeSimulatorPlan}
                isDragging={draggedPlanId === planId}
                onDragStartCard={handleDragStartCard}
                onDragEndCard={handleDragEndCard}
              />
            </React.Fragment>
          );
        })}
        {simulatorPlanIds.length > 0 ? (
          <div
            className={`${styles.pricingPlanMarginDropSlot} ${dropTargetIndex === simulatorPlanIds.length ? styles.pricingPlanMarginDropSlotActive : ""}`}
            aria-hidden="true"
            onDragEnter={() => handleDragEnterSlot(simulatorPlanIds.length)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDropSlot(simulatorPlanIds.length)}
          />
        ) : null}
      </div>
    </section>
  );
}
