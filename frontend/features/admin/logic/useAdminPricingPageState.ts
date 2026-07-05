/**
 * Admin pricing page state.
 * Hydrates the pricing workspace draft, keeps simulator cards stable, and owns draft-only edits.
 */
import React from "react";
import type { PricingConfirmationIntent, PricingWorkspaceState } from "../PricingPageChrome";
import type {
  AdminPricingModelRow,
  AdminPricingPolicySnapshot,
  AdminPricingPreviewVariant,
  AdminPricingStateResponse,
} from "../types";
import {
  buildDefaultPlanEconomicsDraft,
  buildDefaultUsageMixDraftRows,
  buildModelEconomicsRows,
  describeDraftPolicyDiff,
  type PlanEconomicsDraft,
  type UsageMixDraftRow,
} from "../pricingAnalysis";
import {
  formatCredits,
  getCostDocsPosition,
  getModelTypeLabel,
  getProviderPricingDocs,
  type AudioDraftByModelId,
  type AspectDraftByModelId,
  parseIntegerInput,
  parsePercentToBps,
  parsePositiveDecimalInput,
  parseAudioDraft,
  type ResolutionDraftByModelId,
  sortAdminPricingModels,
  type CostDocsPopover,
  type CreditScaleDraftByModelId,
  type DurationDraftByModelId,
  type MarkupDraftByModelId,
  type ModelPricingSortOption,
  type VariantMarkupDraftByVariantKey,
  type ProviderCostDraftByModelId,
  type ProviderCostPerSecondDraftByModelId,
  type VariantProviderCostDraftByVariantKey,
  type VariantProviderCostPerSecondDraftByVariantKey,
} from "../pricingPageUtils";
import { useAdminPricingCatalogState } from "./useAdminPricingCatalogState";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  adminPricingCustomRowsDocumentsEqual,
  compactAdminPricingCustomRowsDocument,
  getDefaultAdminPricingCustomRowsDocument,
  type AdminPricingCustomRowsDocument,
} from "../../../lib/model-runtime/adminPricingCustomRows";
import {
  compactModelPricingPolicyDocument,
  getDefaultModelPricingPolicyDocument,
  modelPricingPolicyDocumentsEqual,
  type ModelPricingPolicyDocument,
} from "../../../lib/model-runtime/pricingPolicy";
import {
  readAdminPricingWorkspaceDraft,
  writeAdminPricingWorkspaceDraft,
} from "./pricingWorkspacePersistence";

const planEconomicsDraftsEqual = (
  left: PlanEconomicsDraft | null | undefined,
  right: PlanEconomicsDraft | null | undefined
) =>
  (left?.simulatedName ?? "") === (right?.simulatedName ?? "") &&
  (left?.priceUsd ?? "") === (right?.priceUsd ?? "") &&
  (left?.includedCredits ?? "") === (right?.includedCredits ?? "") &&
  (left?.discountPct ?? "") === (right?.discountPct ?? "") &&
  (left?.affiliatePct ?? "") === (right?.affiliatePct ?? "") &&
  (left?.processorPct ?? "") === (right?.processorPct ?? "") &&
  (left?.processorFlatUsd ?? "") === (right?.processorFlatUsd ?? "");

const SIMULATOR_PLAN_ID_PREFIX = "sim-plan-";

const isCustomSimulatorPlanId = (planId: string) => planId.startsWith(SIMULATOR_PLAN_ID_PREFIX);

const buildCustomSimulatorPlanName = (sequence: number) => `$49.00/mo Simulation Plan ${sequence}`;

type ModelPolicyApplyResponse = {
  ok?: boolean;
  error?: string;
  message?: string | null;
  status?: string;
  activePolicy?: ModelPricingPolicyDocument | null;
  activeCustomRows?: AdminPricingCustomRowsDocument | null;
  activePolicyVersion?: number | null;
  activePolicyVersionId?: number | null;
};

