import { JwtStrategy } from './jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';

process.env.JWT_SECRET = 'test-secret';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockUserModel = {
    findById: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(mockUserModel as any);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should return user when payload is valid', async () => {
    const user = {
      _id: '1',
      email: 'test@test.com',
      name: 'Test User',
      role: 'staff',
      isActive: true,
    };
    mockUserModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

    const result = await strategy.validate({ userId: '1', type: 'access' });

    expect(result.email).toBe(user.email);
    expect(result.name).toBe(user.name);
    expect(result.isActive).toBe(true);
    expect(mockUserModel.findById).toHaveBeenCalledWith('1');
  });

  it('should throw if user not found', async () => {
    mockUserModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    await expect(strategy.validate({ userId: '1', type: 'access' })).rejects.toThrow(
      new UnauthorizedException('Session expired'),
    );
  });

  it('should throw if user is inactive', async () => {
    const inactiveUser = { _id: '1', email: 'test@test.com', isActive: false };
    mockUserModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(inactiveUser) });

    await expect(strategy.validate({ userId: '1', type: 'access' })).rejects.toThrow(
      new UnauthorizedException('Session expired'),
    );
  });

  it('should call select with -passwordHash to exclude sensitive field', async () => {
    const user = { _id: '1', email: 'test@test.com', isActive: true };
    const selectMock = jest.fn().mockResolvedValue(user);
    mockUserModel.findById.mockReturnValue({ select: selectMock });

    await strategy.validate({ userId: '1', type: 'access' });

    expect(selectMock).toHaveBeenCalledWith('-passwordHash');
  });

  it('should use payload.userId to look up the user', async () => {
    const user = { _id: '123', email: 'test@test.com', isActive: true };
    mockUserModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

    await strategy.validate({ userId: '123', type: 'access' });

    expect(mockUserModel.findById).toHaveBeenCalledWith('123');
  });

  it('should throw if token type is not "access"', async () => {
    const user = { _id: '1', email: 'test@test.com', isActive: true };
    mockUserModel.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

    await expect(
      strategy.validate({ userId: '1', type: 'refresh' }),
    ).rejects.toThrow('Invalid token type');
  });
});
