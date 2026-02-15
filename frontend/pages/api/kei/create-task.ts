import type { NextApiRequest, NextApiResponse } from "next";
import { logGenerationFailure } from "../../../lib/server/api/appErrorLogs";

const DISABLED_MESSAGE = "Kie provider routes are disabled for MVP.";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const routeLabel = "kei/create-task";
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await logGenerationFailure({
    req,
    routeLabel,
    source: "api.kei_route_disabled",
    message: DISABLED_MESSAGE,
    statusCode: 410,
  });
  return res.status(410).json({
    error: DISABLED_MESSAGE,
    code: "KEI_DISABLED_FOR_MVP",
  });
}
