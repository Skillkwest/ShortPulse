/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: false,
  images: {
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 448, 512, 576],
    qualities: [20, 26, 34, 40, 50, 60, 70, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "**",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
