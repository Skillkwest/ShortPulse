import type {
  AudioDraftByModelId,
  AspectDraftByModelId,
  CreditScaleDraftByModelId,
  DurationDraftByModelId,
  MarkupDraftByModelId,
  ModelPricingSortOption,
  ProviderCostDraftByModelId,
  ProviderCostPerSecondDraftByModelId,
  ResolutionDraftByModelId,
  VariantMarkupDraftByVariantKey,
  VariantProviderCostDraftByVariantKey,
  VariantProviderCostPerSecondDraftByVariantKey,
} from "../pricingPageUtils";
import { MODEL_PRICING_SORT_OPTIONS } from "../pricingPageUtils";
import type { PlanEconomicsDraft, UsageMixDraftRow } from "../pricingAnalysis";
import {
  compactAdminPricingCustomRowsDocument,
  getDefaultAdminPricingCustomRowsDocument,
  type AdminPricingCustomRowsDocument,
} from "../../../lib/model-runtime/adminPricingCustomRows";
import {
  compactModelPricingPolicyDocument,
  type ModelPricingPolicyDocument,
} from "../../../lib/model-runtime/pricingPolicy";

const ADMIN_PRICING_WORKSPACE_STORAGE_KEY = "shortpulse.adminPricingWorkspace.v1";
const DEFAULT_MODEL_SORT_OPTION: ModelPricingSortOption = "type";

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem" | "removeItem">;

export type AdminPricingWorkspaceDraftSnapshot = {
  version: 1;
  savedAt: string;
  sourceActivePolicyVersion: number | null;
  modelPolicyDirty: boolean;
  modelPolicyDraft: ModelPricingPolicyDocument | null;
  customRowsDraft: AdminPricingCustomRowsDocument | null;
  durationDrafts: DurationDraftByModelId;
  aspectDrafts: AspectDraftByModelId;
  resolutionDrafts: ResolutionDraftByModelId;
  audioDrafts: AudioDraftByModelId;
  creditScaleDrafts: CreditScaleDraftByModelId;
  markupDrafts: MarkupDraftByModelId;
  variantMarkupDrafts: VariantMarkupDraftByVariantKey;
  providerCostDrafts: ProviderCostDraftByModelId;
  providerCostPerSecondDrafts: ProviderCostPerSecondDraftByModelId;
  variantProviderCostDrafts: VariantProviderCostDraftByVariantKey;
  variantProviderCostPerSecondDrafts: VariantProviderCostPerSecondDraftByVariantKey;
  modelSearchQuery: string;
  modelSortOption: ModelPricingSortOption;
  globalCreditScaleDraft: string;
  globalCreditUsdAmountDraft: string;
  simulatorPlanIds: string[] | null;
  selectedUsagePlanId: string;
  planEconomicsDrafts: Record<string, PlanEconomicsDraft>;
  usageMixRowsByPlanId: Record<string, UsageMixDraftRow[]>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const sanitizeStringRecord = (value: unknown): Record<string, string> => {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, entryValue]) => typeof key === "string" && typeof entryValue === "string"
    )
  ) as Record<string, string>;
};

const sanitizeStringArray = (value: unknown): string[] | null => {
  if (typeof value === "undefined") return null;
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
};

const sanitizeAudioDraftRecord = (value: unknown): AudioDraftByModelId => {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, entryValue]) =>
        typeof key === "string" &&
        (entryValue === "default" || entryValue === "on" || entryValue === "off")
    )
  ) as AudioDraftByModelId;
};

const sanitizePlanEconomicsDraft = (value: unknown): PlanEconomicsDraft | null => {
  if (!isPlainObject(value)) return null;
  const requiredFields = [
    "priceUsd",
    "includedCredits",
    "discountPct",
    "affiliatePct",
    "processorPct",
    "processorFlatUsd",
  ] as const;
  if (!requiredFields.every((field) => typeof value[field] === "string")) return null;
  const draft = value as Record<string, string>;
  return {
    simulatedName: typeof value.simulatedName === "string" ? draft.simulatedName : "",
    priceUsd: draft.priceUsd,
    includedCredits: draft.includedCredits,
    discountPct: draft.discountPct,
    affiliatePct: draft.affiliatePct,
    processorPct: draft.processorPct,
    processorFlatUsd: draft.processorFlatUsd,
  };
};

const sanitizePlanEconomicsDrafts = (value: unknown): Record<string, PlanEconomicsDraft> => {
  if (!isPlainObject(value)) return {};
  const next: Record<string, PlanEconomicsDraft> = {};
  for (const [planId, draft] of Object.entries(value)) {
    const sanitizedDraft = sanitizePlanEconomicsDraft(draft);
    if (sanitizedDraft) next[planId] = sanitizedDraft;
  }
  return next;
};

const sanitizeUsageMixDraftRow = (value: unknown): UsageMixDraftRow | null => {
  if (!isPlainObject(value)) return null;
  const fields = ["id", "modelId", "variantId", "durationSeconds", "runsPerMonth"] as const;
  if (!fields.every((field) => typeof value[field] === "string")) return null;
  const row = value as Record<(typeof fields)[number], string>;
  return {
    id: row.id,
    modelId: row.modelId,
    variantId: row.variantId,
    durationSeconds: row.durationSeconds,
    runsPerMonth: row.runsPerMonth,
  };
};

