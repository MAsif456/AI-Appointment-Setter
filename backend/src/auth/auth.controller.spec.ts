import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should login user', async () => {
    mockAuthService.login.mockResolvedValue({
      user: { email: 'test@test.com' },
      accessToken: 'token',
    });

    const result = await controller.login({
      email: 'test@test.com',
      password: 'password',
    });

    expect(result.accessToken).toBe('token');
  });

  it('should logout', async () => {
    const result = await controller.logout();
    expect(result.message).toBe('Logged out successfully');
  });

  it('should return current user', async () => {
    const req = { user: { email: 'test@test.com' } };

    const result = await controller.getCurrentUser(req);

    expect(result.email).toBe('test@test.com');
  });
});