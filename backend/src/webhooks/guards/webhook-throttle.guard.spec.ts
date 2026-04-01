import { HttpException, HttpStatus } from "@nestjs/common";
import { WebhookThrottleGuard } from "./webhook-throttle.guard";
import { WEBHOOK_RATE_LIMIT } from "../constants/webhook.constants";

describe("WebhookThrottleGuard", () => {
  let guard: WebhookThrottleGuard;

  /**
   * Creates a mock ExecutionContext object for testing the WebhookThrottleGuard.
   *
   * @param {string} ip - The IP address to use in the mock request.
   * @param {string} [locationId] - The location ID to use in the mock request body.
   * @returns {ExecutionContext} - A mock ExecutionContext object.
   */
  function createMockContext(ip: string, locationId?: string) {
    const body: Record<string, unknown> = {};
    if (locationId) body.location = { id: locationId };

    return {
  /**
   * Returns a mock HTTP request object containing the provided IP address and body.
   *
   * @returns {{ getRequest: () => { ip: string, socket: { remoteAddress: string }, body: Record<string, unknown> } }}
   */
      switchToHttp: () => ({
        getRequest: () => ({ ip, socket: { remoteAddress: ip }, body }),
      }),
    } as any;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    guard = new WebhookThrottleGuard();
  });

  afterEach(() => {
    guard.onModuleDestroy();
    jest.useRealTimers();
  });

  it("should allow requests under the rate limit", () => {
    const ctx = createMockContext("192.168.1.1", "loc-1");
    for (let i = 0; i < WEBHOOK_RATE_LIMIT; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });

  it("should reject the request exceeding the IP rate limit", () => {
    const ctx = createMockContext("192.168.1.1", "loc-1");
    for (let i = 0; i < WEBHOOK_RATE_LIMIT; i++) guard.canActivate(ctx);

    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    try {
      guard.canActivate(ctx);
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it("should track IP and locationId independently", () => {
    const ctx1 = createMockContext("10.0.0.1", "shared-loc");
    for (let i = 0; i < WEBHOOK_RATE_LIMIT; i++) guard.canActivate(ctx1);
    expect(() => guard.canActivate(ctx1)).toThrow(HttpException);
  });

  it("should allow different IPs even when one IP is rate-limited", () => {
    const ctx1 = createMockContext("10.0.0.1");
    const ctx2 = createMockContext("10.0.0.2");
    for (let i = 0; i < WEBHOOK_RATE_LIMIT; i++) guard.canActivate(ctx1);
    expect(guard.canActivate(ctx2)).toBe(true);
  });

  it("should reset the counter after the rate window expires", () => {
    const ctx = createMockContext("192.168.1.1");
    for (let i = 0; i < WEBHOOK_RATE_LIMIT; i++) guard.canActivate(ctx);
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);

    jest.advanceTimersByTime(2 * 60 * 1000 + 1);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("should only apply IP rate limiting when locationId is absent", () => {
    const ctx = createMockContext("192.168.1.1");
    for (let i = 0; i < WEBHOOK_RATE_LIMIT; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it("should clean up stale keys during periodic cleanup", () => {
    const ctx = createMockContext("192.168.1.1");
    guard.canActivate(ctx);
    jest.advanceTimersByTime(3 * 60 * 1000);
    jest.advanceTimersByTime(5 * 60 * 1000);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("should clear the cleanup interval on module destroy", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    guard.onModuleDestroy();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
