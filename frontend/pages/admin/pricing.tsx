/**
 * Admin pricing route.
 * Pricing command center for model policy control and public billing catalog management.
 */
import React from "react";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useAdminPricingController } from "../../features/admin/logic/useAdminPricingController";
import type {
  AdminPricingCreditPackageRow,
  AdminPricingPolicySnapshot,
  AdminPricingStorageAddonRow,
} from "../../features/admin/types";
import { fetchWithAuth } from "../../lib/authenticatedFetch";
import { useProtectedRoute } from "../../lib/authGuard";
import { formatStorageBytes } from "../../features/billing/storage";
import {
  compactModelPricingPolicyDocument,
  getDefaultModelPricingPolicyDocument,
  type ModelPricingPolicyDocument,
} from "../../lib/model-runtime/pricingPolicy";
import styles from "../../styles/admin.module.css";

const formatUsd = (value: number): string => `$${value.toFixed(2)}`;
const formatCurrencyFromCents = (value: number): string => formatUsd(value / 100);
const formatCredits = (value: number): string => new Intl.NumberFormat("en-US").format(value);
const formatDateTime = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : "—";
const getProviderLabelClassName = (provider: string): string => {
  const normalized = provider.trim().toLowerCase();
  if (normalized === "fal") return styles.pricingProviderFal;
  if (normalized === "kie") return styles.pricingProviderKie;
  return "";
};

const getPlanStatusClassName = (status: "active" | "legacy" | "inactive"): string => {
  if (status === "active") return styles.pillOk;
  if (status === "legacy") return styles.pillWarn;
  return styles.pillCritical;
};

type CreditPackageDraft = {
  id: string;
  displayName: string;
  creditAmountCents: string;
  priceCents: string;
  stripePriceId: string;
  sortOrder: string;
  isActive: boolean;
};

type PlanCreateDraft = {
  planId: string;
  displayName: string;
  recurringPriceCents: string;
  monthlyCreditsCents: string;
  storageLimitBytes: string;
  sortOrder: string;
};

type StorageOfferDraft = {
  storageAddonId: string;
  offerName: string;
  storageLimitBytes: string;
  recurringPriceCents: string;
  stripePriceId: string;
};

type ModelPolicyApplyResponse = {
  ok?: boolean;
  error?: string;
  message?: string | null;
  status?: string;
};

type PricingView = "all" | "models" | "plans" | "credits" | "media-addons";
type GlobalPricingEditor = "credit-conversion" | "markup" | "roundup" | null;

const PRICING_VIEW_TABS: Array<{ id: PricingView; label: string }> = [
  { id: "all", label: "All" },
  { id: "models", label: "Models" },
  { id: "plans", label: "Plans" },
  { id: "credits", label: "Credits" },
  { id: "media-addons", label: "Media add-ons" },
];

const buildCreditPackageDraft = (row: AdminPricingCreditPackageRow): CreditPackageDraft => ({
  id: row.id,
  displayName: row.displayName,
  creditAmountCents: String(row.creditAmountCents),
  priceCents: String(row.priceCents),
  stripePriceId: row.stripePriceId ?? "",
  sortOrder: String(row.sortOrder),
  isActive: row.isActive,
});

const buildEmptyPlanCreateDraft = (sortOrder: number): PlanCreateDraft => ({
  planId: "",
  displayName: "",
  recurringPriceCents: "",
  monthlyCreditsCents: "",
  storageLimitBytes: "",
  sortOrder: String(sortOrder),
});

const buildStorageOfferDraft = (row: AdminPricingStorageAddonRow): StorageOfferDraft => ({
  storageAddonId: row.storageAddonId,
  offerName: `${row.displayName} Admin Offer`,
  storageLimitBytes: String(row.storageLimitBytes),
  recurringPriceCents: String(row.recurringPriceCents),
  stripePriceId: row.stripePriceId ?? "",
});

const parseIntegerInput = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const parsePercentToBps = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
};

