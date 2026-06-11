/**
 * Admin offers controller.
 * Owns dashboard offer loading, draft state, and create/update actions.
 */
import React from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { AdminDashboardOffer, AdminDashboardOfferKind } from "../types";

export const ADMIN_DASHBOARD_OFFER_EYEBROW_MAX_LENGTH = 32;
export const ADMIN_DASHBOARD_OFFER_TITLE_MAX_LENGTH = 72;
export const ADMIN_DASHBOARD_OFFER_DESCRIPTION_MAX_LENGTH = 240;
export const ADMIN_DASHBOARD_OFFER_DISCOUNT_MAX_LENGTH = 64;
export const ADMIN_DASHBOARD_OFFER_TARGET_MAX_LENGTH = 80;
export const ADMIN_DASHBOARD_OFFER_CTA_LABEL_MAX_LENGTH = 40;
export const ADMIN_DASHBOARD_OFFER_SLOT_COUNT = 4;

export type AdminDashboardOfferDraft = {
  id: string | null;
  eyebrow: string;
  title: string;
  description: string;
  offerKind: AdminDashboardOfferKind;
  discountLabel: string;
  targetLabel: string;
  ctaLabel: string;
  ctaHref: string;
  displayOrder: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

type UseAdminOffersControllerParams = {
  enabled: boolean;
};

type UseAdminOffersControllerResult = {
  offers: AdminDashboardOffer[];
  drafts: AdminDashboardOfferDraft[];
  loading: boolean;
  savingSlotIndex: number | null;
  savingAll: boolean;
  hasUnsavedChanges: boolean;
  result: string | null;
  error: string | null;
  updateDraft: (slotIndex: number, patch: Partial<AdminDashboardOfferDraft>) => void;
  loadOffers: () => Promise<void>;
  saveOfferSlot: (slotIndex: number) => Promise<void>;
  saveAllOffers: () => Promise<void>;
};

const emptyDraft = (slotIndex = 0): AdminDashboardOfferDraft => ({
  id: null,
  eyebrow: `Offer ${slotIndex + 1}`,
  title: "",
  description: "",
  offerKind: "custom",
  discountLabel: "",
  targetLabel: "",
  ctaLabel: "View offer",
  ctaHref: "/pricing",
  displayOrder: String(slotIndex + 1),
  isActive: true,
  startsAt: "",
  endsAt: "",
});

const buildEmptyDrafts = (): AdminDashboardOfferDraft[] =>
  Array.from({ length: ADMIN_DASHBOARD_OFFER_SLOT_COUNT }, (_value, index) => emptyDraft(index));

const asAdminDashboardOffer = (value: unknown): AdminDashboardOffer | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const offerKind =
    typeof row.offerKind === "string" ? (row.offerKind as AdminDashboardOfferKind) : "custom";
  if (!id || !title) return null;
  return {
    id,
    eyebrow: typeof row.eyebrow === "string" ? row.eyebrow : "Offer",
    title,
    description: typeof row.description === "string" ? row.description : "",
    offerKind,
    discountLabel: typeof row.discountLabel === "string" ? row.discountLabel : "",
    targetLabel: typeof row.targetLabel === "string" ? row.targetLabel : "",
    ctaLabel: typeof row.ctaLabel === "string" ? row.ctaLabel : "View offer",
    ctaHref: typeof row.ctaHref === "string" ? row.ctaHref : "/pricing",
    displayOrder: typeof row.displayOrder === "number" ? row.displayOrder : 0,
    isActive: row.isActive === true,
    startsAt: typeof row.startsAt === "string" ? row.startsAt : null,
    endsAt: typeof row.endsAt === "string" ? row.endsAt : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
  };
};

const dateTimeLocalValue = (value: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
};

const draftFromOffer = (offer: AdminDashboardOffer): AdminDashboardOfferDraft => ({
  id: offer.id,
  eyebrow: offer.eyebrow,
  title: offer.title,
  description: offer.description,
  offerKind: offer.offerKind,
  discountLabel: offer.discountLabel,
  targetLabel: offer.targetLabel,
  ctaLabel: offer.ctaLabel,
  ctaHref: offer.ctaHref,
  displayOrder: String(offer.displayOrder),
  isActive: offer.isActive,
  startsAt: dateTimeLocalValue(offer.startsAt),
  endsAt: dateTimeLocalValue(offer.endsAt),
});

