import type { NextApiRequest, NextApiResponse } from "next";
import {
  buildAuthCallbackUrl,
  resolveAuthCallbackFlow,
  resolveAuthCallbackOAuthProvider,
  resolveNextPath,
} from "../../../lib/authRedirects";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { resolvePublicAppOrigin } from "../../../lib/server/api/appOrigin";

type CallbackUrlResponse = {
  url: string;
};

type ErrorResponse = {
  error: string;
};

const CALLBACK_URL_RESOLUTION_ERROR = "Unable to resolve app origin.";

const readQueryValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return typeof value === "string" ? value : null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CallbackUrlResponse | ErrorResponse>
) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const flow = resolveAuthCallbackFlow(req.query.flow);
  if (!flow) {
    return res.status(400).json({ error: "Invalid auth callback flow." });
  }
  const oauthProvider = resolveAuthCallbackOAuthProvider(req.query.provider);

  try {
    const origin = resolvePublicAppOrigin(req);
    if (!origin) {
      await logApiRouteException({
        req,
        error: new Error("Unable to resolve app origin."),
        routeLabel: "auth/callback-url",
        metadata: {
          auth_flow: flow,
        },
      });
      return res.status(500).json({ error: CALLBACK_URL_RESOLUTION_ERROR });
    }

    return res.status(200).json({
      url: buildAuthCallbackUrl({
        origin,
        flow,
        nextPath: resolveNextPath(readQueryValue(req.query.next) ?? undefined),
        oauthProvider: oauthProvider ?? undefined,
      }),
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "auth/callback-url",
      metadata: {
        auth_flow: flow,
      },
    });
    return res.status(500).json({
      error: CALLBACK_URL_RESOLUTION_ERROR,
    });
  }
}
