/**
 * Returns recent Stripe-backed payment transactions for the authenticated user.
 * Powers the subscription and storage billing history panels on the profile page.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  buildSubscriptionFacingTransaction,
  buildStorageTransaction,
  listBillingInvoices,
  resolveStorageCatalog,
  resolveStripeCustomerBillingState,
  resolveTransactionKindFilter,
} from "../../../../lib/server/api/stripeTransactions";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/stripe/subscription-transactions.auth",
    });
    return res.status(500).json({
      error: "Unable to load recent subscription payments.",
    });
  }
  if (!user) return;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(200).json({ transactions: [] });
  }

  try {
    const transactionKind = resolveTransactionKindFilter(req.query?.kind);
    const billingState = await resolveStripeCustomerBillingState(user.id);

    if (billingState.isInternalComp || !billingState.stripeCustomerId) {
      return res.status(200).json({ transactions: [] });
    }

    const invoices = await listBillingInvoices(billingState.stripeCustomerId);

    const storageCatalog = await resolveStorageCatalog();

    let transactions;
    if (transactionKind === "storage") {
      transactions = invoices
        .map((invoice) => buildStorageTransaction(invoice, storageCatalog))
        .filter((value): value is NonNullable<typeof value> => Boolean(value))
        .slice(0, 5);
    } else {
      transactions = invoices
        .map((invoice) => buildSubscriptionFacingTransaction(invoice, storageCatalog))
        .filter((value): value is NonNullable<typeof value> => Boolean(value))
        .slice(0, 5);
    }

    return res.status(200).json({ transactions });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/stripe/subscription-transactions",
      user,
    });
    return res.status(500).json({
      error: "Unable to load recent subscription payments.",
    });
  }
}
