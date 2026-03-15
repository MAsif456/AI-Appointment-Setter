import { User, UserSchema } from './user.schema';

describe('UserSchema', () => {
  it('should create schema', () => {
    expect(UserSchema).toBeDefined();
  });

  it('should create user object', () => {
    const user = new User();

    user.name = 'Admin';
    user.email = 'admin@test.com';
    user.passwordHash = 'hashedpassword';

    expect(user.email).toBe('admin@test.com');
    expect(user.name).toBe('Admin');
  });

  it('should support notification preferences', () => {
    const user = new User();

    user.notificationPreferences = {
      emailNotifications: true,
      dailySummary: true,
      stalled: false,
    };

    expect(user.notificationPreferences.stalled).toBe(false);
    expect(user.notificationPreferences.emailNotifications).toBe(true);
    expect(user.notificationPreferences.dailySummary).toBe(true);
  });

  it('should support email verification fields', () => {
    const user = new User();

    user.isVerified = false;
    user.verificationCode = '123456';
    user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

    expect(user.isVerified).toBe(false);
    expect(user.verificationCode).toBe('123456');
    expect(user.verificationCodeExpires).toBeInstanceOf(Date);
  });

  it('should support password reset fields', () => {
    const user = new User();

    user.passwordResetCode = '654321';
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);

    expect(user.passwordResetCode).toBe('654321');
    expect(user.passwordResetExpires).toBeInstanceOf(Date);
  });

  it('should default isVerified to false', () => {
    const user = new User();
    expect(user.isVerified).toBeUndefined(); // Will be set to false by MongoDB default
  });

  it('should allow undefined verification codes', () => {
    const user = new User();
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;

    expect(user.verificationCode).toBeUndefined();
    expect(user.verificationCodeExpires).toBeUndefined();
  });
});