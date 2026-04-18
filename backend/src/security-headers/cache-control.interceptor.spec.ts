import { CallHandler, ExecutionContext, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of } from "rxjs";
import {
  CacheControlInterceptor,
  SENSITIVE_CACHE_CONTROL,
  SENSITIVE_PRAGMA,
} from "./cache-control.interceptor";
import { SENSITIVE_DATA_METADATA_KEY } from "./sensitive-data.decorator";

/**
 * Unit tests for CacheControlInterceptor.
 *
 * The interceptor is deliberately small but its contract is important,
 * so these tests cover:
 *
 * 1. Sensitive routes receive the strict no-store headers.
 * 2. Non-sensitive routes are left untouched (per-route opt-in).
 * 3. Controller-level metadata is honoured (class decoration).
 * 4. Handler-level metadata takes precedence over class-level absence.
 * 5. Fail-open behaviour when `res.setHeader` throws.
 */
describe("CacheControlInterceptor", () => {
  let interceptor: CacheControlInterceptor;
  let reflector: jest.Mocked<Reflector>;
  let setHeader: jest.Mock;
  let ctx: ExecutionContext;
  let next: CallHandler;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    interceptor = new CacheControlInterceptor(reflector);

    setHeader = jest.fn();
    ctx = {
      getHandler: jest.fn().mockReturnValue(() => undefined),
      getClass: jest.fn().mockReturnValue(class TestController {}),
      switchToHttp: () => ({
        getResponse: () => ({ setHeader }),
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    next = { handle: () => of({ ok: true }) };
  });

  describe("sensitive routes", () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(true);
    });

    it("sets Cache-Control to no-store, no-cache, must-revalidate, private", () => {
      interceptor.intercept(ctx, next);
      expect(setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        SENSITIVE_CACHE_CONTROL,
      );
      expect(SENSITIVE_CACHE_CONTROL).toBe(
        "no-store, no-cache, must-revalidate, private",
      );
    });

    it("sets Pragma: no-cache for HTTP/1.0 compatibility", () => {
      interceptor.intercept(ctx, next);
      expect(setHeader).toHaveBeenCalledWith("Pragma", SENSITIVE_PRAGMA);
      expect(SENSITIVE_PRAGMA).toBe("no-cache");
    });

    it("reads metadata from both the handler and the controller class", () => {
      interceptor.intercept(ctx, next);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        SENSITIVE_DATA_METADATA_KEY,
        [expect.any(Function), expect.any(Function)],
      );
    });

    it("forwards the handler observable unchanged", (done) => {
      interceptor.intercept(ctx, next).subscribe((value) => {
        expect(value).toEqual({ ok: true });
        done();
      });
    });
  });

  describe("non-sensitive routes", () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
    });

    it("does not set any cache headers", () => {
      interceptor.intercept(ctx, next);
      expect(setHeader).not.toHaveBeenCalled();
    });

    it("still passes the request through to the next handler", (done) => {
      interceptor.intercept(ctx, next).subscribe((value) => {
        expect(value).toEqual({ ok: true });
        done();
      });
    });
  });

  describe("fail-open behaviour", () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(true);
      setHeader.mockImplementation(() => {
        throw new Error("stream already flushed");
      });
      // Silence the expected warning so the test output stays clean.
      jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("does not throw when res.setHeader fails", () => {
      expect(() => interceptor.intercept(ctx, next)).not.toThrow();
    });

    it("still returns the handler observable so the request completes", (done) => {
      interceptor.intercept(ctx, next).subscribe((value) => {
        expect(value).toEqual({ ok: true });
        done();
      });
    });

    it("logs a warning describing the failure", () => {
      const warnSpy = jest.spyOn(Logger.prototype, "warn");
      interceptor.intercept(ctx, next);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("stream already flushed"),
      );
    });
  });
});
