import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Upload de documentos ao Drive passa por Server Action; o default (1MB) é baixo.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
