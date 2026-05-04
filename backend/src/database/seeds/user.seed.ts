import * as bcrypt from "bcrypt";

/**
 * Seeds the initial admin user.
 * isSuperAdmin: true marks this account as permanently protected —
 * it can never be demoted or deleted regardless of system state,
 * guaranteeing there is always a way back into the system.
 */
export async function seedUsers(UserModel: any) {
  console.log("Creating users...");

  const password = await bcrypt.hash("admin123", 10);

  const adminUser = await UserModel.create({
    name: "Admin User",
    email: "admin@lunaxdigital.com",
    passwordHash: password,
    role: "admin",
    isActive: true,
    isVerified: true,
    isSuperAdmin: true,
    tokenVersion: 0,
  });

  console.log(`Created super admin: ${adminUser.email}`);
  console.log(`  - Password: admin123\n`);

  return adminUser;
}

/**
 * Seeds a staff demo user with assignedClinics set to the first two
 * clinics. Used to demonstrate role-based analytics filtering: when this
 * staff user logs in, the dashboard only shows the two clinics they're
 * assigned to, while the admin sees all.
 */
export async function seedStaffUser(UserModel: any, clinics: any[]) {
  if (clinics.length < 2) return null;

  const password = await bcrypt.hash("staff123", 10);
  const staffUser = await UserModel.create({
    name: "Staff Demo",
    email: "staff@lunaxdigital.com",
    passwordHash: password,
    role: "staff",
    assignedClinics: [clinics[0]._id, clinics[1]._id],
    isActive: true,
    isVerified: true,
    tokenVersion: 0,
  });

  console.log(`Created staff user: ${staffUser.email}`);
  console.log(`  - Password: staff123`);
  console.log(
    `  - Assigned clinics: ${clinics[0].name}, ${clinics[1].name}\n`,
  );

  return staffUser;
}
