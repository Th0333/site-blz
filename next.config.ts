import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacotes com binários/wasm ficam fora do bundle do servidor
  serverExternalPackages: ["@electric-sql/pglite", "sharp", "pg"],
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
