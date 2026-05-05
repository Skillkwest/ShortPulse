import React from "react";
import type { PricingConfirmationIntent } from "../PricingPageChrome";
import {
  buildCreditPackageConfirmationIntent,
  buildPlanCreateConfirmationIntent,
  buildPlanOfferConfirmationIntent,
  buildStorageOfferConfirmationIntent,
} from "../pricingConfirmationIntents";
import type { AdminPricingStateResponse } from "../types";
import type {
  CreditPackageDraft,
  PlanCreateDraft,
  PlanOfferDraft,
  StorageOfferDraft,
} from "../pricingPageUtils";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

type UseAdminPricingCatalogStateParams = {
  pricingState: AdminPricingStateResponse | null;
  refreshPricingState: () => Promise<unknown>;
  setPendingConfirmation: React.Dispatch<React.SetStateAction<PricingConfirmationIntent | null>>;
};

export function useAdminPricingCatalogState({
  pricingState,
  refreshPricingState,
  setPendingConfirmation,
}: UseAdminPricingCatalogStateParams) {
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
      if (!response.ok) throw new Error(payload.error || "Failed to update the credit package.");
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
      if (!response.ok) throw new Error(payload.error || "Failed to create the plan.");
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
      if (!response.ok) throw new Error(payload.error || "Failed to save the plan pricing.");
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
  }, [planOfferDraft, pricingState?.plans, savePlanOffer, setPendingConfirmation]);

  const openPlanCreateConfirmation = React.useCallback(() => {
    if (!planDraft) return;
    setPendingConfirmation(
      buildPlanCreateConfirmationIntent({
        planDraft,
        onConfirm: () => void createPlan(),
      })
    );
  }, [createPlan, planDraft, setPendingConfirmation]);

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
  }, [creditDraft, pricingState?.creditPackages, saveCreditPackage, setPendingConfirmation]);

  const openStorageOfferConfirmation = React.useCallback(() => {
    if (!storageDraft) return;
    const currentStorageRow = pricingState?.storageAddons.find(
      (row) => row.storageAddonId === storageDraft.storageAddonId
    );
    const currentOffer = currentStorageRow?.offerId ? currentStorageRow : undefined;
    setPendingConfirmation(
      buildStorageOfferConfirmationIntent({
        storageDraft,
        currentOffer,
        onConfirm: () => void createStorageOffer(),
      })
    );
  }, [createStorageOffer, pricingState?.storageAddons, setPendingConfirmation, storageDraft]);

  return {
    creditDraft,
    setCreditDraft,
    creditSaving,
    creditMessage,
    setCreditMessage,
    creditError,
    setCreditError,
    planDraft,
    setPlanDraft,
    planOfferDraft,
    setPlanOfferDraft,
    planSaving,
    planMessage,
    setPlanMessage,
    planError,
    setPlanError,
    storageDraft,
    setStorageDraft,
    storageSaving,
    storageMessage,
    setStorageMessage,
    storageError,
    setStorageError,
    openPlanCreateConfirmation,
    openPlanOfferConfirmation,
    openCreditPackageConfirmation,
    openStorageOfferConfirmation,
  };
}
