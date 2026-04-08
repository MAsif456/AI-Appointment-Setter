import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  CreateUserDto,
} from './dto/auth.dto';
import { LoginDto } from './dto/login.dto';

/** Bypass guards in unit tests — we test guard logic separately */
const mockGuard = { canActivate: () => true };

/** Mock AuthService — all methods return simple resolved values */
const mockAuthService = {
  createUser: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerificationLink: jest.fn(),
  login: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
};

/** Unit tests for AuthController */
describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(mockGuard)
      .overrideGuard(AdminGuard).useValue(mockGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
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
      const result = await controller.createUser(dto);
      expect(mockAuthService.createUser).toHaveBeenCalledWith(dto);
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
    const mockReq = { ip: '192.168.1.1', socket: { remoteAddress: '192.168.1.1' } } as any;

    it('delegates to authService.login with dto and extracted IP', async () => {
      const dto: LoginDto = { email: 'admin@test.com', password: 'Pass1!' };
      const response = {
        user: { _id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin', assignedClinics: [] },
        accessToken: 'jwt',
      };
      mockAuthService.login.mockResolvedValue(response);
      const result = await controller.login(dto, mockReq);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, '192.168.1.1');
      expect(result).toEqual(response);
    });

    it('falls back to req.socket.remoteAddress when req.ip is missing', async () => {
      const dto: LoginDto = { email: 'admin@test.com', password: 'Pass1!' };
      const req = { socket: { remoteAddress: '10.0.0.5' } } as any;
      mockAuthService.login.mockResolvedValue({});
      await controller.login(dto, req);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, '10.0.0.5');
    });

    it('falls back to "unknown" when no IP can be extracted', async () => {
      const dto: LoginDto = { email: 'admin@test.com', password: 'Pass1!' };
      mockAuthService.login.mockResolvedValue({});
      await controller.login(dto, {} as any);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, 'unknown');
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
    it('returns logout confirmation message', async () => {
      const result = await controller.logout();
      expect(result).toEqual({ message: 'Logged out successfully' });
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
