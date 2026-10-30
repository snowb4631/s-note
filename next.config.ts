import type { NextConfig } from "next";

const fontFiles = ["./src/fonts/NanumPenScript-Regular.ttf", "./src/fonts/OFL.txt"];

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  serverExternalPackages: ["@react-pdf/renderer"],
  // The PDF font is read with fs at runtime, so tracing cannot see it by itself.
  outputFileTracingIncludes: {
    "/api/pdf": fontFiles,
    "/api/send": fontFiles,
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
