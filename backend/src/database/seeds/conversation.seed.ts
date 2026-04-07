/**
 * Seeds conversation data — exactly one conversation per lead/phase.
 * leads[0] = Sarah (Confirmed), leads[1] = John (Qualified),
 * leads[2] = Rachel (Booking, 0 messages), leads[3] = Lisa (Declined),
 * leads[4] = James (Returning patient, greeting phase).
 */
export async function seedConversations(
  ConversationModel: any,
  clinics: any[],
  leads: any[],
  adminUser: any,
) {
  console.log("Creating conversations...");

  const conversations = await ConversationModel.insertMany([
    // Sarah Williams — Confirmed (full conversation history)
    {
      clinicId: clinics[0]._id,
      leadId: leads[0]._id,
      phase: "confirmed",
      channel: "whatsapp",
      messageCount: 8,
      startedAt: new Date("2026-03-02T10:19:00"),
      lastMessageAt: new Date("2026-03-02T10:25:00"),
      lastMessageFrom: "lead",
      isHighPriority: false,
      requiresHumanIntervention: false,
    },
    // John Davies — Qualified (greeting + qualification answered)
    {
      clinicId: clinics[1]._id,
      leadId: leads[1]._id,
      phase: "qualified",
      channel: "sms",
      messageCount: 5,
      startedAt: new Date("2026-02-28T11:00:00"),
      lastMessageAt: new Date("2026-02-28T11:05:00"),
      lastMessageFrom: "ai",
      isHighPriority: false,
      requiresHumanIntervention: false,
    },
    // Rachel Green — Booking (no messages, AI greeting triggers on open)
    {
      clinicId: clinics[0]._id,
      leadId: leads[2]._id,
      phase: "greeting",
      channel: "website",
      messageCount: 0,
      startedAt: new Date(),
      isHighPriority: true,
      requiresHumanIntervention: false,
    },
    // Lisa Evans — Declined (outside service area)
    {
      clinicId: clinics[2]._id,
      leadId: leads[3]._id,
      phase: "declined",
      channel: "sms",
      messageCount: 3,
      startedAt: new Date("2026-03-03T12:00:00"),
      lastMessageAt: new Date("2026-03-03T12:02:00"),
      lastMessageFrom: "ai",
      closedAt: new Date("2026-03-03T12:02:00"),
      closedReason: "outside_service_area",
    },
    // James Morgan — Returning patient (pre-seeded for demo, postcode already known)
    {
      clinicId: clinics[0]._id,
      leadId: leads[4]._id,
      phase: "greeting",
      channel: "sms",
      messageCount: 0,
      startedAt: new Date(),
      isHighPriority: false,
      requiresHumanIntervention: false,
      isReturningPatient: true,
      returningPatientConfidence: "high",
      context: new Map([
        ["returningPatientPostcode", "CF14"],
        ["validatedPostcode", "CF14"],
      ]),
    },
  ]);

  console.log(`Created ${conversations.length} conversations\n`);
  return conversations;
}
