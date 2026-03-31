/**
 * Seeds PatientHistory records for demo/development.
 * James Morgan has a prior booking at Cardiff Physiotherapy Centre,
 * making him a pre-seeded returning patient.
 */
export async function seedPatientHistory(
  PatientHistoryModel: any,
  clinics: any[],
  leads: any[],
  conversations: any[],
) {
  console.log('Creating patient history...');

  // leads[4] = James Morgan, clinics[0] = Cardiff Physiotherapy Centre
  // conversations[4] = James's returning patient conversation (used as previousConversationId)
  await PatientHistoryModel.insertMany([
    {
      clinicId: clinics[0]._id,
      phone: '07700 900321',
      email: 'james.morgan@email.com',
      firstName: 'James',
      lastName: 'Morgan',
      validatedPostcode: 'CF14',
      previousConversationId: conversations[4]._id,
      lastBookedAt: new Date('2026-02-14T10:00:00'),
    },
  ]);

  console.log('Created 1 patient history record\n');
}
