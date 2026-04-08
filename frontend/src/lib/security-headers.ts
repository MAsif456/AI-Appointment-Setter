/**
 * Frontend HTTP security headers helper.
 *
 * This module is the single source of truth for the security headers
 * applied to every Next.js response by `next.config.ts`. Keeping the
 * policy here (rather than inlining it in the Next config) makes it
 * unit-testable in isolation and gives reviewers one place to audit
 * the entire security posture of the dashboard.
 *
 * Architectural intent: the values returned here are wired into a
 * single `headers()` entry in `next.config.ts` that matches `/(.*)`,
 * so every current and future page is automatically protected with
 * zero per-page configuration. New routes added by the team get the
 * same protection without anyone touching this file.
 */

/** HSTS max-age in seconds (12 months), per the acceptance criteria. */
export const HSTS_MAX_AGE_SECONDS = 31_536_000;

/** Default backend API origin used when NEXT_PUBLIC_API_URL is unset. */
export const DEFAULT_API_URL = "http://localhost:3001";

/**
 * Shape of a single header entry as expected by `next.config.ts`.
 * Mirrors Next.js's own `Header['headers']` element type without
 * pulling in `next` as a dependency of this helper, so the file
 * remains trivially unit-testable in a plain Node environment.
 */
export interface SecurityHeader {
  key: string;
  value: string;
}

/**
 * Build the Content-Security-Policy directive string.
 *
 * The directives below are calibrated against the actual frontend
 * dependencies discovered in the codebase:
 *
 *   - default-src 'self': fall-through for any directive not listed.
 *   - script-src 'self': no third-party JavaScript is loaded by the
 *     dashboard. Sentry, Google Analytics, Vercel Analytics and any
 *     other CDN scripts are all absent from package.json.
 *   - style-src 'self' 'unsafe-inline': Next.js App Router inlines
 *     critical CSS into <style> tags during SSR for above-the-fold
 *     content. Without 'unsafe-inline' the dashboard would render
 *     unstyled. Tailwind is NOT used in this project, so the usual
 *     "Tailwind needs unsafe-inline" framing does not apply, but
 *     Next.js's own SSR pipeline still requires it.
 *   - img-src 'self' data:: data: URIs are needed for inline SVG
 *     icons (lucide-react) and Next.js placeholder images.
 *   - font-src 'self': next/font/google self-hosts the Inter font
 *     at build time, so no runtime fetch to fonts.gstatic.com.
 *   - connect-src 'self' <api>: lock XHR/fetch/EventSource targets
 *     to the dashboard origin and the configured backend API.
 *   - frame-ancestors 'none': anti-clickjacking, complements
 *     X-Frame-Options for browsers that honour CSP frame-ancestors.
 *   - base-uri 'self': prevent <base href> injection from rewriting
 *     relative URLs to attacker-controlled origins.
 *   - form-action 'self': forms can only POST to the dashboard
 *     origin, blocking phishing-style form hijacks.
 *   - object-src 'none': no Flash, no plugins, no <object> abuse.
 *   - report-uri <api>/security/csp-report: violations from real
 *     browsers are sent to the backend reporting endpoint added
 *     in Chunk 8 so the team can monitor and tune the policy.
 *
 * @param apiUrl - Backend API origin (from NEXT_PUBLIC_API_URL).
 * @returns The serialised CSP value, ready to use as an HTTP header.
 */
export function buildContentSecurityPolicy(apiUrl: string): string {
  const directives: Array<[string, string]> = [
    ["default-src", "'self'"],
    ["script-src", "'self'"],
    ["style-src", "'self' 'unsafe-inline'"],
    ["img-src", "'self' data:"],
    ["font-src", "'self'"],
    ["connect-src", `'self' ${apiUrl}`],
    ["frame-ancestors", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["object-src", "'none'"],
    ["report-uri", `${apiUrl}/security/csp-report`],
  ];

  return directives.map(([name, value]) => `${name} ${value}`).join("; ");
}

/**
 * Build the full set of security headers for the current environment.
 *
 * @param isProduction - Whether the build is for production. In dev
 *   we use Content-Security-Policy-Report-Only so policy violations
 *   are surfaced in the browser console without breaking the dev
 *   workflow, and HSTS is omitted entirely so localhost stays usable.
 * @param apiUrl - Backend API origin. Falls back to localhost:3001
 *   if the caller passes an empty string, matching the default that
 *   the frontend already uses elsewhere in the codebase.
 * @returns An array of `{ key, value }` headers ready for `next.config.ts`.
 */
export function buildSecurityHeaders(
  isProduction: boolean,
  apiUrl: string,
): SecurityHeader[] {
  const resolvedApiUrl = apiUrl || DEFAULT_API_URL;
  const csp = buildContentSecurityPolicy(resolvedApiUrl);

  // CSP header name flips between enforcing and report-only depending on
  // environment. The directive contents are identical so dev violations
  // accurately predict what would block in production.
  const cspHeaderName = isProduction
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";

  const headers: SecurityHeader[] = [
    { key: cspHeaderName, value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
  ];

  // HSTS is production-only. Emitting it during local HTTP development
  // would force browsers to require HTTPS on localhost for a full year,
  // breaking every teammate's local workflow.
  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
    });
  }

  return headers;
}
