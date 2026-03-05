export async function seedMessages(
  MessageModel: any,
  clinics: any[],
  leads: any[],
  conversations: any[]
) {

  console.log('Creating messages...');

  await MessageModel.insertMany([
    {
        conversationId: conversations[0]._id,
        clinicId: clinics[0]._id,
        leadId: leads[0]._id,
        sender: 'ai',
        content: 'Hi Sarah! Thanks for getting in touch with Cardiff Physiotherapy Centre.',
        channel: 'whatsapp',
        detectedIntent: 'GREETING',
        aiProcessingStartedAt: new Date('2026-03-02T10:19:00'),
        aiProcessingCompletedAt: new Date('2026-03-02T10:19:03'),
        responseTimeSeconds: 3
      },
      {
        conversationId: conversations[0]._id,
        clinicId: clinics[0]._id,
        leadId: leads[0]._id,
        sender: 'lead',
        content: 'Hi yes please, I\'ve had back pain for about a week now',
        channel: 'whatsapp'
      }
  ]);

  console.log('Messages created\n');
}