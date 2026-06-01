/**
 * Returns unified billing payment history for the authenticated user.
 * Aggregates recurring invoice payments and one-time credit purchases into one feed.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  buildUnifiedInvoiceTransaction,
  listCreditPurchaseTransactions,
  listPaidInvoices,
  resolveStorageCatalog,
  resolveStripeCustomerBillingState,
} from "../../../../lib/server/api/stripeTransactions";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const billingState = await resolveStripeCustomerBillingState(user.id);
    const [creditTransactions, storageCatalog, invoices] = await Promise.all([
      listCreditPurchaseTransactions(user.id),
      process.env.STRIPE_SECRET_KEY && !billingState.isInternalComp && billingState.stripeCustomerId
        ? resolveStorageCatalog()
        : Promise.resolve(null),
      process.env.STRIPE_SECRET_KEY && !billingState.isInternalComp && billingState.stripeCustomerId
        ? listPaidInvoices(billingState.stripeCustomerId)
        : Promise.resolve([]),
    ]);

    const invoiceTransactions =
      storageCatalog === null
        ? []
        : invoices.map((invoice) => buildUnifiedInvoiceTransaction(invoice, storageCatalog));

    const transactions = [...invoiceTransactions, ...creditTransactions]
      .sort((left, right) => {
        const leftTimestamp = Date.parse(left.paidAt ?? left.createdAt ?? "") || 0;
        const rightTimestamp = Date.parse(right.paidAt ?? right.createdAt ?? "") || 0;
        return rightTimestamp - leftTimestamp;
      })
      .slice(0, 12);

    return res.status(200).json({ transactions });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/stripe/transactions",
      user,
    });
    return res.status(500).json({
      error: "Unable to load recent transactions.",
    });
  }
}