const comparableDraft = (draft: AdminDashboardOfferDraft, slotIndex: number) => ({
  id: draft.id,
  eyebrow: draft.eyebrow.trim() || `Offer ${slotIndex + 1}`,
  title: draft.title.trim(),
  description: draft.description.trim(),
  offerKind: draft.offerKind,
  discountLabel: draft.discountLabel.trim(),
  targetLabel: draft.targetLabel.trim(),
  ctaLabel: draft.ctaLabel.trim() || "View offer",
  ctaHref: draft.ctaHref.trim() || "/pricing",
  displayOrder: String(slotIndex + 1),
  isActive: draft.isActive,
  startsAt: draft.startsAt,
  endsAt: draft.endsAt,
});

const areDraftsEquivalent = (
  current: AdminDashboardOfferDraft,
  loaded: AdminDashboardOfferDraft,
  slotIndex: number
): boolean =>
  JSON.stringify(comparableDraft(current, slotIndex)) ===
  JSON.stringify(comparableDraft(loaded, slotIndex));

type OfferSavePayload = {
  id: string | null;
  eyebrow: string;
  title: string;
  description: string;
  offerKind: AdminDashboardOfferKind;
  discountLabel: string;
  targetLabel: string;
  ctaLabel: string;
  ctaHref: string;
  displayOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const buildOfferSavePayload = (
  draft: AdminDashboardOfferDraft,
  slotIndex: number
): { payload: OfferSavePayload | null; error: string | null } => {
  const title = draft.title.trim();
  const eyebrow = draft.eyebrow.trim() || `Offer ${slotIndex + 1}`;
  const ctaLabel = draft.ctaLabel.trim() || "View offer";
  const ctaHref = draft.ctaHref.trim() || "/pricing";

  if (!title) {
    return { payload: null, error: `Offer ${slotIndex + 1} title is required.` };
  }
  if (!ctaHref.startsWith("/") || ctaHref.startsWith("//")) {
    return { payload: null, error: `Offer ${slotIndex + 1} CTA href must be an internal path.` };
  }

  return {
    payload: {
      id: draft.id,
      eyebrow,
      title,
      description: draft.description.trim(),
      offerKind: draft.offerKind,
      discountLabel: draft.discountLabel.trim(),
      targetLabel: draft.targetLabel.trim(),
      ctaLabel,
      ctaHref,
      displayOrder: slotIndex + 1,
      isActive: draft.isActive,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
    },
    error: null,
  };
};

/**
 * Composes admin offer catalog state and persistence actions.
 */
export const useAdminOffersController = ({
  enabled,
}: UseAdminOffersControllerParams): UseAdminOffersControllerResult => {
  const [offers, setOffers] = React.useState<AdminDashboardOffer[]>([]);
  const [drafts, setDrafts] = React.useState<AdminDashboardOfferDraft[]>(() => buildEmptyDrafts());
  const [loadedDrafts, setLoadedDrafts] = React.useState<AdminDashboardOfferDraft[]>(() =>
    buildEmptyDrafts()
  );
  const [loading, setLoading] = React.useState(false);
  const [savingSlotIndex, setSavingSlotIndex] = React.useState<number | null>(null);
  const [savingAll, setSavingAll] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const hydrateDrafts = React.useCallback((nextOffers: AdminDashboardOffer[]) => {
    const nextDrafts = buildEmptyDrafts();
    nextOffers.slice(0, ADMIN_DASHBOARD_OFFER_SLOT_COUNT).forEach((offer, index) => {
      nextDrafts[index] = {
        ...draftFromOffer(offer),
        eyebrow: offer.eyebrow || `Offer ${index + 1}`,
        displayOrder: String(index + 1),
      };
    });
    setDrafts(nextDrafts);
    setLoadedDrafts(nextDrafts);
  }, []);

  const loadOffers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetchWithAuth("/api/admin/offers", {
        method: "GET",
      });
      const data = (await response.json().catch(() => ({}))) as {
        offers?: unknown[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Failed to load offers.");
      }
      setOffers(
        (Array.isArray(data.offers) ? data.offers : [])
          .map(asAdminDashboardOffer)
          .filter((offer): offer is AdminDashboardOffer => offer !== null)
      );
      hydrateDrafts(
        (Array.isArray(data.offers) ? data.offers : [])
          .map(asAdminDashboardOffer)
          .filter((offer): offer is AdminDashboardOffer => offer !== null)
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load offers.");
      setOffers([]);
      hydrateDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [hydrateDrafts]);

  React.useEffect(() => {
    if (!enabled) return;
    void loadOffers();
  }, [enabled, loadOffers]);

  const updateDraft = React.useCallback(
    (slotIndex: number, patch: Partial<AdminDashboardOfferDraft>) => {
      setDrafts((current) =>
        current.map((draft, index) => (index === slotIndex ? { ...draft, ...patch } : draft))
      );
      setError(null);
      setResult(null);
    },
    []
  );

  const dirtySlotIndexes = React.useMemo(
    () =>
      drafts
        .slice(0, ADMIN_DASHBOARD_OFFER_SLOT_COUNT)
        .flatMap((draft, index) =>
          areDraftsEquivalent(draft, loadedDrafts[index] ?? emptyDraft(index), index) ? [] : [index]
        ),
    [drafts, loadedDrafts]
  );

  const persistOfferPayload = React.useCallback(
    async (payload: OfferSavePayload): Promise<AdminDashboardOffer> => {
      const response = await fetchWithAuth("/api/admin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        offer?: unknown;
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Failed to save offer.");
      }
      const savedOffer = asAdminDashboardOffer(data.offer ?? null);
      if (!savedOffer) {
        throw new Error("Saved offer payload is invalid.");
      }
      return savedOffer;
    },
    []
  );

  const saveOfferSlot = React.useCallback(
    async (slotIndex: number) => {
      const draft = drafts[slotIndex] ?? emptyDraft(slotIndex);
      const validation = buildOfferSavePayload(draft, slotIndex);
      if (validation.error || !validation.payload) {
        setError(validation.error ?? "Offer is invalid.");
        setResult(null);
        return;
      }

      setSavingSlotIndex(slotIndex);
      setError(null);
      setResult(null);
      try {
        const savedOffer = await persistOfferPayload(validation.payload);
        await loadOffers();
        setResult(savedOffer.isActive ? "Offer saved and active." : "Offer saved as inactive.");
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Failed to save offer.");
        setResult(null);
      } finally {
        setSavingSlotIndex(null);
      }
    },
    [drafts, loadOffers, persistOfferPayload]
  );

  const saveAllOffers = React.useCallback(async () => {
    if (!dirtySlotIndexes.length) {
      setError(null);
      setResult("No offer changes to save.");
      return;
    }

    const payloads = dirtySlotIndexes.map((slotIndex) => {
      const validation = buildOfferSavePayload(
        drafts[slotIndex] ?? emptyDraft(slotIndex),
        slotIndex
      );
      return { slotIndex, ...validation };
    });
    const invalidPayload = payloads.find((payload) => payload.error || !payload.payload);
    if (invalidPayload) {
      setError(invalidPayload?.error ?? "Offer changes are invalid.");
      setResult(null);
      return;
    }

    setSavingAll(true);
    setError(null);
    setResult(null);
    try {
      for (const payload of payloads) {
        if (!payload.payload) continue;
        setSavingSlotIndex(payload.slotIndex);
        await persistOfferPayload(payload.payload);
      }
      await loadOffers();
      const savedCount = payloads.length;
      setResult(`${savedCount} offer${savedCount === 1 ? "" : "s"} saved.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to save offers.");
      setResult(null);
    } finally {
      setSavingSlotIndex(null);
      setSavingAll(false);
    }
  }, [dirtySlotIndexes, drafts, loadOffers, persistOfferPayload]);

  return {
    offers,
    drafts,
    loading,
    savingSlotIndex,
    savingAll,
    hasUnsavedChanges: dirtySlotIndexes.length > 0,
    result,
    error,
    updateDraft,
    loadOffers,
    saveOfferSlot,
    saveAllOffers,
  };
};
