/**
 * Seeds conversation data.
 *
 * Phase 1 — named conversations for the four fixture leads (Sarah, John,
 * Rachel, Lisa) used by the chat UI walkthroughs.
 * Phase 2 — bulk analytics conversations, one per bulk lead, with phase
 * distribution that produces a realistic funnel:
 *   ~55% booked / confirmed, ~20% qualified, ~15% booking_started,
 *   ~10% declined. `createdAt` is carried over from the lead so the
 *   analytics date-range filters line up exactly.
 */

const BULK_PHASES = [
  "confirmed",
  "confirmed",
  "confirmed",
  "confirmed",
  "confirmed",
  "qualified",
  "qualified",
  "booking",
  "booking",
  "declined",
] as const;

export async function seedConversations(
  ConversationModel: any,
  clinics: any[],
  leads: any[],
  adminUser: any,
  appointments?: any[],
) {
  console.log("Creating conversations...");

  // Named conversations for the first four leads (fixtures).
  const named = [
    {
      clinicId: clinics[0]._id,
      leadId: leads[0]._id,
      ghlContactId: leads[0].ghlContactId,
      phase: "confirmed",
      channel: "whatsapp",
      messageCount: 8,
      startedAt: new Date("2026-03-02T10:19:00"),
      lastMessageAt: new Date("2026-03-02T10:25:00"),
      lastMessageFrom: "lead",
      isHighPriority: false,
      requiresHumanIntervention: false,
    },
    {
      clinicId: clinics[1]._id,
      leadId: leads[1]._id,
      ghlContactId: leads[1].ghlContactId,
      phase: "qualified",
      channel: "sms",
      messageCount: 5,
      startedAt: new Date("2026-02-28T11:00:00"),
      lastMessageAt: new Date("2026-02-28T11:05:00"),
      lastMessageFrom: "ai",
      isHighPriority: false,
      requiresHumanIntervention: false,
    },
    {
      clinicId: clinics[0]._id,
      leadId: leads[2]._id,
      ghlContactId: leads[2].ghlContactId,
      phase: "greeting",
      channel: "website",
      messageCount: 0,
      startedAt: new Date(),
      isHighPriority: true,
      requiresHumanIntervention: false,
    },
    {
      clinicId: clinics[2]._id,
      leadId: leads[3]._id,
      ghlContactId: leads[3].ghlContactId,
      phase: "declined",
      channel: "sms",
      messageCount: 3,
      startedAt: new Date("2026-03-03T12:00:00"),
      lastMessageAt: new Date("2026-03-03T12:02:00"),
      lastMessageFrom: "ai",
      closedAt: new Date("2026-03-03T12:02:00"),
      closedReason: "outside_service_area",
    },
  ];

  // Bulk conversations — one per bulk lead (leads[4..]). Phase cycles
  // through BULK_PHASES so the funnel is consistent across clinics.
  const bulk: any[] = [];
  for (let i = 4; i < leads.length; i++) {
    const lead = leads[i];
    const phase = BULK_PHASES[i % BULK_PHASES.length];
    const createdAt = lead.createdAt ?? new Date();
    const lastMessageAt = new Date(createdAt.getTime() + 15 * 60_000);
    bulk.push({
      clinicId: lead.clinicId,
      leadId: lead._id,
      ghlContactId: lead.ghlContactId,
      phase,
      channel: lead.preferredChannel ?? "whatsapp",
      messageCount: 3 + (i % 6),
      startedAt: createdAt,
      lastMessageAt,
      lastMessageFrom: i % 2 === 0 ? "lead" : "ai",
      isHighPriority: false,
      requiresHumanIntervention: false,
      ...(phase === "declined"
        ? { closedAt: lastMessageAt, closedReason: "outside_service_area" }
        : {}),
      createdAt,
      updatedAt: lastMessageAt,
    });
  }

  const conversations = await ConversationModel.insertMany([...named, ...bulk]);
  console.log(
    `Created ${conversations.length} conversations (${named.length} named + ${bulk.length} bulk)\n`,
  );
  return conversations;
}
