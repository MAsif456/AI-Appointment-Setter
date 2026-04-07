import {
  buildHelmetOptions,
  HSTS_MAX_AGE_SECONDS,
} from "./security-headers.config";

/**
 * Unit tests for the helmet options factory.
 *
 * These tests lock in the environment-gating behaviour so a future change
 * that accidentally enables HSTS in development (and thereby breaks every
 * teammate's localhost workflow) will fail CI loudly.
 */
describe("buildHelmetOptions", () => {
  describe("HSTS gating", () => {
    it("enables HSTS with a 12-month max-age in production", () => {
      const options = buildHelmetOptions("production");

      expect(options.strictTransportSecurity).toEqual({
        maxAge: HSTS_MAX_AGE_SECONDS,
        includeSubDomains: true,
      });
      expect(HSTS_MAX_AGE_SECONDS).toBe(31_536_000);
    });

    it("disables HSTS in development", () => {
      const options = buildHelmetOptions("development");
      expect(options.strictTransportSecurity).toBe(false);
    });

    it("disables HSTS in test", () => {
      const options = buildHelmetOptions("test");
      expect(options.strictTransportSecurity).toBe(false);
    });

    it("disables HSTS when NODE_ENV is undefined", () => {
      const options = buildHelmetOptions(undefined);
      expect(options.strictTransportSecurity).toBe(false);
    });

    it("disables HSTS for any non-production value", () => {
      const options = buildHelmetOptions("staging");
      expect(options.strictTransportSecurity).toBe(false);
    });
  });

  describe("core security headers (environment-independent)", () => {
    it.each(["production", "development", "test", undefined])(
      "applies clickjacking, MIME-sniffing and referrer protections when NODE_ENV=%s",
      (env) => {
        const options = buildHelmetOptions(env);

        expect(options.frameguard).toEqual({ action: "deny" });
        expect(options.noSniff).toBe(true);
        expect(options.referrerPolicy).toEqual({
          policy: "strict-origin-when-cross-origin",
        });
        expect(options.hidePoweredBy).toBe(true);
      },
    );
  });

  describe("CSP ownership", () => {
    it("disables helmet CSP so the Next.js frontend can own it", () => {
      // The backend serves only JSON APIs — CSP is a no-op on those responses
      // in modern browsers, and having two CSP sources would produce duplicate
      // / conflicting headers on HTML responses proxied through the API.
      const options = buildHelmetOptions("production");
      expect(options.contentSecurityPolicy).toBe(false);
    });
  });

  describe("cross-origin policy", () => {
    it("uses cross-origin CORP so the frontend can fetch API responses", () => {
      const options = buildHelmetOptions("production");
      expect(options.crossOriginResourcePolicy).toEqual({
        policy: "cross-origin",
      });
    });
  });
});
