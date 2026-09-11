import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "jszip",
    "@hyzyla/pdfium",
    "sharp",
    "mammoth",
  ],
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
