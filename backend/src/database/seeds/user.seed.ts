import * as bcrypt from "bcrypt";

export async function seedUsers(UserModel: any) {
  console.log("Creating users...");

  const password = await bcrypt.hash("admin123", 10);

  const adminUser = await UserModel.create({
    name: "Admin User",
    email: "admin@lunaxdigital.com",
    passwordHash: password,
    role: "admin",
    isActive: true,
    notificationPreferences: {
      emailNotifications: true,
      dailySummary: true,
      stalled: true,
    },
  });

  console.log(`Created admin user: ${adminUser.email}\n`);

  return adminUser;
}
