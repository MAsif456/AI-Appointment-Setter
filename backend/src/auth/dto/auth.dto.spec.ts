import { validate } from 'class-validator';
import { 
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './auth.dto';

describe('CreateUserDto', () => {
  const validDto = (): CreateUserDto => {
    const dto = new CreateUserDto();
    dto.name = 'John Doe'; dto.email = 'john@example.com';
    dto.password = 'StrongPass1!'; dto.role = 'staff';
    dto.assignedClinics = ['507f1f77bcf86cd799439011'];
    return dto;
  };

  it('should pass with valid data', async () => {
    const errors = await validate(validDto());
    expect(errors.length).toBe(0);
  });

  it('should fail if name is empty', async () => {
    const dto = validDto();
    dto.name = '';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'name')).toBe(true);
  });

  it('should fail if email is invalid', async () => {
    const dto = validDto();
    dto.email = 'invalid-email';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'email')).toBe(true);
  });

  it('should fail if password is too short', async () => {
    const dto = validDto();
    dto.password = 'Short1!';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'password')).toBe(true);
  });

  it('should fail if password lacks uppercase', async () => {
    const dto = validDto();
    dto.password = 'test123!';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'password')).toBe(true);
  });

  it('should fail if password lacks lowercase', async () => {
    const dto = validDto();
    dto.password = 'TEST123!';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'password')).toBe(true);
  });

  it('should fail if password lacks number', async () => {
    const dto = validDto();
    dto.password = 'TestUser!';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'password')).toBe(true);
  });

  it('should fail if password lacks special character', async () => {
    const dto = validDto();
    dto.password = 'TestUser123';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'password')).toBe(true);
  });

  it('should fail if role is invalid', async () => {
    const dto = validDto();
    dto.role = 'patient' as any;
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'role')).toBe(true);
  });

  it('should pass without assignedClinics (optional)', async () => {
    const dto = validDto();
    delete dto.assignedClinics;
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail if assignedClinics is not an array', async () => {
    const dto = validDto();
    dto.assignedClinics = 'not-array' as any;
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'assignedClinics')).toBe(true);
  });

  it('should fail if assignedClinics contains invalid MongoId', async () => {
    const dto = validDto();
    dto.assignedClinics = ['invalid-id'];
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'assignedClinics')).toBe(true);
  });
});

describe('UpdateUserDto', () => {
  it('should pass with empty object', async () => {
    const dto = new UpdateUserDto();
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate email if invalid', async () => {
    const dto = new UpdateUserDto();
    dto.email = 'bad-email';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'email')).toBe(true);
  });

  it('should validate role enum', async () => {
    const dto = new UpdateUserDto();
    dto.role = 'invalid' as any;
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'role')).toBe(true);
  });

  it('should validate assignedClinics MongoId', async () => {
    const dto = new UpdateUserDto();
    dto.assignedClinics = ['bad-id'];
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'assignedClinics')).toBe(true);
  });
});

describe('ChangePasswordDto', () => {
  it('should pass valid passwords', async () => {
    const dto = new ChangePasswordDto();
    dto.currentPassword = 'OldPass1!';
    dto.newPassword = 'NewPass1!';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail if currentPassword missing', async () => {
    const dto = new ChangePasswordDto();
    dto.currentPassword = '';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'currentPassword')).toBe(true);
  });

  it('should fail weak new password', async () => {
    const dto = new ChangePasswordDto();
    dto.currentPassword = 'OldPass1!';
    dto.newPassword = 'weak';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'newPassword')).toBe(true);
  });
});

describe('ForgotPasswordDto', () => {
  it('should pass valid email', async () => {
    const dto = new ForgotPasswordDto();
    dto.email = 'test@example.com';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail invalid email', async () => {
    const dto = new ForgotPasswordDto();
    dto.email = 'bad-email';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'email')).toBe(true);
  });
});

describe('ResetPasswordDto', () => {
  it('should pass valid data', async () => {
    const dto = new ResetPasswordDto();
    dto.token = 'valid-token';
    dto.newPassword = 'NewPass1!';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail if token is missing', async () => {
    const dto = new ResetPasswordDto();
    dto.token = '';
    dto.newPassword = 'NewPass1!';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'token')).toBe(true);
  });

  it('should fail weak password', async () => {
    const dto = new ResetPasswordDto();
    dto.token = 'valid-token';
    dto.newPassword = 'weak';
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'newPassword')).toBe(true);
  });
});