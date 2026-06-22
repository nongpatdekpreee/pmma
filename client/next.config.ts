import path from "path";
import type { NextConfig } from "next";

/** LAN dev — ใส่ใน client/.env เช่น ALLOWED_DEV_ORIGINS=192.168.60.69 */
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || "192.168.60.69")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  /** ให้เครื่องอื่นใน LAN โหลด /_next/* ตอน dev (ไม่งั้นหน้าเปล่า/พัง) */
  allowedDevOrigins: ["localhost", "127.0.0.1","192.168.60.114", "http://192.168.60.114:3000",
    "http://localhost:3000", ...allowedDevOrigins],
  experimental: {
    /** Dev proxy (/api → Express): default 10MB truncates uploads; match backend multer (30MB) */
    proxyClientMaxBodySize: "30mb",
  },
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
  /** Dev: เรียก `/api` และ `/uploads` ที่ Next แล้วส่งต่อไป Express */
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const target = (process.env.API_PROXY_TARGET || "http://127.0.0.1:5000").replace(/\/$/, "");
    return [
      { source: "/api/:path*", destination: `${target}/api/:path*` },
      { source: "/uploads/:path*", destination: `${target}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
