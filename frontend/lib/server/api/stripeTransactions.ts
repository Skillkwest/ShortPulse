import { getSupabaseAdmin } from "./supabaseAdmin";
import { stripeGet } from "./stripe";

type BillingProfileRow = {
  stripe_customer_id: string | null;
};

type BillingContractRow = {
  contract_source: "stripe" | "internal_comp" | null;
  stripe_customer_id: string | null;
};

type BillingStorageAddonOfferRow = {
  storage_addon_id: string | null;
  stripe_price_id: string | null;
};

type BillingStorageAddonRow = {
  id: string;
  display_name: string | null;
};

type CreditLedgerRow = {
  id: string;
  source_ref: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type CreditPackageRow = {
  id: string;
  display_name: string | null;
  price_cents: number | null;
};

type StripeCheckoutSessionResponse = {
  id: string;
  amount_total?: number | null;
  currency?: string | null;
  payment_status?: string | null;
};

export type StripeInvoiceListResponse = {
  data?: StripeInvoiceResponse[];
};

export type StripeInvoiceResponse = {
  id: string;
  number?: string | null;
  status?: string | null;
  currency?: string | null;
  amount_paid?: number | null;
  created?: number | null;
  paid?: boolean;
  billing_reason?: string | null;
  description?: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  status_transitions?: {
    paid_at?: number | null;
  } | null;
  lines?: {
    data?: StripeInvoiceLineResponse[];
  } | null;
};

export type StripeInvoiceLineResponse = {
  id?: string | null;
  amount?: number | null;
  description?: string | null;
  pricing?: {
    price_details?: {
      price?: string | null;
    } | null;
  } | null;
};

export type BillingPaymentTransaction = {
  id: string;
  invoiceNumber: string | null;
  amountPaidCents: number;
  currency: string | null;
  status: string | null;
  title: string;
  createdAt: string | null;
  paidAt: string | null;
  receiptUrl: string | null;
  kind: "subscription" | "storage" | "credit_purchase" | "mixed";
  kindLabel: string;
  reference: string | null;
};

export type TransactionKindFilter = "subscription" | "storage" | "all";

type StorageCatalog = {
  priceToAddonId: Map<string, string>;
  addonNames: Map<string, string>;
};

const invoiceUnixToIso = (value: number | null | undefined): string | null => {
  if (!Number.isFinite(value)) return null;
  return new Date((value as number) * 1000).toISOString();
};

const resolveInvoiceTitle = (invoice: StripeInvoiceResponse): string => {
  const description = typeof invoice.description === "string" ? invoice.description.trim() : "";
  if (description.length > 0) return description;

  if (invoice.billing_reason === "subscription_create") {
    return "Initial subscription payment";
  }
  if (invoice.billing_reason === "subscription_cycle") {
    return "Monthly subscription renewal";
  }
  if (invoice.billing_reason === "subscription_update") {
    return "Plan change adjustment";
  }
  return "Subscription payment";
};

export const resolveTransactionKindFilter = (value: unknown): TransactionKindFilter => {
  if (value === "storage") return "storage";
  if (value === "all") return "all";
  return "subscription";
};

const resolveStorageLinePriceId = (line: StripeInvoiceLineResponse): string | null => {
  const price = line.pricing?.price_details?.price;
  return typeof price === "string" && price.length > 0 ? price : null;
};

export const resolveStripeCustomerBillingState = async (userId: string) => {
  const supabaseAdmin = getSupabaseAdmin();
  const [billingProfileResult, billingContractResult] = await Promise.all([
    supabaseAdmin
      .from("billing_profiles")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_subscription_contracts")
      .select("contract_source, stripe_customer_id")
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (billingProfileResult.error || billingContractResult.error) {
    throw new Error(
      billingProfileResult.error?.message ||
        billingContractResult.error?.message ||
        "Unable to load billing state."
    );
  }

  const billingProfile = (billingProfileResult.data as BillingProfileRow | null) ?? null;
  const billingContract = (billingContractResult.data as BillingContractRow | null) ?? null;

  return {
    billingProfile,
    billingContract,
    isInternalComp: billingContract?.contract_source === "internal_comp",
    stripeCustomerId:
      billingContract?.stripe_customer_id ?? billingProfile?.stripe_customer_id ?? null,
  };
};

export const listPaidInvoices = async (
  stripeCustomerId: string
): Promise<StripeInvoiceResponse[]> => {
  const invoiceList = await stripeGet<StripeInvoiceListResponse>("/invoices", {
    customer: stripeCustomerId,
    limit: 12,
    "expand[0]": "data.lines",
  });

  return (Array.isArray(invoiceList.data) ? invoiceList.data : []).filter((invoice) => {
    const amountPaid = Number(invoice.amount_paid ?? 0);
    return amountPaid > 0 || invoice.paid === true || invoice.status === "paid";
  });
};

export const resolveStorageCatalog = async (): Promise<StorageCatalog> => {
  const supabaseAdmin = getSupabaseAdmin();
  const [offersResult, addonsResult] = await Promise.all([
    supabaseAdmin.from("billing_storage_addon_offers").select("storage_addon_id, stripe_price_id"),
    supabaseAdmin.from("billing_storage_addons").select("id, display_name"),
  ]);

  if (offersResult.error || addonsResult.error) {
    throw new Error(
      offersResult.error?.message ||
        addonsResult.error?.message ||
        "Unable to load storage catalog."
    );
  }

  const priceToAddonId = new Map<string, string>();
  for (const row of (Array.isArray(offersResult.data)
    ? offersResult.data
    : []) as BillingStorageAddonOfferRow[]) {
    if (typeof row.stripe_price_id === "string" && typeof row.storage_addon_id === "string") {
      priceToAddonId.set(row.stripe_price_id, row.storage_addon_id);
    }
  }

  const addonNames = new Map<string, string>();
  for (const row of (Array.isArray(addonsResult.data)
    ? addonsResult.data
    : []) as BillingStorageAddonRow[]) {
    if (typeof row.id === "string" && typeof row.display_name === "string") {
      addonNames.set(row.id, row.display_name);
    }
  }

  return { priceToAddonId, addonNames };
};

const resolveStorageSummary = (
  invoice: StripeInvoiceResponse,
  storageCatalog: StorageCatalog
): {
  matchedNames: string[];
  matchedAmountCents: number;
  hasStorageLines: boolean;
  hasNonStorageLines: boolean;
} => {
  const lines = Array.isArray(invoice.lines?.data) ? invoice.lines?.data : [];
  const matchedLines = lines.filter((line) => {
    const priceId = resolveStorageLinePriceId(line);
    return priceId ? storageCatalog.priceToAddonId.has(priceId) : false;
  });

  const matchedAmountCents = matchedLines.reduce(
    (sum, line) => sum + Math.max(0, Number(line.amount ?? 0) || 0),
    0
  );

  const matchedNames = Array.from(
    new Set(
      matchedLines
        .map((line) => {
          const priceId = resolveStorageLinePriceId(line);
          if (!priceId) return null;
          const addonId = storageCatalog.priceToAddonId.get(priceId);
          return addonId ? (storageCatalog.addonNames.get(addonId) ?? null) : null;
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  return {
    matchedNames,
    matchedAmountCents,
    hasStorageLines: matchedLines.length > 0,
    hasNonStorageLines:
      lines.filter((line) => Math.max(0, Number(line.amount ?? 0) || 0) > 0).length >
      matchedLines.length,
  };
};

export const buildStorageTransaction = (
  invoice: StripeInvoiceResponse,
  storageCatalog: StorageCatalog
): BillingPaymentTransaction | null => {
  const storageSummary = resolveStorageSummary(invoice, storageCatalog);
  if (!storageSummary.hasStorageLines || storageSummary.matchedAmountCents <= 0) {
    return null;
  }

  let title = "Storage add-on payment";
  if (storageSummary.matchedNames.length === 1) {
    title = storageSummary.matchedNames[0];
  } else if (storageSummary.matchedNames.length > 1) {
    title = `Storage add-ons (${storageSummary.matchedNames.length} items)`;
  }

  return {
    id: invoice.id,
    invoiceNumber: typeof invoice.number === "string" ? invoice.number : null,
    amountPaidCents: storageSummary.matchedAmountCents,
    currency: typeof invoice.currency === "string" ? invoice.currency : null,
    status: typeof invoice.status === "string" ? invoice.status : null,
    title,
    createdAt: invoiceUnixToIso(invoice.created),
    paidAt: invoiceUnixToIso(invoice.status_transitions?.paid_at),
    receiptUrl:
      (typeof invoice.hosted_invoice_url === "string" && invoice.hosted_invoice_url) ||
      (typeof invoice.invoice_pdf === "string" && invoice.invoice_pdf) ||
      null,
    kind: "storage",
    kindLabel: "Storage",
    reference: typeof invoice.number === "string" ? invoice.number : invoice.id,
  };
};

export const buildSubscriptionTransaction = (
  invoice: StripeInvoiceResponse
): BillingPaymentTransaction => ({
  id: invoice.id,
  invoiceNumber: typeof invoice.number === "string" ? invoice.number : null,
  amountPaidCents: Math.max(0, Number(invoice.amount_paid ?? 0) || 0),
  currency: typeof invoice.currency === "string" ? invoice.currency : null,
  status: typeof invoice.status === "string" ? invoice.status : null,
  title: resolveInvoiceTitle(invoice),
  createdAt: invoiceUnixToIso(invoice.created),
  paidAt: invoiceUnixToIso(invoice.status_transitions?.paid_at),
  receiptUrl:
    (typeof invoice.hosted_invoice_url === "string" && invoice.hosted_invoice_url) ||
    (typeof invoice.invoice_pdf === "string" && invoice.invoice_pdf) ||
    null,
  kind: "subscription",
  kindLabel: "Subscription",
  reference: typeof invoice.number === "string" ? invoice.number : invoice.id,
});

export const buildUnifiedInvoiceTransaction = (
  invoice: StripeInvoiceResponse,
  storageCatalog: StorageCatalog
): BillingPaymentTransaction => {
  const storageSummary = resolveStorageSummary(invoice, storageCatalog);
  if (!storageSummary.hasStorageLines) {
    return buildSubscriptionTransaction(invoice);
  }

  const baseTransaction = {
    id: invoice.id,
    invoiceNumber: typeof invoice.number === "string" ? invoice.number : null,
    amountPaidCents: Math.max(0, Number(invoice.amount_paid ?? 0) || 0),
    currency: typeof invoice.currency === "string" ? invoice.currency : null,
    status: typeof invoice.status === "string" ? invoice.status : null,
    createdAt: invoiceUnixToIso(invoice.created),
    paidAt: invoiceUnixToIso(invoice.status_transitions?.paid_at),
    receiptUrl:
      (typeof invoice.hosted_invoice_url === "string" && invoice.hosted_invoice_url) ||
      (typeof invoice.invoice_pdf === "string" && invoice.invoice_pdf) ||
      null,
    reference: typeof invoice.number === "string" ? invoice.number : invoice.id,
  };

  if (!storageSummary.hasNonStorageLines) {
    return {
      ...baseTransaction,
      title:
        storageSummary.matchedNames.length === 1
          ? storageSummary.matchedNames[0]
          : storageSummary.matchedNames.length > 1
            ? `Storage add-ons (${storageSummary.matchedNames.length} items)`
            : "Storage add-on payment",
      kind: "storage",
      kindLabel: "Storage",
    };
  }

  return {
    ...baseTransaction,
    title: "Subscription + storage",
    kind: "mixed",
    kindLabel: "Combined invoice",
  };
};

export const listCreditPurchaseTransactions = async (
  userId: string
): Promise<BillingPaymentTransaction[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: ledgerRows, error: ledgerError } = await supabaseAdmin
    .from("ai_credit_ledger")
    .select("id, source_ref, metadata, created_at")
    .eq("user_id", userId)
    .eq("source", "stripe_checkout")
    .order("created_at", { ascending: false })
    .limit(12);

  if (ledgerError) {
    throw new Error(ledgerError.message || "Unable to load credit purchase history.");
  }

  const rows = Array.isArray(ledgerRows) ? (ledgerRows as CreditLedgerRow[]) : [];
  const packageIds = Array.from(
    new Set(
      rows
        .map((row) => {
          const metadata = row.metadata ?? {};
          return typeof metadata.credit_package_id === "string" ? metadata.credit_package_id : null;
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  const packageMap = new Map<string, CreditPackageRow>();
  if (packageIds.length > 0) {
    const { data: packages, error: packagesError } = await supabaseAdmin
      .from("billing_credit_packages")
      .select("id, display_name, price_cents")
      .in("id", packageIds);

    if (packagesError) {
      throw new Error(packagesError.message || "Unable to load credit package catalog.");
    }

    for (const row of (Array.isArray(packages) ? packages : []) as CreditPackageRow[]) {
      if (typeof row.id === "string") {
        packageMap.set(row.id, row);
      }
    }
  }

  const checkoutAmountMap = new Map<
    string,
    { amountPaidCents: number; currency: string | null; status: string | null }
  >();
  if (process.env.STRIPE_SECRET_KEY) {
    await Promise.all(
      rows.map(async (row) => {
        const metadata = row.metadata ?? {};
        const checkoutSessionId =
          typeof metadata.checkout_session_id === "string" ? metadata.checkout_session_id : null;
        if (!checkoutSessionId) return;
        try {
          const session = await stripeGet<StripeCheckoutSessionResponse>(
            `/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`
          );
          checkoutAmountMap.set(checkoutSessionId, {
            amountPaidCents: Math.max(0, Number(session.amount_total ?? 0) || 0),
            currency: typeof session.currency === "string" ? session.currency : null,
            status: typeof session.payment_status === "string" ? session.payment_status : null,
          });
        } catch {
          // Fall back to local package pricing when the historical Checkout session is unavailable.
        }
      })
    );
  }

  return rows
    .map<BillingPaymentTransaction | null>((row) => {
      const metadata = row.metadata ?? {};
      const packageId =
        typeof metadata.credit_package_id === "string" ? metadata.credit_package_id : null;
      const packageRecord = packageId ? (packageMap.get(packageId) ?? null) : null;
      const packageDisplayNameSnapshot =
        typeof metadata.credit_package_display_name === "string"
          ? metadata.credit_package_display_name
          : null;
      const packagePriceCentsSnapshot = Number(metadata.credit_package_price_cents);
      const checkoutSessionId =
        typeof metadata.checkout_session_id === "string" ? metadata.checkout_session_id : null;
      const checkoutSessionAmount = checkoutSessionId
        ? (checkoutAmountMap.get(checkoutSessionId) ?? null)
        : null;
      const fallbackSnapshotAmountCents =
        Number.isFinite(packagePriceCentsSnapshot) && packagePriceCentsSnapshot > 0
          ? Math.max(0, packagePriceCentsSnapshot)
          : 0;
      const fallbackCatalogAmountCents =
        packageRecord && Number.isFinite(packageRecord.price_cents)
          ? Math.max(0, Number(packageRecord.price_cents ?? 0) || 0)
          : 0;
      const amountPaidCents =
        checkoutSessionAmount?.amountPaidCents ??
        (fallbackSnapshotAmountCents > 0
          ? fallbackSnapshotAmountCents
          : fallbackCatalogAmountCents);
      if (amountPaidCents <= 0) {
        return null;
      }

      const resolvedPackageDisplayName =
        packageDisplayNameSnapshot && packageDisplayNameSnapshot.trim().length > 0
          ? packageDisplayNameSnapshot
          : packageRecord?.display_name && packageRecord.display_name.trim().length > 0
            ? packageRecord.display_name
            : null;
      const title = resolvedPackageDisplayName
        ? `Credit top-up · ${resolvedPackageDisplayName}`
        : "Credit top-up";

      return {
        id: row.id,
        invoiceNumber: null,
        amountPaidCents,
        currency: checkoutSessionAmount?.currency ?? "usd",
        status: checkoutSessionAmount?.status ?? "paid",
        title,
        createdAt: row.created_at,
        paidAt: row.created_at,
        receiptUrl: null,
        kind: "credit_purchase",
        kindLabel: "Credit top-up",
        reference: checkoutSessionId ?? row.source_ref,
      };
    })
    .filter((value): value is BillingPaymentTransaction => Boolean(value));
};
