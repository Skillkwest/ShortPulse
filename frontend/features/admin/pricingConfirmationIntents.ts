/**
 * Builds admin pricing confirmation dialogs and mirrors route-level draft validation.
 */
import { formatStorageBytes } from "../billing/storage";
import type { PricingConfirmationIntent } from "./PricingPageChrome";
import type {
  AdminPricingCreditPackageRow,
  AdminPricingPlanRow,
  AdminPricingStorageAddonRow,
} from "./types";
import {
  formatCredits,
  formatCurrencyFromCents,
  parseIntegerInput,
  type CreditPackageDraft,
  type PlanCreateDraft,
  type PlanOfferDraft,
  type StorageOfferDraft,
} from "./pricingPageUtils";

const PLAN_ID_PATTERN = /^[a-z0-9_]+$/;

const isBlank = (value: string): boolean => value.trim() === "";

const requiresPlanStripePrice = (planId: string, recurringPriceCents: number | null): boolean =>
  planId.trim().toLowerCase() !== "free" && recurringPriceCents != null && recurringPriceCents > 0;

const isInvalidPublicPlanPrice = (planId: string, priceCents: number | null): boolean =>
  priceCents == null || (planId.trim().toLowerCase() !== "free" && priceCents <= 0);

const formatMaybeCurrency = (value: number | null): string =>
  value == null ? "invalid" : formatCurrencyFromCents(value);

export const buildPlanOfferConfirmationIntent = ({
  planOfferDraft,
  plan,
  onConfirm,
}: {
  planOfferDraft: PlanOfferDraft;
  plan: AdminPricingPlanRow | undefined;
  onConfirm: () => void;
}): PricingConfirmationIntent => {
  const currentOffer =
    planOfferDraft.billingInterval === "year" ? plan?.annualOffer : plan?.monthlyOffer;
  const draftPrice = parseIntegerInput(planOfferDraft.recurringPriceCents);
  const draftCredits = parseIntegerInput(planOfferDraft.monthlyCreditsCents);
  const draftStorageBytes = parseIntegerInput(planOfferDraft.storageLimitBytes);
  const stripePriceId = planOfferDraft.stripePriceId.trim();
  const planId = planOfferDraft.planId.trim().toLowerCase();
  const hasInvalidDraft =
    isBlank(planId) ||
    isBlank(planOfferDraft.offerName) ||
    isInvalidPublicPlanPrice(planId, draftPrice) ||
    draftCredits == null ||
    draftCredits < 0 ||
    draftStorageBytes == null ||
    draftStorageBytes < 0 ||
    (requiresPlanStripePrice(planId, draftPrice) && !stripePriceId);

  return {
    title: `${currentOffer ? "Update" : "Create"} ${
      planOfferDraft.billingInterval === "year" ? "annual" : "monthly"
    } plan offer`,
    description:
      "This activates the public acquisition offer for new buyers. Existing subscriber contracts keep their locked pricing.",
    confirmLabel: "Activate offer",
    hasInvalidDraft,
    rows: [
      {
        label: "Current offer",
        before: currentOffer?.offerId ?? "none",
        after: planOfferDraft.offerName.trim() || "invalid",
      },
      {
        label: "Recurring price",
        before: currentOffer ? formatCurrencyFromCents(currentOffer.recurringPriceCents) : "none",
        after: formatMaybeCurrency(draftPrice),
      },
      {
        label: "Monthly credits",
        before: currentOffer ? formatCredits(currentOffer.monthlyCreditsCents) : "none",
        after: draftCredits == null || draftCredits < 0 ? "invalid" : formatCredits(draftCredits),
      },
      {
        label: "Storage",
        before: currentOffer ? formatStorageBytes(currentOffer.storageLimitBytes) : "none",
        after:
          draftStorageBytes == null || draftStorageBytes < 0
            ? "invalid"
            : formatStorageBytes(draftStorageBytes),
      },
      {
        label: "Stripe price",
        before: currentOffer?.stripePriceId ?? "none",
        after:
          requiresPlanStripePrice(planId, draftPrice) && !stripePriceId
            ? "invalid"
            : stripePriceId || "none",
      },
    ],
    onConfirm,
  };
};

export const buildPlanCreateConfirmationIntent = ({
  planDraft,
  onConfirm,
}: {
  planDraft: PlanCreateDraft;
  onConfirm: () => void;
}): PricingConfirmationIntent => {
  const planId = planDraft.planId.trim().toLowerCase();
  const draftPrice = parseIntegerInput(planDraft.recurringPriceCents);
  const draftAnnualPrice = parseIntegerInput(planDraft.annualRecurringPriceCents);
  const draftCredits = parseIntegerInput(planDraft.monthlyCreditsCents);
  const draftStorageBytes = parseIntegerInput(planDraft.storageLimitBytes);
  const draftSortOrder = parseIntegerInput(planDraft.sortOrder);
  const hasInvalidDraft =
    !PLAN_ID_PATTERN.test(planId) ||
    isBlank(planDraft.displayName) ||
    isInvalidPublicPlanPrice(planId, draftPrice) ||
    isInvalidPublicPlanPrice(planId, draftAnnualPrice) ||
    draftCredits == null ||
    draftCredits < 0 ||
    draftStorageBytes == null ||
    draftStorageBytes < 0 ||
    draftSortOrder == null ||
    draftSortOrder < 0;

  return {
    title: "Create public plan",
    description:
      "This creates an active plan, its first monthly and annual public offers, and Stripe product/price records.",
    confirmLabel: "Create plan",
    hasInvalidDraft,
    rows: [
      {
        label: "Plan",
        before: "none",
        after: planDraft.displayName.trim() || planDraft.planId.trim() || "invalid",
      },
      {
        label: "Monthly price",
        before: "none",
        after: formatMaybeCurrency(draftPrice),
      },
      {
        label: "Annual price",
        before: "none",
        after: formatMaybeCurrency(draftAnnualPrice),
      },
      {
        label: "Monthly credits",
        before: "none",
        after: draftCredits == null || draftCredits < 0 ? "invalid" : formatCredits(draftCredits),
      },
      {
        label: "Storage",
        before: "none",
        after:
          draftStorageBytes == null || draftStorageBytes < 0
            ? "invalid"
            : formatStorageBytes(draftStorageBytes),
      },
      {
        label: "Sort order",
        before: "none",
        after:
          draftSortOrder == null || draftSortOrder < 0 ? "invalid" : formatCredits(draftSortOrder),
      },
    ],
    onConfirm,
  };
};

