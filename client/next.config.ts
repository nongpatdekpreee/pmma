import path from "path";
import type { NextConfig } from "next";

/** แปลง IP / URL เป็น host ที่ Next ใช้ใน allowedDevOrigins (เช่น 10.4.52.7:3000) */
function toDevOriginHost(entry: string, port = "3000"): string {
  const raw = entry.trim();
  if (!raw) return "";
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).host;
  } catch {
    /* fall through */
  }
  if (raw.includes(":")) return raw;
  return `${raw}:${port}`;
}

/** LAN dev — ใส่ใน client/.env.local เช่น ALLOWED_DEV_ORIGINS=10.4.52.7,10.3.231.120 */
const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((s) => toDevOriginHost(s))
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  /** ให้เครื่องอื่นใน LAN โหลด /_next/* ตอน dev (ไม่งั้นหน้าเปล่า/พัง) */
  allowedDevOrigins: [
    "localhost:3000",
    "192.168.60.75:3000",
    "192.168.60.75",
    "127.0.0.1:3000",
    "localhost",
    "127.0.0.1",
    
    ...extraDevOrigins,
  ],
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
