import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@scomap/db", "maplibre-gl"],
};

export default nextConfig;