const sanitizeUsageMixRowsByPlanId = (value: unknown): Record<string, UsageMixDraftRow[]> => {
  if (!isPlainObject(value)) return {};
  const next: Record<string, UsageMixDraftRow[]> = {};
  for (const [planId, rows] of Object.entries(value)) {
    if (!Array.isArray(rows)) continue;
    next[planId] = rows
      .map((row) => sanitizeUsageMixDraftRow(row))
      .filter((row): row is UsageMixDraftRow => Boolean(row));
  }
  return next;
};

const sanitizeModelSortOption = (value: unknown): ModelPricingSortOption =>
  typeof value === "string" && MODEL_PRICING_SORT_OPTIONS.some((option) => option.id === value)
    ? (value as ModelPricingSortOption)
    : DEFAULT_MODEL_SORT_OPTION;

const sanitizeModelPricingPolicyDocument = (value: unknown): ModelPricingPolicyDocument | null => {
  if (!isPlainObject(value)) return null;
  try {
    return compactModelPricingPolicyDocument(value as ModelPricingPolicyDocument);
  } catch {
    return null;
  }
};

const sanitizeAdminPricingCustomRowsDocument = (
  value: unknown
): AdminPricingCustomRowsDocument | null => {
  if (!isPlainObject(value)) return null;
  try {
    return compactAdminPricingCustomRowsDocument(value as AdminPricingCustomRowsDocument);
  } catch {
    return getDefaultAdminPricingCustomRowsDocument();
  }
};

const sanitizeWorkspaceDraftSnapshot = (
  value: unknown
): AdminPricingWorkspaceDraftSnapshot | null => {
  if (!isPlainObject(value)) return null;
  return {
    version: 1,
    savedAt: typeof value.savedAt === "string" ? value.savedAt : new Date(0).toISOString(),
    sourceActivePolicyVersion:
      typeof value.sourceActivePolicyVersion === "number" &&
      Number.isFinite(value.sourceActivePolicyVersion)
        ? value.sourceActivePolicyVersion
        : null,
    modelPolicyDirty: Boolean(value.modelPolicyDirty),
    modelPolicyDraft: sanitizeModelPricingPolicyDocument(value.modelPolicyDraft),
    customRowsDraft: sanitizeAdminPricingCustomRowsDocument(value.customRowsDraft),
    durationDrafts: sanitizeStringRecord(value.durationDrafts),
    aspectDrafts: sanitizeStringRecord(value.aspectDrafts),
    resolutionDrafts: sanitizeStringRecord(value.resolutionDrafts),
    audioDrafts: sanitizeAudioDraftRecord(value.audioDrafts),
    creditScaleDrafts: sanitizeStringRecord(value.creditScaleDrafts),
    markupDrafts: sanitizeStringRecord(value.markupDrafts),
    variantMarkupDrafts: sanitizeStringRecord(value.variantMarkupDrafts),
    providerCostDrafts: sanitizeStringRecord(value.providerCostDrafts),
    providerCostPerSecondDrafts: sanitizeStringRecord(value.providerCostPerSecondDrafts),
    variantProviderCostDrafts: sanitizeStringRecord(value.variantProviderCostDrafts),
    variantProviderCostPerSecondDrafts: sanitizeStringRecord(
      value.variantProviderCostPerSecondDrafts
    ),
    modelSearchQuery: typeof value.modelSearchQuery === "string" ? value.modelSearchQuery : "",
    modelSortOption: sanitizeModelSortOption(value.modelSortOption),
    globalCreditScaleDraft:
      typeof value.globalCreditScaleDraft === "string" ? value.globalCreditScaleDraft : "",
    globalCreditUsdAmountDraft:
      typeof value.globalCreditUsdAmountDraft === "string" ? value.globalCreditUsdAmountDraft : "1",
    simulatorPlanIds: sanitizeStringArray(value.simulatorPlanIds),
    selectedUsagePlanId:
      typeof value.selectedUsagePlanId === "string" ? value.selectedUsagePlanId : "",
    planEconomicsDrafts: sanitizePlanEconomicsDrafts(value.planEconomicsDrafts),
    usageMixRowsByPlanId: sanitizeUsageMixRowsByPlanId(value.usageMixRowsByPlanId),
  };
};

export function readAdminPricingWorkspaceDraftFromStorage(
  storage: StorageReader,
  storageKey = ADMIN_PRICING_WORKSPACE_STORAGE_KEY
): AdminPricingWorkspaceDraftSnapshot | null {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    return sanitizeWorkspaceDraftSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeAdminPricingWorkspaceDraftToStorage(
  storage: StorageWriter,
  snapshot: AdminPricingWorkspaceDraftSnapshot,
  storageKey = ADMIN_PRICING_WORKSPACE_STORAGE_KEY
) {
  storage.setItem(storageKey, JSON.stringify(snapshot));
}

export function clearAdminPricingWorkspaceDraftFromStorage(
  storage: StorageWriter,
  storageKey = ADMIN_PRICING_WORKSPACE_STORAGE_KEY
) {
  storage.removeItem(storageKey);
}

export function readAdminPricingWorkspaceDraft(): AdminPricingWorkspaceDraftSnapshot | null {
  if (typeof window === "undefined") return null;
  return readAdminPricingWorkspaceDraftFromStorage(window.localStorage);
}

export function writeAdminPricingWorkspaceDraft(snapshot: AdminPricingWorkspaceDraftSnapshot) {
  if (typeof window === "undefined") return;
  writeAdminPricingWorkspaceDraftToStorage(window.localStorage, snapshot);
}

export function clearAdminPricingWorkspaceDraft() {
  if (typeof window === "undefined") return;
  clearAdminPricingWorkspaceDraftFromStorage(window.localStorage);
}
