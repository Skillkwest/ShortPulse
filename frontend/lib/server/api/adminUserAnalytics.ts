/**
 * Server-side selected-account analytics composer for the admin support console.
 * It keeps the list API lightweight and centralizes source labels for deep account stats.
 */
import type { AdminUserAnalyticsResponse } from "../../../features/admin/types";
import { isSchemaCompatibilityError } from "../adminUserHealth/deep";
import { loadAdminHealthSnapshot } from "../adminUserHealth/snapshot";
import { resolveAdminBillingDiagnostics } from "./adminBillingDiagnostics";
import { fetchAdminUserCycleSpend } from "./adminUserCycleSpend";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { stripeGet } from "./stripe";
import type { StripeInvoiceResponse, StripeInvoiceListResponse } from "./stripeTransactions";

type SourceNote = AdminUserAnalyticsResponse["sourceHealth"][number];

type GenerationAnalyticsRow = {
  id: string;
  status: string | null;
  mode?: string | null;
  model_id: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string | null;
};

type CreditGrantSummaryRow = {
  user_id: string;
  available_cents: number | string | null;
  reserved_cents: number | string | null;
  spendable_cents: number | string | null;
  expiring_cents: number | string | null;
  non_expiring_cents: number | string | null;
  next_expiring_cents: number | string | null;
  next_expires_at: string | null;
};

type TopUpLedgerRow = {
  change_cents: number | string | null;
  metadata: Record<string, unknown> | null;
};

type CreditPackageRow = {
  id: string;
  price_cents: number | string | null;
};

type StripeInvoicePage = StripeInvoiceListResponse & {
  has_more?: boolean;
};

const MAX_STRIPE_INVOICE_PAGES = 20;
const STRIPE_INVOICE_PAGE_SIZE = 100;

const toFiniteInt = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normalizeText = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

const readMetadataString = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const createSourceNote = (
  key: string,
  label: string,
  status: SourceNote["status"],
  detail: string
): SourceNote => ({
  key,
  label,
  status,
  detail,
});

const emptyMediaBreakdown = (): AdminUserAnalyticsResponse["mediaBreakdown"] => ({
  images: 0,
  videos: 0,
  audio: 0,
  voices: 0,
  music: 0,
  soundEffects: 0,
  unknownAudio: 0,
  unknown: 0,
  source: "unavailable",
});

const classifyGenerationMedia = (
  row: GenerationAnalyticsRow
): keyof Omit<AdminUserAnalyticsResponse["mediaBreakdown"], "source"> => {
  const metadata = asRecord(row.metadata);
  const mode = normalizeText(row.mode);
  const modelId = normalizeText(row.model_id);
  const workflowType = normalizeText(metadata.workflow_type ?? metadata.workflowType);
  const workflow = normalizeText(metadata.workflow ?? metadata.origin_tool ?? metadata.originTool);
  const combined = [mode, modelId, workflowType, workflow].filter(Boolean).join(" ");

  if (combined.includes("video") || combined.includes("kling") || combined.includes("veo")) {
    return "videos";
  }
  if (combined.includes("music")) return "music";
  if (combined.includes("sound effect") || combined.includes("sfx")) return "soundEffects";
  if (
    combined.includes("voice") ||
    combined.includes("speech") ||
    combined.includes("tts") ||
    combined.includes("eleven")
  ) {
    return "voices";
  }
  if (combined.includes("audio") || combined.includes("sound")) return "unknownAudio";
  if (
    combined.includes("image") ||
    combined.includes("photo") ||
    combined.includes("flux") ||
    combined.includes("seedream") ||
    combined.includes("nano")
  ) {
    return "images";
  }
  return "unknown";
};

