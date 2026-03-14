import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    verifyEmail: jest.fn(),
    login: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123!@#',
      };

      mockAuthService.register.mockResolvedValue({
        message: 'Account created',
        email: registerDto.email,
      });

      const result = await controller.register(registerDto);

      expect(result.message).toContain('Account created');
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email', async () => {
      const verifyDto = { email: 'test@example.com', code: '123456' };

      mockAuthService.verifyEmail.mockResolvedValue({
        message: 'Email verified successfully',
      });

      const result = await controller.verifyEmail(verifyDto);

      expect(result.message).toContain('verified');
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(verifyDto);
    });
  });

  describe('login', () => {
    it('should login user', async () => {
      const loginDto = { email: 'test@example.com', password: 'password' };

      mockAuthService.login.mockResolvedValue({
        user: { email: 'test@test.com' },
        accessToken: 'token',
      });

      const result = await controller.login(loginDto);

      expect(result.accessToken).toBe('token');
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset code', async () => {
      const forgotDto = { email: 'test@example.com' };

      mockAuthService.forgotPassword.mockResolvedValue({
        message: 'If the email exists, a reset code has been sent.',
      });

      const result = await controller.forgotPassword(forgotDto);

      expect(result.message).toContain('reset code');
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(forgotDto);
    });
  });

  describe('resetPassword', () => {
    it('should reset password', async () => {
      const resetDto = {
        email: 'test@example.com',
        code: '123456',
        newPassword: 'NewPass123!@#',
      };

      mockAuthService.resetPassword.mockResolvedValue({
        message: 'Password reset successfully',
      });

      const result = await controller.resetPassword(resetDto);

      expect(result.message).toContain('reset successfully');
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(resetDto);
    });
  });

  describe('logout', () => {
    it('should logout', async () => {
      const result = await controller.logout();
      expect(result.message).toBe('Logged out successfully');
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const req = { user: { email: 'test@example.com' } };
      const result = await controller.getCurrentUser(req);
      expect(result.email).toBe('test@example.com');
    });
  });
});