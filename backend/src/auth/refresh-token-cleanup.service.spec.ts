import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenCleanupService } from './refresh-token-cleanup.service';
import { RefreshTokenService } from './refresh-token.service';

const mockRefreshTokenService = {
  cleanupExpired: jest.fn(),
};

describe('RefreshTokenCleanupService', () => {
  let service: RefreshTokenCleanupService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenCleanupService,
        { provide: RefreshTokenService, useValue: mockRefreshTokenService },
      ],
    }).compile();

    service = module.get<RefreshTokenCleanupService>(RefreshTokenCleanupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('handleCleanup: calls cleanupExpired and logs the count', async () => {
    mockRefreshTokenService.cleanupExpired.mockResolvedValue(7);
    await service.handleCleanup();
    expect(mockRefreshTokenService.cleanupExpired).toHaveBeenCalledTimes(1);
  });

  it('handleCleanup: works correctly when zero records are deleted', async () => {
    mockRefreshTokenService.cleanupExpired.mockResolvedValue(0);
    await expect(service.handleCleanup()).resolves.toBeUndefined();
  });
});
