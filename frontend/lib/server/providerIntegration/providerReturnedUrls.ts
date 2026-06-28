/**
 * Utilities for deriving trusted provider status/result bases from provider-returned URLs.
 */

const REQUEST_STATUS_SUFFIX = "/status";

const uniqueStrings = (values: readonly (string | null | undefined)[]): string[] => {
  const seen = new Set<string>();
  const next: string[] = [];
  values.forEach((value) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    next.push(normalized);
  });
  return next;
};

/**
 * Derives a Fal queue base URL from provider-returned status or response URLs.
 */
export const deriveFalStatusBaseFromProviderUrl = ({
  requestId,
  url,
}: {
  requestId: string;
  url: string | null;
}): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const requestSegment = `/${encodeURIComponent(requestId)}`;
    if (parsed.pathname.endsWith(`${requestSegment}${REQUEST_STATUS_SUFFIX}`)) {
      parsed.pathname = parsed.pathname.slice(
        0,
        -`${requestSegment}${REQUEST_STATUS_SUFFIX}`.length
      );
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString().replace(/\/+$/, "");
    }
    if (parsed.pathname.endsWith(requestSegment)) {
      parsed.pathname = parsed.pathname.slice(0, -requestSegment.length);
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString().replace(/\/+$/, "");
    }
  } catch {
    return null;
  }
  return null;
};

/**
 * Resolves deduped Fal queue bases from provider-returned status/response URLs.
 */
export const resolveFalStatusBaseUrlsFromProviderUrls = ({
  requestId,
  providerStatusUrl,
  providerResponseUrl,
}: {
  requestId: string;
  providerStatusUrl: string | null;
  providerResponseUrl: string | null;
}): string[] =>
  uniqueStrings([
    deriveFalStatusBaseFromProviderUrl({
      requestId,
      url: providerStatusUrl,
    }),
    deriveFalStatusBaseFromProviderUrl({
      requestId,
      url: providerResponseUrl,
    }),
  ]);

/**
 * Returns a deduped list of provider URL candidates while preserving input order.
 */
export const uniqueProviderUrls = (values: readonly (string | null | undefined)[]): string[] =>
  uniqueStrings(values);
