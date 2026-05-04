import { Controller, Get, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import helmet from "helmet";
import request from "supertest";
import { buildHelmetOptions } from "./security-headers.config";

/**
 * Integration test for the global helmet middleware.
 *
 * Instead of importing the full AppModule (which would require a live
 * MongoDB instance and every downstream dependency), this spec boots a
 * minimal Nest application with a single dummy controller and applies the
 * exact same `app.use(helmet(buildHelmetOptions(...)))` call that
 * `main.ts` uses in production. This proves two things:
 *
 * 1. The security headers produced by our config factory are actually
 *    emitted by helmet when wired into a real Nest request pipeline.
 * 2. A brand-new controller added with zero security configuration
 *    is automatically protected. This is the "secure by default"
 *    guarantee that the architectural requirement depends on.
 */

/** A throwaway controller standing in for any future route. */
@Controller()
class DummyController {
  @Get("ping")
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

/**
 * Build a minimal Nest test app with helmet applied for the given NODE_ENV.
 * Factored into a helper so individual tests stay declarative.
 */
async function buildApp(nodeEnv: string | undefined): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [DummyController],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(helmet(buildHelmetOptions(nodeEnv)));
  await app.init();
  return app;
}

describe("Global helmet middleware (integration)", () => {
  describe("development environment", () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp("development");
    });

    afterAll(async () => {
      await app.close();
    });

    it("sets X-Frame-Options: DENY on every response", async () => {
      const res = await request(app.getHttpServer()).get("/ping").expect(200);
      expect(res.headers["x-frame-options"]).toBe("DENY");
    });

    it("sets X-Content-Type-Options: nosniff", async () => {
      const res = await request(app.getHttpServer()).get("/ping").expect(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("sets Referrer-Policy: strict-origin-when-cross-origin", async () => {
      const res = await request(app.getHttpServer()).get("/ping").expect(200);
      expect(res.headers["referrer-policy"]).toBe(
        "strict-origin-when-cross-origin",
      );
    });

    it("hides the X-Powered-By fingerprint", async () => {
      const res = await request(app.getHttpServer()).get("/ping").expect(200);
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("does NOT set Strict-Transport-Security in development", async () => {
      const res = await request(app.getHttpServer()).get("/ping").expect(200);
      expect(res.headers["strict-transport-security"]).toBeUndefined();
    });

    it("sets Cross-Origin-Resource-Policy: cross-origin", async () => {
      // Required so the Next.js frontend on a different origin can still
      // fetch API responses without being blocked by CORP.
      const res = await request(app.getHttpServer()).get("/ping").expect(200);
      expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    });
  });

  describe("production environment", () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp("production");
    });

    afterAll(async () => {
      await app.close();
    });

    it("sets Strict-Transport-Security with a 12-month max-age and includeSubDomains", async () => {
      const res = await request(app.getHttpServer()).get("/ping").expect(200);
      expect(res.headers["strict-transport-security"]).toBe(
        "max-age=31536000; includeSubDomains",
      );
    });

    it("still sets the environment-independent headers in production", async () => {
      const res = await request(app.getHttpServer()).get("/ping").expect(200);
      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["referrer-policy"]).toBe(
        "strict-origin-when-cross-origin",
      );
    });
  });

  describe("automatic protection of new routes", () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp("production");
    });

    afterAll(async () => {
      await app.close();
    });

    it("protects a newly added route with zero per-route configuration", async () => {
      // DummyController.ping was added with no decorators, no middleware and
      // no security annotations. The fact that helmet still covers it is the
      // whole point of the global-middleware design.
      const res = await request(app.getHttpServer()).get("/ping").expect(200);

      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["strict-transport-security"]).toContain(
        "max-age=31536000",
      );
    });
  });
});
