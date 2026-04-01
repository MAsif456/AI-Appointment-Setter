import { AuthResponseDto } from './auth-response.dto';

describe('AuthResponseDto', () => {
  it('should create a response DTO instance', () => {
    const dto = new AuthResponseDto();

    dto.user = {
      _id: '1',
      name: 'Test User',
      email: 'test@test.com',
      role: 'staff',
      assignedClinics: ['clinic1', 'clinic2'],

    };

    dto.accessToken = 'jwt-token-here';

    expect(dto.user.email).toBe('test@test.com');
    expect(dto.user.name).toBe('Test User');
    expect(dto.user.role).toBe('staff');
    expect(dto.user.assignedClinics).toEqual(['clinic1', 'clinic2']);
    expect(dto.accessToken).toBe('jwt-token-here');
  });

  it('should have correct structure', () => {
    const dto: AuthResponseDto = {
      user: {
        _id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        assignedClinics: ['clinic1', 'clinic2'],
      },
      accessToken: 'token123',
    };

    expect(dto).toHaveProperty('user');
    expect(dto).toHaveProperty('accessToken');
    expect(dto.user).toHaveProperty('_id');
    expect(dto.user).toHaveProperty('name');
    expect(dto.user).toHaveProperty('email');
    expect(dto.user).toHaveProperty('role');
  });
  it('should allow empty assignedClinics array', () => {
    const dto = new AuthResponseDto();

    dto.user = {
      _id: '1',
      name: 'Test User',
      email: 'test@test.com',
      role: 'admin',
      assignedClinics: [],
    };

    dto.accessToken = 'token';

    expect(dto.user.assignedClinics).toEqual([]);
  });
});