import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new LoginDto();
    dto.email = 'test@example.com';
    dto.password = 'password123';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail if email is empty', async () => {
    const dto = new LoginDto();
    dto.email = '';
    dto.password = 'password123';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
    expect(errors[0].constraints?.isNotEmpty).toContain('Email is required');
  });

  it('should fail if email is invalid format', async () => {
    const dto = new LoginDto();
    dto.email = 'invalid-email';
    dto.password = 'password123';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
    expect(errors[0].constraints?.isEmail).toContain('Please provide a valid email address');
  });

  it('should fail if password is empty', async () => {
    const dto = new LoginDto();
    dto.email = 'test@example.com';
    dto.password = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('password');
    expect(errors[0].constraints?.isNotEmpty).toContain('Password is required');
  });

  it('should fail if password is too short', async () => {
    const dto = new LoginDto();
    dto.email = 'test@example.com';
    dto.password = '12345';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('password');
    expect(errors[0].constraints?.minLength).toContain('Password must be at least 6 characters');
  });

  it('should pass with minimum password length', async () => {
    const dto = new LoginDto();
    dto.email = 'test@example.com';
    dto.password = '123456';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});