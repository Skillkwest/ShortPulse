/**
 * Preflights the configured Supabase Google OAuth authorize URL before the
 * browser leaves ShortPulse, so upstream outage pages stay off the customer UI.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";

type OAuthHandoffPreflightResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

const GOOGLE_OAUTH_UNAVAILABLE_MESSAGE =
  "Google sign-in is temporarily unavailable. Please try again in a few minutes.";
const GOOGLE_OAUTH_PREFLIGHT_TIMEOUT_MS = 3500;

const readBodyUrl = (body: unknown): string | null => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = (body as Record<string, unknown>).url;
  return typeof value === "string" ? value : null;
};

const resolveConfiguredSupabaseOrigin = (): string | null => {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
};

const resolveGoogleOAuthAuthorizeUrl = (rawUrl: string): URL | null => {
  const configuredOrigin = resolveConfiguredSupabaseOrigin();
  if (!configuredOrigin) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return null;
    if (parsed.origin !== configuredOrigin) return null;
    if (parsed.pathname !== "/auth/v1/authorize") return null;
    if (parsed.searchParams.get("provider") !== "google") return null;
    return parsed;
  } catch {
    return null;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OAuthHandoffPreflightResponse>
) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (
    !enforceApiRateLimit(req, res, {
      keyPrefix: "auth.oauth-handoff-preflight",
      maxRequests: 30,
      windowMs: 15 * 60 * 1000,
    })
  ) {
    return;
  }

  const oauthUrl = resolveGoogleOAuthAuthorizeUrl(readBodyUrl(req.body) ?? "");
  if (!oauthUrl) {
    return res.status(400).json({ ok: false, error: "Invalid Google sign-in handoff URL." });
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), GOOGLE_OAUTH_PREFLIGHT_TIMEOUT_MS);
  try {
    const response = await fetch(oauthUrl.toString(), {
      method: "GET",
      redirect: "manual",
      signal: abortController.signal,
    });

    if (response.status >= 200 && response.status < 400) {
      return res.status(200).json({ ok: true });
    }

    await logApiRouteException({
      req,
      error: new Error(`Google OAuth handoff preflight returned HTTP ${response.status}.`),
      routeLabel: "auth/oauth-handoff-preflight",
      metadata: {
        status: response.status,
      },
    }).catch(() => undefined);
    return res.status(503).json({ ok: false, error: GOOGLE_OAUTH_UNAVAILABLE_MESSAGE });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "auth/oauth-handoff-preflight",
    }).catch(() => undefined);
    return res.status(503).json({ ok: false, error: GOOGLE_OAUTH_UNAVAILABLE_MESSAGE });
  } finally {
    clearTimeout(timeoutId);
  }
}
