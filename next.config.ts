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
};

export default nextConfig;
