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

  it('should return user if valid', async () => {
    const user = { 
      _id: '1', 
      email: 'test@test.com', 
      name: 'Test User',
      role: 'staff',
      isActive: true 
    };

    mockUserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    const result = await strategy.validate({ sub: '1' });
    
    expect(result.email).toBe(user.email);
    expect(result.name).toBe(user.name);
    expect(result.isActive).toBe(true);
    expect(mockUserModel.findById).toHaveBeenCalledWith('1');
  });

  it('should throw if user not found', async () => {
    mockUserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await expect(strategy.validate({ sub: '1' })).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(strategy.validate({ sub: '1' })).rejects.toThrow('Session expired');
  });

  it('should throw if user is inactive', async () => {
    const inactiveUser = {
      _id: '1',
      email: 'test@test.com',
      isActive: false,
    };

    mockUserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(inactiveUser),
    });

    await expect(strategy.validate({ sub: '1' })).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(strategy.validate({ sub: '1' })).rejects.toThrow('Session expired');
  });

  it('should exclude passwordHash from result', async () => {
    const user = {
      _id: '1',
      email: 'test@test.com',
      isActive: true,
    };

    const selectMock = jest.fn().mockResolvedValue(user);
    mockUserModel.findById.mockReturnValue({ select: selectMock });

    await strategy.validate({ sub: '1' });

    expect(selectMock).toHaveBeenCalledWith('-passwordHash');
  });

  it('should extract sub from payload', async () => {
    const user = { _id: '123', email: 'test@test.com', isActive: true };

    mockUserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    await strategy.validate({ sub: '123', email: 'test@test.com', iat: 1234567890 });

    expect(mockUserModel.findById).toHaveBeenCalledWith('123');
  });

  it('should throw if user invalid', async () => {
    mockUserModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await expect(strategy.validate({ sub: '1' })).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(strategy.validate({ sub: '1' })).rejects.toThrow('Session expired');
  });
});