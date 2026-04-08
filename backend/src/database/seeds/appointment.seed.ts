export async function seedAppointments(
  AppointmentModel: any,
  clinics: any[],
  leads: any[],
  conversations: any[],
  ConversationModel?: any,
) {
  console.log("Creating appointments...");

  const appointments = await AppointmentModel.insertMany([
    {
      clinicId: clinics[0]._id,
      leadId: leads[0]._id,
      conversationId: conversations[0]._id,
      ghlAppointmentId: "APT-2024-001234",
      appointmentDate: new Date("2026-03-06"),
      appointmentTime: "14:30",
      durationMinutes: 30,
      serviceType: "Back pain",
      price: 60,
      status: "confirmed",
    },
  ]);

  // Back-fill appointmentId on the conversation so the reminder service can
  // look up the conversation via { appointmentId: appointment._id }.
  if (ConversationModel) {
    await ConversationModel.findByIdAndUpdate(conversations[0]._id, {
      appointmentId: appointments[0]._id,
    });
  }

  console.log(`Created ${appointments.length} appointments\n`);

  return appointments;
}
