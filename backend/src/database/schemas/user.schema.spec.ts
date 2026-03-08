import { User, UserSchema } from './user.schema';

describe('UserSchema', () => {
  it('should create schema', () => {
    expect(UserSchema).toBeDefined();
  });

  it('should create user object', () => {
    const user = new User();

    user.name = 'Admin';
    user.email = 'admin@test.com';

    expect(user.email).toBe('admin@test.com');
  });

  it('should support notification preferences', () => {
    const user = new User();

    user.notificationPreferences = {
      emailNotifications: true,
      dailySummary: true,
      stalled: false,
    };

    expect(user.notificationPreferences.stalled).toBe(false);
  });
});