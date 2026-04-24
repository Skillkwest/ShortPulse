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
  AdminPricingModelRow,
  AdminPricingPlanRow,
  AdminPricingPolicySnapshot,
  AdminPricingStorageAddonRow,
} from "../../features/admin/types";
import { fetchWithAuth } from "../../lib/authenticatedFetch";
import { useProtectedRoute } from "../../lib/authGuard";
import { formatStorageBytes } from "../../features/billing/storage";
import { buildDefaultPricingParams, computeCostForModel } from "../../lib/model-runtime/pricing";
import {
  compactModelPricingPolicyDocument,
  getDefaultModelPricingPolicyDocument,
  type CreditRoundingMode,
  type ModelPricingPolicyDocument,
} from "../../lib/model-runtime/pricingPolicy";
import styles from "../../styles/admin.module.css";

const formatUsd = (value: number): string => `$${value.toFixed(2)}`;
const formatCurrencyFromCents = (value: number): string => formatUsd(value / 100);
const formatCredits = (value: number): string => new Intl.NumberFormat("en-US").format(value);
const formatDateTime = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : "—";
const formatPercent = (value: number): string => `${value.toFixed(2).replace(/\.00$/, "")}%`;

type ModelOverrideRoundingDraft = CreditRoundingMode | "default";

type CreditPackageDraft = {
  id: string;
  displayName: string;
  creditAmountCents: string;
  priceCents: string;
  stripePriceId: string;
  sortOrder: string;
  isActive: boolean;
};

