import { AuthResponseDto } from './auth-response.dto';

describe('AuthResponseDto', () => {
  it('should create a response DTO instance', () => {
    const dto = new AuthResponseDto();

    dto.user = {
      _id: '1',
      name: 'Test',
      email: 'test@test.com',
      role: 'user',
    };

    dto.accessToken = 'token';

    expect(dto.user.email).toBe('test@test.com');
    expect(dto.accessToken).toBe('token');
  });
});