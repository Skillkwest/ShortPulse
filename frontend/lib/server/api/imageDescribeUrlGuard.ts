/**
 * URL safety and probe helpers for describe-image.
 * Prevents private-network probing and validates reachable image resources.
 */
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

const URL_PROBE_TIMEOUT_MS = 8000;
const MAX_URL_PROBE_REDIRECTS = 4;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_PROBE_DETAIL_LENGTH = 3000;

type HostTrustPolicy = {
  enforceAllowedHosts: boolean;
  allowedHosts: string[];
};

export type UrlProbeResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      detail: string;
      statusCode: number;
    };

type RedirectProbeResult =
  | {
      ok: true;
      response: Response;
    }
  | {
      ok: false;
      failure: UrlProbeResult;
    };

const trimDetail = (value: string): string => value.trim().slice(0, MAX_PROBE_DETAIL_LENGTH);

const isImageContentType = (value: string | null): boolean => {
  if (!value) return true;
  const normalized = value.toLowerCase();
  return normalized.includes("image/") || normalized.includes("application/octet-stream");
};

const normalizeHostname = (value: string): string => value.trim().toLowerCase().replace(/\.$/, "");

const parseAllowedHostList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => normalizeHostname(item))
    .filter((item) => item.length > 0);

const parseHostnameFromUrl = (value: string | undefined): string | null => {
  if (!value?.trim()) return null;
  try {
    return normalizeHostname(new URL(value).hostname);
  } catch {
    return null;
  }
};

const matchesAllowedHost = (hostname: string, allowedHosts: string[]): boolean => {
  const normalizedHost = normalizeHostname(hostname);
  return allowedHosts.some((rule) => {
    if (!rule) return false;
    if (rule.startsWith("*.")) {
      const suffix = rule.slice(2);
      return normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`);
    }
    if (rule.startsWith(".")) {
      const suffix = rule.slice(1);
      return normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`);
    }
    return normalizedHost === rule;
  });
};

const buildHostTrustPolicy = (): HostTrustPolicy => {
  const configuredHosts = parseAllowedHostList(process.env.OPENAI_DESCRIBE_ALLOWED_HOSTS);
  const supabaseHost = parseHostnameFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const allowedHosts = Array.from(
    new Set([...(supabaseHost ? [supabaseHost] : []), ...configuredHosts])
  );
  // Security default: describe-image runs fail-closed for non-allowlisted hosts.
  // Supabase host is auto-trusted to preserve signed-media describe flows.
  const enforceAllowedHosts = true;
  return {
    enforceAllowedHosts,
    allowedHosts,
  };
};

const isPrivateIpv4 = (hostname: string): boolean => {
  const parts = hostname.split(".").map((segment) => Number(segment));
  if (
    parts.length !== 4 ||
    parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
};

const isPrivateIpv6 = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  return false;
};

const isBlockedPrivateHost = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return true;
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4(normalized);
  if (ipVersion === 6) return isPrivateIpv6(normalized);
  return false;
};

const isBlockedPrivateAddress = (address: string): boolean => {
  const normalized = normalizeHostname(address);
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4(normalized);
  if (ipVersion === 6) return isPrivateIpv6(normalized);
  return false;
};

const resolveHostAddresses = async (hostname: string): Promise<string[] | null> => {
  try {
    const records = await dnsLookup(hostname, { all: true });
    if (!Array.isArray(records)) {
      const singleAddress = (records as { address?: string }).address;
      return singleAddress ? [singleAddress] : [];
    }
    return records
      .map((record) => (typeof record.address === "string" ? record.address : ""))
      .filter((address) => address.length > 0);
  } catch {
    return null;
  }
};

const validateCandidateUrl = async (
  candidate: URL,
  trustPolicy: HostTrustPolicy
): Promise<UrlProbeResult | null> => {
  if (candidate.protocol !== "https:") {
    return {
      ok: false,
      message: "Image URL must use HTTPS.",
      detail: `Unsupported protocol: ${candidate.protocol}`,
      statusCode: 422,
    };
  }

  const normalizedHost = normalizeHostname(candidate.hostname);
  if (isBlockedPrivateHost(normalizedHost)) {
    return {
      ok: false,
      message: "Image URL host is not allowed.",
      detail: `Blocked host: ${normalizedHost}`,
      statusCode: 422,
    };
  }

  if (
    trustPolicy.enforceAllowedHosts &&
    !matchesAllowedHost(normalizedHost, trustPolicy.allowedHosts)
  ) {
    return {
      ok: false,
      message: "Image URL host is not in the trusted allowlist.",
      detail: `Host '${normalizedHost}' not in OPENAI_DESCRIBE_ALLOWED_HOSTS.`,
      statusCode: 422,
    };
  }

  if (isIP(normalizedHost) !== 0) {
    return null;
  }
  const addresses = await resolveHostAddresses(normalizedHost);
  if (!addresses || !addresses.length) {
    return {
      ok: false,
      message: "Unable to resolve image URL host.",
      detail: `DNS lookup failed for host '${normalizedHost}'.`,
      statusCode: 422,
    };
  }
  if (addresses.some((address) => isBlockedPrivateAddress(address))) {
    return {
      ok: false,
      message: "Image URL host resolved to a private network address.",
      detail: `DNS resolution for '${normalizedHost}' returned a private IP.`,
      statusCode: 422,
    };
  }
  return null;
};

