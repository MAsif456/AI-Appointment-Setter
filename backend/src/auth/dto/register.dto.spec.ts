import { validate } from 'class-validator';
import { RegisterDto, VerifyEmailDto, ForgotPasswordDto, ResetPasswordDto } from './register.dto';

describe('RegisterDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new RegisterDto();
    dto.name = 'Test User';
    dto.email = 'test@example.com';
    dto.password = 'Test123!@#';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail if name is empty', async () => {
    const dto = new RegisterDto();
    dto.name = '';
    dto.email = 'test@example.com';
    dto.password = 'Test123!@#';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('name');
    expect(errors[0].constraints?.isNotEmpty).toContain('Name is required');
  });

  it('should fail if email is invalid', async () => {
    const dto = new RegisterDto();
    dto.name = 'Test User';
    dto.email = 'invalid-email';
    dto.password = 'Test123!@#';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
    expect(errors[0].constraints?.isEmail).toContain('Please provide a valid email address');
  });

  it('should fail if password is too short', async () => {
    const dto = new RegisterDto();
    dto.name = 'Test User';
    dto.email = 'test@example.com';
    dto.password = 'Short1!';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('password');
    expect(errors[0].constraints?.minLength).toContain('Password must be at least 8 characters');
  });

  it('should fail if password lacks uppercase', async () => {
    const dto = new RegisterDto();
    dto.name = 'Test User';
    dto.email = 'test@example.com';
    dto.password = 'test123!@#';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('password');
    expect(errors[0].constraints?.matches).toContain(
      'Password must contain uppercase, lowercase, number, and special character',
    );
  });

  it('should fail if password lacks lowercase', async () => {
    const dto = new RegisterDto();
    dto.name = 'Test User';
    dto.email = 'test@example.com';
    dto.password = 'TEST123!@#';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('password');
  });

  it('should fail if password lacks number', async () => {
    const dto = new RegisterDto();
    dto.name = 'Test User';
    dto.email = 'test@example.com';
    dto.password = 'TestTest!@#';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('password');
  });

  it('should fail if password lacks special character', async () => {
    const dto = new RegisterDto();
    dto.name = 'Test User';
    dto.email = 'test@example.com';
    dto.password = 'Test123456';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('password');
  });
});

describe('VerifyEmailDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new VerifyEmailDto();
    dto.email = 'test@example.com';
    dto.code = '123456';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail if email is invalid', async () => {
    const dto = new VerifyEmailDto();
    dto.email = 'invalid-email';
    dto.code = '123456';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
  });

  it('should fail if code is empty', async () => {
    const dto = new VerifyEmailDto();
    dto.email = 'test@example.com';
    dto.code = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('code');
  });
});

describe('ForgotPasswordDto', () => {
  it('should pass validation with valid email', async () => {
    const dto = new ForgotPasswordDto();
    dto.email = 'test@example.com';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail if email is invalid', async () => {
    const dto = new ForgotPasswordDto();
    dto.email = 'invalid-email';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
  });
});

describe('ResetPasswordDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new ResetPasswordDto();
    dto.email = 'test@example.com';
    dto.code = '123456';
    dto.newPassword = 'NewPass123!@#';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail if email is invalid', async () => {
    const dto = new ResetPasswordDto();
    dto.email = 'invalid-email';
    dto.code = '123456';
    dto.newPassword = 'NewPass123!@#';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
  });

  it('should fail if code is empty', async () => {
    const dto = new ResetPasswordDto();
    dto.email = 'test@example.com';
    dto.code = '';
    dto.newPassword = 'NewPass123!@#';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('code');
  });

  it('should fail if password is too short', async () => {
    const dto = new ResetPasswordDto();
    dto.email = 'test@example.com';
    dto.code = '123456';
    dto.newPassword = 'Short1!';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('newPassword');
  });

  it('should fail if password does not match pattern', async () => {
    const dto = new ResetPasswordDto();
    dto.email = 'test@example.com';
    dto.code = '123456';
    dto.newPassword = 'weakpassword';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('newPassword');
  });
});