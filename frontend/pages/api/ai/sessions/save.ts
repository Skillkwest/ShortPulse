/**
 * Saves one AI Studio session snapshot for the authenticated user.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;
  return res.status(410).json({ error: "AI Studio legacy session persistence has been retired" });
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};
