import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  allowedDevOrigins: [
    "*.natapp.cc",
    "*.natapp1.cc",
    "*.natapp.link",
  ],
  serverExternalPackages: ["pdf-parse", "jszip"],
};

export default nextConfig;
