import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 5000,
      name: 'test',
    });
  });

  it('should start in CLOSED state', () => {
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should allow calls through in CLOSED state', async () => {
    const result = await breaker.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should count failures but stay CLOSED below threshold', async () => {
    const fail = () => breaker.execute(() => Promise.reject(new Error('fail')));

    await expect(fail()).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('CLOSED');

    await expect(fail()).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should trip to OPEN after reaching failure threshold', async () => {
    const fail = () => breaker.execute(() => Promise.reject(new Error('fail')));

    await expect(fail()).rejects.toThrow();
    await expect(fail()).rejects.toThrow();
    await expect(fail()).rejects.toThrow();

    expect(breaker.getState()).toBe('OPEN');
  });

  it('should fail fast when OPEN without calling the function', async () => {
    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }

    const fn = jest.fn();
    await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
    expect(fn).not.toHaveBeenCalled();
  });

  it('should reset failure count on success', async () => {
    const fail = () => breaker.execute(() => Promise.reject(new Error('fail')));

    await expect(fail()).rejects.toThrow();
    await expect(fail()).rejects.toThrow();

    // Success resets the count
    await breaker.execute(() => Promise.resolve('ok'));
    expect(breaker.getState()).toBe('CLOSED');

    // Should need 3 more failures to trip
    await expect(fail()).rejects.toThrow();
    await expect(fail()).rejects.toThrow();
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should transition to HALF_OPEN after reset timeout', async () => {
    const shortBreaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 50,
      name: 'short',
    });

    await shortBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    expect(shortBreaker.getState()).toBe('OPEN');

    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 60));

    // Next call should transition to HALF_OPEN and execute
    const result = await shortBreaker.execute(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
    expect(shortBreaker.getState()).toBe('CLOSED');
  });

  it('should re-open if probe request fails in HALF_OPEN', async () => {
    const shortBreaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 50,
      name: 'short',
    });

    await shortBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    expect(shortBreaker.getState()).toBe('OPEN');

    await new Promise((r) => setTimeout(r, 60));

    // Probe fails
    await shortBreaker.execute(() => Promise.reject(new Error('still down'))).catch(() => {});
    expect(shortBreaker.getState()).toBe('OPEN');
  });
});
