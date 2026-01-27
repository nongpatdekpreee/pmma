import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Turbopack configuration (Next.js 16 default)
  // Empty config to silence the error - Turbopack should resolve modules correctly by default
  turbopack: {},
  
  // Webpack configuration (used when running with --webpack flag)
  webpack: (config, { isServer }) => {
    // Ensure webpack resolves modules from the client directory first
    const clientNodeModules = path.resolve(__dirname, "node_modules");
    config.resolve.modules = [
      clientNodeModules,
      ...(Array.isArray(config.resolve.modules) ? config.resolve.modules : ["node_modules"]),
    ];
    
    // Also set resolve.alias to ensure tailwindcss resolves correctly
    config.resolve.alias = {
      ...config.resolve.alias,
      tailwindcss: path.resolve(clientNodeModules, "tailwindcss"),
    };
    
    return config;
  },
};

export default nextConfig;
