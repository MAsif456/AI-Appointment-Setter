import * as bcrypt from 'bcrypt';

/**
 * Seeds the initial admin user.
 * isSuperAdmin: true marks this account as permanently protected —
 * it can never be demoted or deleted regardless of system state,
 * guaranteeing there is always a way back into the system.
 */
export async function seedUsers(UserModel: any) {
  console.log('Creating users...');

  const password = await bcrypt.hash('admin123', 10);

  const adminUser = await UserModel.create({
    name: 'Admin User',
    email: 'admin@lunaxdigital.com',
    passwordHash: password,
    role: 'admin',
    isActive: true,
    isVerified: true,
    isSuperAdmin: true,
    tokenVersion: 0,
    notificationPreferences: {
      emailNotifications: true,
      dailySummary: true,
      stalled: true,
    },
  });

  console.log(`Created super admin: ${adminUser.email}`);
  console.log(`  - Email:    ${adminUser.email}`);
  console.log(`  - Password: admin123`);
  console.log(`  - Role:     ${adminUser.role}`);
  console.log(`  - Verified: ${adminUser.isVerified}`);
  console.log(`  - Super:    ${adminUser.isSuperAdmin}\n`);

  return adminUser;
}