const normalizeModelOverrideDraft = (
  policy: ModelPricingPolicyDocument,
  modelId: string,
  nextOverride: {
    creditUsdScale?: number | null;
    markupBps?: number | null;
    roundingIncrement?: number | null;
  }
): ModelPricingPolicyDocument => {
  const currentOverride = policy.perModel[modelId] ?? {};
  const mergedOverride = {
    creditUsdScale:
      nextOverride.creditUsdScale !== undefined
        ? nextOverride.creditUsdScale
        : currentOverride.creditUsdScale,
    markupBps:
      nextOverride.markupBps !== undefined ? nextOverride.markupBps : currentOverride.markupBps,
    roundingIncrement:
      nextOverride.roundingIncrement !== undefined
        ? nextOverride.roundingIncrement
        : currentOverride.roundingIncrement,
  };

  const nextPerModel = { ...policy.perModel };
  const hasCustomCreditUsdScale =
    typeof mergedOverride.creditUsdScale === "number" &&
    mergedOverride.creditUsdScale > 0 &&
    mergedOverride.creditUsdScale !== policy.global.creditUsdScale;
  const hasCustomMarkup =
    typeof mergedOverride.markupBps === "number" &&
    mergedOverride.markupBps !== policy.global.markupBps;
  const hasCustomRoundingIncrement =
    typeof mergedOverride.roundingIncrement === "number" &&
    mergedOverride.roundingIncrement > 0 &&
    mergedOverride.roundingIncrement !== policy.global.defaultRoundingIncrement;

  if (!hasCustomCreditUsdScale && !hasCustomMarkup && !hasCustomRoundingIncrement) {
    delete nextPerModel[modelId];
  } else {
    const nextOverride = {} as NonNullable<(typeof nextPerModel)[string]>;
    if (hasCustomCreditUsdScale && typeof mergedOverride.creditUsdScale === "number") {
      nextOverride.creditUsdScale = mergedOverride.creditUsdScale;
    }
    if (hasCustomMarkup && typeof mergedOverride.markupBps === "number") {
      nextOverride.markupBps = mergedOverride.markupBps;
    }
    if (hasCustomRoundingIncrement && typeof mergedOverride.roundingIncrement === "number") {
      nextOverride.roundingIncrement = mergedOverride.roundingIncrement;
    }
    nextPerModel[modelId] = nextOverride;
  }

  return compactModelPricingPolicyDocument({
    ...policy,
    perModel: nextPerModel,
  });
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
  const [planSaving, setPlanSaving] = React.useState(false);
  const [planMessage, setPlanMessage] = React.useState<string | null>(null);
  const [planError, setPlanError] = React.useState<string | null>(null);

  const [storageDraft, setStorageDraft] = React.useState<StorageOfferDraft | null>(null);
  const [storageSaving, setStorageSaving] = React.useState(false);
  const [storageMessage, setStorageMessage] = React.useState<string | null>(null);
  const [storageError, setStorageError] = React.useState<string | null>(null);

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
  const [globalCreditConversionInput, setGlobalCreditConversionInput] = React.useState("");
  const [globalMarkupInput, setGlobalMarkupInput] = React.useState("");
  const [globalRoundupInput, setGlobalRoundupInput] = React.useState("");
  const [selectedPricingView, setSelectedPricingView] = React.useState<PricingView>("all");
  const [modelSearchQuery, setModelSearchQuery] = React.useState("");
  const [activeGlobalEditor, setActiveGlobalEditor] = React.useState<GlobalPricingEditor>(null);
  const globalCreditConversionInputRef = React.useRef<HTMLInputElement | null>(null);
  const globalMarkupInputRef = React.useRef<HTMLInputElement | null>(null);
  const globalRoundupInputRef = React.useRef<HTMLInputElement | null>(null);

  const health = pricingState?.health;
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
  }, [activeModelPolicyDocument, modelPolicyDirty, pricingState]);

  const effectiveModelPolicyDraft = modelPolicyDraft ?? activeModelPolicyDocument;

  React.useEffect(() => {
    setGlobalCreditConversionInput(String(effectiveModelPolicyDraft.global.creditUsdScale));
    setGlobalMarkupInput(String(effectiveModelPolicyDraft.global.markupBps / 100));
    setGlobalRoundupInput(String(effectiveModelPolicyDraft.global.defaultRoundingIncrement));
  }, [
    effectiveModelPolicyDraft.global.creditUsdScale,
    effectiveModelPolicyDraft.global.defaultRoundingIncrement,
    effectiveModelPolicyDraft.global.markupBps,
  ]);

  React.useEffect(() => {
    const target =
      activeGlobalEditor === "credit-conversion"
        ? globalCreditConversionInputRef.current
        : activeGlobalEditor === "markup"
          ? globalMarkupInputRef.current
          : activeGlobalEditor === "roundup"
            ? globalRoundupInputRef.current
            : null;

    if (!target) return;
    target.focus();
    const cursorPosition = target.value.length;
    target.setSelectionRange(cursorPosition, cursorPosition);
  }, [activeGlobalEditor]);

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
        model.workflowType,
        model.pricingStrategy,
        model.pricingStrategyLabel,
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [modelSearchQuery, pricingState?.models]);

  const showModelsSection = selectedPricingView === "all" || selectedPricingView === "models";
  const showPlansSection = selectedPricingView === "all" || selectedPricingView === "plans";
  const showCreditsSection = selectedPricingView === "all" || selectedPricingView === "credits";
  const showMediaAddonsSection =
    selectedPricingView === "all" || selectedPricingView === "media-addons";
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

  const resetModelPolicyDraft = React.useCallback(() => {
    setModelPolicyDraft(activeModelPolicyDocument);
    setModelPolicyDirty(false);
    setModelPolicyMessage(null);
    setModelPolicyError(null);
    setModelPolicyNote("");
  }, [activeModelPolicyDocument]);

  const commitGlobalCreditConversionInput = React.useCallback(() => {
    const nextValue = parseIntegerInput(globalCreditConversionInput);
    if (nextValue == null || nextValue <= 0) {
      setGlobalCreditConversionInput(String(effectiveModelPolicyDraft.global.creditUsdScale));
      return false;
    }
    updateModelPolicyDraft((current) => ({
      ...current,
      global: {
        ...current.global,
        creditUsdScale: nextValue,
      },
    }));
    setGlobalCreditConversionInput(String(nextValue));
    return true;
  }, [
    effectiveModelPolicyDraft.global.creditUsdScale,
    globalCreditConversionInput,
    updateModelPolicyDraft,
  ]);

  const commitGlobalMarkupInput = React.useCallback(() => {
    const nextValue = parsePercentToBps(globalMarkupInput);
    if (nextValue == null || nextValue < 0) {
      setGlobalMarkupInput(String(effectiveModelPolicyDraft.global.markupBps / 100));
      return false;
    }
    updateModelPolicyDraft((current) => ({
      ...current,
      global: {
        ...current.global,
        markupBps: nextValue,
      },
    }));
    setGlobalMarkupInput(String(nextValue / 100));
    return true;
  }, [effectiveModelPolicyDraft.global.markupBps, globalMarkupInput, updateModelPolicyDraft]);

  const commitGlobalRoundupInput = React.useCallback(() => {
    const nextValue = parseIntegerInput(globalRoundupInput);
    if (nextValue == null || nextValue <= 0) {
      setGlobalRoundupInput(String(effectiveModelPolicyDraft.global.defaultRoundingIncrement));
      return false;
    }
    updateModelPolicyDraft((current) => ({
      ...current,
      global: {
        ...current.global,
        defaultRoundingIncrement: nextValue,
      },
    }));
    setGlobalRoundupInput(String(nextValue));
    return true;
  }, [
    effectiveModelPolicyDraft.global.defaultRoundingIncrement,
    globalRoundupInput,
    updateModelPolicyDraft,
  ]);

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
        throw new Error(payload.error || "Failed to apply model pricing policy.");
      }

      await refreshPricingState();
      setModelPolicyDirty(false);
      setModelPolicyNote("");
      setModelPolicyMessage(payload.message ?? "Model pricing policy applied.");
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
        <section className={styles.adminSection}>
          <div className={styles.adminSectionHead}>
            <div>
              <p className="eyebrow">Pricing workspace</p>
              <h2 className={styles.adminSectionTitle}>{pricingWorkspaceState.title}</h2>
              <p className="tiny subdued">{pricingWorkspaceState.description}</p>
            </div>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => void refreshPricingState()}
              disabled={pricingLoading || pricingRefreshing}
            >
              {pricingLoading || pricingRefreshing
                ? "Refreshing…"
                : pricingWorkspaceState.actionLabel}
            </button>
          </div>
          <div className={styles.adminStatePanel}>
            <p className={styles.adminStateEyebrow}>{pricingWorkspaceState.eyebrow}</p>
            <h3 className={styles.adminStateTitle}>{pricingWorkspaceState.title}</h3>
            <p className={styles.adminStateDescription}>{pricingWorkspaceState.description}</p>
            <p className={styles.adminStateDescriptionMuted}>{pricingWorkspaceState.helper}</p>
          </div>
        </section>
      ) : (
        <>
          {pricingRefreshWarning ? (
            <p className={styles.announcementError}>{pricingRefreshWarning}</p>
          ) : null}

          <section className={styles.adminGrid}>
            {activeGlobalEditor === "credit-conversion" ? (
              <article className={styles.adminCard}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Credit conversion</span>
                </div>
                <div className={styles.adminCardInputRow}>
                  <input
                    ref={globalCreditConversionInputRef}
                    aria-label="Global credit conversion rate"
                    className={`${styles.searchInput} ${styles.adminCardMetricInput}`}
                    value={pricingState ? globalCreditConversionInput : ""}
                    onChange={(event) => setGlobalCreditConversionInput(event.target.value)}
                    onBlur={() => {
                      void commitGlobalCreditConversionInput();
                      setActiveGlobalEditor(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      if (commitGlobalCreditConversionInput()) {
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder="100"
                    disabled={!pricingState}
                  />
                  <span className={styles.adminCardMetricSuffix}>/ USD</span>
                </div>
                <p className={styles.adminSubtext}>
                  {pricingState
                    ? `1 credit = ${formatUsd(1 / effectiveModelPolicyDraft.global.creditUsdScale)}`
                    : "Runtime model pricing policy"}
                </p>
              </article>
            ) : (
              <button
                type="button"
                className={`${styles.adminCard} ${styles.adminCardButton}`}
                onClick={() => pricingState && setActiveGlobalEditor("credit-conversion")}
                disabled={!pricingState}
                aria-label="Edit global credit conversion rate"
              >
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Credit conversion</span>
                </div>
                <div className={styles.adminCardInputRow}>
                  <span className={styles.adminCardMetricButton}>
                    {pricingState ? effectiveModelPolicyDraft.global.creditUsdScale : "—"}
                  </span>
                  <span className={styles.adminCardMetricSuffix}>/ USD</span>
                </div>
                <p className={styles.adminSubtext}>
                  {pricingState
                    ? `1 credit = ${formatUsd(1 / effectiveModelPolicyDraft.global.creditUsdScale)}`
                    : "Runtime model pricing policy"}
                </p>
              </button>
            )}
            {activeGlobalEditor === "markup" ? (
              <article className={styles.adminCard}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Markup</span>
                </div>
                <div className={styles.adminCardInputRow}>
                  <span className={styles.adminCardMetricPrefix}>+</span>
                  <input
                    ref={globalMarkupInputRef}
                    aria-label="Global markup percent"
                    className={`${styles.searchInput} ${styles.adminCardMetricInput}`}
                    value={pricingState ? globalMarkupInput : ""}
                    onChange={(event) => setGlobalMarkupInput(event.target.value)}
                    onBlur={() => {
                      void commitGlobalMarkupInput();
                      setActiveGlobalEditor(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      if (commitGlobalMarkupInput()) {
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder="3"
                    disabled={!pricingState}
                  />
                  <span className={styles.adminCardMetricSuffix}>%</span>
                </div>
                <p className={styles.adminSubtext}>
                  {pricingState
                    ? `${effectiveModelPolicyDraft.global.markupBps} bps global runtime markup`
                    : "Markup not loaded"}
                </p>
              </article>
            ) : (
              <button
                type="button"
                className={`${styles.adminCard} ${styles.adminCardButton}`}
                onClick={() => pricingState && setActiveGlobalEditor("markup")}
                disabled={!pricingState}
                aria-label="Edit global markup percent"
              >
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Markup</span>
                </div>
                <div className={styles.adminCardInputRow}>
                  <span className={styles.adminCardMetricPrefix}>+</span>
                  <span className={styles.adminCardMetricButton}>
                    {pricingState ? effectiveModelPolicyDraft.global.markupBps / 100 : "—"}
                  </span>
                  <span className={styles.adminCardMetricSuffix}>%</span>
                </div>
                <p className={styles.adminSubtext}>
                  {pricingState
                    ? `${effectiveModelPolicyDraft.global.markupBps} bps global runtime markup`
                    : "Markup not loaded"}
                </p>
              </button>
            )}
            {activeGlobalEditor === "roundup" ? (
              <article className={styles.adminCard}>
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Global roundup</span>
                </div>
                <div className={styles.adminCardInputRow}>
                  <input
                    ref={globalRoundupInputRef}
                    aria-label="Global roundup increment"
                    className={`${styles.searchInput} ${styles.adminCardMetricInput}`}
                    value={pricingState ? globalRoundupInput : ""}
                    onChange={(event) => setGlobalRoundupInput(event.target.value)}
                    onBlur={() => {
                      void commitGlobalRoundupInput();
                      setActiveGlobalEditor(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      if (commitGlobalRoundupInput()) {
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder="5"
                    disabled={!pricingState}
                  />
                </div>
                <p className={styles.adminSubtext}>
                  {pricingState
                    ? `Round to the nearest ${effectiveModelPolicyDraft.global.defaultRoundingIncrement} credits`
                    : "Roundup not loaded"}
                </p>
              </article>
            ) : (
              <button
                type="button"
                className={`${styles.adminCard} ${styles.adminCardButton}`}
                onClick={() => pricingState && setActiveGlobalEditor("roundup")}
                disabled={!pricingState}
                aria-label="Edit global roundup increment"
              >
                <div className={styles.adminCardTop}>
                  <span className={styles.adminLabel}>Global roundup</span>
                </div>
                <div className={styles.adminCardInputRow}>
                  <span className={styles.adminCardMetricButton}>
                    {pricingState ? effectiveModelPolicyDraft.global.defaultRoundingIncrement : "—"}
                  </span>
                </div>
                <p className={styles.adminSubtext}>
                  {pricingState
                    ? `Round to the nearest ${effectiveModelPolicyDraft.global.defaultRoundingIncrement} credits`
                    : "Roundup not loaded"}
                </p>
              </button>
            )}
            <article
              className={`${styles.adminCard} ${health?.totalWarnings ? styles.warning : ""}`}
            >
              <div className={styles.adminCardTop}>
                <span className={styles.adminLabel}>Stripe health</span>
              </div>
              <p className={styles.adminMetric}>{health ? health.totalWarnings : "—"}</p>
              <p className={styles.adminSubtext}>
                {health
                  ? health.totalWarnings > 0
                    ? "Active catalog warnings need operator follow-up"
                    : "No missing Stripe price mappings in active catalog rows"
                  : "Catalog linkage checks pending"}
              </p>
            </article>
          </section>

          <nav className={styles.adminNavRow} aria-label="Pricing views">
            {PRICING_VIEW_TABS.map((tab) => {
              const active = tab.id === selectedPricingView;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  className={`${styles.adminNavLink} ${styles.adminNavButton} ${
                    active ? styles.adminNavLinkActive : ""
                  }`}
                  onClick={() => setSelectedPricingView(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {showModelsSection ? (
            <section className={styles.adminSection}>
              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Model pricing</p>
                  <h2 className={styles.adminSectionTitle}>Runtime model policy</h2>
                  <p className="tiny subdued">
                    Adjust the shared conversion contract and per-model overrides that drive both AI
                    Studio estimates and server-side debits.
                  </p>
                </div>
              </div>

              {modelPolicyMessage ? (
                <p className={styles.announcementResult}>{modelPolicyMessage}</p>
              ) : null}
              {modelPolicyError ? (
                <p className={styles.announcementError}>{modelPolicyError}</p>
              ) : null}

              {pricingState ? (
                <>
                  <div className={styles.searchRow}>
                    <input
                      type="search"
                      className={styles.searchInput}
                      value={modelSearchQuery}
                      onChange={(event) => setModelSearchQuery(event.target.value)}
                      placeholder="Search models, providers, ids, or strategies"
                      aria-label="Search pricing models"
                    />
                  </div>
                  <div className={styles.adminTable}>
                    <div className={`${styles.pricingModelsHead} ${styles.adminTableHead}`}>
                      <span>Model</span>
                      <span>Provider</span>
                      <span>Type</span>
                      <span>Strategy</span>
                      <span>Current</span>
                      <span>Conversion override</span>
                      <span>Markup override</span>
                      <span>Roundup override</span>
                    </div>
                    {filteredModels.length === 0 ? (
                      <div className={styles.adminTableRow}>
                        <span className={styles.pricingPrimaryCell}>
                          <strong>No models found</strong>
                          <small>Try a different search.</small>
                        </span>
                      </div>
                    ) : null}
                    {filteredModels.map((model) => {
                      const activePreview = model.pricingPreview;
                      const isSelected = selectedModelRow?.id === model.id;
                      const draftOverride = effectiveModelPolicyDraft.perModel[model.id] ?? null;
                      return (
                        <React.Fragment key={model.id}>
                          <button
                            type="button"
                            className={`${styles.pricingModelsRow} ${styles.adminTableRowButton} ${
                              isSelected ? styles.adminTableRowActive : ""
                            }`}
                            onClick={() =>
                              setSelectedModelOverrideId((current) =>
                                current === model.id ? null : model.id
                              )
                            }
                            aria-expanded={isSelected}
                            aria-label={`Configure pricing override for ${model.label}`}
                          >
                            <span className={styles.pricingPrimaryCell}>
                              <strong>{model.label}</strong>
                            </span>
                            <span
                              className={`${styles.pricingProviderLabel} ${getProviderLabelClassName(
                                model.provider
                              )}`.trim()}
                            >
                              {model.provider}
                            </span>
                            <span>{model.workflowType}</span>
                            <span>{model.pricingStrategyLabel}</span>
                            <span className={styles.pricingPrimaryCell}>
                              {activePreview ? (
                                <strong>{formatCredits(activePreview.billedCredits ?? 0)}</strong>
                              ) : (
                                <small>Unavailable</small>
                              )}
                            </span>
                            <span className={styles.pricingMonoCell}>
                              {draftOverride?.creditUsdScale != null
                                ? String(draftOverride.creditUsdScale)
                                : ""}
                            </span>
                            <span className={styles.pricingMonoCell}>
                              {draftOverride?.markupBps != null
                                ? `${draftOverride.markupBps / 100}%`
                                : ""}
                            </span>
                            <span className={styles.pricingMonoCell}>
                              {draftOverride?.roundingIncrement != null
                                ? String(draftOverride.roundingIncrement)
                                : ""}
                            </span>
                          </button>
                          {isSelected ? (
                            <div className={styles.pricingInlineEditorCard}>
                              <p className="eyebrow">Edit model pricing policy</p>
                              <div className={styles.pricingInlineEditorTopRow}>
                                <div className={styles.pricingInlineOverridesGrid}>
                                  <label className={styles.manualAdjustField}>
                                    <span className="tiny subdued">Credit conversion override</span>
                                    <input
                                      className={`${styles.searchInput} ${styles.pricingOverrideInput}`}
                                      value={
                                        draftOverride?.creditUsdScale != null
                                          ? String(draftOverride.creditUsdScale)
                                          : ""
                                      }
                                      placeholder="none"
                                      onChange={(event) =>
                                        updateModelPolicyDraft((current) =>
                                          normalizeModelOverrideDraft(current, model.id, {
                                            creditUsdScale: parseIntegerInput(event.target.value),
                                          })
                                        )
                                      }
                                    />
                                  </label>
                                  <label className={styles.manualAdjustField}>
                                    <span className="tiny subdued">Markup override</span>
                                    <input
                                      className={`${styles.searchInput} ${styles.pricingOverrideInput}`}
                                      value={
                                        draftOverride?.markupBps != null
                                          ? String(draftOverride.markupBps / 100)
                                          : ""
                                      }
                                      placeholder="none"
                                      onChange={(event) =>
                                        updateModelPolicyDraft((current) =>
                                          normalizeModelOverrideDraft(current, model.id, {
                                            markupBps: parsePercentToBps(event.target.value),
                                          })
                                        )
                                      }
                                    />
                                  </label>
                                  <label className={styles.manualAdjustField}>
                                    <span className="tiny subdued">Roundup increment override</span>
                                    <input
                                      className={`${styles.searchInput} ${styles.pricingOverrideInput}`}
                                      value={
                                        draftOverride?.roundingIncrement != null
                                          ? String(draftOverride.roundingIncrement)
                                          : ""
                                      }
                                      placeholder="none"
                                      onChange={(event) =>
                                        updateModelPolicyDraft((current) =>
                                          normalizeModelOverrideDraft(current, model.id, {
                                            roundingIncrement: parseIntegerInput(
                                              event.target.value
                                            ),
                                          })
                                        )
                                      }
                                    />
                                  </label>
                                </div>
                              </div>
                              <div className={styles.pricingInlineEditorBottomRow}>
                                <div className={styles.pricingEditorActionsColumn}>
                                  <div className={styles.pricingEditorActions}>
                                    <button
                                      type="button"
                                      className="ghost-btn mini"
                                      onClick={() => void applyModelPolicy()}
                                      disabled={
                                        modelPolicySaving ||
                                        modelPolicyRollbackLoading ||
                                        !modelPolicyDirty
                                      }
                                    >
                                      {modelPolicySaving ? "Applying…" : "Apply policy"}
                                    </button>
                                    <button
                                      type="button"
                                      className="ghost-btn mini"
                                      onClick={resetModelPolicyDraft}
                                      disabled={
                                        modelPolicySaving ||
                                        modelPolicyRollbackLoading ||
                                        !modelPolicyDirty
                                      }
                                    >
                                      Reset draft
                                    </button>
                                    <button
                                      type="button"
                                      className="ghost-btn mini"
                                      onClick={() => void rollbackModelPolicy()}
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
                            </div>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {showPlansSection ? (
            <section className={styles.adminSection}>
              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Subscriptions</p>
                  <h2 className={styles.adminSectionTitle}>Public plans</h2>
                </div>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={() => {
                    const nextSortOrder =
                      (pricingState?.plans.reduce(
                        (maxOrder, row) => Math.max(maxOrder, row.sortOrder),
                        0
                      ) ?? 0) + 10;
                    setPlanDraft(buildEmptyPlanCreateDraft(nextSortOrder));
                    setPlanError(null);
                    setPlanMessage(null);
                  }}
                >
                  Create new plan
                </button>
              </div>

              {pricingState ? (
                <div className={styles.adminTable}>
                  <div className={`${styles.pricingPlanCatalogHead} ${styles.adminTableHead}`}>
                    <span>Plan</span>
                    <span>Accounts</span>
                    <span>Status</span>
                    <span>Monthly price</span>
                    <span>Credits</span>
                    <span>Storage</span>
                    <span>Stripe price</span>
                    <span>Effective</span>
                  </div>
                  {pricingState.plans.map((plan) => (
                    <div key={plan.offerId} className={styles.pricingPlanCatalogRow}>
                      <span className={styles.pricingPrimaryCell}>
                        <strong>{plan.displayName}</strong>
                      </span>
                      <span>{formatCredits(plan.accountCount)}</span>
                      <span className={getPlanStatusClassName(plan.status)}>{plan.status}</span>
                      <span>{formatCurrencyFromCents(plan.recurringPriceCents)}</span>
                      <span>{formatCredits(plan.monthlyCreditsCents)}</span>
                      <span>{formatStorageBytes(plan.storageLimitBytes)}</span>
                      <span className={styles.pricingMonoCell}>
                        {plan.stripePriceId ?? "Missing"}
                      </span>
                      <span>{formatDateTime(plan.effectiveStartAt)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {planMessage ? <p className={styles.announcementResult}>{planMessage}</p> : null}
              {planError ? <p className={styles.announcementError}>{planError}</p> : null}

              {planDraft ? (
                <div className={styles.pricingEditorCard}>
                  <p className="eyebrow">Create new plan</p>
                  <div className={styles.pricingFormGrid}>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Plan id</span>
                      <input
                        className={styles.searchInput}
                        value={planDraft.planId}
                        onChange={(event) =>
                          setPlanDraft((current) =>
                            current ? { ...current, planId: event.target.value } : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Display name</span>
                      <input
                        className={styles.searchInput}
                        value={planDraft.displayName}
                        onChange={(event) =>
                          setPlanDraft((current) =>
                            current ? { ...current, displayName: event.target.value } : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Recurring price (cents)</span>
                      <input
                        className={styles.searchInput}
                        value={planDraft.recurringPriceCents}
                        onChange={(event) =>
                          setPlanDraft((current) =>
                            current
                              ? { ...current, recurringPriceCents: event.target.value }
                              : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Monthly credits</span>
                      <input
                        className={styles.searchInput}
                        value={planDraft.monthlyCreditsCents}
                        onChange={(event) =>
                          setPlanDraft((current) =>
                            current
                              ? { ...current, monthlyCreditsCents: event.target.value }
                              : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Storage bytes</span>
                      <input
                        className={styles.searchInput}
                        value={planDraft.storageLimitBytes}
                        onChange={(event) =>
                          setPlanDraft((current) =>
                            current
                              ? { ...current, storageLimitBytes: event.target.value }
                              : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Sort order</span>
                      <input
                        className={styles.searchInput}
                        value={planDraft.sortOrder}
                        onChange={(event) =>
                          setPlanDraft((current) =>
                            current ? { ...current, sortOrder: event.target.value } : current
                          )
                        }
                      />
                    </label>
                  </div>
                  <p className="tiny subdued">
                    This creates the ShortPulse plan row, its first public offer, and the Stripe
                    product plus recurring price.
                  </p>
                  <p className="tiny subdued">
                    Stripe product preview:{" "}
                    <strong>
                      {planDraft.displayName.trim()
                        ? `Plan - ${planDraft.displayName.trim()}`
                        : "Plan - <DisplayName>"}
                    </strong>
                  </p>
                  <div className={styles.pricingEditorActions}>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => void createPlan()}
                      disabled={planSaving}
                    >
                      {planSaving ? "Creating…" : "Create plan"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => setPlanDraft(null)}
                      disabled={planSaving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {showCreditsSection ? (
            <section className={styles.adminSection}>
              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Credit top-ups</p>
                  <h2 className={styles.adminSectionTitle}>Active credit packages</h2>
                  <p className="tiny subdued">Direct package rows currently exposed to checkout.</p>
                </div>
              </div>

              {pricingState ? (
                <div className={styles.adminTable}>
                  <div className={`${styles.pricingCatalogHead} ${styles.adminTableHead}`}>
                    <span>Package</span>
                    <span>Price</span>
                    <span>Credits</span>
                    <span>Unit economics</span>
                    <span>Stripe price</span>
                    <span>Status</span>
                    <span>Action</span>
                  </div>
                  {pricingState.creditPackages.map((pkg) => (
                    <div key={pkg.id} className={styles.pricingCatalogRow}>
                      <span className={styles.pricingPrimaryCell}>
                        <strong>{pkg.displayName}</strong>
                      </span>
                      <span>{formatCurrencyFromCents(pkg.priceCents)}</span>
                      <span>{formatCredits(pkg.creditAmountCents)}</span>
                      <span>
                        {formatUsd((pkg.priceCents / 100 / pkg.creditAmountCents) * 1000)}
                      </span>
                      <span className={styles.pricingMonoCell}>
                        {pkg.stripePriceId ?? "Missing"}
                      </span>
                      <span className={pkg.isActive ? styles.pillOk : styles.pillWarn}>
                        {pkg.isActive ? "active" : "inactive"}
                      </span>
                      <span>
                        <button
                          type="button"
                          className="ghost-btn mini"
                          onClick={() => {
                            setCreditDraft(buildCreditPackageDraft(pkg));
                            setCreditError(null);
                            setCreditMessage(null);
                          }}
                        >
                          Edit
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {creditMessage ? <p className={styles.announcementResult}>{creditMessage}</p> : null}
              {creditError ? <p className={styles.announcementError}>{creditError}</p> : null}

              {creditDraft ? (
                <div className={styles.pricingEditorCard}>
                  <p className="eyebrow">Edit credit package</p>
                  <div className={styles.pricingFormGrid}>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Display name</span>
                      <input
                        className={styles.searchInput}
                        value={creditDraft.displayName}
                        onChange={(event) =>
                          setCreditDraft((current) =>
                            current ? { ...current, displayName: event.target.value } : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Credits</span>
                      <input
                        className={styles.searchInput}
                        value={creditDraft.creditAmountCents}
                        onChange={(event) =>
                          setCreditDraft((current) =>
                            current
                              ? { ...current, creditAmountCents: event.target.value }
                              : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Price (cents)</span>
                      <input
                        className={styles.searchInput}
                        value={creditDraft.priceCents}
                        onChange={(event) =>
                          setCreditDraft((current) =>
                            current ? { ...current, priceCents: event.target.value } : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Stripe price id</span>
                      <input
                        className={styles.searchInput}
                        value={creditDraft.stripePriceId}
                        onChange={(event) =>
                          setCreditDraft((current) =>
                            current ? { ...current, stripePriceId: event.target.value } : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Sort order</span>
                      <input
                        className={styles.searchInput}
                        value={creditDraft.sortOrder}
                        onChange={(event) =>
                          setCreditDraft((current) =>
                            current ? { ...current, sortOrder: event.target.value } : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.pricingCheckboxField}>
                      <input
                        type="checkbox"
                        checked={creditDraft.isActive}
                        onChange={(event) =>
                          setCreditDraft((current) =>
                            current ? { ...current, isActive: event.target.checked } : current
                          )
                        }
                      />
                      <span>Active package</span>
                    </label>
                  </div>
                  <div className={styles.pricingEditorActions}>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => void saveCreditPackage()}
                      disabled={creditSaving}
                    >
                      {creditSaving ? "Saving…" : "Save package"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => setCreditDraft(null)}
                      disabled={creditSaving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {showMediaAddonsSection ? (
            <section className={styles.adminSection}>
              <div className={styles.adminSectionHead}>
                <div>
                  <p className="eyebrow">Storage add-ons</p>
                  <h2 className={styles.adminSectionTitle}>Active public storage offers</h2>
                  <p className="tiny subdued">
                    Current recurring storage acquisition rows and linked Stripe identifiers.
                  </p>
                </div>
              </div>

              {pricingState ? (
                <div className={styles.adminTable}>
                  <div className={`${styles.pricingCatalogHead} ${styles.adminTableHead}`}>
                    <span>Add-on</span>
                    <span>Monthly price</span>
                    <span>Storage</span>
                    <span>Offer id</span>
                    <span>Stripe price</span>
                    <span>Effective</span>
                    <span>Action</span>
                  </div>
                  {pricingState.storageAddons.map((addon) => (
                    <div key={addon.offerId} className={styles.pricingCatalogRow}>
                      <span className={styles.pricingPrimaryCell}>
                        <strong>{addon.displayName}</strong>
                      </span>
                      <span>{formatCurrencyFromCents(addon.recurringPriceCents)}</span>
                      <span>{formatStorageBytes(addon.storageLimitBytes)}</span>
                      <span className={styles.pricingMonoCell}>{addon.offerId}</span>
                      <span className={styles.pricingMonoCell}>
                        {addon.stripePriceId ?? "Missing"}
                      </span>
                      <span>{formatDateTime(addon.effectiveStartAt)}</span>
                      <span>
                        <button
                          type="button"
                          className="ghost-btn mini"
                          onClick={() => {
                            setStorageDraft(buildStorageOfferDraft(addon));
                            setStorageError(null);
                            setStorageMessage(null);
                          }}
                        >
                          Create next
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {storageMessage ? (
                <p className={styles.announcementResult}>{storageMessage}</p>
              ) : null}
              {storageError ? <p className={styles.announcementError}>{storageError}</p> : null}

              {storageDraft ? (
                <div className={styles.pricingEditorCard}>
                  <p className="eyebrow">Create next storage offer</p>
                  <div className={styles.pricingFormGrid}>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Offer name</span>
                      <input
                        className={styles.searchInput}
                        value={storageDraft.offerName}
                        onChange={(event) =>
                          setStorageDraft((current) =>
                            current ? { ...current, offerName: event.target.value } : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Storage bytes</span>
                      <input
                        className={styles.searchInput}
                        value={storageDraft.storageLimitBytes}
                        onChange={(event) =>
                          setStorageDraft((current) =>
                            current
                              ? { ...current, storageLimitBytes: event.target.value }
                              : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Recurring price (cents)</span>
                      <input
                        className={styles.searchInput}
                        value={storageDraft.recurringPriceCents}
                        onChange={(event) =>
                          setStorageDraft((current) =>
                            current
                              ? { ...current, recurringPriceCents: event.target.value }
                              : current
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">Stripe price id</span>
                      <input
                        className={styles.searchInput}
                        value={storageDraft.stripePriceId}
                        onChange={(event) =>
                          setStorageDraft((current) =>
                            current ? { ...current, stripePriceId: event.target.value } : current
                          )
                        }
                      />
                    </label>
                  </div>
                  <p className="tiny subdued">
                    This creates a new current public recurring storage offer for new buyers only.
                  </p>
                  <div className={styles.pricingEditorActions}>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => void createStorageOffer()}
                      disabled={storageSaving}
                    >
                      {storageSaving ? "Creating…" : "Create and activate"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => setStorageDraft(null)}
                      disabled={storageSaving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </AdminRouteShell>
  );
}
