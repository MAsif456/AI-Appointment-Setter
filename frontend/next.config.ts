import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security-headers";

/*
 * Apply HTTP security headers to every Next.js response via the global
 * `headers()` async function. The path matcher `/(.*)` covers every
 * current and future page so new routes are automatically protected
 * without any per-page configuration, in line with the "secure by
 * default" principle.
 *
 * The actual header values come from src/lib/security-headers.ts so
 * the policy is unit-testable in isolation and lives in one place
 * for review.
 */
const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders(isProduction, apiUrl),
      },
    ];
  },
};

export default nextConfig;
