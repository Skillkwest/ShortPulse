export type AuthCallbackFlow = "signin" | "signup" | "recovery" | "email-change";

export const AUTH_ENTRY_PATH = "/auth";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const DEFAULT_POST_AUTH_PATH = "/dashboard";
export const DEFAULT_SIGNUP_NEXT_PATH = "/pricing";
const PAID_SIGNUP_PLAN_IDS = new Set(["starter", "media", "studio", "business"]);
const PUBLIC_SIGNUP_ENABLED_VALUE = "true";
const LEGACY_CHARACTER_AUTH_NEXT_PATHS = new Map<string, string>([
  ["/character", "/ai-studio"],
  ["/character-soon", "/ai-studio"],
]);

const readQueryStringFromAsPath = (asPath: string): string => {
  if (!asPath.includes("?")) return "";
  const beforeHash = asPath.split("#", 1)[0] ?? asPath;
  return beforeHash.slice(beforeHash.indexOf("?") + 1);
};

export function readHashParams(hash: string): URLSearchParams {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!normalizedHash) return new URLSearchParams();
  return new URLSearchParams(normalizedHash);
}

export const resolveNextPath = (nextQueryValue: string | string[] | undefined): string => {
  const rawValue = Array.isArray(nextQueryValue) ? nextQueryValue[0] : nextQueryValue;
  if (!rawValue) return DEFAULT_POST_AUTH_PATH;
  const candidate = rawValue.trim();
  if (candidate.includes("\\")) return DEFAULT_POST_AUTH_PATH;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return DEFAULT_POST_AUTH_PATH;
  if (candidate.startsWith(AUTH_ENTRY_PATH)) return DEFAULT_POST_AUTH_PATH;
  const candidatePathname = (candidate.split(/[?#]/, 1)[0] ?? candidate).replace(/\/+$/, "") || "/";
  return LEGACY_CHARACTER_AUTH_NEXT_PATHS.get(candidatePathname) ?? candidate;
};

export const resolveNextPathFromAsPath = (asPath: string): string => {
  const queryString = readQueryStringFromAsPath(asPath);
  if (!queryString) return DEFAULT_POST_AUTH_PATH;
  return resolveNextPath(new URLSearchParams(queryString).get("next") ?? undefined);
};

export const isPaidPricingSignupNextPath = (nextPath: string): boolean => {
  if (!nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.includes("\\")) {
    return false;
  }
  const parsed = new URL(nextPath, "https://shortpulse.local");
  const candidatePathname = parsed.pathname.replace(/\/+$/, "") || "/";
  if (candidatePathname !== DEFAULT_SIGNUP_NEXT_PATH) return false;
  const planId = parsed.searchParams.get("plan")?.trim().toLowerCase() ?? "";
  return PAID_SIGNUP_PLAN_IDS.has(planId);
};

export const resolveSignupNextPath = (nextPath: string): string | null => {
  if (!isPaidPricingSignupNextPath(nextPath)) return null;
  return nextPath;
};

export const isPublicSignupEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED?.trim().toLowerCase() ===
  PUBLIC_SIGNUP_ENABLED_VALUE;

export const resolveAuthCallbackFlow = (
  value: string | string[] | undefined
): AuthCallbackFlow | null => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (rawValue === "signin") return "signin";
  if (rawValue === "signup") return "signup";
  if (rawValue === "recovery") return "recovery";
  if (rawValue === "email-change") return "email-change";
  return null;
};

export const resolveAuthCallbackFlowFromType = (value: string | null): AuthCallbackFlow | null => {
  if (value === "signup") return "signup";
  if (value === "recovery") return "recovery";
  if (value === "email_change") return "email-change";
  return null;
};

export const resolveAuthCallbackFlowFromAsPath = (asPath: string): AuthCallbackFlow | null => {
  const queryString = readQueryStringFromAsPath(asPath);
  const queryParams = new URLSearchParams(queryString);
  return (
    resolveAuthCallbackFlow(queryParams.get("flow") ?? undefined) ??
    resolveAuthCallbackFlowFromType(queryParams.get("type"))
  );
};

export const hasPasswordRecoveryHint = (asPath: string, hash: string): boolean => {
  const queryParams = new URLSearchParams(readQueryStringFromAsPath(asPath));
  if (queryParams.get("type") === "recovery") return true;
  return readHashParams(hash).get("type") === "recovery";
};

export const resolveAuthCallbackError = (asPath: string, hash: string): string | null => {
  const queryParams = new URLSearchParams(readQueryStringFromAsPath(asPath));
  const hashParams = readHashParams(hash);
  const candidate =
    queryParams.get("error_description") ??
    hashParams.get("error_description") ??
    queryParams.get("error") ??
    hashParams.get("error") ??
    null;
  if (!candidate) return null;
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
};

export const buildAuthCallbackPath = (options: {
  flow: AuthCallbackFlow;
  nextPath?: string;
}): string => {
  const params = new URLSearchParams();
  params.set("flow", options.flow);
  params.set("next", resolveNextPath(options.nextPath));
  return `${AUTH_CALLBACK_PATH}?${params.toString()}`;
};

export const buildAuthCallbackUrl = (options: {
  origin: string;
  flow: AuthCallbackFlow;
  nextPath?: string;
}): string => `${options.origin}${buildAuthCallbackPath(options)}`;

type AuthCallbackUrlResponse = {
  url?: unknown;
};

const isProductionClientEnvironment = (): boolean => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.trim().toLowerCase();
    if (hostname === "shortpulse.ai" || hostname === "www.shortpulse.ai") {
      return true;
    }
  }
  const publicVercelEnvironment = process.env.NEXT_PUBLIC_VERCEL_ENV?.trim().toLowerCase();
  if (publicVercelEnvironment) {
    return publicVercelEnvironment === "production";
  }
  return false;
};

export const resolveBrowserAuthCallbackUrl = (options: {
  flow: AuthCallbackFlow;
  nextPath?: string;
}): string | null => {
  if (typeof window === "undefined") return null;
  return buildAuthCallbackUrl({
    origin: window.location.origin,
    flow: options.flow,
    nextPath: options.nextPath,
  });
};

export const fetchCanonicalAuthCallbackUrl = async (options: {
  flow: AuthCallbackFlow;
  nextPath?: string;
}): Promise<string | null> => {
  const fallbackUrl = resolveBrowserAuthCallbackUrl(options);
  const allowBrowserFallback = !isProductionClientEnvironment();
  if (typeof window === "undefined") return fallbackUrl;

  try {
    const params = new URLSearchParams();
    params.set("flow", options.flow);
    params.set("next", resolveNextPath(options.nextPath));
    const response = await fetch(`/api/auth/callback-url?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = (await response.json().catch(() => null)) as AuthCallbackUrlResponse | null;
    if (response.ok && typeof payload?.url === "string" && payload.url.trim()) {
      return payload.url.trim();
    }
  } catch {
    return allowBrowserFallback ? fallbackUrl : null;
  }

  return allowBrowserFallback ? fallbackUrl : null;
};
