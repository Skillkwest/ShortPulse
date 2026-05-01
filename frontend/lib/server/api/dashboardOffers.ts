/**
 * Server helpers for admin-managed dashboard offers.
 * Normalizes offer payloads and centralizes public/admin offer reads and writes.
 */
import type { getSupabaseAdmin } from "./supabaseAdmin";

export const DASHBOARD_OFFER_EYEBROW_MAX_LENGTH = 32;
export const DASHBOARD_OFFER_TITLE_MAX_LENGTH = 72;
export const DASHBOARD_OFFER_DESCRIPTION_MAX_LENGTH = 240;
export const DASHBOARD_OFFER_DISCOUNT_MAX_LENGTH = 64;
export const DASHBOARD_OFFER_TARGET_MAX_LENGTH = 80;
export const DASHBOARD_OFFER_CTA_LABEL_MAX_LENGTH = 40;
export const DASHBOARD_OFFER_CTA_HREF_MAX_LENGTH = 200;
export const DASHBOARD_OFFER_PUBLIC_LIMIT = 4;

export const DASHBOARD_OFFER_KINDS = [
  "model_pricing",
  "plan",
  "credit_package",
  "storage_addon",
  "custom",
] as const;

export type DashboardOfferKind = (typeof DASHBOARD_OFFER_KINDS)[number];

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type RawDashboardOffer = {
  id?: unknown;
  eyebrow?: unknown;
  title?: unknown;
  description?: unknown;
  offer_kind?: unknown;
  discount_label?: unknown;
  target_label?: unknown;
  cta_label?: unknown;
  cta_href?: unknown;
  display_order?: unknown;
  is_active?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

export type DashboardOffer = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  offerKind: DashboardOfferKind;
  discountLabel: string;
  targetLabel: string;
  ctaLabel: string;
  ctaHref: string;
  displayOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DashboardOfferInputValidation = {
  offer: Omit<DashboardOffer, "id" | "createdAt" | "updatedAt">;
  error: string | null;
};

const asTrimmed = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const isDashboardOfferKind = (value: string): value is DashboardOfferKind =>
  DASHBOARD_OFFER_KINDS.includes(value as DashboardOfferKind);

const normalizeOptionalDate = (value: unknown): string | null => {
  const text = asTrimmed(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "invalid";
  return date.toISOString();
};

const toDashboardOffer = (value: unknown): DashboardOffer | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as RawDashboardOffer;
  const id = typeof row.id === "string" ? row.id : "";
  const title = asTrimmed(row.title);
  const offerKindRaw = asTrimmed(row.offer_kind);
  if (!id || !title || !isDashboardOfferKind(offerKindRaw)) return null;

  return {
    id,
    eyebrow: asTrimmed(row.eyebrow) || "Offer",
    title,
    description: asTrimmed(row.description),
    offerKind: offerKindRaw,
    discountLabel: asTrimmed(row.discount_label),
    targetLabel: asTrimmed(row.target_label),
    ctaLabel: asTrimmed(row.cta_label) || "View offer",
    ctaHref: asTrimmed(row.cta_href) || "/pricing",
    displayOrder: typeof row.display_order === "number" ? row.display_order : 0,
    isActive: row.is_active === true,
    startsAt: typeof row.starts_at === "string" ? row.starts_at : null,
    endsAt: typeof row.ends_at === "string" ? row.ends_at : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
};

/**
 * Validates and normalizes one admin offer payload.
 */
export const normalizeDashboardOfferInput = (body: unknown): DashboardOfferInputValidation => {
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const eyebrow = asTrimmed(payload.eyebrow) || "Offer";
  const title = asTrimmed(payload.title);
  const description = asTrimmed(payload.description);
  const offerKindRaw = asTrimmed(payload.offerKind || payload.offer_kind) || "custom";
  const discountLabel = asTrimmed(payload.discountLabel || payload.discount_label);
  const targetLabel = asTrimmed(payload.targetLabel || payload.target_label);
  const ctaLabel = asTrimmed(payload.ctaLabel || payload.cta_label) || "View offer";
  const ctaHref = asTrimmed(payload.ctaHref || payload.cta_href) || "/pricing";
  const displayOrderRaw = Number(payload.displayOrder ?? payload.display_order ?? 0);
  const displayOrder = Number.isFinite(displayOrderRaw) ? Math.trunc(displayOrderRaw) : 0;
  const isActive = payload.isActive ?? payload.is_active;
  const startsAt = normalizeOptionalDate(payload.startsAt ?? payload.starts_at);
  const endsAt = normalizeOptionalDate(payload.endsAt ?? payload.ends_at);

  if (!title) {
    return { offer: emptyNormalizedOffer(), error: "Title is required." };
  }
  if (eyebrow.length > DASHBOARD_OFFER_EYEBROW_MAX_LENGTH) {
    return { offer: emptyNormalizedOffer(), error: "Eyebrow is too long." };
  }
  if (title.length > DASHBOARD_OFFER_TITLE_MAX_LENGTH) {
    return { offer: emptyNormalizedOffer(), error: "Title is too long." };
  }
  if (description.length > DASHBOARD_OFFER_DESCRIPTION_MAX_LENGTH) {
    return { offer: emptyNormalizedOffer(), error: "Description is too long." };
  }
  if (!isDashboardOfferKind(offerKindRaw)) {
    return { offer: emptyNormalizedOffer(), error: "Offer type is invalid." };
  }
  if (discountLabel.length > DASHBOARD_OFFER_DISCOUNT_MAX_LENGTH) {
    return { offer: emptyNormalizedOffer(), error: "Discount label is too long." };
  }
  if (targetLabel.length > DASHBOARD_OFFER_TARGET_MAX_LENGTH) {
    return { offer: emptyNormalizedOffer(), error: "Target label is too long." };
  }
  if (!ctaLabel || ctaLabel.length > DASHBOARD_OFFER_CTA_LABEL_MAX_LENGTH) {
    return { offer: emptyNormalizedOffer(), error: "CTA label is invalid." };
  }
  if (
    !ctaHref ||
    ctaHref.length > DASHBOARD_OFFER_CTA_HREF_MAX_LENGTH ||
    !ctaHref.startsWith("/") ||
    ctaHref.startsWith("//")
  ) {
    return { offer: emptyNormalizedOffer(), error: "CTA href must be an internal path." };
  }
  if (startsAt === "invalid" || endsAt === "invalid") {
    return { offer: emptyNormalizedOffer(), error: "Offer dates must be valid dates." };
  }
  if (startsAt && endsAt && new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
    return { offer: emptyNormalizedOffer(), error: "Start date must be before end date." };
  }

  return {
    offer: {
      eyebrow,
      title,
      description,
      offerKind: offerKindRaw,
      discountLabel,
      targetLabel,
      ctaLabel,
      ctaHref,
      displayOrder,
      isActive: typeof isActive === "boolean" ? isActive : true,
      startsAt,
      endsAt,
    },
    error: null,
  };
};

const emptyNormalizedOffer = (): Omit<DashboardOffer, "id" | "createdAt" | "updatedAt"> => ({
  eyebrow: "Offer",
  title: "",
  description: "",
  offerKind: "custom",
  discountLabel: "",
  targetLabel: "",
  ctaLabel: "View offer",
  ctaHref: "/pricing",
  displayOrder: 0,
  isActive: true,
  startsAt: null,
  endsAt: null,
});

const OFFER_SELECT =
  "id, eyebrow, title, description, offer_kind, discount_label, target_label, cta_label, cta_href, display_order, is_active, starts_at, ends_at, created_at, updated_at";

/**
 * Reads active public dashboard offers, capped to the guest dashboard capacity.
 */
export const readActiveDashboardOffers = async (
  supabaseAdmin: SupabaseAdminClient,
  limit = DASHBOARD_OFFER_PUBLIC_LIMIT
): Promise<DashboardOffer[]> => {
  const { data, error } = await supabaseAdmin
    .from("dashboard_offers")
    .select(OFFER_SELECT)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(Math.max(limit, 100));

  if (error) {
    throw new Error(error.message || "Failed to load dashboard offers.");
  }

  const nowMs = Date.now();
  return (Array.isArray(data) ? data : [])
    .map(toDashboardOffer)
    .filter((offer): offer is DashboardOffer => {
      if (!offer) return false;
      const startsAtMs = offer.startsAt ? new Date(offer.startsAt).getTime() : null;
      const endsAtMs = offer.endsAt ? new Date(offer.endsAt).getTime() : null;
      return (startsAtMs == null || startsAtMs <= nowMs) && (endsAtMs == null || endsAtMs > nowMs);
    })
    .slice(0, limit);
};

/**
 * Reads the admin offer catalog.
 */
export const readAdminDashboardOffers = async (
  supabaseAdmin: SupabaseAdminClient
): Promise<DashboardOffer[]> => {
  const { data, error } = await supabaseAdmin
    .from("dashboard_offers")
    .select(OFFER_SELECT)
    .order("display_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message || "Failed to load dashboard offers.");
  }

  return (Array.isArray(data) ? data : [])
    .map(toDashboardOffer)
    .filter((offer): offer is DashboardOffer => offer !== null);
};

/**
 * Creates or updates a dashboard offer from an admin request.
 */
export const saveDashboardOffer = async (
  supabaseAdmin: SupabaseAdminClient,
  args: {
    id?: string | null;
    offer: Omit<DashboardOffer, "id" | "createdAt" | "updatedAt">;
    actorUserId: string | null;
  }
): Promise<DashboardOffer> => {
  const row = {
    eyebrow: args.offer.eyebrow,
    title: args.offer.title,
    description: args.offer.description,
    offer_kind: args.offer.offerKind,
    discount_label: args.offer.discountLabel,
    target_label: args.offer.targetLabel,
    cta_label: args.offer.ctaLabel,
    cta_href: args.offer.ctaHref,
    display_order: args.offer.displayOrder,
    is_active: args.offer.isActive,
    starts_at: args.offer.startsAt,
    ends_at: args.offer.endsAt,
    updated_by: args.actorUserId,
  };

  const result = args.id
    ? await supabaseAdmin
        .from("dashboard_offers")
        .update(row)
        .eq("id", args.id)
        .select(OFFER_SELECT)
        .maybeSingle()
    : await supabaseAdmin
        .from("dashboard_offers")
        .insert({ ...row, created_by: args.actorUserId })
        .select(OFFER_SELECT)
        .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message || "Failed to save dashboard offer.");
  }

  const offer = toDashboardOffer(result.data);
  if (!offer) {
    throw new Error("Saved dashboard offer payload is invalid.");
  }
  return offer;
};
