export type AuthCallbackFlow = "signup" | "recovery" | "email-change";

export const AUTH_ENTRY_PATH = "/auth";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const DEFAULT_POST_AUTH_PATH = "/dashboard";

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
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return DEFAULT_POST_AUTH_PATH;
  if (candidate.startsWith(AUTH_ENTRY_PATH)) return DEFAULT_POST_AUTH_PATH;
  return candidate;
};

export const resolveNextPathFromAsPath = (asPath: string): string => {
  const queryString = readQueryStringFromAsPath(asPath);
  if (!queryString) return DEFAULT_POST_AUTH_PATH;
  return resolveNextPath(new URLSearchParams(queryString).get("next") ?? undefined);
};

export const resolveAuthCallbackFlow = (
  value: string | string[] | undefined
): AuthCallbackFlow | null => {
  const rawValue = Array.isArray(value) ? value[0] : value;
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
