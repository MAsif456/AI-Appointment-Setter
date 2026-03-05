export async function seedConversations(
  ConversationModel: any,
  clinics: any[],
  leads: any[],
  adminUser: any
) {

  console.log('Creating conversations...');
    
    const conversations = await ConversationModel.insertMany([
      {
        clinicId: clinics[0]._id,
        leadId: leads[0]._id,
        phase: 'confirmed',
        channel: 'whatsapp',
        messageCount: 9,
        startedAt: new Date('2026-03-02T10:19:00'),
        lastMessageAt: new Date('2026-03-02T10:25:00'),
        lastMessageFrom: 'ai',
        isHighPriority: false,
        requiresHumanIntervention: false,
        patientRating: {
          stars: 5,
          feedback: 'Very easy booking process and helpful AI assistant!',
          ratedAt: new Date('2026-03-02T10:25:00')
        }
      },
      {
        clinicId: clinics[0]._id,
        leadId: leads[1]._id,
        phase: 'booking',
        channel: 'sms',
        messageCount: 6,
        startedAt: new Date('2026-03-02T14:20:00'),
        lastMessageAt: new Date('2026-03-02T14:23:00'),
        lastMessageFrom: 'lead',
        isHighPriority: false,
        requiresHumanIntervention: false,
        flaggedForReview: true,
        flaggedAt: new Date('2026-03-02T14:30:00'),
        flaggedBy: adminUser._id.toString(),
        flagReason: 'Lead asked unusual question about payment'
      },
      {
        clinicId: clinics[0]._id,
        leadId: leads[2]._id,
        phase: 'confirmed',
        channel: 'whatsapp',
        messageCount: 7,
        startedAt: new Date('2026-03-02T09:30:00'),
        lastMessageAt: new Date('2026-03-02T09:35:00'),
        lastMessageFrom: 'ai',
        isHighPriority: false
      },
      {
        clinicId: clinics[1]._id,
        leadId: leads[3]._id,
        phase: 'qualified',
        channel: 'sms',
        messageCount: 5,
        startedAt: new Date('2026-02-28T11:00:00'),
        lastMessageAt: new Date('2026-02-28T11:05:00'),
        lastMessageFrom: 'ai',
        isHighPriority: false
      },
      {
        clinicId: clinics[1]._id,
        leadId: leads[4]._id,
        phase: 'booking',
        channel: 'whatsapp',
        messageCount: 4,
        startedAt: new Date('2026-03-04T15:30:00'),
        lastMessageAt: new Date('2026-03-04T15:33:00'),
        lastMessageFrom: 'lead',
        isHighPriority: true,
        isEmergency: false,
        requiresHumanIntervention: false
      },
      {
        clinicId: clinics[2]._id,
        leadId: leads[5]._id,
        phase: 'booking',
        channel: 'instagram',
        messageCount: 5,
        startedAt: new Date('2026-03-01T16:45:00'),
        lastMessageAt: new Date('2026-03-01T16:47:00'),
        lastMessageFrom: 'ai',
        isHighPriority: true,
        isEmergency: true,
        requiresHumanIntervention: true,
        humanInterventionReason: 'Urgent case but no available slots in next 24 hours'
      },
      {
        clinicId: clinics[2]._id,
        leadId: leads[6]._id,
        phase: 'declined',
        channel: 'sms',
        messageCount: 3,
        startedAt: new Date('2026-03-03T12:00:00'),
        lastMessageAt: new Date('2026-03-03T12:02:00'),
        lastMessageFrom: 'ai',
        closedAt: new Date('2026-03-03T12:02:00'),
        closedReason: 'outside_service_area'
      }
  ]);

  console.log(`Created ${conversations.length} conversations\n`);

  return conversations;
}