import React from "react";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import {
  PricingConfirmationDialog,
  PricingCostDocsPopover,
  PricingHealthSection,
  PricingViewTabs,
  PricingWorkspaceNotice,
  type PricingConfirmationIntent,
} from "../../features/admin/PricingPageChrome";
import { PricingCatalogSections } from "../../features/admin/PricingCatalogSections";
import { PricingModelWorkbook } from "../../features/admin/PricingModelWorkbook";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useAdminPricingController } from "../../features/admin/logic/useAdminPricingController";
import {
  buildCreditPackageConfirmationIntent,
  buildPlanCreateConfirmationIntent,
  buildPlanOfferConfirmationIntent,
  buildStorageOfferConfirmationIntent,
} from "../../features/admin/pricingConfirmationIntents";
import type {
  AdminPricingModelRow,
  AdminPricingPolicySnapshot,
  AdminPricingPreviewVariant,
} from "../../features/admin/types";
import {
  PRICING_VIEW_TABS,
  formatCredits,
  getCostDocsPosition,
  getModelTypeLabel,
  getProviderPricingDocs,
  parseIntegerInput,
  parsePercentToBps,
  parsePositiveDecimalInput,
  sortAdminPricingModels,
  type CostDocsPopover,
  type CreditScaleDraftByModelId,
  type CreditPackageDraft,
  type DurationDraftByModelId,
  type MarkupDraftByModelId,
  type ModelPricingSortOption,
  type PlanCreateDraft,
  type PlanOfferDraft,
  type PricingView,
  type RoundingDraftByModelId,
  type StorageOfferDraft,
} from "../../features/admin/pricingPageUtils";
import { fetchWithAuth } from "../../lib/authenticatedFetch";
import { useProtectedRoute } from "../../lib/authGuard";
import {
  compactModelPricingPolicyDocument,
  getDefaultModelPricingPolicyDocument,
  modelPricingPolicyDocumentsEqual,
  type ModelPricingPolicyDocument,
} from "../../lib/model-runtime/pricingPolicy";
import styles from "../../styles/admin.module.css";

