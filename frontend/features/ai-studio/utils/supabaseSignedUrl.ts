type JwtPayload = Record<string, unknown>;

export type SupabaseSignedObjectRef = {
  bucket: string;
  storagePath: string;
  expiresAtSeconds: number | null;
};

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(padded);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  throw new Error("No base64 decoder available");
};

const decodeJwtPayload = (token: string): JwtPayload | null => {
  const segments = token.split(".");
  if (segments.length < 2) return null;
  try {
    const rawPayload = decodeBase64Url(segments[1] ?? "");
    const parsed = JSON.parse(rawPayload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as JwtPayload;
  } catch {
    return null;
  }
};

export const parseSupabaseSignedObjectRef = (url: string): SupabaseSignedObjectRef | null => {
  try {
    const parsedUrl = new URL(url);
    const match = parsedUrl.pathname.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/i);
    if (!match) return null;
    const bucket = decodeURIComponent(match[1] ?? "").trim();
    const pathFromPathname = decodeURIComponent(match[2] ?? "").trim();
    if (!bucket || !pathFromPathname) return null;

    const token = parsedUrl.searchParams.get("token");
    const payload = token ? decodeJwtPayload(token) : null;
    const payloadUrl = typeof payload?.url === "string" ? payload.url.trim() : "";
    const payloadExp = typeof payload?.exp === "number" ? payload.exp : null;

    let storagePath = pathFromPathname;
    if (payloadUrl) {
      const normalized = payloadUrl.replace(/^\/+/, "");
      if (normalized.startsWith(`${bucket}/`)) {
        storagePath = normalized.slice(bucket.length + 1);
      }
    }
    if (!storagePath) return null;
    return {
      bucket,
      storagePath,
      expiresAtSeconds: payloadExp,
    };
  } catch {
    return null;
  }
};

export const shouldRefreshSupabaseSignedUrl = (
  expiresAtSeconds: number | null,
  refreshBufferSeconds: number
): boolean => {
  if (expiresAtSeconds == null) return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAtSeconds - nowSeconds <= refreshBufferSeconds;
};
