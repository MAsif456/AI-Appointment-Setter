import { calculateBackoffWithJitter, retryWithBackoff } from "./retry-utils";

describe("calculateBackoffWithJitter", () => {
  it("should return a value between 0 and min(cap, base * 2^attempt)", () => {
    for (let i = 0; i < 100; i++) {
      const delay = calculateBackoffWithJitter(0, 1000, 4000);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(1000); // base * 2^0 = 1000
    }
  });

  it("should respect the cap for higher attempts", () => {
    for (let i = 0; i < 100; i++) {
      const delay = calculateBackoffWithJitter(5, 1000, 4000);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(4000); // capped at 4000
    }
  });

  it("should produce varying values (jitter is applied)", () => {
    const delays = Array.from({ length: 50 }, () =>
      calculateBackoffWithJitter(1, 1000, 4000),
    );
    const unique = new Set(delays);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe("retryWithBackoff", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("should return result on first success", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const result = await retryWithBackoff(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and succeed on second attempt", async () => {
    jest.useRealTimers();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1,
      maxDelayMs: 2,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should throw after exhausting all retries", async () => {
    jest.useRealTimers();
    const fn = jest.fn().mockRejectedValue(new Error("persistent failure"));

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 2 }),
    ).rejects.toThrow("persistent failure");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should call onRetry callback between attempts", async () => {
    jest.useRealTimers();
    const onRetry = jest.fn();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("ok");

    await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1,
      maxDelayMs: 2,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(
      1,
      expect.any(Error),
      expect.any(Number),
    );
    expect(onRetry).toHaveBeenCalledWith(
      2,
      expect.any(Error),
      expect.any(Number),
    );
  });

  it("should not call onRetry when function succeeds first time", async () => {
    const onRetry = jest.fn();
    const fn = jest.fn().mockResolvedValue("ok");

    await retryWithBackoff(fn, { onRetry });
    expect(onRetry).not.toHaveBeenCalled();
  });
});
