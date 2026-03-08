export async function seedAppointments(
  AppointmentModel: any,
  clinics: any[],
  leads: any[],
  conversations: any[]
) {

  console.log('Creating appointments...');

  const appointments = await AppointmentModel.insertMany([
    {
        clinicId: clinics[0]._id,
        leadId: leads[0]._id,
        conversationId: conversations[0]._id,
        ghlAppointmentId: 'APT-2024-001234',
        appointmentDate: new Date('2026-03-06'),
        appointmentTime: '14:30',
        durationMinutes: 30,
        serviceType: 'Back pain',
        price: 60,
        status: 'confirmed'
      }
  ]);

  console.log(`Created ${appointments.length} appointments\n`);

  return appointments;
}