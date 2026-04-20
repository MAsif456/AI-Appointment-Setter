import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { IntegrationsService } from './integrations.service';
import { IntegrationSettings } from '../database/schemas/integration-settings.schema';

/** Builds a sample stored settings document. */
function buildDoc(overrides: Record<string, unknown> = {}): any {
  return {
    ghlApiKey: '',
    ghlApiKeyPreview: '',
    webhookUrl: '',
    ghlConnectionStatus: 'disconnected',
    ...overrides,
  };
}

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let mockModel: Record<string, jest.Mock>;
  let mockHttp: { get: jest.Mock };

  beforeEach(async () => {
    // Chain: findOne().lean().exec() and findOneAndUpdate().lean().exec()
    const execMock = jest.fn();
    const leanMock = jest.fn().mockReturnValue({ exec: execMock });
    const findOneMock = jest.fn().mockReturnValue({ lean: leanMock });

    const updateExecMock = jest.fn();
    const updateLeanMock = jest.fn().mockReturnValue({ exec: updateExecMock });
    const updateExecNoLeanMock = jest.fn();
    const findOneAndUpdateMock = jest.fn().mockReturnValue({
      lean: updateLeanMock,
      exec: updateExecNoLeanMock,
    });

    mockModel = {
      findOne: findOneMock,
      findOneAndUpdate: findOneAndUpdateMock,
      _exec: execMock,
      _updateExec: updateExecMock,
      _updateExecNoLean: updateExecNoLeanMock,
    };

    mockHttp = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: getModelToken(IntegrationSettings.name), useValue: mockModel },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-encryption-key-for-unit-tests') },
        },
        { provide: HttpService, useValue: mockHttp },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
  });

  // ─── getSettings ──────────────────────────────────────────────────────────

  describe('getSettings', () => {
    it('returns empty strings when no document exists', async () => {
      mockModel._exec.mockResolvedValue(null);
      const result = await service.getSettings();
      expect(result.ghlApiKey).toBe('');
      expect(result.webhookUrl).toBe('');
      expect(result.ghlConnectionStatus).toBe('disconnected');
    });

    it('returns masked API key and full webhook URL', async () => {
      mockModel._exec.mockResolvedValue(
        buildDoc({ ghlApiKey: 'encrypted', ghlApiKeyPreview: 'abc123', webhookUrl: 'https://x.com/wh' }),
      );
      const result = await service.getSettings();
      expect(result.ghlApiKey).toBe('••••••••••••abc123');
      expect(result.webhookUrl).toBe('https://x.com/wh');
    });

    it('never returns the plaintext API key', async () => {
      const plainKey = 'super-secret-token-abc123';
      const encrypted = service.encryptKey(plainKey);
      mockModel._exec.mockResolvedValue(
        buildDoc({ ghlApiKey: encrypted, ghlApiKeyPreview: plainKey.slice(-6) }),
      );
      const result = await service.getSettings();
      expect(result.ghlApiKey).not.toContain('super-secret-token');
      expect(result.ghlApiKey).toContain('abc123');
    });
  });

  // ─── updateSettings ───────────────────────────────────────────────────────

  describe('updateSettings', () => {
    it('rejects an invalid API key with BadRequestException', async () => {
      mockHttp.get.mockReturnValue(of({ status: 401 }));
      await expect(service.updateSettings({ ghlApiKey: 'bad-key-here' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('encrypts and stores a valid API key', async () => {
      mockHttp.get.mockReturnValue(of({ status: 200 }));
      mockModel._updateExec.mockResolvedValue(
        buildDoc({ ghlApiKey: 'encrypted', ghlApiKeyPreview: 'abc123', ghlConnectionStatus: 'connected' }),
      );
      mockModel._exec.mockResolvedValue(
        buildDoc({ ghlApiKey: 'encrypted', ghlApiKeyPreview: 'abc123', ghlConnectionStatus: 'connected' }),
      );

      await service.updateSettings({ ghlApiKey: 'valid-token-abc123' });

      const callArgs = mockModel.findOneAndUpdate.mock.calls[0];
      const setFields = callArgs[1].$set;
      expect(setFields.ghlApiKey).not.toBe('valid-token-abc123'); // encrypted
      expect(setFields.ghlApiKeyPreview).toBe('abc123'); // last 6 of 'valid-token-abc123'
      expect(setFields.ghlConnectionStatus).toBe('connected');
    });

    it('updates only webhook URL without touching API key', async () => {
      mockModel._updateExec.mockResolvedValue(buildDoc({ webhookUrl: 'https://new.com/wh' }));
      mockModel._exec.mockResolvedValue(buildDoc({ webhookUrl: 'https://new.com/wh' }));

      await service.updateSettings({ webhookUrl: 'https://new.com/wh' });

      const callArgs = mockModel.findOneAndUpdate.mock.calls[0];
      expect(callArgs[1].$set).not.toHaveProperty('ghlApiKey');
      expect(callArgs[1].$set.webhookUrl).toBe('https://new.com/wh');
    });

    it('sets ghlConnectionStatus to connected after valid key', async () => {
      mockHttp.get.mockReturnValue(of({ status: 200 }));
      mockModel._updateExec.mockResolvedValue(
        buildDoc({ ghlConnectionStatus: 'connected' }),
      );
      mockModel._exec.mockResolvedValue(buildDoc({ ghlConnectionStatus: 'connected' }));

      const result = await service.updateSettings({ ghlApiKey: 'valid-key-xyz789' });
      expect(result.ghlConnectionStatus).toBe('connected');
    });
  });

  // ─── testConnection ───────────────────────────────────────────────────────

  describe('testConnection', () => {
    it('returns disconnected when no key is stored', async () => {
      mockModel._exec.mockResolvedValue(null);
      const result = await service.testConnection();
      expect(result.status).toBe('disconnected');
    });

    it('returns connected when GHL API accepts the key', async () => {
      const encrypted = service.encryptKey('valid-key-live123');
      mockModel._exec.mockResolvedValue(
        buildDoc({ ghlApiKey: encrypted }),
      );
      mockHttp.get.mockReturnValue(of({ status: 200 }));
      mockModel._updateExecNoLean.mockResolvedValue({});

      const result = await service.testConnection();
      expect(result.status).toBe('connected');
    });

    it('returns disconnected when GHL API rejects the key', async () => {
      const encrypted = service.encryptKey('invalid-key-xyz000');
      mockModel._exec.mockResolvedValue(buildDoc({ ghlApiKey: encrypted }));
      mockHttp.get.mockReturnValue(of({ status: 401 }));
      mockModel._updateExecNoLean.mockResolvedValue({});

      const result = await service.testConnection();
      expect(result.status).toBe('disconnected');
    });
  });

  // ─── disconnect ───────────────────────────────────────────────────────────

  describe('disconnect', () => {
    it('clears the API key and sets status to disconnected', async () => {
      mockModel._updateExecNoLean.mockResolvedValue({});
      await service.disconnect();

      const callArgs = mockModel.findOneAndUpdate.mock.calls[0];
      expect(callArgs[1].$set.ghlApiKey).toBe('');
      expect(callArgs[1].$set.ghlConnectionStatus).toBe('disconnected');
    });
  });

  // ─── encrypt / decrypt ────────────────────────────────────────────────────

  describe('encryptKey / decryptKey', () => {
    it('round-trips a plaintext key correctly', () => {
      const original = 'my-secret-ghl-token-abc123';
      const encrypted = service.encryptKey(original);
      expect(encrypted).not.toBe(original);
      expect(service.decryptKey(encrypted)).toBe(original);
    });

    it('produces different ciphertexts for same plaintext (random IV)', () => {
      const key = 'same-key-every-time';
      expect(service.encryptKey(key)).not.toBe(service.encryptKey(key));
    });
  });
});
