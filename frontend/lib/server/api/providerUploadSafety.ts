/**
 * Shared provider-upload safety primitives for authenticated staging routes.
 * Keeps private-network URL blocking, redirect checks, and byte caps consistent
 * without merging provider-specific Fal/Kie upload authority.
 */
import { Buffer } from "node:buffer";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { NextApiRequest } from "next";

const DEFAULT_DNS_LOOKUP_TIMEOUT_MS = 2_500;
const DEFAULT_MAX_SOURCE_REDIRECTS = 3;

/**
 * Error raised when a provider-upload source or body violates safety limits.
 */
export class ProviderUploadSafetyError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ProviderUploadSafetyError";
    this.statusCode = statusCode;
  }
}

type FetchPublicProviderSourceOptions = {
  signal: AbortSignal;
  maxRedirects?: number;
};

const normalizeHostname = (hostname: string): string =>
  hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[(.*)\]$/, "$1");

const isPrivateIpv4Address = (hostname: string): boolean => {
  const match = normalizeHostname(hostname).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map((segment) => Number.parseInt(segment, 10));
  if (octets.some((octet) => !Number.isFinite(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  if (first === 0) return true;
  if (first === 10) return true;
  if (first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 198 && (second === 18 || second === 19)) return true;
  return false;
};

const isPrivateIpv6Address = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8")) return true;
  if (normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea")) return true;
  if (normalized.startsWith("feb")) return true;
  return false;
};

const isBlockedPrivateAddress = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4Address(normalized);
  if (ipVersion === 6) return isPrivateIpv6Address(normalized);
  return false;
};

const isLocalOrPrivateHostname = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  return isBlockedPrivateAddress(normalized);
};

const resolveHostAddresses = async (hostname: string): Promise<string[] | null> => {
  try {
    const records = await Promise.race([
      dnsLookup(hostname, { all: true }),
      new Promise<never>((_, reject) => {
        globalThis.setTimeout(
          () => reject(new Error("dns_lookup_timeout")),
          DEFAULT_DNS_LOOKUP_TIMEOUT_MS
        );
      }),
    ]);
    return records
      .map((record) => (typeof record.address === "string" ? record.address : ""))
      .filter((address) => address.length > 0);
  } catch {
    return null;
  }
};

/**
 * Reject local/private source URLs before provider staging fetches them.
 */
export const assertPublicProviderNetworkUrl = async (sourceUrl: URL): Promise<void> => {
  if (isLocalOrPrivateHostname(sourceUrl.hostname)) {
    throw new ProviderUploadSafetyError("fileUrl cannot target a local or private-network host.");
  }
  if (isIP(normalizeHostname(sourceUrl.hostname)) !== 0) return;

  const addresses = await resolveHostAddresses(sourceUrl.hostname);
  if (!addresses?.length) {
    throw new ProviderUploadSafetyError("fileUrl host could not be resolved.");
  }
  if (addresses.some((address) => isBlockedPrivateAddress(address))) {
    throw new ProviderUploadSafetyError("fileUrl host resolved to a private-network address.");
  }
};

/**
 * Parse and validate an HTTP(S) provider source URL.
 */
export const parseSafeProviderHttpUrl = async (value: string): Promise<URL> => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ProviderUploadSafetyError("fileUrl must be a valid http(s) URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ProviderUploadSafetyError("fileUrl must use http or https.");
  }
  await assertPublicProviderNetworkUrl(parsed);
  return parsed;
};

const isRedirectStatus = (status: number): boolean =>
  status === 301 || status === 302 || status === 303 || status === 307 || status === 308;

/**
 * Fetch a public source URL with manual redirect validation on each hop.
 */
export const fetchPublicProviderSource = async (
  sourceUrl: URL,
  { signal, maxRedirects = DEFAULT_MAX_SOURCE_REDIRECTS }: FetchPublicProviderSourceOptions
): Promise<Response> => {
  let currentUrl = sourceUrl;
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicProviderNetworkUrl(currentUrl);
    const sourceResponse = await fetch(currentUrl.toString(), {
      method: "GET",
      redirect: "manual",
      signal,
    });

    if (!isRedirectStatus(sourceResponse.status)) return sourceResponse;

    const location = sourceResponse.headers.get("location");
    if (!location) {
      throw new ProviderUploadSafetyError("Source URL redirected without a Location header.");
    }
    try {
      currentUrl = await parseSafeProviderHttpUrl(new URL(location, currentUrl).toString());
    } catch (error) {
      if (error instanceof ProviderUploadSafetyError) throw error;
      throw new ProviderUploadSafetyError("Source URL redirected to an invalid URL.");
    }
  }

  throw new ProviderUploadSafetyError("Source URL redirected too many times.");
};

/**
 * Read a fetched or stored source body into a Buffer with a hard byte cap.
 */
export const readProviderBodyWithLimit = async (
  response: Response | Blob,
  maxBytes: number
): Promise<Buffer> => {
  const rawContentLength = "headers" in response ? response.headers.get("content-length") : null;
  const contentLength = Number(rawContentLength);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ProviderUploadSafetyError("Source file exceeds the maximum upload size.", 413);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    throw new ProviderUploadSafetyError("Source file exceeds the maximum upload size.", 413);
  }
  return Buffer.from(arrayBuffer);
};

/**
 * Read a binary API request body into a Buffer with a hard byte cap.
 */
export const readBinaryProviderRequestBody = async (
  req: NextApiRequest,
  maxBytes: number
): Promise<Buffer> =>
  await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let done = false;

    const fail = (error: unknown) => {
      if (done) return;
      done = true;
      reject(error);
    };

    req.on("data", (chunk) => {
      if (done) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > maxBytes) {
        if (typeof req.destroy === "function") req.destroy();
        fail(new ProviderUploadSafetyError("Upload body exceeds the maximum upload size.", 413));
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks));
    });
    req.on("error", fail);
  });
