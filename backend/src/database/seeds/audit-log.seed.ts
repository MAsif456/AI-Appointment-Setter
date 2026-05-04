export async function seedAuditLogs(
  AuditLogModel: any,
  clinics: any[],
  adminUser: any,
) {
  console.log("Creating audit logs...");

  await AuditLogModel.insertMany([
    {
      userId: adminUser._id,
      clinicId: clinics[0]._id,
      action: "clinic.created",
      entityType: "clinic",
      entityId: clinics[0]._id.toString(),
      severity: "info",
    },
  ]);

  console.log("Audit logs created\n");
}