const loadGenerationAnalytics = async (
  userId: string
): Promise<{
  generations: AdminUserAnalyticsResponse["generations"];
  mediaBreakdown: AdminUserAnalyticsResponse["mediaBreakdown"];
  note: SourceNote;
}> => {
  const supabaseAdmin = getSupabaseAdmin();
  const selectFallbacks = [
    "id,status,mode,model_id,metadata,created_at",
    "id,status,model_id,metadata,created_at",
    "id,status,model_id,created_at",
  ];

  let rows: GenerationAnalyticsRow[] = [];
  let selectUsed = "";
  for (const selectExpression of selectFallbacks) {
    const { data, error } = await supabaseAdmin
      .from("ai_generations")
      .select(selectExpression)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (!error) {
      rows = (Array.isArray(data) ? data : []) as unknown as GenerationAnalyticsRow[];
      selectUsed = selectExpression;
      break;
    }
    const message = error.message ?? "";
    const isCompatibilityError =
      message.includes("does not exist") ||
      message.includes("Could not find") ||
      message.includes("schema cache");
    if (!isCompatibilityError) {
      throw new Error(message || "Failed to load generation analytics.");
    }
  }

  if (!selectUsed) {
    return {
      generations: {
        total: 0,
        succeeded: 0,
        failed: 0,
        last30dTotal: 0,
        last30dSucceeded: 0,
        last30dFailed: 0,
        byStatus: {},
        source: "unavailable",
      },
      mediaBreakdown: emptyMediaBreakdown(),
      note: createSourceNote(
        "generations",
        "Generation analytics",
        "unavailable",
        "ai_generations could not be read with the supported analytics fields."
      ),
    };
  }

  const nowMs = Date.now();
  const last30dMs = nowMs - 30 * 24 * 60 * 60 * 1000;
  const byStatus: Record<string, number> = {};
  const mediaBreakdown = emptyMediaBreakdown();
  mediaBreakdown.source = "generation_rows";

  rows.forEach((row) => {
    const status = row.status || "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    const bucket = classifyGenerationMedia(row);
    mediaBreakdown[bucket] += 1;
    if (
      bucket === "voices" ||
      bucket === "music" ||
      bucket === "soundEffects" ||
      bucket === "unknownAudio"
    ) {
      mediaBreakdown.audio += 1;
    }
  });

  const last30dRows = rows.filter((row) => {
    if (!row.created_at) return false;
    const ms = Date.parse(row.created_at);
    return Number.isFinite(ms) && ms >= last30dMs;
  });
  const isFailed = (row: GenerationAnalyticsRow) =>
    row.status === "fail" || row.status === "failed" || row.status === "error";

  return {
    generations: {
      total: rows.length,
      succeeded: rows.filter((row) => row.status === "success").length,
      failed: rows.filter(isFailed).length,
      last30dTotal: last30dRows.length,
      last30dSucceeded: last30dRows.filter((row) => row.status === "success").length,
      last30dFailed: last30dRows.filter(isFailed).length,
      byStatus,
      source: "generation_rows",
    },
    mediaBreakdown,
    note: createSourceNote(
      "generations",
      "Generation analytics",
      rows.length >= 5000 ? "partial" : "exact",
      rows.length >= 5000
        ? "Read the newest 5,000 ai_generations rows for this account."
        : "Read ai_generations rows for this account."
    ),
  };
};

const loadCreditGrantSummary = async (userId: string): Promise<CreditGrantSummaryRow | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("ai_credit_grant_summary_v")
    .select(
      "user_id,available_cents,reserved_cents,spendable_cents,expiring_cents,non_expiring_cents,next_expiring_cents,next_expires_at"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return (data as CreditGrantSummaryRow | null) ?? null;
};