export const buildCreditPackageConfirmationIntent = ({
  creditDraft,
  currentPackage,
  onConfirm,
}: {
  creditDraft: CreditPackageDraft;
  currentPackage: AdminPricingCreditPackageRow | undefined;
  onConfirm: () => void;
}): PricingConfirmationIntent => {
  const draftPrice = parseIntegerInput(creditDraft.priceCents);
  const draftCredits = parseIntegerInput(creditDraft.creditAmountCents);
  const draftSortOrder = parseIntegerInput(creditDraft.sortOrder);
  const stripePriceId = creditDraft.stripePriceId.trim();
  const hasInvalidDraft =
    isBlank(creditDraft.id) ||
    isBlank(creditDraft.displayName) ||
    draftPrice == null ||
    draftPrice <= 0 ||
    draftCredits == null ||
    draftCredits <= 0 ||
    draftSortOrder == null ||
    draftSortOrder < 0 ||
    (creditDraft.isActive && !stripePriceId);

  return {
    title: "Update credit package",
    description:
      "This updates the public credit top-up package and its checkout linkage for new purchases.",
    confirmLabel: "Save package",
    hasInvalidDraft,
    rows: [
      {
        label: "Price",
        before: currentPackage ? formatCurrencyFromCents(currentPackage.priceCents) : "none",
        after:
          draftPrice == null || draftPrice <= 0 ? "invalid" : formatCurrencyFromCents(draftPrice),
      },
      {
        label: "Credits granted",
        before: currentPackage ? formatCredits(currentPackage.creditAmountCents) : "none",
        after: draftCredits == null || draftCredits <= 0 ? "invalid" : formatCredits(draftCredits),
      },
      {
        label: "Stripe price",
        before: currentPackage?.stripePriceId ?? "none",
        after: creditDraft.isActive && !stripePriceId ? "invalid" : stripePriceId || "none",
      },
      {
        label: "Status",
        before: currentPackage?.isActive ? "active" : "inactive",
        after: creditDraft.isActive ? "active" : "inactive",
      },
      {
        label: "Sort order",
        before: currentPackage ? formatCredits(currentPackage.sortOrder) : "none",
        after:
          draftSortOrder == null || draftSortOrder < 0 ? "invalid" : formatCredits(draftSortOrder),
      },
    ],
    onConfirm,
  };
};

export const buildStorageOfferConfirmationIntent = ({
  storageDraft,
  currentOffer,
  onConfirm,
}: {
  storageDraft: StorageOfferDraft;
  currentOffer: AdminPricingStorageAddonRow | undefined;
  onConfirm: () => void;
}): PricingConfirmationIntent => {
  const draftPrice = parseIntegerInput(storageDraft.recurringPriceCents);
  const draftStorageBytes = parseIntegerInput(storageDraft.storageLimitBytes);
  const stripePriceId = storageDraft.stripePriceId.trim();
  const hasInvalidDraft =
    isBlank(storageDraft.storageAddonId) ||
    isBlank(storageDraft.offerName) ||
    draftPrice == null ||
    draftPrice <= 0 ||
    draftStorageBytes == null ||
    draftStorageBytes <= 0 ||
    !stripePriceId;

  return {
    title: "Create storage add-on offer",
    description: "This activates a new current public recurring storage offer for new buyers only.",
    confirmLabel: "Create and activate",
    hasInvalidDraft,
    rows: [
      {
        label: "Current offer",
        before: currentOffer?.offerId ?? "none",
        after: storageDraft.offerName.trim() || "invalid",
      },
      {
        label: "Monthly price",
        before: currentOffer ? formatCurrencyFromCents(currentOffer.recurringPriceCents) : "none",
        after:
          draftPrice == null || draftPrice <= 0 ? "invalid" : formatCurrencyFromCents(draftPrice),
      },
      {
        label: "Storage",
        before: currentOffer ? formatStorageBytes(currentOffer.storageLimitBytes) : "none",
        after:
          draftStorageBytes == null || draftStorageBytes <= 0
            ? "invalid"
            : formatStorageBytes(draftStorageBytes),
      },
      {
        label: "Stripe price",
        before: currentOffer?.stripePriceId ?? "none",
        after: stripePriceId || "invalid",
      },
    ],
    onConfirm,
  };
};
