import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    _id: '123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    passwordHash: 'hashedpassword',
    isActive: true,
    save: jest.fn(),
  };

  const mockUserModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mocked-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken('User'), useValue: mockUserModel },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should login successfully', async () => {
    mockUserModel.findOne.mockResolvedValue(mockUser);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const result = await service.login({
      email: 'test@example.com',
      password: 'password',
    });

    expect(result.accessToken).toBe('mocked-token');
    expect(result.user.email).toBe(mockUser.email);
  });

  it('should throw if user not found', async () => {
    mockUserModel.findOne.mockResolvedValue(null);

    await expect(
      service.login({ email: 'test@example.com', password: 'password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw if password incorrect', async () => {
    mockUserModel.findOne.mockResolvedValue(mockUser);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(
      service.login({ email: 'test@example.com', password: 'password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should validate user', async () => {
    mockUserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const result = await service.validateUser('123');

    expect(result.email).toBe(mockUser.email);
  });
});