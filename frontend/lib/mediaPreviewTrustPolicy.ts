/**
 * Central trust policy for media direct preview URLs and Next image optimizer hosts.
 * Keeps host/path checks consistent across media library and AI Studio surfaces.
 */

const MEDIA_BUCKET = "media_library";
const NEXT_IMAGE_OPTIMIZER_PREFIX = "/_next/image";
const TRAVERSAL_SEGMENT_REGEX = /(?:^|\/)\.\.(?:\/|$)/;
const BUILT_IN_EXTERNAL_DIRECT_PREVIEW_HOSTS = [
  "tempfile.redpandaai.co",
  "tempfile.aiquickdraw.com",
];

const normalizeHostname = (value: string): string => value.trim().toLowerCase().replace(/\.$/, "");

const parseBooleanEnv = (...values: Array<string | undefined>): boolean => {
  for (const value of values) {
    const normalized = value?.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return false;
};

const isLocalHostname = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
};

const parseHostEntry = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return normalizeHostname(new URL(trimmed).hostname);
  } catch {
    return normalizeHostname(trimmed.replace(/^https?:\/\//i, "").split("/")[0] ?? "");
  }
};

const parseHostList = (raw: string | undefined): string[] => {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((entry) => parseHostEntry(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const resolveSupabaseHost = (): string | null => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return normalizeHostname(new URL(raw).hostname);
  } catch {
    return null;
  }
};

const matchesHost = (hostname: string, allowedHost: string): boolean => {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedAllowed = normalizeHostname(allowedHost);
  return normalizedHost === normalizedAllowed || normalizedHost.endsWith(`.${normalizedAllowed}`);
};

const isAllowedProtocol = (url: URL): boolean => {
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && isLocalHostname(url.hostname);
};

const extractObjectPathFromUrl = (url: URL): string | null => {
  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  const bucketIndex = segments.indexOf(MEDIA_BUCKET);
  if (bucketIndex >= 0 && bucketIndex < segments.length - 1) {
    return segments.slice(bucketIndex + 1).join("/");
  }
  return segments.join("/");
};

const isUserScopedPath = (path: string, userId: string): boolean => {
  const normalizedPath = path.trim().replace(/^\/+/, "");
  if (!normalizedPath) return false;
  if (normalizedPath.includes("\\")) return false;
  if (TRAVERSAL_SEGMENT_REGEX.test(normalizedPath)) return false;
  return normalizedPath.startsWith(`${userId}/`);
};

const isHostTrustedForExternalUse = (hostname: string): boolean => {
  const allowExternal = parseBooleanEnv(
    process.env.SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS,
    process.env.NEXT_PUBLIC_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS
  );
  if (!allowExternal) return false;
  const allowlistedHosts = parseHostList(
    process.env.SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS ??
      process.env.NEXT_PUBLIC_MEDIA_DIRECT_URL_ALLOWED_HOSTS
  );
  const builtInHosts = BUILT_IN_EXTERNAL_DIRECT_PREVIEW_HOSTS;
  return [...allowlistedHosts, ...builtInHosts].some((allowedHost) =>
    matchesHost(hostname, allowedHost)
  );
};

const isHostTrustedForMediaPreview = (hostname: string): boolean => {
  if (isLocalHostname(hostname)) return true;
  const supabaseHost = resolveSupabaseHost();
  if (supabaseHost && matchesHost(hostname, supabaseHost)) return true;
  return isHostTrustedForExternalUse(hostname);
};

export const resolveMediaPreviewTrustedHosts = (): string[] => {
  const hosts = new Set<string>();
  const supabaseHost = resolveSupabaseHost();
  if (supabaseHost) hosts.add(supabaseHost);
  const allowExternal = parseBooleanEnv(
    process.env.SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS,
    process.env.NEXT_PUBLIC_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS
  );
  if (allowExternal) {
    for (const host of parseHostList(
      process.env.SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS ??
        process.env.NEXT_PUBLIC_MEDIA_DIRECT_URL_ALLOWED_HOSTS
    )) {
      hosts.add(host);
    }
    for (const host of BUILT_IN_EXTERNAL_DIRECT_PREVIEW_HOSTS) {
      hosts.add(host);
    }
  }
  hosts.add("localhost");
  hosts.add("127.0.0.1");
  return Array.from(hosts);
};

export const isTrustedMediaDirectPreviewUrl = (
  url: string,
  options?: {
    userId?: string | null;
    requireUserScope?: boolean;
  }
): boolean => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  if (!isAllowedProtocol(parsedUrl)) return false;
  if (!isHostTrustedForMediaPreview(parsedUrl.hostname)) return false;

  const requireUserScope = options?.requireUserScope ?? true;
  if (!requireUserScope) return true;

  const userId = options?.userId?.trim();
  if (!userId) return false;
  const extractedPath = extractObjectPathFromUrl(parsedUrl);
  if (!extractedPath) return false;
  return isUserScopedPath(extractedPath, userId);
};

export const filterTrustedMediaDirectPreviewUrls = (
  urls: string[],
  options?: {
    userId?: string | null;
    requireUserScope?: boolean;
  }
): string[] => {
  const seen = new Set<string>();
  const trusted: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (!isTrustedMediaDirectPreviewUrl(trimmed, options)) continue;
    seen.add(trimmed);
    trusted.push(trimmed);
  }
  return trusted;
};

export const canUseNextImageOptimizerForUrl = (url: string): boolean => {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(NEXT_IMAGE_OPTIMIZER_PREFIX)) return false;
  if (trimmed.startsWith("/")) return true;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return false;
  }

  if (!isAllowedProtocol(parsedUrl)) return false;
  return isHostTrustedForMediaPreview(parsedUrl.hostname);
};