const listAllPaidInvoices = async (stripeCustomerId: string): Promise<StripeInvoiceResponse[]> => {
  const invoices: StripeInvoiceResponse[] = [];
  let startingAfter: string | null = null;
  for (let page = 0; page < MAX_STRIPE_INVOICE_PAGES; page += 1) {
    const invoiceList: StripeInvoicePage = await stripeGet<StripeInvoicePage>("/invoices", {
      customer: stripeCustomerId,
      limit: STRIPE_INVOICE_PAGE_SIZE,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const pageRows: StripeInvoiceResponse[] = Array.isArray(invoiceList.data)
      ? invoiceList.data
      : [];
    invoices.push(
      ...pageRows.filter((invoice) => {
        const amountPaid = Number(invoice.amount_paid ?? 0);
        return amountPaid > 0 || invoice.paid === true || invoice.status === "paid";
      })
    );
    if (!invoiceList.has_more || pageRows.length === 0) break;
    startingAfter = pageRows[pageRows.length - 1]?.id ?? null;
    if (!startingAfter) break;
  }
  return invoices;
};

const loadTopUpAnalytics = async (
  userId: string
): Promise<{
  purchaseCount: number;
  creditsPurchased: number;
  revenueCents: number | null;
  note: SourceNote;
}> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("ai_credit_ledger")
    .select("change_cents,metadata")
    .eq("user_id", userId)
    .eq("source", "stripe_checkout");
  if (error) {
    throw new Error(error.message || "Failed to load top-up analytics.");
  }

  const rows = (Array.isArray(data) ? data : []) as TopUpLedgerRow[];
  const packageIds = Array.from(
    new Set(
      rows
        .map((row) => readMetadataString(row.metadata, "credit_package_id"))
        .filter((value): value is string => Boolean(value))
    )
  );
  const packagePrices = new Map<string, number>();
  if (packageIds.length > 0) {
    const packageResult = await supabaseAdmin
      .from("billing_credit_packages")
      .select("id,price_cents")
      .in("id", packageIds);
    if (!packageResult.error) {
      for (const row of (Array.isArray(packageResult.data)
        ? packageResult.data
        : []) as CreditPackageRow[]) {
        packagePrices.set(row.id, Math.max(0, toFiniteInt(row.price_cents)));
      }
    }
  }

  let creditsPurchased = 0;
  let revenueCents = 0;
  let pricedRows = 0;
  rows.forEach((row) => {
    const credits = Math.max(0, toFiniteInt(row.change_cents));
    if (credits > 0) creditsPurchased += credits;
    const metadataPrice = toFiniteInt(row.metadata?.credit_package_price_cents);
    const packageId = readMetadataString(row.metadata, "credit_package_id");
    const catalogPrice = packageId ? (packagePrices.get(packageId) ?? 0) : 0;
    const price = metadataPrice > 0 ? metadataPrice : catalogPrice;
    if (price > 0) {
      revenueCents += price;
      pricedRows += 1;
    }
  });

  return {
    purchaseCount: rows.length,
    creditsPurchased,
    revenueCents: pricedRows === rows.length ? revenueCents : rows.length === 0 ? 0 : revenueCents,
    note: createSourceNote(
      "top-ups",
      "Top-up analytics",
      pricedRows === rows.length ? "exact" : "partial",
      pricedRows === rows.length
        ? "Read all stripe_checkout credit ledger rows and catalog price snapshots."
        : "Some top-up rows are missing local package price metadata, so revenue is partial."
    ),
  };
};

/**
 * Builds the selected-account analytics payload used by the admin support accordion.
 */
export const resolveAdminUserAnalytics = async ({
  userId,
  logStripeLookupException,
}: {
  userId: string;
  logStripeLookupException?: (params: {
    error: unknown;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
}): Promise<AdminUserAnalyticsResponse> => {
  const generatedAt = new Date().toISOString();
  const sourceHealth: SourceNote[] = [];

  const health = await loadAdminHealthSnapshot({
    lookup: userId,
    lookupMode: "user_id",
    lookbackDays: 30,
  });
  sourceHealth.push(
    createSourceNote("health", "Health snapshot", "exact", "Loaded admin user-health snapshot.")
  );

  const [billingResult, grantSummaryResult, generationResult, topUpResult] =
    await Promise.allSettled([
      resolveAdminBillingDiagnostics({ userId, logStripeLookupException }),
      loadCreditGrantSummary(userId),
      loadGenerationAnalytics(userId),
      loadTopUpAnalytics(userId),
    ]);

  const billing = billingResult.status === "fulfilled" ? billingResult.value : null;
  sourceHealth.push(
    billing
      ? createSourceNote("billing", "Billing diagnostics", "exact", "Loaded billing diagnostics.")
      : createSourceNote(
          "billing",
          "Billing diagnostics",
          "unavailable",
          billingResult.status === "rejected"
            ? billingResult.reason instanceof Error
              ? billingResult.reason.message
              : "Billing diagnostics failed."
            : "Billing diagnostics failed."
        )
  );

  const grantSummary = grantSummaryResult.status === "fulfilled" ? grantSummaryResult.value : null;
  if (!grantSummary) {
    sourceHealth.push(
      createSourceNote(
        "credit-lots",
        "Credit lot expiration",
        "partial",
        "Credit grant summary view was unavailable; expiration values use zero defaults."
      )
    );
  }

  const generationAnalytics =
    generationResult.status === "fulfilled"
      ? generationResult.value
      : {
          generations: {
            total: health.generations.total,
            succeeded: health.generations.byStatus.success ?? 0,
            failed: health.generations.byStatus.fail ?? 0,
            last30dTotal: health.generations.last30d.total,
            last30dSucceeded: health.generations.last30d.success,
            last30dFailed: health.generations.last30d.fail,
            byStatus: health.generations.byStatus,
            source: "health_snapshot" as const,
          },
          mediaBreakdown: emptyMediaBreakdown(),
          note: createSourceNote(
            "generations",
            "Generation analytics",
            "partial",
            generationResult.status === "rejected" && generationResult.reason instanceof Error
              ? generationResult.reason.message
              : "Fell back to user-health generation counts; media breakdown unavailable."
          ),
        };
  sourceHealth.push(generationAnalytics.note);

  const topUps =
    topUpResult.status === "fulfilled"
      ? topUpResult.value
      : {
          purchaseCount: 0,
          creditsPurchased: 0,
          revenueCents: null,
          note: createSourceNote(
            "top-ups",
            "Top-up analytics",
            "unavailable",
            topUpResult.status === "rejected" && topUpResult.reason instanceof Error
              ? topUpResult.reason.message
              : "Top-up analytics failed."
          ),
        };
  sourceHealth.push(topUps.note);

  const stripeCustomerId =
    billing?.currentContract?.stripeCustomerId ?? billing?.billingProfile?.stripeCustomerId ?? null;
  let subscriptionRevenueCents: number | null = null;
  let invoiceCount = 0;
  let revenueSource: AdminUserAnalyticsResponse["revenue"]["source"] = "unavailable";
  let revenueNote =
    "Stripe revenue could not be loaded because the account has no linked Stripe customer.";
  if (stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
    try {
      const invoices = await listAllPaidInvoices(stripeCustomerId);
      invoiceCount = invoices.length;
      subscriptionRevenueCents = invoices.reduce(
        (sum, invoice) => sum + Math.max(0, toFiniteInt(invoice.amount_paid)),
        0
      );
      revenueSource = "stripe";
      revenueNote = "Subscription and storage revenue is summed from paid Stripe invoices.";
      sourceHealth.push(
        createSourceNote("revenue", "Revenue", "exact", "Read paid Stripe invoices for customer.")
      );
    } catch (error) {
      await logStripeLookupException?.({
        error,
        metadata: { user_id: userId, stripe_customer_id: stripeCustomerId },
      });
      sourceHealth.push(
        createSourceNote(
          "revenue",
          "Revenue",
          "partial",
          error instanceof Error ? error.message : "Stripe invoice lookup failed."
        )
      );
    }
  } else if (stripeCustomerId) {
    sourceHealth.push(
      createSourceNote(
        "revenue",
        "Revenue",
        "partial",
        "STRIPE_SECRET_KEY is not configured; only local top-up revenue can be shown."
      )
    );
    revenueSource = topUps.revenueCents != null ? "local_ledger" : "unavailable";
    revenueNote = "Stripe invoice revenue is unavailable in this environment.";
  } else {
    sourceHealth.push(createSourceNote("revenue", "Revenue", "partial", revenueNote));
    revenueSource = topUps.revenueCents != null ? "local_ledger" : "unavailable";
  }

  const totalRevenueCents =
    subscriptionRevenueCents == null && topUps.revenueCents == null
      ? null
      : Math.max(0, subscriptionRevenueCents ?? 0) + Math.max(0, topUps.revenueCents ?? 0);
  const currentContract = billing?.currentContract ?? null;
  const stripeSubscription = billing?.stripeSubscription ?? null;
  const billingInterval =
    stripeSubscription?.billingInterval ?? currentContract?.billingInterval ?? null;
  const recurringPriceCents =
    stripeSubscription?.recurringPriceCents ?? currentContract?.recurringPriceCents ?? null;
  const monthlyRecurringRevenueCents =
    recurringPriceCents == null
      ? null
      : billingInterval === "year"
        ? Math.round(recurringPriceCents / 12)
        : recurringPriceCents;
  let currentCycleSpentCredits: number | null = null;
  try {
    const cycleSpend = await fetchAdminUserCycleSpend({
      supabaseAdmin: getSupabaseAdmin(),
      userIds: [userId],
      contractByUser: new Map([
        [
          userId,
          {
            user_id: userId,
            current_period_start: currentContract?.currentPeriodStart ?? null,
            current_period_end: currentContract?.currentPeriodEnd ?? null,
          },
        ],
      ]),
      profileByUser: new Map([
        [
          userId,
          {
            user_id: userId,
            current_period_end: billing?.billingProfile?.currentPeriodEnd ?? null,
          },
        ],
      ]),
      isSchemaCompatibilityError: (message) => isSchemaCompatibilityError({ message }),
    });
    currentCycleSpentCredits = cycleSpend.spentByUser.get(userId) ?? 0;
    if (cycleSpend.error) {
      sourceHealth.push(
        createSourceNote("cycle-spend", "Current-cycle spend", "partial", cycleSpend.error.message)
      );
    } else {
      sourceHealth.push(
        createSourceNote(
          "cycle-spend",
          "Current-cycle spend",
          "exact",
          "Loaded current-cycle spend from credit grant allocations with ledger compatibility."
        )
      );
    }
  } catch (error) {
    sourceHealth.push(
      createSourceNote(
        "cycle-spend",
        "Current-cycle spend",
        "unavailable",
        error instanceof Error ? error.message : "Current-cycle spend lookup failed."
      )
    );
  }

  return {
    generatedAt,
    target: {
      userId,
      email: health.target.email,
      createdAt: health.target.createdAt,
      lastSignInAt: health.target.lastSignInAt,
    },
    credits: {
      spendableCredits: grantSummary
        ? toFiniteInt(grantSummary.spendable_cents)
        : health.credits.spendableCents,
      availableCredits: grantSummary
        ? toFiniteInt(grantSummary.available_cents)
        : health.credits.availableCents,
      reservedCredits: grantSummary
        ? toFiniteInt(grantSummary.reserved_cents)
        : health.credits.reservedCents,
      totalCreditsSpent: health.credits.totalDebitsCentsAbs,
      currentCycleSpentCredits,
      generationCreditsSpent: health.credits.generationDebitsCentsAbs,
      expiringCredits: grantSummary ? toFiniteInt(grantSummary.expiring_cents) : 0,
      nonExpiringCredits: grantSummary ? toFiniteInt(grantSummary.non_expiring_cents) : 0,
      nextExpiringCredits: grantSummary ? toFiniteInt(grantSummary.next_expiring_cents) : 0,
      nextExpiresAt: grantSummary?.next_expires_at ?? null,
      source: grantSummary ? "exact" : "health_snapshot",
    },
    billing: {
      status: stripeSubscription?.status ?? currentContract?.status ?? null,
      contractSource: currentContract?.contractSource ?? null,
      recurringPriceCents,
      billingInterval,
      monthlyRecurringRevenueCents,
      renewalAt: stripeSubscription?.currentPeriodEnd ?? currentContract?.currentPeriodEnd ?? null,
      paymentExempt: currentContract?.contractSource === "internal_comp",
      source: billing ? "exact" : "unavailable",
    },
    revenue: {
      totalRevenueCents,
      subscriptionRevenueCents,
      topUpRevenueCents: topUps.revenueCents,
      invoiceCount,
      topUpPurchaseCount: topUps.purchaseCount,
      source: revenueSource,
      note: revenueNote,
    },
    topUps: {
      purchaseCount: topUps.purchaseCount,
      creditsPurchased: topUps.creditsPurchased,
      revenueCents: topUps.revenueCents,
      source: topUpResult.status === "fulfilled" ? "local_ledger" : "unavailable",
    },
    generations: generationAnalytics.generations,
    mediaBreakdown: generationAnalytics.mediaBreakdown,
    storage: {
      usedBytes: billing?.storageSummary?.usedBytes ?? null,
      totalLimitBytes: billing?.storageSummary?.totalLimitBytes ?? null,
      addonLimitBytes: billing?.storageSummary?.addonLimitBytes ?? null,
      remainingBytes: billing?.storageSummary?.remainingBytes ?? null,
      isOverLimit: billing?.storageSummary?.isOverLimit ?? null,
      source: billing?.storageSummary ? "exact" : "unavailable",
    },
    agentUsage: {
      standard: {
        turns: null,
        source: "unavailable",
        note: "Standard agent route telemetry is emitted for runtime monitoring, but per-user historical turn analytics are not yet durable in an admin-readable table.",
      },
      pulse: {
        turns: null,
        source: "unavailable",
        note: "Pulse agent quality is tracked through route telemetry and Pulse session state; per-user historical turn totals need a separate telemetry persistence lane.",
      },
    },
    sourceHealth,
  };
};
