import { User, UserSchema } from './user.schema';

/** Unit tests for User schema */
describe('UserSchema', () => {
  it('creates the schema without errors', () => {
    expect(UserSchema).toBeDefined();
  });

  it('creates a User instance and sets basic fields', () => {
    const user = new User();
    user.name = 'Admin User';
    user.email = 'admin@test.com';
    user.passwordHash = 'hashedpassword';
    user.role = 'admin';

    expect(user.name).toBe('Admin User');
    expect(user.email).toBe('admin@test.com');
    expect(user.passwordHash).toBe('hashedpassword');
    expect(user.role).toBe('admin');
  });

  it('supports notification preferences', () => {
    const user = new User();
    user.notificationPreferences = {
      generalNotifications: true,
      emailNotifications: true,
      stalledConversations: false,
      escalatedConversations: true,
      bookingCancelled: false,
      newUserJoined: true,
      appointmentReminders: true,
    };

    expect(user.notificationPreferences.emailNotifications).toBe(true);
    expect(user.notificationPreferences.stalledConversations).toBe(false);
    expect(user.notificationPreferences.escalatedConversations).toBe(true);
  });

  it('supports token-based email verification fields', () => {
    const user = new User();
    user.isVerified = false;
    user.verificationToken = 'abc123securetoken';
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    expect(user.isVerified).toBe(false);
    expect(user.verificationToken).toBe('abc123securetoken');
    expect(user.verificationTokenExpires).toBeInstanceOf(Date);
  });

  it('supports token-based password reset fields', () => {
    const user = new User();
    user.passwordResetToken = 'reset-token-xyz';
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);

    expect(user.passwordResetToken).toBe('reset-token-xyz');
    expect(user.passwordResetExpires).toBeInstanceOf(Date);
  });

  it('supports assignedClinics as an array', () => {
    const user = new User();
    user.assignedClinics = [];
    expect(Array.isArray(user.assignedClinics)).toBe(true);
  });

  it('supports isActive field', () => {
    const user = new User();
    user.isActive = false;
    expect(user.isActive).toBe(false);
  });

  it('allows clearing token fields to undefined (single-use tokens)', () => {
    const user = new User();
    user.verificationToken = 'token';
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    expect(user.verificationToken).toBeUndefined();
    expect(user.verificationTokenExpires).toBeUndefined();
    expect(user.passwordResetToken).toBeUndefined();
    expect(user.passwordResetExpires).toBeUndefined();
  });

  it('supports lastLoginAt field', () => {
    const user = new User();
    const now = new Date();
    user.lastLoginAt = now;
    expect(user.lastLoginAt).toBe(now);
  });
});