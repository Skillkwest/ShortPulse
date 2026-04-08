/** @type {import('next').NextConfig} */
const BUILT_IN_EXTERNAL_DIRECT_PREVIEW_HOSTS = ["tempfile.aiquickdraw.com"];

const normalizeHostname = (value) => value.trim().toLowerCase().replace(/\.$/, "");

const parseHostEntry = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return normalizeHostname(new URL(trimmed).hostname);
  } catch {
    return normalizeHostname(trimmed.replace(/^https?:\/\//i, "").split("/")[0] ?? "");
  }
};

const parseHostList = (raw) => {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((entry) => parseHostEntry(entry))
    .filter((entry) => Boolean(entry));
};

const resolveSupabaseHost = () => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return normalizeHostname(new URL(raw).hostname);
  } catch {
    return null;
  }
};

const isLocalHost = (hostname) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

const resolveTrustedImageHosts = () => {
  const hosts = new Set();
  const supabaseHost = resolveSupabaseHost();
  if (supabaseHost) hosts.add(supabaseHost);
  // Public demo/stub assets referenced across landing/performance surfaces.
  hosts.add("images.pexels.com");

  for (const host of parseHostList(
    process.env.SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS ??
      process.env.NEXT_PUBLIC_MEDIA_DIRECT_URL_ALLOWED_HOSTS
  )) {
    hosts.add(host);
  }
  for (const host of BUILT_IN_EXTERNAL_DIRECT_PREVIEW_HOSTS) {
    hosts.add(host);
  }

  hosts.add("localhost");
  hosts.add("127.0.0.1");
  return Array.from(hosts);
};

const resolveImageRemotePatterns = () =>
  resolveTrustedImageHosts().flatMap((hostname) => {
    if (isLocalHost(hostname)) {
      return [
        { protocol: "http", hostname, pathname: "/**" },
        { protocol: "https", hostname, pathname: "/**" },
      ];
    }
    return [{ protocol: "https", hostname, pathname: "/**" }];
  });

const nextConfig = {
  reactStrictMode: true,
  reactCompiler: false,
  images: {
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 448, 512, 576],
    qualities: [24, 26, 34, 40, 50, 60, 70, 75],
    remotePatterns: resolveImageRemotePatterns(),
  },
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