type PlanOfferDraft = {
  planId: string;
  offerName: string;
  recurringPriceCents: string;
  monthlyCreditsCents: string;
  storageLimitBytes: string;
  stripePriceId: string;
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

const buildCreditPackageDraft = (row: AdminPricingCreditPackageRow): CreditPackageDraft => ({
  id: row.id,
  displayName: row.displayName,
  creditAmountCents: String(row.creditAmountCents),
  priceCents: String(row.priceCents),
  stripePriceId: row.stripePriceId ?? "",
  sortOrder: String(row.sortOrder),
  isActive: row.isActive,
});

const buildPlanOfferDraft = (row: AdminPricingPlanRow): PlanOfferDraft => ({
  planId: row.planId,
  offerName: `${row.displayName} Admin Offer`,
  recurringPriceCents: String(row.recurringPriceCents),
  monthlyCreditsCents: String(row.monthlyCreditsCents),
  storageLimitBytes: String(row.storageLimitBytes),
  stripePriceId: row.stripePriceId ?? "",
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
    multiplierBps?: number | null;
    roundingMode?: ModelOverrideRoundingDraft;
  }
): ModelPricingPolicyDocument => {
  const currentOverride = policy.perModel[modelId] ?? {};
  const mergedOverride = {
    multiplierBps:
      nextOverride.multiplierBps !== undefined
        ? nextOverride.multiplierBps
        : currentOverride.multiplierBps,
    roundingMode:
      nextOverride.roundingMode !== undefined
        ? nextOverride.roundingMode === "default"
          ? null
          : nextOverride.roundingMode
        : (currentOverride.roundingMode ?? null),
  };

  const nextPerModel = { ...policy.perModel };
  const hasCustomMultiplier =
    typeof mergedOverride.multiplierBps === "number" && mergedOverride.multiplierBps !== 10_000;
  const hasCustomRounding =
    mergedOverride.roundingMode === "nearest-5" || mergedOverride.roundingMode === "ceil";

  if (!hasCustomMultiplier && !hasCustomRounding) {
    delete nextPerModel[modelId];
  } else {
    nextPerModel[modelId] = {
      ...(hasCustomMultiplier ? { multiplierBps: mergedOverride.multiplierBps ?? 10_000 } : {}),
      ...(hasCustomRounding ? { roundingMode: mergedOverride.roundingMode } : {}),
    };
  }

  return compactModelPricingPolicyDocument({
    ...policy,
    perModel: nextPerModel,
  });
};

const buildModelPolicyPreview = (
  model: AdminPricingModelRow,
  policy: ModelPricingPolicyDocument | null
) => computeCostForModel(model.id, buildDefaultPricingParams(model.id), policy);

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

  const [planDraft, setPlanDraft] = React.useState<PlanOfferDraft | null>(null);
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
  const [modelPolicyReason, setModelPolicyReason] = React.useState("");
  const [selectedModelOverrideId, setSelectedModelOverrideId] = React.useState<string | null>(null);

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

  React.useEffect(() => {
    if (selectedModelOverrideId || !pricingState?.models.length) return;
    setSelectedModelOverrideId(pricingState.models[0]?.id ?? null);
  }, [pricingState?.models, selectedModelOverrideId]);

  const effectiveModelPolicyDraft = modelPolicyDraft ?? activeModelPolicyDocument;
  const selectedModelRow = React.useMemo(
    () =>
      pricingState?.models.find((model) => model.id === selectedModelOverrideId) ??
      pricingState?.models[0] ??
      null,
    [pricingState?.models, selectedModelOverrideId]
  );
  const selectedModelOverride = selectedModelRow
    ? (effectiveModelPolicyDraft.perModel[selectedModelRow.id] ?? null)
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
    setModelPolicyReason("");
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

  const createPlanOffer = React.useCallback(async () => {
    if (!planDraft) return;
    setPlanSaving(true);
    setPlanError(null);
    setPlanMessage(null);
    try {
      const response = await fetchWithAuth("/api/admin/pricing/plan-offers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planDraft),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create the next plan offer.");
      }
      await refreshPricingState();
      setPlanMessage(payload.message ?? "Plan offer created and activated.");
      setPlanDraft(null);
    } catch (error) {
      setPlanError(
        error instanceof Error ? error.message : "Failed to create the next plan offer."
      );
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
          reason: modelPolicyReason,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ModelPolicyApplyResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Failed to apply model pricing policy.");
      }

      await refreshPricingState();
      setModelPolicyDirty(false);
      setModelPolicyNote("");
      setModelPolicyReason("");
      setModelPolicyMessage(payload.message ?? "Model pricing policy applied.");
    } catch (error) {
      setModelPolicyError(
        error instanceof Error ? error.message : "Failed to apply model pricing policy."
      );
    } finally {
      setModelPolicySaving(false);
    }
  }, [effectiveModelPolicyDraft, modelPolicyNote, modelPolicyReason, refreshPricingState]);

  const rollbackModelPolicy = React.useCallback(async () => {
    setModelPolicyRollbackLoading(true);
    setModelPolicyError(null);
    setModelPolicyMessage(null);

    try {
      const response = await fetchWithAuth("/api/admin/pricing/model-policy/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: modelPolicyReason,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ModelPolicyApplyResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Failed to rollback model pricing policy.");
      }

      await refreshPricingState();
      setModelPolicyDirty(false);
      setModelPolicyNote("");
      setModelPolicyReason("");
      setModelPolicyMessage(payload.message ?? "Model pricing policy rolled back.");
    } catch (error) {
      setModelPolicyError(
        error instanceof Error ? error.message : "Failed to rollback model pricing policy."
      );
    } finally {
      setModelPolicyRollbackLoading(false);
    }
  }, [modelPolicyReason, refreshPricingState]);

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
      <section className={styles.adminGrid}>
        <article className={styles.adminCard}>
          <div className={styles.adminCardTop}>
            <span className={styles.adminLabel}>Credit conversion</span>
          </div>
          <p className={styles.adminMetric}>
            {pricingState ? `${pricingState.modelPolicy.creditUsdScale} / USD` : "—"}
          </p>
          <p className={styles.adminSubtext}>
            {pricingState
              ? `1 credit = ${formatUsd(pricingState.modelPolicy.creditValueUsd)}`
              : "Runtime model pricing policy"}
          </p>
        </article>
        <article className={styles.adminCard}>
          <div className={styles.adminCardTop}>
            <span className={styles.adminLabel}>Markup</span>
          </div>
          <p className={styles.adminMetric}>
            {pricingState ? `+${pricingState.modelPolicy.markupPercent.toFixed(0)}%` : "—"}
          </p>
          <p className={styles.adminSubtext}>
            {pricingState
              ? `${pricingState.modelPolicy.markupBps} bps shared runtime markup`
              : "Markup not loaded"}
          </p>
        </article>
        <article className={styles.adminCard}>
          <div className={styles.adminCardTop}>
            <span className={styles.adminLabel}>Active model rows</span>
          </div>
          <p className={styles.adminMetric}>{pricingState?.models.length ?? "—"}</p>
          <p className={styles.adminSubtext}>Runtime registry-backed model coverage</p>
        </article>
        <article className={`${styles.adminCard} ${health?.totalWarnings ? styles.warning : ""}`}>
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

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className="eyebrow">Overview</p>
            <h2 className={styles.adminSectionTitle}>Pricing state</h2>
            <p className="tiny subdued">
              Billing catalog writes and runtime model pricing edits now share this one operator
              surface.
            </p>
          </div>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => void refreshPricingState()}
            disabled={pricingLoading || pricingRefreshing}
          >
            {pricingRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {pricingError ? <p className={styles.announcementError}>{pricingError}</p> : null}
        {pricingLoading && !pricingState ? (
          <p className="tiny subdued">Loading pricing state…</p>
        ) : null}

        {pricingState ? (
          <div className={styles.pricingOverviewGrid}>
            <article className={styles.adminCard}>
              <p className="eyebrow">Model policy</p>
              <div className={styles.pricingMetaList}>
                <span>Version: {pricingState.modelPolicy.version}</span>
                <span>Source: {pricingState.modelPolicy.policySource}</span>
                <span>
                  Default rounding: {pricingState.modelPolicy.defaultRoundingMode} (
                  {pricingState.modelPolicy.defaultRoundingIncrement})
                </span>
                <span>Overrides: {pricingState.modelPolicy.overrideCount}</span>
                <span>Updated: {formatDateTime(pricingState.modelPolicy.updatedAt)}</span>
              </div>
            </article>
            <article className={styles.adminCard}>
              <p className="eyebrow">Billing catalog</p>
              <div className={styles.pricingMetaList}>
                <span>Plans: {pricingState.plans.length}</span>
                <span>Credit packages: {pricingState.creditPackages.length}</span>
                <span>Storage add-ons: {pricingState.storageAddons.length}</span>
              </div>
            </article>
            <article
              className={`${styles.adminCard} ${health?.totalWarnings ? styles.warning : ""}`}
            >
              <p className="eyebrow">Health warnings</p>
              {health && health.warnings.length > 0 ? (
                <ul className={styles.pricingWarningList}>
                  {health.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="tiny subdued">No active Stripe-mapping warnings.</p>
              )}
            </article>
          </div>
        ) : null}
      </section>

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
        {modelPolicyError ? <p className={styles.announcementError}>{modelPolicyError}</p> : null}

        {pricingState ? (
          <>
            <div className={styles.pricingOverviewGrid}>
              <article className={styles.adminCard}>
                <p className="eyebrow">Active policy</p>
                <div className={styles.pricingMetaList}>
                  <span>Version: {pricingState.modelPolicy.version}</span>
                  <span>Updated by: {pricingState.modelPolicy.updatedByEmail ?? "Unknown"}</span>
                  <span>
                    Default exception ids:{" "}
                    {pricingState.modelPolicy.exceptionRoundingModelIds.length}
                  </span>
                  <span>
                    Draft status: {modelPolicyDirty ? "unsaved changes" : "synced to active"}
                  </span>
                </div>
              </article>
              <article className={styles.adminCard}>
                <p className="eyebrow">Selected model override</p>
                {selectedModelRow ? (
                  <div className={styles.pricingMetaList}>
                    <span>{selectedModelRow.label}</span>
                    <span>{selectedModelRow.id}</span>
                    <span>
                      Multiplier:{" "}
                      {selectedModelOverride?.multiplierBps
                        ? formatPercent(selectedModelOverride.multiplierBps / 100)
                        : "default 100%"}
                    </span>
                    <span>Rounding: {selectedModelOverride?.roundingMode ?? "default policy"}</span>
                  </div>
                ) : (
                  <p className="tiny subdued">Select a model row to edit per-model overrides.</p>
                )}
              </article>
            </div>

            <div className={styles.pricingEditorCard}>
              <p className="eyebrow">Edit model pricing policy</p>
              <div className={styles.pricingFormGrid}>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Credits per USD</span>
                  <input
                    className={styles.searchInput}
                    value={String(effectiveModelPolicyDraft.global.creditUsdScale)}
                    onChange={(event) => {
                      const nextValue = parseIntegerInput(event.target.value);
                      if (nextValue == null || nextValue <= 0) return;
                      updateModelPolicyDraft((current) => ({
                        ...current,
                        global: {
                          ...current.global,
                          creditUsdScale: nextValue,
                        },
                      }));
                    }}
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Markup percent</span>
                  <input
                    className={styles.searchInput}
                    value={String(effectiveModelPolicyDraft.global.markupBps / 100)}
                    onChange={(event) => {
                      const nextValue = parsePercentToBps(event.target.value);
                      if (nextValue == null || nextValue < 0) return;
                      updateModelPolicyDraft((current) => ({
                        ...current,
                        global: {
                          ...current.global,
                          markupBps: nextValue,
                        },
                      }));
                    }}
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Default rounding mode</span>
                  <select
                    className={styles.searchInput}
                    value={effectiveModelPolicyDraft.global.defaultRoundingMode}
                    onChange={(event) =>
                      updateModelPolicyDraft((current) => ({
                        ...current,
                        global: {
                          ...current.global,
                          defaultRoundingMode: event.target.value as CreditRoundingMode,
                        },
                      }))
                    }
                  >
                    <option value="nearest-5">nearest-5</option>
                    <option value="ceil">ceil</option>
                  </select>
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Default rounding increment</span>
                  <input
                    className={styles.searchInput}
                    value={String(effectiveModelPolicyDraft.global.defaultRoundingIncrement)}
                    onChange={(event) => {
                      const nextValue = parseIntegerInput(event.target.value);
                      if (nextValue == null || nextValue <= 0) return;
                      updateModelPolicyDraft((current) => ({
                        ...current,
                        global: {
                          ...current.global,
                          defaultRoundingIncrement: nextValue,
                        },
                      }));
                    }}
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Exception rounding model ids</span>
                  <textarea
                    className={styles.searchInput}
                    rows={4}
                    value={effectiveModelPolicyDraft.global.exceptionRoundingModelIds.join("\n")}
                    onChange={(event) =>
                      updateModelPolicyDraft((current) => ({
                        ...current,
                        global: {
                          ...current.global,
                          exceptionRoundingModelIds: event.target.value
                            .split(/[\n,]+/)
                            .map((value) => value.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                  />
                </label>
                {selectedModelRow ? (
                  <>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">
                        {selectedModelRow.label} multiplier percent
                      </span>
                      <input
                        className={styles.searchInput}
                        value={
                          selectedModelOverride?.multiplierBps != null
                            ? String(selectedModelOverride.multiplierBps / 100)
                            : ""
                        }
                        placeholder="100"
                        onChange={(event) =>
                          updateModelPolicyDraft((current) =>
                            normalizeModelOverrideDraft(current, selectedModelRow.id, {
                              multiplierBps: parsePercentToBps(event.target.value),
                            })
                          )
                        }
                      />
                    </label>
                    <label className={styles.manualAdjustField}>
                      <span className="tiny subdued">
                        {selectedModelRow.label} rounding override
                      </span>
                      <select
                        className={styles.searchInput}
                        value={
                          (selectedModelOverride?.roundingMode ??
                            "default") as ModelOverrideRoundingDraft
                        }
                        onChange={(event) =>
                          updateModelPolicyDraft((current) =>
                            normalizeModelOverrideDraft(current, selectedModelRow.id, {
                              roundingMode: event.target.value as ModelOverrideRoundingDraft,
                            })
                          )
                        }
                      >
                        <option value="default">default</option>
                        <option value="nearest-5">nearest-5</option>
                        <option value="ceil">ceil</option>
                      </select>
                    </label>
                  </>
                ) : null}
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Change note</span>
                  <input
                    className={styles.searchInput}
                    value={modelPolicyNote}
                    onChange={(event) => setModelPolicyNote(event.target.value)}
                    placeholder="Short operator note for this version"
                  />
                </label>
                <label className={styles.manualAdjustField}>
                  <span className="tiny subdued">Reason / rollback note</span>
                  <input
                    className={styles.searchInput}
                    value={modelPolicyReason}
                    onChange={(event) => setModelPolicyReason(event.target.value)}
                    placeholder="Why this change is being applied"
                  />
                </label>
              </div>
              <p className="tiny subdued">
                Changes here affect future model estimates and future server-side generation debits.
                Existing ledger rows remain historical.
              </p>
              <div className={styles.pricingEditorActions}>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={() => void applyModelPolicy()}
                  disabled={modelPolicySaving || modelPolicyRollbackLoading || !modelPolicyDirty}
                >
                  {modelPolicySaving ? "Applying…" : "Apply policy"}
                </button>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={resetModelPolicyDraft}
                  disabled={modelPolicySaving || modelPolicyRollbackLoading || !modelPolicyDirty}
                >
                  Reset draft
                </button>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={() => void rollbackModelPolicy()}
                  disabled={modelPolicySaving || modelPolicyRollbackLoading}
                >
                  {modelPolicyRollbackLoading ? "Rolling back…" : "Rollback active policy"}
                </button>
              </div>
            </div>

            <div className={styles.adminTable}>
              <div className={`${styles.pricingModelsHead} ${styles.adminTableHead}`}>
                <span>Model</span>
                <span>Provider</span>
                <span>Type</span>
                <span>Strategy</span>
                <span>Current</span>
                <span>Draft</span>
                <span>Action</span>
              </div>
              {pricingState.models.map((model) => {
                const draftPreview = buildModelPolicyPreview(model, effectiveModelPolicyDraft);
                const activePreview = model.pricingPreview;
                const isSelected = selectedModelRow?.id === model.id;
                const draftOverride = effectiveModelPolicyDraft.perModel[model.id] ?? null;
                return (
                  <div key={model.id} className={styles.pricingModelsRow}>
                    <span className={styles.pricingPrimaryCell}>
                      <strong>{model.label}</strong>
                      <small>{model.id}</small>
                    </span>
                    <span>{model.provider}</span>
                    <span>{model.mediaType}</span>
                    <span className={styles.pricingMonoCell}>{model.pricingStrategy}</span>
                    <span className={styles.pricingPrimaryCell}>
                      {activePreview ? (
                        <>
                          <strong>{formatCredits(activePreview.billedCredits ?? 0)}</strong>
                          <small>{model.roundingMode}</small>
                        </>
                      ) : (
                        <small>Unavailable</small>
                      )}
                    </span>
                    <span className={styles.pricingPrimaryCell}>
                      {draftPreview ? (
                        <>
                          <strong>{formatCredits(draftPreview.credits ?? 0)}</strong>
                          <small>
                            {draftOverride?.multiplierBps != null
                              ? formatPercent(draftOverride.multiplierBps / 100)
                              : "default"}
                            {" · "}
                            {draftOverride?.roundingMode ?? "default"}
                          </small>
                        </>
                      ) : (
                        <small>Unavailable</small>
                      )}
                    </span>
                    <span>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => setSelectedModelOverrideId(model.id)}
                      >
                        {isSelected ? "Editing" : "Configure"}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className="eyebrow">Subscriptions</p>
            <h2 className={styles.adminSectionTitle}>Active public plan offers</h2>
            <p className="tiny subdued">
              Current acquisition-facing offer rows. Existing subscriber contracts are not shown
              here.
            </p>
          </div>
        </div>

        {pricingState ? (
          <div className={styles.adminTable}>
            <div className={`${styles.pricingCatalogHead} ${styles.adminTableHead}`}>
              <span>Plan</span>
              <span>Monthly price</span>
              <span>Credits</span>
              <span>Storage</span>
              <span>Stripe price</span>
              <span>Effective</span>
              <span>Action</span>
            </div>
            {pricingState.plans.map((plan) => (
              <div key={plan.offerId} className={styles.pricingCatalogRow}>
                <span className={styles.pricingPrimaryCell}>
                  <strong>{plan.displayName}</strong>
                  <small>{plan.planId}</small>
                </span>
                <span>{formatCurrencyFromCents(plan.recurringPriceCents)}</span>
                <span>{formatCredits(plan.monthlyCreditsCents)}</span>
                <span>{formatStorageBytes(plan.storageLimitBytes)}</span>
                <span className={styles.pricingMonoCell}>{plan.stripePriceId ?? "Missing"}</span>
                <span>{formatDateTime(plan.effectiveStartAt)}</span>
                <span>
                  <button
                    type="button"
                    className="ghost-btn mini"
                    onClick={() => {
                      setPlanDraft(buildPlanOfferDraft(plan));
                      setPlanError(null);
                      setPlanMessage(null);
                    }}
                  >
                    Create next
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {planMessage ? <p className={styles.announcementResult}>{planMessage}</p> : null}
        {planError ? <p className={styles.announcementError}>{planError}</p> : null}

        {planDraft ? (
          <div className={styles.pricingEditorCard}>
            <p className="eyebrow">Create next plan offer</p>
            <div className={styles.pricingFormGrid}>
              <label className={styles.manualAdjustField}>
                <span className="tiny subdued">Offer name</span>
                <input
                  className={styles.searchInput}
                  value={planDraft.offerName}
                  onChange={(event) =>
                    setPlanDraft((current) =>
                      current ? { ...current, offerName: event.target.value } : current
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
                      current ? { ...current, recurringPriceCents: event.target.value } : current
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
                      current ? { ...current, monthlyCreditsCents: event.target.value } : current
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
                      current ? { ...current, storageLimitBytes: event.target.value } : current
                    )
                  }
                />
              </label>
              <label className={styles.manualAdjustField}>
                <span className="tiny subdued">Stripe price id</span>
                <input
                  className={styles.searchInput}
                  value={planDraft.stripePriceId}
                  onChange={(event) =>
                    setPlanDraft((current) =>
                      current ? { ...current, stripePriceId: event.target.value } : current
                    )
                  }
                />
              </label>
            </div>
            <p className="tiny subdued">
              This creates a new current public offer for new buyers. Existing subscriber contracts
              remain unchanged.
            </p>
            <div className={styles.pricingEditorActions}>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => void createPlanOffer()}
                disabled={planSaving}
              >
                {planSaving ? "Creating…" : "Create and activate"}
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
                  <small>{pkg.id}</small>
                </span>
                <span>{formatCurrencyFromCents(pkg.priceCents)}</span>
                <span>{formatCredits(pkg.creditAmountCents)}</span>
                <span>{formatUsd((pkg.priceCents / 100 / pkg.creditAmountCents) * 1000)}</span>
                <span className={styles.pricingMonoCell}>{pkg.stripePriceId ?? "Missing"}</span>
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
                      current ? { ...current, creditAmountCents: event.target.value } : current
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
                  <small>{addon.storageAddonId}</small>
                </span>
                <span>{formatCurrencyFromCents(addon.recurringPriceCents)}</span>
                <span>{formatStorageBytes(addon.storageLimitBytes)}</span>
                <span className={styles.pricingMonoCell}>{addon.offerId}</span>
                <span className={styles.pricingMonoCell}>{addon.stripePriceId ?? "Missing"}</span>
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

        {storageMessage ? <p className={styles.announcementResult}>{storageMessage}</p> : null}
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
                      current ? { ...current, storageLimitBytes: event.target.value } : current
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
                      current ? { ...current, recurringPriceCents: event.target.value } : current
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
    </AdminRouteShell>
  );
}