type ModelPolicyApplyResponse = {
  ok?: boolean;
  error?: string;
  message?: string | null;
  status?: string;
  activePolicy?: ModelPricingPolicyDocument | null;
  activePolicyVersion?: number | null;
  activePolicyVersionId?: number | null;
};

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

  const [creditDraft, setCreditDraft] = React.useState<CreditPackageDraft | null>(null);
  const [creditSaving, setCreditSaving] = React.useState(false);
  const [creditMessage, setCreditMessage] = React.useState<string | null>(null);
  const [creditError, setCreditError] = React.useState<string | null>(null);

  const [planDraft, setPlanDraft] = React.useState<PlanCreateDraft | null>(null);
  const [planOfferDraft, setPlanOfferDraft] = React.useState<PlanOfferDraft | null>(null);
  const [planSaving, setPlanSaving] = React.useState(false);
  const [planMessage, setPlanMessage] = React.useState<string | null>(null);
  const [planError, setPlanError] = React.useState<string | null>(null);

  const [storageDraft, setStorageDraft] = React.useState<StorageOfferDraft | null>(null);
  const [storageSaving, setStorageSaving] = React.useState(false);
  const [storageMessage, setStorageMessage] = React.useState<string | null>(null);
  const [storageError, setStorageError] = React.useState<string | null>(null);

  const [durationDrafts, setDurationDrafts] = React.useState<DurationDraftByModelId>({});
  const [creditScaleDrafts, setCreditScaleDrafts] = React.useState<CreditScaleDraftByModelId>({});
  const [markupDrafts, setMarkupDrafts] = React.useState<MarkupDraftByModelId>({});
  const [roundingDrafts, setRoundingDrafts] = React.useState<RoundingDraftByModelId>({});

  const [modelPolicyDraft, setModelPolicyDraft] = React.useState<ModelPricingPolicyDocument | null>(
    null
  );
  const [modelPolicyDirty, setModelPolicyDirty] = React.useState(false);
  const [modelPolicySaving, setModelPolicySaving] = React.useState(false);
  const [modelPolicyRollbackLoading, setModelPolicyRollbackLoading] = React.useState(false);
  const [modelPolicyMessage, setModelPolicyMessage] = React.useState<string | null>(null);
  const [modelPolicyError, setModelPolicyError] = React.useState<string | null>(null);
  const [modelPolicyNote, setModelPolicyNote] = React.useState("");
  const [selectedModelOverrideId, setSelectedModelOverrideId] = React.useState<string | null>(null);
  const [selectedPricingView, setSelectedPricingView] = React.useState<PricingView>("all");
  const [modelSearchQuery, setModelSearchQuery] = React.useState("");
  const [modelSortOption, setModelSortOption] = React.useState<ModelPricingSortOption>("type");
  const [globalCreditScaleDraft, setGlobalCreditScaleDraft] = React.useState("");
  const [globalCreditUsdAmountDraft, setGlobalCreditUsdAmountDraft] = React.useState("1");
  const [costDocsPopover, setCostDocsPopover] = React.useState<CostDocsPopover | null>(null);
  const [pendingConfirmation, setPendingConfirmation] =
    React.useState<PricingConfirmationIntent | null>(null);

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

  React.useEffect(() => {
    if (!pricingState || modelPolicyDirty) return;
    setModelPolicyDraft(activeModelPolicyDocument);
    setCreditScaleDrafts({});
    setMarkupDrafts({});
    setRoundingDrafts({});
  }, [activeModelPolicyDocument, modelPolicyDirty, pricingState]);

  const effectiveModelPolicyDraft = modelPolicyDraft ?? activeModelPolicyDocument;

  React.useEffect(() => {
    if (modelPolicyDirty) return;
    setGlobalCreditScaleDraft(String(effectiveModelPolicyDraft.global.creditUsdScale));
    setGlobalCreditUsdAmountDraft("1");
  }, [effectiveModelPolicyDraft.global.creditUsdScale, modelPolicyDirty]);

  const selectedModelRow = React.useMemo(
    () => pricingState?.models.find((model) => model.id === selectedModelOverrideId) ?? null,
    [pricingState?.models, selectedModelOverrideId]
  );
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
      }),
    [durationDrafts, effectiveModelPolicyDraft, filteredModels, modelSortOption]
  );

  const showModelsSection = selectedPricingView === "all" || selectedPricingView === "models";
  const showPlansSection = selectedPricingView === "all" || selectedPricingView === "plans";
  const showCreditsSection = selectedPricingView === "all" || selectedPricingView === "credits";
  const showMediaAddonsSection =
    selectedPricingView === "all" || selectedPricingView === "media-addons";
  const canApplyModelPolicy = modelPolicyDirty;
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

    return Object.values(roundingDrafts).some((value) => {
      if (value.trim() === "") return false;
      const parsed = parseIntegerInput(value);
      return parsed == null || parsed <= 0;
    });
  }, [
    creditScaleDrafts,
    globalCreditScaleDraft,
    globalCreditUsdAmountDraft,
    markupDrafts,
    roundingDrafts,
  ]);
  const pricingWorkspaceState = !pricingState
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
        return compactModelPricingPolicyDocument(next);
      });
      setModelPolicyDirty(true);
      setModelPolicyMessage(null);
      setModelPolicyError(null);
    },
    [activeModelPolicyDocument]
  );

  const updateGlobalConversionDraft = React.useCallback(
    (creditsValue: string, usdValue: string) => {
      const parsedCredits = parseIntegerInput(creditsValue);
      const parsedUsd = parsePositiveDecimalInput(usdValue);
      if (parsedCredits == null || parsedCredits <= 0 || parsedUsd == null) {
        return;
      }
      const parsed = Math.max(1, Math.round(parsedCredits / parsedUsd));
      if (parsed === effectiveModelPolicyDraft.global.creditUsdScale) {
        return;
      }
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
    setCreditScaleDrafts({});
    setMarkupDrafts({});
    setRoundingDrafts({});
    setModelPolicyDirty(false);
    setModelPolicyMessage(null);
    setModelPolicyError(null);
    setModelPolicyNote("");
  }, [activeModelPolicyDocument]);

  const saveCreditPackage = React.useCallback(async () => {
    if (!creditDraft) return;
    setCreditSaving(true);
    setCreditError(null);
    setCreditMessage(null);
    try {
      const response = await fetchWithAuth("/api/admin/pricing/credit-packages/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creditDraft),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update the credit package.");
      }
      await refreshPricingState();
      setCreditMessage(payload.message ?? "Credit package updated.");
      setCreditDraft(null);
    } catch (error) {
      setCreditError(
        error instanceof Error ? error.message : "Failed to update the credit package."
      );
    } finally {
      setCreditSaving(false);
    }
  }, [creditDraft, refreshPricingState]);

  const createPlan = React.useCallback(async () => {
    if (!planDraft) return;
    setPlanSaving(true);
    setPlanError(null);
    setPlanMessage(null);
    try {
      const response = await fetchWithAuth("/api/admin/pricing/plans/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planDraft),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create the plan.");
      }
      await refreshPricingState();
      setPlanMessage(payload.message ?? "Plan created and activated.");
      setPlanDraft(null);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Failed to create the plan.");
    } finally {
      setPlanSaving(false);
    }
  }, [planDraft, refreshPricingState]);

  const savePlanOffer = React.useCallback(async () => {
    if (!planOfferDraft) return;
    setPlanSaving(true);
    setPlanError(null);
    setPlanMessage(null);
    try {
      const response = await fetchWithAuth("/api/admin/pricing/plan-offers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planOfferDraft),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save the plan pricing.");
      }
      await refreshPricingState();
      setPlanMessage(payload.message ?? "Plan pricing saved as the current public offer.");
      setPlanOfferDraft(null);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Failed to save the plan pricing.");
    } finally {
      setPlanSaving(false);
    }
  }, [planOfferDraft, refreshPricingState]);

  const createStorageOffer = React.useCallback(async () => {
    if (!storageDraft) return;
    setStorageSaving(true);
    setStorageError(null);
    setStorageMessage(null);
    try {
      const response = await fetchWithAuth("/api/admin/pricing/storage-offers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storageDraft),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create the next storage add-on offer.");
      }
      await refreshPricingState();
      setStorageMessage(payload.message ?? "Storage add-on offer created and activated.");
      setStorageDraft(null);
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Failed to create the next storage add-on offer."
      );
    } finally {
      setStorageSaving(false);
    }
  }, [refreshPricingState, storageDraft]);

  const applyModelPolicy = React.useCallback(async () => {
    const policy = compactModelPricingPolicyDocument(effectiveModelPolicyDraft);
    setModelPolicySaving(true);
    setModelPolicyError(null);
    setModelPolicyMessage(null);

    try {
      const response = await fetchWithAuth("/api/admin/pricing/model-policy/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy,
          note: modelPolicyNote,
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

      await refreshPricingState();
      setModelPolicyDraft(compactModelPricingPolicyDocument(payload.activePolicy));
      setModelPolicyDirty(false);
      setModelPolicyNote("");
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
  }, [effectiveModelPolicyDraft, modelPolicyNote, refreshPricingState]);

  const rollbackModelPolicy = React.useCallback(async () => {
    setModelPolicyRollbackLoading(true);
    setModelPolicyError(null);
    setModelPolicyMessage(null);

    try {
      const response = await fetchWithAuth("/api/admin/pricing/model-policy/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ModelPolicyApplyResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Failed to rollback model pricing policy.");
      }

      await refreshPricingState();
      setModelPolicyDirty(false);
      setModelPolicyNote("");
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
      ],
      onConfirm: () => void applyModelPolicy(),
    });
  }, [
    activeModelPolicyDocument,
    applyModelPolicy,
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

  const openPlanOfferConfirmation = React.useCallback(() => {
    if (!planOfferDraft) return;
    const plan = pricingState?.plans.find((row) => row.planId === planOfferDraft.planId);
    setPendingConfirmation(
      buildPlanOfferConfirmationIntent({
        planOfferDraft,
        plan,
        onConfirm: () => void savePlanOffer(),
      })
    );
  }, [planOfferDraft, pricingState?.plans, savePlanOffer]);

  const openPlanCreateConfirmation = React.useCallback(() => {
    if (!planDraft) return;
    setPendingConfirmation(
      buildPlanCreateConfirmationIntent({
        planDraft,
        onConfirm: () => void createPlan(),
      })
    );
  }, [createPlan, planDraft]);

  const openCreditPackageConfirmation = React.useCallback(() => {
    if (!creditDraft) return;
    const currentPackage = pricingState?.creditPackages.find((row) => row.id === creditDraft.id);
    setPendingConfirmation(
      buildCreditPackageConfirmationIntent({
        creditDraft,
        currentPackage,
        onConfirm: () => void saveCreditPackage(),
      })
    );
  }, [creditDraft, pricingState?.creditPackages, saveCreditPackage]);

  const openStorageOfferConfirmation = React.useCallback(() => {
    if (!storageDraft) return;
    const currentOffer = pricingState?.storageAddons.find(
      (row) => row.storageAddonId === storageDraft.storageAddonId
    );
    setPendingConfirmation(
      buildStorageOfferConfirmationIntent({
        storageDraft,
        currentOffer,
        onConfirm: () => void createStorageOffer(),
      })
    );
  }, [createStorageOffer, pricingState?.storageAddons, storageDraft]);

  return (
    <AdminRouteShell
      loading={loading}
      isAdminEnabled={adminEnabled}
      isAdminAccessLoading={isAdminAccessLoading}
      adminAccessStatus={adminAccessStatus}
      adminAccessError={adminAccessError}
      onRetryAccessCheck={refreshAdminAccess}
      documentTitle="ShortPulse · Admin Pricing"
      metaDescription="Admin pricing command center for model runtime policy and public billing catalog state."
      pageTitle="Pricing"
      pageDescription="Manage public billing catalog pricing, inspect current model credit policy, and watch Stripe linkage health from one admin workspace."
      userEmail={user?.email}
      currentPath="/admin/pricing"
    >
      {pricingWorkspaceState ? (
        <PricingWorkspaceNotice
          workspaceState={pricingWorkspaceState}
          pricingLoading={pricingLoading}
          pricingRefreshing={pricingRefreshing}
          onRefresh={() => void refreshPricingState()}
        />
      ) : (
        <>
          {pricingRefreshWarning ? (
            <p className={styles.announcementError}>{pricingRefreshWarning}</p>
          ) : null}

          <PricingViewTabs
            tabs={PRICING_VIEW_TABS}
            selectedPricingView={selectedPricingView}
            onSelect={setSelectedPricingView}
          />

          <PricingHealthSection health={pricingState?.health} />

          <PricingModelWorkbook
            pricingState={pricingState}
            showModelsSection={showModelsSection}
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
            setModelSortOption={setModelSortOption}
            modelSearchQuery={modelSearchQuery}
            setModelSearchQuery={setModelSearchQuery}
            globalCreditScaleDraft={globalCreditScaleDraft}
            updateGlobalCreditScaleDraft={updateGlobalCreditScaleDraft}
            globalCreditUsdAmountDraft={globalCreditUsdAmountDraft}
            updateGlobalCreditUsdAmountDraft={updateGlobalCreditUsdAmountDraft}
            resetInvalidGlobalConversionDraft={resetInvalidGlobalConversionDraft}
            modelPolicyMessage={modelPolicyMessage}
            modelPolicyError={modelPolicyError}
            modelPolicySaving={modelPolicySaving}
            modelPolicyRollbackLoading={modelPolicyRollbackLoading}
            canApplyModelPolicy={canApplyModelPolicy}
            openModelPolicyApplyConfirmation={openModelPolicyApplyConfirmation}
            openModelPolicyRollbackConfirmation={openModelPolicyRollbackConfirmation}
            resetModelPolicyDraft={resetModelPolicyDraft}
            showCostDocsPopover={showCostDocsPopover}
            hideCostDocsPopover={hideCostDocsPopover}
            setSelectedModelOverrideId={setSelectedModelOverrideId}
            updateModelPolicyDraft={updateModelPolicyDraft}
            modelPolicyNote={modelPolicyNote}
            setModelPolicyNote={setModelPolicyNote}
          />

          <PricingCatalogSections
            pricingState={pricingState}
            showPlansSection={showPlansSection}
            showCreditsSection={showCreditsSection}
            showMediaAddonsSection={showMediaAddonsSection}
            planDraft={planDraft}
            setPlanDraft={setPlanDraft}
            planOfferDraft={planOfferDraft}
            setPlanOfferDraft={setPlanOfferDraft}
            planSaving={planSaving}
            planMessage={planMessage}
            planError={planError}
            setPlanMessage={setPlanMessage}
            setPlanError={setPlanError}
            onConfirmPlanCreate={openPlanCreateConfirmation}
            onConfirmPlanOffer={openPlanOfferConfirmation}
            creditDraft={creditDraft}
            setCreditDraft={setCreditDraft}
            creditSaving={creditSaving}
            creditMessage={creditMessage}
            creditError={creditError}
            setCreditMessage={setCreditMessage}
            setCreditError={setCreditError}
            onConfirmCreditPackage={openCreditPackageConfirmation}
            storageDraft={storageDraft}
            setStorageDraft={setStorageDraft}
            storageSaving={storageSaving}
            storageMessage={storageMessage}
            storageError={storageError}
            setStorageMessage={setStorageMessage}
            setStorageError={setStorageError}
            onConfirmStorageOffer={openStorageOfferConfirmation}
          />
          <PricingCostDocsPopover popover={costDocsPopover} />
          <PricingConfirmationDialog
            pendingConfirmation={pendingConfirmation}
            onCancel={cancelPendingPricingAction}
            onConfirm={confirmPendingPricingAction}
            confirmDisabled={
              Boolean(pendingConfirmation?.hasInvalidDraft) ||
              modelPolicySaving ||
              modelPolicyRollbackLoading ||
              planSaving ||
              creditSaving ||
              storageSaving
            }
            cancelDisabled={
              modelPolicySaving ||
              modelPolicyRollbackLoading ||
              planSaving ||
              creditSaving ||
              storageSaving
            }
          />
        </>
      )}
    </AdminRouteShell>
  );
}