export function useAdminPricingPageState({
  pricingState,
  pricingLoading,
  pricingError,
  refreshPricingState,
}: {
  pricingState: AdminPricingStateResponse | null;
  pricingLoading: boolean;
  pricingError: string | null;
  refreshPricingState: () => Promise<unknown>;
}) {
  const [durationDrafts, setDurationDrafts] = React.useState<DurationDraftByModelId>({});
  const [aspectDrafts, setAspectDrafts] = React.useState<AspectDraftByModelId>({});
  const [resolutionDrafts, setResolutionDrafts] = React.useState<ResolutionDraftByModelId>({});
  const [audioDrafts, setAudioDrafts] = React.useState<AudioDraftByModelId>({});
  const [creditScaleDrafts, setCreditScaleDrafts] = React.useState<CreditScaleDraftByModelId>({});
  const [markupDrafts, setMarkupDrafts] = React.useState<MarkupDraftByModelId>({});
  const [variantMarkupDrafts, setVariantMarkupDrafts] =
    React.useState<VariantMarkupDraftByVariantKey>({});
  const [providerCostDrafts, setProviderCostDrafts] = React.useState<ProviderCostDraftByModelId>(
    {}
  );
  const [providerCostPerSecondDrafts, setProviderCostPerSecondDrafts] =
    React.useState<ProviderCostPerSecondDraftByModelId>({});
  const [variantProviderCostDrafts, setVariantProviderCostDrafts] =
    React.useState<VariantProviderCostDraftByVariantKey>({});
  const [variantProviderCostPerSecondDrafts, setVariantProviderCostPerSecondDrafts] =
    React.useState<VariantProviderCostPerSecondDraftByVariantKey>({});

  const [modelPolicyDraft, setModelPolicyDraft] = React.useState<ModelPricingPolicyDocument | null>(
    null
  );
  const [customRowsDraft, setCustomRowsDraft] =
    React.useState<AdminPricingCustomRowsDocument | null>(null);
  const [modelPolicyDirty, setModelPolicyDirty] = React.useState(false);
  const [modelPolicySaving, setModelPolicySaving] = React.useState(false);
  const [modelPolicyRollbackLoading, setModelPolicyRollbackLoading] = React.useState(false);
  const [modelPolicyMessage, setModelPolicyMessage] = React.useState<string | null>(null);
  const [modelPolicyError, setModelPolicyError] = React.useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = React.useState("");
  const [modelSortOption, setModelSortOption] = React.useState<ModelPricingSortOption>("type");
  const [globalCreditScaleDraft, setGlobalCreditScaleDraft] = React.useState("");
  const [globalCreditUsdAmountDraft, setGlobalCreditUsdAmountDraft] = React.useState("1");
  const [costDocsPopover, setCostDocsPopover] = React.useState<CostDocsPopover | null>(null);
  const [pendingConfirmation, setPendingConfirmation] =
    React.useState<PricingConfirmationIntent | null>(null);
  const [planEconomicsDrafts, setPlanEconomicsDrafts] = React.useState<
    Record<string, PlanEconomicsDraft>
  >({});
  const [simulatorPlanIds, setSimulatorPlanIds] = React.useState<string[] | null>(null);
  const [selectedUsagePlanId, setSelectedUsagePlanId] = React.useState("");
  const [usageMixRowsByPlanId, setUsageMixRowsByPlanId] = React.useState<
    Record<string, UsageMixDraftRow[]>
  >({});
  const planEconomicsSeedByPlanIdRef = React.useRef<Record<string, PlanEconomicsDraft>>({});
  const [pricingWorkspaceHydrated, setPricingWorkspaceHydrated] = React.useState(false);
  const catalogState = useAdminPricingCatalogState({
    pricingState,
    refreshPricingState,
    setPendingConfirmation,
  });

  const showCostDocsPopover = React.useCallback(
    (
      clientX: number,
      clientY: number,
      model: AdminPricingModelRow,
      variant: AdminPricingPreviewVariant | null
    ) => {
      const position = getCostDocsPosition(clientX, clientY);
      setCostDocsPopover({
        ...getProviderPricingDocs(model, variant),
        ...position,
      });
    },
    []
  );

  const hideCostDocsPopover = React.useCallback(() => {
    setCostDocsPopover(null);
  }, []);

  const modelPolicySnapshot: AdminPricingPolicySnapshot | null = pricingState?.modelPolicy ?? null;
  const activeModelPolicyDocument = React.useMemo(
    () =>
      compactModelPricingPolicyDocument(
        modelPolicySnapshot?.document ?? getDefaultModelPricingPolicyDocument()
      ),
    [modelPolicySnapshot]
  );
  const activeCustomRowsDocument = React.useMemo(
    () =>
      compactAdminPricingCustomRowsDocument(
        pricingState?.customRows ?? getDefaultAdminPricingCustomRowsDocument()
      ),
    [pricingState?.customRows]
  );

  React.useEffect(() => {
    if (!pricingState || pricingWorkspaceHydrated) return;
    const restoredWorkspace = readAdminPricingWorkspaceDraft();
    if (restoredWorkspace) {
      const restoredPolicyDraft = restoredWorkspace.modelPolicyDraft ?? activeModelPolicyDocument;
      const restoredCustomRowsDraft = restoredWorkspace.customRowsDraft ?? activeCustomRowsDocument;
      const nextModelPolicyDraft = compactModelPricingPolicyDocument(restoredPolicyDraft);
      const nextCustomRowsDraft = compactAdminPricingCustomRowsDocument(restoredCustomRowsDraft);
      const nextModelPolicyDirty =
        !modelPricingPolicyDocumentsEqual(nextModelPolicyDraft, activeModelPolicyDocument) ||
        !adminPricingCustomRowsDocumentsEqual(nextCustomRowsDraft, activeCustomRowsDocument);

      setDurationDrafts(restoredWorkspace.durationDrafts);
      setAspectDrafts(restoredWorkspace.aspectDrafts);
      setResolutionDrafts(restoredWorkspace.resolutionDrafts);
      setAudioDrafts(restoredWorkspace.audioDrafts);
      setCreditScaleDrafts(restoredWorkspace.creditScaleDrafts);
      setMarkupDrafts(restoredWorkspace.markupDrafts);
      setVariantMarkupDrafts(restoredWorkspace.variantMarkupDrafts);
      setProviderCostDrafts(restoredWorkspace.providerCostDrafts);
      setProviderCostPerSecondDrafts(restoredWorkspace.providerCostPerSecondDrafts);
      setVariantProviderCostDrafts(restoredWorkspace.variantProviderCostDrafts);
      setVariantProviderCostPerSecondDrafts(restoredWorkspace.variantProviderCostPerSecondDrafts);
      setModelPolicyDraft(nextModelPolicyDraft);
      setCustomRowsDraft(nextCustomRowsDraft);
      setModelPolicyDirty(nextModelPolicyDirty);
      setModelSearchQuery(restoredWorkspace.modelSearchQuery);
      setModelSortOption(restoredWorkspace.modelSortOption);
      setGlobalCreditScaleDraft(restoredWorkspace.globalCreditScaleDraft);
      setGlobalCreditUsdAmountDraft(restoredWorkspace.globalCreditUsdAmountDraft);
      setPlanEconomicsDrafts(restoredWorkspace.planEconomicsDrafts);
      setSimulatorPlanIds(restoredWorkspace.simulatorPlanIds);
      setSelectedUsagePlanId(restoredWorkspace.selectedUsagePlanId);
      setUsageMixRowsByPlanId(restoredWorkspace.usageMixRowsByPlanId);
    }
    setPricingWorkspaceHydrated(true);
  }, [activeCustomRowsDocument, activeModelPolicyDocument, pricingState, pricingWorkspaceHydrated]);

  React.useEffect(() => {
    if (!pricingState || modelPolicyDirty || !pricingWorkspaceHydrated) return;
    setModelPolicyDraft(activeModelPolicyDocument);
    setCustomRowsDraft(activeCustomRowsDocument);
    setCreditScaleDrafts({});
    setMarkupDrafts({});
    setVariantMarkupDrafts({});
    setProviderCostDrafts({});
    setProviderCostPerSecondDrafts({});
    setVariantProviderCostDrafts({});
    setVariantProviderCostPerSecondDrafts({});
  }, [
    activeCustomRowsDocument,
    activeModelPolicyDocument,
    modelPolicyDirty,
    pricingState,
    pricingWorkspaceHydrated,
  ]);

  const effectiveModelPolicyDraft = modelPolicyDraft ?? activeModelPolicyDocument;
  const effectiveCustomRowsDraft = customRowsDraft ?? activeCustomRowsDocument;

  React.useEffect(() => {
    if (modelPolicyDirty) return;
    setGlobalCreditScaleDraft(String(effectiveModelPolicyDraft.global.creditUsdScale));
    setGlobalCreditUsdAmountDraft("1");
  }, [effectiveModelPolicyDraft.global.creditUsdScale, modelPolicyDirty]);

  React.useEffect(() => {
    if (!pricingState || !pricingWorkspaceHydrated) return;
    writeAdminPricingWorkspaceDraft({
      version: 1,
      savedAt: new Date().toISOString(),
      sourceActivePolicyVersion: modelPolicySnapshot?.activePolicyVersion ?? null,
      modelPolicyDirty,
      modelPolicyDraft: effectiveModelPolicyDraft,
      customRowsDraft: effectiveCustomRowsDraft,
      durationDrafts,
      aspectDrafts,
      resolutionDrafts,
      audioDrafts,
      creditScaleDrafts,
      markupDrafts,
      variantMarkupDrafts,
      providerCostDrafts,
      providerCostPerSecondDrafts,
      variantProviderCostDrafts,
      variantProviderCostPerSecondDrafts,
      modelSearchQuery,
      modelSortOption,
      globalCreditScaleDraft,
      globalCreditUsdAmountDraft,
      simulatorPlanIds: simulatorPlanIds ?? [],
      selectedUsagePlanId,
      planEconomicsDrafts,
      usageMixRowsByPlanId,
    });
  }, [
    aspectDrafts,
    audioDrafts,
    creditScaleDrafts,
    durationDrafts,
    effectiveCustomRowsDraft,
    effectiveModelPolicyDraft,
    globalCreditScaleDraft,
    globalCreditUsdAmountDraft,
    markupDrafts,
    modelPolicyDirty,
    modelSearchQuery,
    modelSortOption,
    modelPolicySnapshot?.activePolicyVersion,
    planEconomicsDrafts,
    pricingState,
    pricingWorkspaceHydrated,
    providerCostDrafts,
    providerCostPerSecondDrafts,
    resolutionDrafts,
    simulatorPlanIds,
    selectedUsagePlanId,
    usageMixRowsByPlanId,
    variantMarkupDrafts,
    variantProviderCostDrafts,
    variantProviderCostPerSecondDrafts,
  ]);

  const filteredModels = React.useMemo(() => {
    const models = pricingState?.models ?? [];
    const query = modelSearchQuery.trim().toLowerCase();
    if (!query) return models;
    return models.filter((model) =>
      [
        model.label,
        model.id,
        model.provider,
        getModelTypeLabel(model),
        model.workflowType,
        model.pricingStrategy,
        model.pricingStrategyLabel,
        model.pricingAuthority,
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [modelSearchQuery, pricingState?.models]);
  const displayedModels = React.useMemo(
    () =>
      sortAdminPricingModels({
        models: filteredModels,
        sortOption: modelSortOption,
        pricingPolicy: effectiveModelPolicyDraft,
        durationDrafts,
        aspectDrafts,
        resolutionDrafts,
        audioDrafts,
      }),
    [
      aspectDrafts,
      audioDrafts,
      durationDrafts,
      effectiveModelPolicyDraft,
      filteredModels,
      modelSortOption,
      resolutionDrafts,
    ]
  );

  const modelEconomicsRows = React.useMemo(
    () =>
      buildModelEconomicsRows({
        models: pricingState?.models ?? [],
        pricingPolicy: effectiveModelPolicyDraft,
        customRowsDocument: effectiveCustomRowsDraft,
        durationDrafts,
        aspectDrafts,
        resolutionDrafts,
        audioDrafts,
      }),
    [
      aspectDrafts,
      audioDrafts,
      durationDrafts,
      effectiveCustomRowsDraft,
      effectiveModelPolicyDraft,
      pricingState?.models,
      resolutionDrafts,
    ]
  );

  const buildPlanEconomicsDefaults = React.useCallback(
    () =>
      Object.fromEntries(
        (pricingState?.plans ?? []).map((plan) => [
          plan.planId,
          buildDefaultPlanEconomicsDraft(plan),
        ])
      ) as Record<string, PlanEconomicsDraft>,
    [pricingState?.plans]
  );

  const getDefaultSimulatorCatalogPlans = React.useCallback(() => {
    const plans = [...(pricingState?.plans ?? [])];
    const hasStarter = plans.some((plan) => plan.planId === "starter");
    return hasStarter ? plans.filter((plan) => plan.planId !== "free") : plans;
  }, [pricingState?.plans]);

  const buildLiveSimulatorPlanIds = React.useCallback(
    () =>
      [...getDefaultSimulatorCatalogPlans()]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((plan) => plan.planId),
    [getDefaultSimulatorCatalogPlans]
  );

  const buildUsageMixDefaults = React.useCallback(
    () =>
      Object.fromEntries(
        (pricingState?.plans ?? []).map((plan) => [
          plan.planId,
          buildDefaultUsageMixDraftRows(modelEconomicsRows[0] ?? null),
        ])
      ) as Record<string, UsageMixDraftRow[]>,
    [modelEconomicsRows, pricingState?.plans]
  );

  React.useEffect(() => {
    const plans = pricingState?.plans ?? [];
    const simulatorCatalogPlans = getDefaultSimulatorCatalogPlans();
    if (!plans.length) return;
    const nextDefaultDrafts = buildPlanEconomicsDefaults();
    const previousSeedDrafts = planEconomicsSeedByPlanIdRef.current;
    setPlanEconomicsDrafts((current) => {
      const next: Record<string, PlanEconomicsDraft> = {};
      let changed = false;
      for (const plan of plans) {
        const existingDraft = current[plan.planId];
        const nextDefault = nextDefaultDrafts[plan.planId];
        const previousSeed = previousSeedDrafts[plan.planId];
        const shouldReseed =
          !existingDraft || planEconomicsDraftsEqual(existingDraft, previousSeed);
        next[plan.planId] = shouldReseed ? nextDefault : existingDraft;
        if (shouldReseed && !planEconomicsDraftsEqual(existingDraft, nextDefault)) changed = true;
      }
      for (const [planId, draft] of Object.entries(current)) {
        if (next[planId]) continue;
        if (!isCustomSimulatorPlanId(planId)) {
          changed = true;
          continue;
        }
        next[planId] = draft;
      }
      if (Object.keys(current).some((planId) => !next[planId])) changed = true;
      return changed ? next : current;
    });
    planEconomicsSeedByPlanIdRef.current = nextDefaultDrafts;
    setSimulatorPlanIds((current) => {
      if (current == null) return buildLiveSimulatorPlanIds();
      const availableIds = new Set([
        ...Object.keys(nextDefaultDrafts),
        ...Object.keys(planEconomicsDrafts),
        ...current.filter((planId) => isCustomSimulatorPlanId(planId)),
      ]);
      const filtered = current.filter((planId) => availableIds.has(planId));
      if (filtered.length !== current.length) return filtered;
      return current;
    });
    setSelectedUsagePlanId((current) =>
      current && simulatorCatalogPlans.some((plan) => plan.planId === current)
        ? current
        : (simulatorCatalogPlans[0]?.planId ?? "")
    );
    setUsageMixRowsByPlanId((current) => {
      const next: Record<string, UsageMixDraftRow[]> = {};
      let changed = false;
      for (const plan of plans) {
        const existingRows = current[plan.planId];
        next[plan.planId] =
          existingRows && existingRows.length > 0
            ? existingRows
            : buildDefaultUsageMixDraftRows(modelEconomicsRows[0] ?? null);
        if (!existingRows || existingRows.length === 0) changed = true;
      }
      if (Object.keys(current).some((planId) => !next[planId])) changed = true;
      return changed ? next : current;
    });
  }, [
    buildLiveSimulatorPlanIds,
    buildPlanEconomicsDefaults,
    getDefaultSimulatorCatalogPlans,
    modelEconomicsRows,
    planEconomicsDrafts,
    pricingState?.plans,
  ]);

  const selectedUsagePlan = React.useMemo(
    () => pricingState?.plans.find((plan) => plan.planId === selectedUsagePlanId) ?? null,
    [pricingState?.plans, selectedUsagePlanId]
  );
  const selectedUsageMixRows = React.useMemo(
    () =>
      selectedUsagePlanId
        ? (usageMixRowsByPlanId[selectedUsagePlanId] ??
          buildDefaultUsageMixDraftRows(modelEconomicsRows[0] ?? null))
        : buildDefaultUsageMixDraftRows(modelEconomicsRows[0] ?? null),
    [modelEconomicsRows, selectedUsagePlanId, usageMixRowsByPlanId]
  );

  const updateAspectDraft = React.useCallback((modelId: string, value: string) => {
    setAspectDrafts((current) => {
      if (!value.trim()) {
        const next = { ...current };
        delete next[modelId];
        return next;
      }
      return {
        ...current,
        [modelId]: value,
      };
    });
  }, []);

  const updateResolutionDraft = React.useCallback((modelId: string, value: string) => {
    setResolutionDrafts((current) => {
      if (!value.trim()) {
        const next = { ...current };
        delete next[modelId];
        return next;
      }
      return {
        ...current,
        [modelId]: value,
      };
    });
  }, []);

  const updateAudioDraft = React.useCallback(
    (modelId: string, value: AudioDraftByModelId[string], model: AdminPricingModelRow) => {
      const normalizedValue = value === "default" ? "default" : value;
      setAudioDrafts((current) => {
        const resolvedDefaultAudio = parseAudioDraft(undefined, model);
        if (
          normalizedValue === "default" ||
          (normalizedValue === "on" && resolvedDefaultAudio) ||
          (normalizedValue === "off" && !resolvedDefaultAudio)
        ) {
          const next = { ...current };
          delete next[modelId];
          return next;
        }
        return {
          ...current,
          [modelId]: normalizedValue,
        };
      });
    },
    []
  );

  const updatePlanEconomicsDraft = React.useCallback(
    (planId: string, field: keyof PlanEconomicsDraft, value: string) => {
      setPlanEconomicsDrafts((current) => {
        const fallbackPlan = pricingState?.plans.find((plan) => plan.planId === planId) ?? null;
        const existing = current[planId] ?? buildDefaultPlanEconomicsDraft(fallbackPlan);
        return {
          ...current,
          [planId]: {
            ...existing,
            [field]: value,
          },
        };
      });
    },
    [pricingState?.plans]
  );

  const addSimulatorPlan = React.useCallback(() => {
    const usedSequenceNumbers = [...Object.keys(planEconomicsDrafts), ...(simulatorPlanIds ?? [])]
      .map((planId) =>
        isCustomSimulatorPlanId(planId)
          ? Number(planId.slice(SIMULATOR_PLAN_ID_PREFIX.length))
          : Number.NaN
      )
      .filter((value) => Number.isFinite(value));
    const nextSequence = usedSequenceNumbers.length > 0 ? Math.max(...usedSequenceNumbers) + 1 : 1;
    const nextPlanId = `${SIMULATOR_PLAN_ID_PREFIX}${nextSequence}`;
    setPlanEconomicsDrafts((current) => ({
      ...current,
      [nextPlanId]: {
        ...buildDefaultPlanEconomicsDraft(null),
        simulatedName: buildCustomSimulatorPlanName(nextSequence),
      },
    }));
    setSimulatorPlanIds((current) => [...(current ?? buildLiveSimulatorPlanIds()), nextPlanId]);
  }, [buildLiveSimulatorPlanIds, planEconomicsDrafts, simulatorPlanIds]);

  const removeSimulatorPlan = React.useCallback((planId: string) => {
    setSimulatorPlanIds((current) => {
      if (current == null) return current;
      return current.filter((currentPlanId) => currentPlanId !== planId);
    });
    setPlanEconomicsDrafts((current) => {
      const next = { ...current };
      delete next[planId];
      return next;
    });
  }, []);

  const reorderSimulatorPlans = React.useCallback(
    (fromPlanId: string, targetIndex: number) => {
      setSimulatorPlanIds((current) => {
        const source = current ?? buildLiveSimulatorPlanIds();
        const fromIndex = source.indexOf(fromPlanId);
        if (fromIndex < 0) return source;
        const boundedTargetIndex = Math.max(0, Math.min(targetIndex, source.length));
        if (boundedTargetIndex === fromIndex || boundedTargetIndex === fromIndex + 1) return source;
        const next = [...source];
        const [moved] = next.splice(fromIndex, 1);
        const adjustedTargetIndex =
          boundedTargetIndex > fromIndex ? boundedTargetIndex - 1 : boundedTargetIndex;
        next.splice(adjustedTargetIndex, 0, moved);
        return next;
      });
    },
    [buildLiveSimulatorPlanIds]
  );

  const updateUsageMixRow = React.useCallback(
    (rowId: string, patch: Partial<UsageMixDraftRow>) => {
      if (!selectedUsagePlanId) return;
      setUsageMixRowsByPlanId((current) => {
        const currentRows =
          current[selectedUsagePlanId] ??
          buildDefaultUsageMixDraftRows(modelEconomicsRows[0] ?? null);
        return {
          ...current,
          [selectedUsagePlanId]: currentRows.map((row) =>
            row.id === rowId ? { ...row, ...patch } : row
          ),
        };
      });
    },
    [modelEconomicsRows, selectedUsagePlanId]
  );

  const addUsageMixRow = React.useCallback(() => {
    if (!selectedUsagePlanId) return;
    setUsageMixRowsByPlanId((current) => {
      const currentRows =
        current[selectedUsagePlanId] ??
        buildDefaultUsageMixDraftRows(modelEconomicsRows[0] ?? null);
      return {
        ...current,
        [selectedUsagePlanId]: [
          ...currentRows,
          ...buildDefaultUsageMixDraftRows(modelEconomicsRows[0] ?? null),
        ],
      };
    });
  }, [modelEconomicsRows, selectedUsagePlanId]);

  const removeUsageMixRow = React.useCallback(
    (rowId: string) => {
      if (!selectedUsagePlanId) return;
      setUsageMixRowsByPlanId((current) => {
        const currentRows =
          current[selectedUsagePlanId] ??
          buildDefaultUsageMixDraftRows(modelEconomicsRows[0] ?? null);
        if (currentRows.length <= 1) return current;
        return {
          ...current,
          [selectedUsagePlanId]: currentRows.filter((row) => row.id !== rowId),
        };
      });
    },
    [modelEconomicsRows, selectedUsagePlanId]
  );

  const canApplyModelPolicy = modelPolicyDirty;
  const draftPolicyDiffDescriptions = React.useMemo(() => {
    const diffs = describeDraftPolicyDiff({
      livePolicy: activeModelPolicyDocument,
      draftPolicy: effectiveModelPolicyDraft,
    });
    if (
      modelPolicyDirty &&
      !adminPricingCustomRowsDocumentsEqual(activeCustomRowsDocument, effectiveCustomRowsDraft)
    ) {
      diffs.push("Helper display rows changed.");
    }
    return diffs;
  }, [
    activeCustomRowsDocument,
    activeModelPolicyDocument,
    effectiveCustomRowsDraft,
    effectiveModelPolicyDraft,
    modelPolicyDirty,
  ]);

  const hasInvalidModelPolicyDraft = React.useMemo(() => {
    const parsedGlobalCredits = parseIntegerInput(globalCreditScaleDraft);
    const parsedGlobalUsd = parsePositiveDecimalInput(globalCreditUsdAmountDraft);
    if (parsedGlobalCredits == null || parsedGlobalCredits <= 0 || parsedGlobalUsd == null) {
      return true;
    }

    const hasInvalidCreditScaleDraft = Object.values(creditScaleDrafts).some((value) => {
      if (value.trim() === "") return false;
      const parsed = parseIntegerInput(value);
      return parsed == null || parsed <= 0;
    });
    if (hasInvalidCreditScaleDraft) return true;

    const hasInvalidMarkupDraft = Object.values(markupDrafts).some((value) => {
      if (value.trim() === "") return false;
      const parsed = parsePercentToBps(value);
      return parsed == null || parsed < 0;
    });
    if (hasInvalidMarkupDraft) return true;

    const hasInvalidVariantMarkupDraft = Object.values(variantMarkupDrafts).some((value) => {
      if (value.trim() === "") return false;
      const parsed = parsePercentToBps(value);
      return parsed == null || parsed < 0;
    });
    if (hasInvalidVariantMarkupDraft) return true;

    const hasInvalidProviderCostDraft = Object.values(providerCostDrafts).some((value) => {
      if (value.trim() === "") return false;
      return parsePositiveDecimalInput(value) == null;
    });
    if (hasInvalidProviderCostDraft) return true;

    const hasInvalidProviderCostPerSecondDraft = Object.values(providerCostPerSecondDrafts).some(
      (value) => {
        if (value.trim() === "") return false;
        return parsePositiveDecimalInput(value) == null;
      }
    );
    if (hasInvalidProviderCostPerSecondDraft) return true;

    const hasInvalidVariantProviderCostDraft = Object.values(variantProviderCostDrafts).some(
      (value) => {
        if (value.trim() === "") return false;
        return parsePositiveDecimalInput(value) == null;
      }
    );
    if (hasInvalidVariantProviderCostDraft) return true;

    const hasInvalidVariantProviderCostPerSecondDraft = Object.values(
      variantProviderCostPerSecondDrafts
    ).some((value) => {
      if (value.trim() === "") return false;
      return parsePositiveDecimalInput(value) == null;
    });
    if (hasInvalidVariantProviderCostPerSecondDraft) return true;

    return false;
  }, [
    creditScaleDrafts,
    globalCreditScaleDraft,
    globalCreditUsdAmountDraft,
    markupDrafts,
    providerCostDrafts,
    providerCostPerSecondDrafts,
    variantMarkupDrafts,
    variantProviderCostDrafts,
    variantProviderCostPerSecondDrafts,
  ]);

  const pricingWorkspaceState: PricingWorkspaceState | null = !pricingState
    ? pricingLoading
      ? {
          eyebrow: "Loading pricing state",
          title: "Loading pricing workspace",
          description:
            "Fetching the current model policy, public catalog rows, and Stripe linkage health.",
          helper:
            "The pricing workspace will open once the latest control-plane snapshot and active catalog rows arrive.",
          actionLabel: "Refreshing…",
        }
      : pricingError
        ? {
            eyebrow: "Pricing sync failed",
            title: "Pricing state is unavailable",
            description: pricingError,
            helper:
              "Retry the pricing sync before making policy or catalog edits. We only show this route once there is a trustworthy snapshot to work from.",
            actionLabel: "Retry sync",
          }
        : {
            eyebrow: "No pricing snapshot",
            title: "Pricing state has not loaded yet",
            description: "There is no pricing snapshot available for this admin route right now.",
            helper:
              "Retry the pricing sync to load the current model policy, plan offers, and credit packages.",
            actionLabel: "Load pricing",
          }
    : null;

  const pricingRefreshWarning =
    pricingState && pricingError
      ? `${pricingError} Showing the last loaded pricing snapshot while refresh recovers.`
      : null;

  const updateModelPolicyDraft = React.useCallback(
    (updater: (current: ModelPricingPolicyDocument) => ModelPricingPolicyDocument) => {
      setModelPolicyDraft((current) => {
        const next = updater(current ?? activeModelPolicyDocument);
        const nextDraft = compactModelPricingPolicyDocument(next);
        setModelPolicyDirty(
          !modelPricingPolicyDocumentsEqual(nextDraft, activeModelPolicyDocument) ||
            !adminPricingCustomRowsDocumentsEqual(
              effectiveCustomRowsDraft,
              activeCustomRowsDocument
            )
        );
        return nextDraft;
      });
      setModelPolicyMessage(null);
      setModelPolicyError(null);
    },
    [activeCustomRowsDocument, activeModelPolicyDocument, effectiveCustomRowsDraft]
  );

  const updateCustomRowsDraft = React.useCallback(
    (updater: (current: AdminPricingCustomRowsDocument) => AdminPricingCustomRowsDocument) => {
      setCustomRowsDraft((current) => {
        const next = updater(current ?? activeCustomRowsDocument);
        const nextDraft = compactAdminPricingCustomRowsDocument(next);
        setModelPolicyDirty(
          !modelPricingPolicyDocumentsEqual(effectiveModelPolicyDraft, activeModelPolicyDocument) ||
            !adminPricingCustomRowsDocumentsEqual(nextDraft, activeCustomRowsDocument)
        );
        return nextDraft;
      });
      setModelPolicyMessage(null);
      setModelPolicyError(null);
    },
    [activeCustomRowsDocument, activeModelPolicyDocument, effectiveModelPolicyDraft]
  );

  const updateGlobalConversionDraft = React.useCallback(
    (creditsValue: string, usdValue: string) => {
      const parsedCredits = parseIntegerInput(creditsValue);
      const parsedUsd = parsePositiveDecimalInput(usdValue);
      if (parsedCredits == null || parsedCredits <= 0 || parsedUsd == null) return;
      const parsed = Math.max(1, Math.round(parsedCredits / parsedUsd));
      if (parsed === effectiveModelPolicyDraft.global.creditUsdScale) return;
      updateModelPolicyDraft((current) =>
        compactModelPricingPolicyDocument({
          ...current,
          global: {
            ...current.global,
            creditUsdScale: parsed,
          },
        })
      );
    },
    [effectiveModelPolicyDraft.global.creditUsdScale, updateModelPolicyDraft]
  );

  const updateGlobalCreditScaleDraft = React.useCallback(
    (value: string) => {
      setGlobalCreditScaleDraft(value);
      updateGlobalConversionDraft(value, globalCreditUsdAmountDraft);
    },
    [globalCreditUsdAmountDraft, updateGlobalConversionDraft]
  );

  const updateGlobalCreditUsdAmountDraft = React.useCallback(
    (value: string) => {
      setGlobalCreditUsdAmountDraft(value);
      updateGlobalConversionDraft(globalCreditScaleDraft, value);
    },
    [globalCreditScaleDraft, updateGlobalConversionDraft]
  );

  const resetInvalidGlobalConversionDraft = React.useCallback(() => {
    const parsedCredits = parseIntegerInput(globalCreditScaleDraft);
    const parsedUsd = parsePositiveDecimalInput(globalCreditUsdAmountDraft);
    if (parsedCredits == null || parsedCredits <= 0 || parsedUsd == null) {
      setGlobalCreditScaleDraft(String(effectiveModelPolicyDraft.global.creditUsdScale));
      setGlobalCreditUsdAmountDraft("1");
    }
  }, [
    effectiveModelPolicyDraft.global.creditUsdScale,
    globalCreditScaleDraft,
    globalCreditUsdAmountDraft,
  ]);

  const resetModelPolicyDraft = React.useCallback(() => {
    setModelPolicyDraft(activeModelPolicyDocument);
    setCustomRowsDraft(activeCustomRowsDocument);
    setAspectDrafts({});
    setResolutionDrafts({});
    setAudioDrafts({});
    setCreditScaleDrafts({});
    setMarkupDrafts({});
    setVariantMarkupDrafts({});
    setProviderCostDrafts({});
    setProviderCostPerSecondDrafts({});
    setVariantProviderCostDrafts({});
    setVariantProviderCostPerSecondDrafts({});
    setPlanEconomicsDrafts(buildPlanEconomicsDefaults());
    setSimulatorPlanIds(buildLiveSimulatorPlanIds());
    setUsageMixRowsByPlanId(buildUsageMixDefaults());
    setModelPolicyDirty(false);
    setModelPolicyMessage(null);
    setModelPolicyError(null);
  }, [
    activeCustomRowsDocument,
    activeModelPolicyDocument,
    buildLiveSimulatorPlanIds,
    buildPlanEconomicsDefaults,
    buildUsageMixDefaults,
  ]);

  const applyModelPolicy = React.useCallback(async () => {
    const policy = compactModelPricingPolicyDocument(effectiveModelPolicyDraft);
    const customRows = compactAdminPricingCustomRowsDocument(effectiveCustomRowsDraft);
    setModelPolicySaving(true);
    setModelPolicyError(null);
    setModelPolicyMessage(null);
    try {
      const response = await fetchWithAuth("/api/admin/pricing/model-policy/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy,
          customRows,
          reason: "",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ModelPolicyApplyResponse;
      if (!response.ok) {
        throw new Error(
          payload.error || payload.message || "Failed to apply model pricing policy."
        );
      }
      if (!modelPricingPolicyDocumentsEqual(policy, payload.activePolicy)) {
        throw new Error(
          payload.message ||
            "The pricing policy was not confirmed as the active runtime policy. Refresh and retry."
        );
      }
      if (!adminPricingCustomRowsDocumentsEqual(customRows, payload.activeCustomRows)) {
        throw new Error(
          payload.message ||
            "The custom pricing rows were not confirmed as the active runtime state. Refresh and retry."
        );
      }
      await refreshPricingState();
      setModelPolicyDraft(compactModelPricingPolicyDocument(payload.activePolicy));
      setCustomRowsDraft(compactAdminPricingCustomRowsDocument(payload.activeCustomRows));
      setModelPolicyDirty(false);
      setModelPolicyMessage(
        payload.message ??
          (payload.activePolicyVersion != null
            ? `Model pricing policy v${payload.activePolicyVersion} saved.`
            : "Model pricing policy saved.")
      );
    } catch (error) {
      setModelPolicyError(
        error instanceof Error ? error.message : "Failed to apply model pricing policy."
      );
    } finally {
      setModelPolicySaving(false);
    }
  }, [effectiveCustomRowsDraft, effectiveModelPolicyDraft, refreshPricingState]);

  const rollbackModelPolicy = React.useCallback(async () => {
    setModelPolicyRollbackLoading(true);
    setModelPolicyError(null);
    setModelPolicyMessage(null);
    try {
      const response = await fetchWithAuth("/api/admin/pricing/model-policy/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "" }),
      });
      const payload = (await response.json().catch(() => ({}))) as ModelPolicyApplyResponse;
      if (!response.ok)
        throw new Error(payload.error || "Failed to rollback model pricing policy.");
      await refreshPricingState();
      setModelPolicyDirty(false);
      setModelPolicyMessage(payload.message ?? "Model pricing policy rolled back.");
    } catch (error) {
      setModelPolicyError(
        error instanceof Error ? error.message : "Failed to rollback model pricing policy."
      );
    } finally {
      setModelPolicyRollbackLoading(false);
    }
  }, [refreshPricingState]);

  const confirmPendingPricingAction = React.useCallback(() => {
    const confirmation = pendingConfirmation;
    if (!confirmation) return;
    setPendingConfirmation(null);
    confirmation.onConfirm();
  }, [pendingConfirmation]);

  const cancelPendingPricingAction = React.useCallback(() => {
    setPendingConfirmation(null);
  }, []);

  const openModelPolicyApplyConfirmation = React.useCallback(() => {
    const policy = compactModelPricingPolicyDocument(effectiveModelPolicyDraft);
    setPendingConfirmation({
      title: "Save model pricing changes",
      description:
        "This saves the pending grid edits and activates runtime credit debits for model generations. Review the active policy and proposed draft before saving.",
      confirmLabel: "Save",
      hasInvalidDraft: hasInvalidModelPolicyDraft,
      rows: [
        {
          label: "Active policy version",
          before: modelPolicySnapshot?.activePolicyVersion
            ? `v${modelPolicySnapshot.activePolicyVersion}`
            : "unversioned",
          after: "new active version",
        },
        {
          label: "Credit conversion",
          before: `1 USD = ${formatCredits(activeModelPolicyDocument.global.creditUsdScale)} credits`,
          after: `1 USD = ${formatCredits(policy.global.creditUsdScale)} credits`,
        },
        {
          label: "Default rounding",
          before: formatCredits(activeModelPolicyDocument.global.defaultRoundingIncrement),
          after: formatCredits(policy.global.defaultRoundingIncrement),
        },
        {
          label: "Model overrides",
          before: formatCredits(Object.keys(activeModelPolicyDocument.perModel).length),
          after: formatCredits(Object.keys(policy.perModel).length),
        },
        {
          label: "Custom rows",
          before: formatCredits(
            Object.values(activeCustomRowsDocument.rowsByModel).reduce(
              (sum, rows) => sum + rows.length,
              0
            )
          ),
          after: formatCredits(
            Object.values(effectiveCustomRowsDraft.rowsByModel).reduce(
              (sum, rows) => sum + rows.length,
              0
            )
          ),
        },
      ],
      onConfirm: () => void applyModelPolicy(),
    });
  }, [
    activeCustomRowsDocument,
    activeModelPolicyDocument,
    applyModelPolicy,
    effectiveCustomRowsDraft,
    effectiveModelPolicyDraft,
    hasInvalidModelPolicyDraft,
    modelPolicySnapshot,
  ]);

  const openModelPolicyRollbackConfirmation = React.useCallback(() => {
    setPendingConfirmation({
      title: "Rollback active pricing policy",
      description:
        "This changes runtime credit debits back to the previous active policy selected by the rollback API.",
      confirmLabel: "Rollback policy",
      hasInvalidDraft: false,
      rows: [
        {
          label: "Current active version",
          before: modelPolicySnapshot?.activePolicyVersion
            ? `v${modelPolicySnapshot.activePolicyVersion}`
            : "unversioned",
          after: "previous active version",
        },
        {
          label: "Current credit conversion",
          before: `1 USD = ${formatCredits(activeModelPolicyDocument.global.creditUsdScale)} credits`,
          after: "from previous active policy",
        },
      ],
      onConfirm: () => void rollbackModelPolicy(),
    });
  }, [activeModelPolicyDocument, modelPolicySnapshot, rollbackModelPolicy]);

  return {
    ...catalogState,
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
    variantMarkupDrafts,
    setVariantMarkupDrafts,
    providerCostDrafts,
    setProviderCostDrafts,
    providerCostPerSecondDrafts,
    setProviderCostPerSecondDrafts,
    variantProviderCostDrafts,
    setVariantProviderCostDrafts,
    variantProviderCostPerSecondDrafts,
    setVariantProviderCostPerSecondDrafts,
    effectiveModelPolicyDraft,
    displayedModels,
    canApplyModelPolicy,
    modelPolicySaving,
    modelPolicyRollbackLoading,
    modelPolicyMessage,
    modelPolicyError,
    modelSortOption,
    setModelSortOption,
    modelSearchQuery,
    setModelSearchQuery,
    globalCreditScaleDraft,
    updateGlobalCreditScaleDraft,
    globalCreditUsdAmountDraft,
    updateGlobalCreditUsdAmountDraft,
    resetInvalidGlobalConversionDraft,
    pricingWorkspaceState,
    pricingRefreshWarning,
    costDocsPopover,
    pendingConfirmation,
    showCostDocsPopover,
    hideCostDocsPopover,
    updateModelPolicyDraft,
    updateCustomRowsDraft,
    openModelPolicyApplyConfirmation,
    openModelPolicyRollbackConfirmation,
    resetModelPolicyDraft,
    confirmPendingPricingAction,
    cancelPendingPricingAction,
    hasInvalidModelPolicyDraft,
    activeModelPolicyDocument,
    activeCustomRowsDocument,
    modelPolicySnapshot,
    effectiveCustomRowsDraft,
    modelEconomicsRows,
    draftPolicyDiffDescriptions,
    planEconomicsDrafts,
    simulatorPlanIds: simulatorPlanIds ?? buildLiveSimulatorPlanIds(),
    updatePlanEconomicsDraft,
    addSimulatorPlan,
    removeSimulatorPlan,
    reorderSimulatorPlans,
    selectedUsagePlanId,
    setSelectedUsagePlanId,
    selectedUsagePlan,
    usageMixRows: selectedUsageMixRows,
    updateUsageMixRow,
    addUsageMixRow,
    removeUsageMixRow,
  };
}