const probeWithRedirectSafety = async ({
  startUrl,
  method,
  signal,
  trustPolicy,
  headers,
}: {
  startUrl: string;
  method: "HEAD" | "GET";
  signal: AbortSignal;
  trustPolicy: HostTrustPolicy;
  headers?: Record<string, string>;
}): Promise<RedirectProbeResult> => {
  let currentUrl = startUrl;
  for (let hop = 0; hop <= MAX_URL_PROBE_REDIRECTS; hop += 1) {
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method,
        redirect: "manual",
        signal,
        headers,
      });
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      return {
        ok: false,
        failure: {
          ok: false,
          message: "Unable to verify the image URL.",
          detail: trimDetail(detail),
          statusCode: 422,
        },
      };
    }

    if (!REDIRECT_STATUS_CODES.has(response.status)) {
      return {
        ok: true,
        response,
      };
    }

    if (hop >= MAX_URL_PROBE_REDIRECTS) {
      return {
        ok: false,
        failure: {
          ok: false,
          message: "Image URL redirected too many times.",
          detail: "Redirect limit exceeded while probing image URL.",
          statusCode: 422,
        },
      };
    }

    const location = response.headers.get("location");
    if (!location) {
      return {
        ok: true,
        response,
      };
    }

    let redirectedUrl: URL;
    try {
      redirectedUrl = new URL(location, currentUrl);
    } catch {
      return {
        ok: false,
        failure: {
          ok: false,
          message: "Image URL returned an invalid redirect.",
          detail: `Invalid redirect location '${location}'.`,
          statusCode: 422,
        },
      };
    }

    const urlValidationFailure = await validateCandidateUrl(redirectedUrl, trustPolicy);
    if (urlValidationFailure) {
      return {
        ok: false,
        failure: urlValidationFailure,
      };
    }
    currentUrl = redirectedUrl.toString();
  }

  return {
    ok: false,
    failure: {
      ok: false,
      message: "Image URL redirected too many times.",
      detail: "Redirect chain exceeded maximum hops.",
      statusCode: 422,
    },
  };
};

export const probeImageUrlForDescribe = async (imageUrl: string): Promise<UrlProbeResult> => {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return {
      ok: false,
      message: "Image URL must be a valid URL.",
      detail: "Invalid image URL.",
      statusCode: 422,
    };
  }
  const trustPolicy = buildHostTrustPolicy();
  const initialUrlValidationFailure = await validateCandidateUrl(parsed, trustPolicy);
  if (initialUrlValidationFailure) return initialUrlValidationFailure;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), URL_PROBE_TIMEOUT_MS);
  try {
    const headProbe = await probeWithRedirectSafety({
      startUrl: parsed.toString(),
      method: "HEAD",
      signal: controller.signal,
      trustPolicy,
    });
    if (!headProbe.ok) return headProbe.failure;
    let probeResponse = headProbe.response;

    if (!probeResponse.ok || probeResponse.status === 405 || probeResponse.status === 501) {
      const getProbe = await probeWithRedirectSafety({
        startUrl: parsed.toString(),
        method: "GET",
        signal: controller.signal,
        trustPolicy,
        headers: { Range: "bytes=0-0" },
      });
      if (!getProbe.ok) {
        if (!probeResponse.ok) return getProbe.failure;
      } else if (getProbe.response.ok || !probeResponse.ok) {
        probeResponse = getProbe.response;
      }
    }

    if (!probeResponse.ok) {
      return {
        ok: false,
        message: "Image URL is not publicly reachable.",
        detail: `Image URL responded with HTTP ${probeResponse.status}.`,
        statusCode: 422,
      };
    }

    const contentType = probeResponse.headers.get("content-type");
    if (!isImageContentType(contentType)) {
      return {
        ok: false,
        message: "Image URL did not return an image file.",
        detail: `Unexpected content-type: ${contentType}`,
        statusCode: 422,
      };
    }
    return { ok: true };
  } finally {
    clearTimeout(timeoutId);
  }
};
