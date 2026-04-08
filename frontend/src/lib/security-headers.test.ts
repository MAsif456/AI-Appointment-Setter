import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  DEFAULT_API_URL,
  HSTS_MAX_AGE_SECONDS,
  SecurityHeader,
} from "./security-headers";

/**
 * Unit tests for the frontend security headers helper.
 *
 * The helper is the single source of truth for the dashboard's HTTP
 * security posture, so these tests deliberately lock down both the
 * directive structure and the dev-vs-prod differences. A regression
 * here (e.g. accidentally enabling HSTS in development, or losing
 * the report-uri) will fail CI loudly.
 */

const findHeader = (headers: SecurityHeader[], key: string): SecurityHeader | undefined =>
  headers.find((h) => h.key === key);

describe("buildContentSecurityPolicy", () => {
  const csp = buildContentSecurityPolicy("https://api.example.com");

  it("includes default-src 'self' as the fallback directive", () => {
    expect(csp).toContain("default-src 'self'");
  });

  it("locks script-src to 'self' with no third-party CDNs", () => {
    expect(csp).toContain("script-src 'self'");
  });

  it("allows 'unsafe-inline' in style-src so Next.js SSR critical CSS works", () => {
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("allows data: URIs in img-src for inline icons and placeholders", () => {
    expect(csp).toContain("img-src 'self' data:");
  });

  it("locks font-src to 'self' since next/font self-hosts at build time", () => {
    expect(csp).toContain("font-src 'self'");
  });

  it("includes the backend API origin in connect-src", () => {
    expect(csp).toContain("connect-src 'self' https://api.example.com");
  });

  it("sets frame-ancestors 'none' to prevent clickjacking", () => {
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("sets object-src 'none' to block legacy plugin abuse", () => {
    expect(csp).toContain("object-src 'none'");
  });

  it("sets base-uri 'self' to prevent base href injection", () => {
    expect(csp).toContain("base-uri 'self'");
  });

  it("sets form-action 'self' to prevent form hijacking", () => {
    expect(csp).toContain("form-action 'self'");
  });

  it("points report-uri at the backend CSP report endpoint", () => {
    expect(csp).toContain("report-uri https://api.example.com/security/csp-report");
  });

  it("separates directives with semicolons", () => {
    // The serialised header must use "; " between directives. Splitting
    // on "; " should produce one entry per directive declared above.
    const directives = csp.split("; ");
    expect(directives.length).toBeGreaterThanOrEqual(11);
  });
});

describe("buildSecurityHeaders", () => {
  describe("production mode", () => {
    const headers = buildSecurityHeaders(true, "https://api.example.com");

    it("uses the enforcing Content-Security-Policy header name", () => {
      expect(findHeader(headers, "Content-Security-Policy")).toBeDefined();
      expect(
        findHeader(headers, "Content-Security-Policy-Report-Only"),
      ).toBeUndefined();
    });

    it("includes Strict-Transport-Security with a 12-month max-age", () => {
      const hsts = findHeader(headers, "Strict-Transport-Security");
      expect(hsts).toBeDefined();
      expect(hsts!.value).toBe(
        `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
      );
      expect(HSTS_MAX_AGE_SECONDS).toBe(31_536_000);
    });

    it("sets X-Frame-Options: DENY", () => {
      expect(findHeader(headers, "X-Frame-Options")?.value).toBe("DENY");
    });

    it("sets X-Content-Type-Options: nosniff", () => {
      expect(findHeader(headers, "X-Content-Type-Options")?.value).toBe(
        "nosniff",
      );
    });

    it("sets Referrer-Policy: strict-origin-when-cross-origin", () => {
      expect(findHeader(headers, "Referrer-Policy")?.value).toBe(
        "strict-origin-when-cross-origin",
      );
    });

    it("disables camera, microphone, geolocation and payment via Permissions-Policy", () => {
      const policy = findHeader(headers, "Permissions-Policy");
      expect(policy?.value).toBe(
        "camera=(), microphone=(), geolocation=(), payment=()",
      );
    });
  });

  describe("development mode", () => {
    const headers = buildSecurityHeaders(false, "http://localhost:3001");

    it("uses Content-Security-Policy-Report-Only so violations do not break dev", () => {
      expect(
        findHeader(headers, "Content-Security-Policy-Report-Only"),
      ).toBeDefined();
      expect(findHeader(headers, "Content-Security-Policy")).toBeUndefined();
    });

    it("does NOT include Strict-Transport-Security", () => {
      expect(findHeader(headers, "Strict-Transport-Security")).toBeUndefined();
    });

    it("still applies the environment-independent headers", () => {
      expect(findHeader(headers, "X-Frame-Options")?.value).toBe("DENY");
      expect(findHeader(headers, "X-Content-Type-Options")?.value).toBe(
        "nosniff",
      );
      expect(findHeader(headers, "Referrer-Policy")?.value).toBe(
        "strict-origin-when-cross-origin",
      );
    });
  });

  describe("API URL handling", () => {
    it("falls back to the default API URL when an empty string is passed", () => {
      const headers = buildSecurityHeaders(true, "");
      const cspHeader = findHeader(headers, "Content-Security-Policy");
      expect(cspHeader?.value).toContain(`connect-src 'self' ${DEFAULT_API_URL}`);
      expect(cspHeader?.value).toContain(
        `report-uri ${DEFAULT_API_URL}/security/csp-report`,
      );
    });

    it("uses the supplied API URL verbatim when provided", () => {
      const headers = buildSecurityHeaders(true, "https://api.lunax.health");
      const cspHeader = findHeader(headers, "Content-Security-Policy");
      expect(cspHeader?.value).toContain(
        "connect-src 'self' https://api.lunax.health",
      );
    });
  });
});
