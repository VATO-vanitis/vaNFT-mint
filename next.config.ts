import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // allow embedding on your WP site(s)
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://vato.international https://www.vato.international;" }
        ],
      },
    ];
  },
};

export default nextConfig;
