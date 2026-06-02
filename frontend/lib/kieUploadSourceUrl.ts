const KIE_STREAM_UPLOAD_SIGNED_QUERY_KEYS = [
  "token",
  "x-amz-signature",
  "x-amz-security-token",
  "signature",
  "sig",
] as const;

const toUrl = (value: string | URL): URL | null => {
  if (value instanceof URL) return value;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

export const prefersKieRemoteStreamUpload = (value: string | URL): boolean => {
  const parsedUrl = toUrl(value);
  if (!parsedUrl) return false;

  if (parsedUrl.pathname.toLowerCase().includes("/storage/v1/object/sign/")) {
    return true;
  }

  const queryParamNames = new Set(
    Array.from(parsedUrl.searchParams.keys(), (key) => key.trim().toLowerCase())
  );
  return KIE_STREAM_UPLOAD_SIGNED_QUERY_KEYS.some((key) => queryParamNames.has(key));
};
