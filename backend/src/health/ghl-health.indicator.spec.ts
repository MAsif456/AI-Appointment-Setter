import { HealthCheckError } from '@nestjs/terminus';
import { GhlHealthIndicator } from './ghl-health.indicator';

describe('GhlHealthIndicator', () => {
  let indicator: GhlHealthIndicator;
  const mockGhlApiService = { getCircuitBreakerStates: jest.fn() };

  beforeEach(() => {
    indicator = new GhlHealthIndicator(mockGhlApiService as any);
    jest.clearAllMocks();
  });

  it('should report healthy when all circuit breakers are CLOSED', async () => {
    mockGhlApiService.getCircuitBreakerStates.mockReturnValue({
      messaging: 'CLOSED',
      appointments: 'CLOSED',
    });

    const result = await indicator.isHealthy('ghl-api');

    expect(result['ghl-api'].status).toBe('up');
    expect(result['ghl-api'].circuitBreakers).toEqual({
      messaging: 'CLOSED',
      appointments: 'CLOSED',
    });
  });

  it('should throw HealthCheckError when messaging circuit breaker is OPEN', async () => {
    mockGhlApiService.getCircuitBreakerStates.mockReturnValue({
      messaging: 'OPEN',
      appointments: 'CLOSED',
    });

    await expect(indicator.isHealthy('ghl-api')).rejects.toThrow(HealthCheckError);
  });

  it('should throw HealthCheckError when appointments circuit breaker is OPEN', async () => {
    mockGhlApiService.getCircuitBreakerStates.mockReturnValue({
      messaging: 'CLOSED',
      appointments: 'OPEN',
    });

    await expect(indicator.isHealthy('ghl-api')).rejects.toThrow(HealthCheckError);
  });

  it('should throw HealthCheckError when all circuit breakers are OPEN', async () => {
    mockGhlApiService.getCircuitBreakerStates.mockReturnValue({
      messaging: 'OPEN',
      appointments: 'OPEN',
    });

    await expect(indicator.isHealthy('ghl-api')).rejects.toThrow(HealthCheckError);
  });
});
