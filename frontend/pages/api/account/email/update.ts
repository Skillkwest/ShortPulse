import type { NextApiRequest, NextApiResponse } from "next";
import {
  isValidEmailAddress,
  normalizeEmailInput,
  resolveAuthDisplayName,
  updateSupabaseAuthUser,
} from "../../../lib/server/api/accountIdentity";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { syncStripeCustomerForUser } from "../../../lib/server/api/stripeCustomer";

type EmailUpdateBody = {
  email?: unknown;
};

type EmailUpdateResponse = {
  email: string;
  confirmationRequired: true;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string } | EmailUpdateResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const email = normalizeEmailInput((req.body as EmailUpdateBody | null)?.email);
  if (!email || !isValidEmailAddress(email)) {
    return res.status(400).json({ error: "Enter a valid email." });
  }

  try {
    await updateSupabaseAuthUser({
      req,
      payload: { email },
    });

    await syncStripeCustomerForUser({
      userId: user.id,
      email,
      displayName: resolveAuthDisplayName(user),
    });

    return res.status(200).json({ email, confirmationRequired: true });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "account/email/update",
      user,
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to update your email.",
    });
  }
}
