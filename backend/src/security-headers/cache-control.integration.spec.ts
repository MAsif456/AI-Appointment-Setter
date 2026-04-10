import { Controller, Get, INestApplication } from "@nestjs/common";
import { APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import {
  CacheControlInterceptor,
  SENSITIVE_CACHE_CONTROL,
  SENSITIVE_PRAGMA,
} from "./cache-control.interceptor";
import { SensitiveData } from "./sensitive-data.decorator";

/**
 * End-to-end style integration test for the CacheControlInterceptor
 * wired as a global APP_INTERCEPTOR. The point of this spec is to
 * verify the decorator-plus-interceptor pair behaves correctly when
 * actually mounted in a Nest pipeline, not just in isolation.
 *
 * The spec registers two dummy controllers in a throwaway test module:
 *   - PatientLikeController marked with @SensitiveData() at the class
 *     level (standing in for Conversations / Analytics / Appointments)
 *   - PublicController with no decorator (standing in for health
 *     checks or other non-sensitive endpoints)
 *
 * We then assert that only the sensitive controller receives the
 * strict cache headers, which locks in the "per-route opt-in" contract
 * the architectural requirement depends on.
 */

@SensitiveData()
@Controller("patient-like")
class PatientLikeController {
  @Get("summary")
  summary(): { firstName: string } {
    return { firstName: "Alice" };
  }

  @Get("history")
  history(): { events: unknown[] } {
    return { events: [] };
  }
}

@Controller("public")
class PublicController {
  @Get("health")
  health(): { status: string } {
    return { status: "ok" };
  }
}

describe("CacheControlInterceptor (integration)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PatientLikeController, PublicController],
      providers: [
        Reflector,
        { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("routes marked with @SensitiveData() at class level", () => {
    it("returns strict no-store Cache-Control on /patient-like/summary", async () => {
      const res = await request(app.getHttpServer())
        .get("/patient-like/summary")
        .expect(200);

      expect(res.headers["cache-control"]).toBe(SENSITIVE_CACHE_CONTROL);
      expect(res.headers["pragma"]).toBe(SENSITIVE_PRAGMA);
    });

    it("applies the headers to every handler on the marked class", async () => {
      // Proves the class-level decorator covers sibling handlers too,
      // which is the whole point of using class-level @SensitiveData()
      // on Conversations / Appointments / Analytics.
      const res = await request(app.getHttpServer())
        .get("/patient-like/history")
        .expect(200);

      expect(res.headers["cache-control"]).toBe(SENSITIVE_CACHE_CONTROL);
      expect(res.headers["pragma"]).toBe(SENSITIVE_PRAGMA);
    });
  });

  describe("routes without @SensitiveData()", () => {
    it("does not set the strict no-store Cache-Control header", async () => {
      const res = await request(app.getHttpServer())
        .get("/public/health")
        .expect(200);

      // Nest / Express does not set a Cache-Control header by default,
      // so the assertion is "the strict string is not present". This
      // lets the test stay robust if a future global default is added.
      expect(res.headers["cache-control"]).not.toBe(SENSITIVE_CACHE_CONTROL);
      expect(res.headers["pragma"]).toBeUndefined();
    });
  });
});
