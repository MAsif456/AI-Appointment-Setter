import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RefreshTokenService, AccessTokenPayload } from './refresh-token.service';
import { RefreshToken } from '../database/schemas/refresh-token.schema';

const mockPayload: AccessTokenPayload = {
  sub: new Types.ObjectId().toString(),
  email: 'test@example.com',
  role: 'staff',
  tokenVersion: 0,
};

const buildRecord = (overrides: Partial<Record<string, any>> = {}) => ({
  _id: new Types.ObjectId(),
  userId: new Types.ObjectId(mockPayload.sub),
  tokenHash: 'some-hash',
  family: 'test-family-uuid',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  used: false,
  save: jest.fn().mockResolvedValue(undefined),
  deleteOne: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let model: {
    findOne: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
  };

  beforeEach(async () => {
    model = {
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: getModelToken(RefreshToken.name), useValue: model },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock-access-token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-jwt-secret') },
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
  });

  // ─── generateTokenPair ───────────────────────────────────────────────────────

  it('generateTokenPair: creates DB record with correct fields and returns token pair', async () => {
    const result = await service.generateTokenPair(mockPayload, '127.0.0.1', 'jest');

    expect(model.create).toHaveBeenCalledTimes(1);
    const createArg = model.create.mock.calls[0][0];
    expect(createArg.userId.toString()).toBe(mockPayload.sub);
    expect(createArg.tokenHash).toHaveLength(64); // sha256 hex = 64 chars
    expect(typeof createArg.family).toBe('string');
    expect(createArg.used).toBe(false);
    expect(createArg.ipAddress).toBe('127.0.0.1');
    expect(createArg.userAgent).toBe('jest');
    expect(result.accessToken).toBe('mock-access-token');
    expect(result.rawRefreshToken).toHaveLength(128); // 64 bytes hex = 128 chars
  });

  it('generateTokenPair: uses existingFamily when provided', async () => {
    await service.generateTokenPair(mockPayload, undefined, undefined, 'provided-family');

    const createArg = model.create.mock.calls[0][0];
    expect(createArg.family).toBe('provided-family');
  });

  // ─── rotate ──────────────────────────────────────────────────────────────────

  it('rotate (happy path): marks record used, saves, and returns new token pair', async () => {
    const record = buildRecord();
    model.findOne.mockResolvedValue(record);

    const result = await service.rotate('raw-token', mockPayload, '127.0.0.1', 'jest');

    expect(record.used).toBe(true);
    expect(record.save).toHaveBeenCalledTimes(1);
    expect(model.create).toHaveBeenCalledTimes(1); // generateTokenPair inside rotate
    const createArg = model.create.mock.calls[0][0];
    expect(createArg.family).toBe('test-family-uuid'); // same family as rotated token
    expect(result.accessToken).toBe('mock-access-token');
    expect(result.rawRefreshToken).toHaveLength(128);
  });

  it('rotate (not found): throws UnauthorizedException', async () => {
    model.findOne.mockResolvedValue(null);

    await expect(service.rotate('bad-token', mockPayload)).rejects.toThrow(
      new UnauthorizedException('Invalid refresh token'),
    );
  });

  it('rotate (expired): throws UnauthorizedException and calls deleteOne', async () => {
    const record = buildRecord({ expiresAt: new Date(Date.now() - 1000) });
    model.findOne.mockResolvedValue(record);

    await expect(service.rotate('expired-token', mockPayload)).rejects.toThrow(
      new UnauthorizedException('Refresh token expired'),
    );
    expect(record.deleteOne).toHaveBeenCalledTimes(1);
  });

  it('rotate (reuse detected): deletes family and throws with reuse message', async () => {
    const record = buildRecord({ used: true });
    model.findOne.mockResolvedValue(record);
    model.deleteMany.mockResolvedValue({ deletedCount: 3 });

    await expect(service.rotate('reused-token', mockPayload)).rejects.toThrow(
      new UnauthorizedException('Token reuse detected — please log in again'),
    );
    expect(model.deleteMany).toHaveBeenCalledWith({ family: 'test-family-uuid' });
  });

  // ─── revokeAll ───────────────────────────────────────────────────────────────

  it('revokeAll: calls deleteMany with correct userId ObjectId', async () => {
    model.deleteMany.mockResolvedValue({ deletedCount: 2 });
    const userId = mockPayload.sub;

    await service.revokeAll(userId);

    expect(model.deleteMany).toHaveBeenCalledTimes(1);
    const arg = model.deleteMany.mock.calls[0][0];
    expect(arg.userId.toString()).toBe(userId);
  });

  // ─── cleanupExpired ──────────────────────────────────────────────────────────

  it('cleanupExpired: calls deleteMany with $lt query and returns deletedCount', async () => {
    model.deleteMany.mockResolvedValue({ deletedCount: 5 });

    const count = await service.cleanupExpired();

    expect(count).toBe(5);
    expect(model.deleteMany).toHaveBeenCalledTimes(1);
    const arg = model.deleteMany.mock.calls[0][0];
    expect(arg.expiresAt.$lt).toBeInstanceOf(Date);
  });
});
