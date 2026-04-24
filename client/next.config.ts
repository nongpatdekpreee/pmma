import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/calendar",
        permanent: false,
      },
    ];
  },
  /** Dev: เรียก `/api` ที่ Next แล้วส่งต่อไป Express — ใช้เมื่อ NEXT_PUBLIC_API_URL ว่างหรือ same-origin */
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const target = (process.env.API_PROXY_TARGET || "http://127.0.0.1:5000").replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
