import { JwtStrategy } from './jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';

process.env.JWT_SECRET = 'test-secret'; 

describe('JwtStrategy', () => {
  const mockUserModel = {
    findById: jest.fn(),
  };

  const strategy = new JwtStrategy(mockUserModel as any);

  it('should return user if valid', async () => {
    const user = { _id: '1', email: 'test@test.com', isActive: true };

    mockUserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    const result = await strategy.validate({ sub: '1' });

    expect(result.email).toBe(user.email);
  });

  it('should throw if user invalid', async () => {
    mockUserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await expect(strategy.validate({ sub: '1' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});