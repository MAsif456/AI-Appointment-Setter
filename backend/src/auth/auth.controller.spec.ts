import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  CreateUserDto,
} from './dto/auth.dto';
import { LoginDto } from './dto/login.dto';

/** Bypass guards in unit tests — guard logic is tested separately */
const mockGuard = { canActivate: () => true };

const mockAuthService = {
  createUser: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerificationLink: jest.fn(),
  login: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
};

const mockRefreshTokenService = {
  generateTokenPair: jest.fn().mockResolvedValue({ accessToken: 'new-jwt', rawRefreshToken: 'raw' }),
  rotate: jest.fn().mockResolvedValue({ accessToken: 'rotated-jwt', rawRefreshToken: 'new-raw' }),
  revokeSingle: jest.fn().mockResolvedValue(undefined),
  revokeAll: jest.fn().mockResolvedValue(undefined),
};

const mockRes = { cookie: jest.fn() };

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: RefreshTokenService, useValue: mockRefreshTokenService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(mockGuard)
      .overrideGuard(AdminGuard).useValue(mockGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
    mockRefreshTokenService.generateTokenPair.mockResolvedValue({ accessToken: 'new-jwt', rawRefreshToken: 'raw' });
    mockRefreshTokenService.rotate.mockResolvedValue({ accessToken: 'rotated-jwt', rawRefreshToken: 'new-raw' });
    mockRefreshTokenService.revokeSingle.mockResolvedValue(undefined);
    mockRefreshTokenService.revokeAll.mockResolvedValue(undefined);
    mockRes.cookie.mockClear();
  });

  // createUser
  describe('createUser', () => {
    it('delegates to authService.createUser and returns result', async () => {
      const dto: CreateUserDto = {
        name: 'Sarah', email: 'sarah@test.com',
        password: 'Pass1!xxx', role: 'staff',
        assignedClinics: ['507f1f77bcf86cd799439011'],
      };
      mockAuthService.createUser.mockResolvedValue({ message: 'Account created.' });
      const req = { user: { email: 'admin@test.com' } } as any;
      const result = await controller.createUser(dto, req);
      expect(mockAuthService.createUser).toHaveBeenCalledWith(dto, 'admin@test.com');
      expect(result).toEqual({ message: 'Account created.' });
    });
  });

  // verifyEmail
  describe('verifyEmail', () => {
    it('delegates to authService.verifyEmail with token from query param', async () => {
      mockAuthService.verifyEmail.mockResolvedValue({ message: 'Email verified.' });
      const result = await controller.verifyEmail('some-token');
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('some-token');
      expect(result).toEqual({ message: 'Email verified.' });
    });
  });

  // resendVerification
  describe('resendVerification', () => {
    it('delegates to authService.resendVerificationLink', async () => {
      mockAuthService.resendVerificationLink.mockResolvedValue({ message: 'Link sent.' });
      const result = await controller.resendVerification('user@test.com');
      expect(mockAuthService.resendVerificationLink).toHaveBeenCalledWith('user@test.com');
      expect(result).toEqual({ message: 'Link sent.' });
    });
  });

  // login
  describe('login', () => {
    const baseUser = { _id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin', assignedClinics: [] };

    it('calls authService.login, passes userId+role to generateTokenPair, sets cookie', async () => {
      const dto: LoginDto = { email: 'admin@test.com', password: 'Pass1!' };
      const req = { ip: '192.168.1.1', socket: {}, headers: { 'user-agent': 'jest' } } as any;
      mockAuthService.login.mockResolvedValue({ user: baseUser });

      const result = await controller.login(dto, req, mockRes as any);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto, '192.168.1.1');
      expect(mockRefreshTokenService.generateTokenPair).toHaveBeenCalledWith(
        { userId: baseUser._id, role: baseUser.role },
        '192.168.1.1',
        'jest',
      );
      expect(mockRes.cookie).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ accessToken: 'new-jwt' });
    });

    it('falls back to req.socket.remoteAddress when req.ip is missing', async () => {
      const dto: LoginDto = { email: 'admin@test.com', password: 'Pass1!' };
      const req = { socket: { remoteAddress: '10.0.0.5' }, headers: {} } as any;
      mockAuthService.login.mockResolvedValue({ user: baseUser });
      await controller.login(dto, req, mockRes as any);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, '10.0.0.5');
    });

    it('falls back to "unknown" when no IP can be extracted', async () => {
      const dto: LoginDto = { email: 'admin@test.com', password: 'Pass1!' };
      mockAuthService.login.mockResolvedValue({ user: baseUser });
      await controller.login(dto, { headers: {} } as any, mockRes as any);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, 'unknown');
    });
  });

  // refresh
  describe('refresh', () => {
    it('throws 401 when no refresh cookie present', async () => {
      const req = { cookies: {}, ip: '127.0.0.1', headers: {} } as any;
      await expect(controller.refresh(req, mockRes as any)).rejects.toThrow('No refresh token');
    });

    it('happy path: calls rotate with cookie, sets new cookie, returns accessToken', async () => {
      const req = {
        cookies: { refresh_token: 'raw-token' },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as any;

      const result = await controller.refresh(req, mockRes as any);

      expect(mockRefreshTokenService.rotate).toHaveBeenCalledWith('raw-token', '127.0.0.1', 'jest');
      expect(mockRes.cookie).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ accessToken: 'rotated-jwt' });
    });
  });

  // forgotPassword
  describe('forgotPassword', () => {
    it('delegates to authService.forgotPassword', async () => {
      const dto: ForgotPasswordDto = { email: 'user@test.com' };
      mockAuthService.forgotPassword.mockResolvedValue({ message: 'Link sent.' });
      const result = await controller.forgotPassword(dto);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ message: 'Link sent.' });
    });
  });

  // resetPassword
  describe('resetPassword', () => {
    it('delegates to authService.resetPassword', async () => {
      const dto: ResetPasswordDto = { token: 'abc', newPassword: 'NewPass1!' };
      mockAuthService.resetPassword.mockResolvedValue({ message: 'Password reset.' });
      const result = await controller.resetPassword(dto);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ message: 'Password reset.' });
    });
  });

  // changePassword
  describe('changePassword', () => {
    it('delegates to authService.changePassword with userId from req', async () => {
      const dto: ChangePasswordDto = { currentPassword: 'Old1!', newPassword: 'New1!xxx' };
      const req = { user: { _id: { toString: () => 'user_123' } } };
      mockAuthService.changePassword.mockResolvedValue({ message: 'Password updated.' });
      const result = await controller.changePassword(req as any, dto);
      expect(mockAuthService.changePassword).toHaveBeenCalledWith('user_123', dto);
      expect(result).toEqual({ message: 'Password updated.' });
    });
  });

  // logout
  describe('logout', () => {
    it('revokes only current device token, clears cookie, returns confirmation', async () => {
      const req = {
        user: { _id: 'user_123' },
        cookies: { refresh_token: 'raw-cookie-token' },
      } as any;
      const result = await controller.logout(req, mockRes as any);
      expect(mockRefreshTokenService.revokeSingle).toHaveBeenCalledWith('raw-cookie-token');
      expect(mockRefreshTokenService.revokeAll).not.toHaveBeenCalled();
      expect(mockRes.cookie).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  // revokeAll — role check is now delegated to AdminGuard, not inline
  describe('revokeAll', () => {
    it('revokes all sessions for userId and returns confirmation', async () => {
      const req = { user: { _id: 'admin-id' } } as any;
      const result = await controller.revokeAll(req, 'target-id');
      expect(mockRefreshTokenService.revokeAll).toHaveBeenCalledWith('target-id');
      expect(result).toEqual({ message: 'All sessions revoked', revokedUserId: 'target-id' });
    });
  });

  // getCurrentUser
  describe('getCurrentUser', () => {
    it('returns the user from the request', async () => {
      const req = { user: { _id: '1', name: 'Admin', role: 'admin' } };
      const result = await controller.getCurrentUser(req as any);
      expect(result).toEqual(req.user);
    });
  });
});
