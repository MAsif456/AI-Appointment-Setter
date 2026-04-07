import type { HelmetOptions } from "helmet";

/**
 * Environment-aware configuration factory for the `helmet` middleware.
 *
 * Centralising the helmet options here (rather than inlining them in
 * `main.ts`) keeps the bootstrap file thin and makes the security policy
 * unit-testable in isolation — we can assert the exact options returned
 * for each environment without having to boot the whole Nest application.
 *
 * Design notes:
 * - HSTS is gated on `NODE_ENV === "production"`. Emitting `Strict-Transport-Security`
 *   while developing against `http://localhost` would force browsers to require
 *   HTTPS on localhost for a full year, breaking every teammate's local workflow.
 * - CSP is intentionally disabled on the backend (`contentSecurityPolicy: false`).
 *   The Next.js frontend owns the Content-Security-Policy header — it is the only
 *   component that serves HTML pages, and having two sources of CSP would produce
 *   conflicting / duplicated policies. The backend serves JSON APIs for which CSP
 *   is a no-op in modern browsers.
 * - `crossOriginResourcePolicy` is set to `cross-origin` so the frontend (running
 *   on a different origin in dev) can still fetch API responses; CORS remains the
 *   authoritative access-control mechanism.
 * - Other headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
 *   X-DNS-Prefetch-Control, etc.) use helmet's secure defaults and apply in
 *   every environment.
 */

/** Default HSTS max-age: 12 months in seconds, per the acceptance criteria. */
export const HSTS_MAX_AGE_SECONDS = 31_536_000;

/**
 * Build the helmet options for the current environment.
 *
 * @param nodeEnv - The value of `process.env.NODE_ENV`. Accepts `undefined` so
 *   callers can pass `process.env.NODE_ENV` directly without coercion.
 * @returns A `HelmetOptions` object ready to pass to `app.use(helmet(...))`.
 */
export function buildHelmetOptions(nodeEnv: string | undefined): HelmetOptions {
  const isProduction = nodeEnv === "production";

  return {
    // Frontend owns CSP — see module header comment for rationale.
    contentSecurityPolicy: false,

    // HSTS: production only. In development this resolves to `false`, which
    // tells helmet to skip setting the header entirely.
    strictTransportSecurity: isProduction
      ? {
          maxAge: HSTS_MAX_AGE_SECONDS,
          includeSubDomains: true,
        }
      : false,

    // Defence-in-depth against clickjacking — complements `frame-ancestors 'none'`
    // in the frontend CSP so older browsers that don't honour CSP still refuse
    // to render the app inside an iframe.
    frameguard: { action: "deny" },

    // Prevent MIME sniffing of response bodies.
    noSniff: true,

    // Never leak full URL paths (which may contain conversation or clinic IDs)
    // to cross-origin destinations.
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },

    // Keep cross-origin JSON fetches from the frontend working without
    // weakening CORS (which is configured separately in `main.ts`).
    crossOriginResourcePolicy: { policy: "cross-origin" },

    // Hide the default `X-Powered-By: Express` fingerprint from responses.
    hidePoweredBy: true,
  };
}
