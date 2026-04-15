/**
 * Seeds message data for development/testing.
 * Conversations[0]=Sarah (Confirmed), [1]=John (Qualified),
 * [2]=Rachel (Booking, no messages), [3]=Lisa (Declined).
 */
export async function seedMessages(
  MessageModel: any,
  clinics: any[],
  leads: any[],
  conversations: any[],
) {
  console.log("Creating messages...");

  await MessageModel.insertMany([
    // === Sarah Williams — Confirmed (full booking flow) ===
    {
      conversationId: conversations[0]._id,
      clinicId: clinics[0]._id,
      leadId: leads[0]._id,
      sender: "ai",
      content:
        "Hi Sarah! Thanks for getting in touch with Cardiff Physiotherapy Centre. " +
        "I can help you book an appointment for your back pain. " +
        "Let me ask a few quick questions.",
      channel: "whatsapp",
      detectedIntent: "GREETING",
    },
    {
      conversationId: conversations[0]._id,
      clinicId: clinics[0]._id,
      leadId: leads[0]._id,
      sender: "lead",
      content: "Hi yes please, I've had back pain for about a week now",
      channel: "whatsapp",
    },
    {
      conversationId: conversations[0]._id,
      clinicId: clinics[0]._id,
      leadId: leads[0]._id,
      sender: "ai",
      content:
        "I'm sorry to hear that. Can you confirm your postcode " +
        "so I can check we cover your area?",
      channel: "whatsapp",
    },
    {
      conversationId: conversations[0]._id,
      clinicId: clinics[0]._id,
      leadId: leads[0]._id,
      sender: "lead",
      content: "CF10 3AB",
      channel: "whatsapp",
    },
    {
      conversationId: conversations[0]._id,
      clinicId: clinics[0]._id,
      leadId: leads[0]._id,
      sender: "ai",
      content:
        "Great, you're within our service area! " +
        "I have availability on Thursday 5th March at 2pm or Friday 6th at 10am. " +
        "Which works better for you?",
      channel: "whatsapp",
    },
    {
      conversationId: conversations[0]._id,
      clinicId: clinics[0]._id,
      leadId: leads[0]._id,
      sender: "lead",
      content: "Thursday 2pm works perfectly",
      channel: "whatsapp",
    },
    {
      conversationId: conversations[0]._id,
      clinicId: clinics[0]._id,
      leadId: leads[0]._id,
      sender: "ai",
      content:
        "Wonderful! I've booked you in for Thursday 5th March at 2pm " +
        "at Cardiff Physiotherapy Centre. You'll receive a confirmation " +
        "shortly. Is there anything else I can help with?",
      channel: "whatsapp",
    },
    {
      conversationId: conversations[0]._id,
      clinicId: clinics[0]._id,
      leadId: leads[0]._id,
      sender: "lead",
      content: "No that's great, thank you!",
      channel: "whatsapp",
    },

    // === John Davies — Qualified (greeting + qualification) ===
    {
      conversationId: conversations[1]._id,
      clinicId: clinics[1]._id,
      leadId: leads[1]._id,
      sender: "ai",
      content:
        "Hello John, welcome to Newport Sports Clinic. " +
        "How can we assist you with your knee injury today?",
      channel: "sms",
      detectedIntent: "GREETING",
    },
    {
      conversationId: conversations[1]._id,
      clinicId: clinics[1]._id,
      leadId: leads[1]._id,
      sender: "lead",
      content: "Hi, I hurt my knee playing football yesterday and it's swollen",
      channel: "sms",
    },
    {
      conversationId: conversations[1]._id,
      clinicId: clinics[1]._id,
      leadId: leads[1]._id,
      sender: "ai",
      content:
        "I understand. Can you confirm your postcode so I can " +
        "check we cover your area?",
      channel: "sms",
    },
    {
      conversationId: conversations[1]._id,
      clinicId: clinics[1]._id,
      leadId: leads[1]._id,
      sender: "lead",
      content: "NP20 1AA",
      channel: "sms",
    },
    {
      conversationId: conversations[1]._id,
      clinicId: clinics[1]._id,
      leadId: leads[1]._id,
      sender: "ai",
      content:
        "You're within our service area. How soon do you need " +
        "to be seen? And are you a new or returning patient?",
      channel: "sms",
    },

    // === Rachel Green — Booking (no messages, AI greeting on open) ===
    // (intentionally empty)

    // === Lisa Evans — Declined (outside service area) ===
    {
      conversationId: conversations[3]._id,
      clinicId: clinics[2]._id,
      leadId: leads[3]._id,
      sender: "ai",
      content:
        "Hi Lisa, thanks for contacting Swansea Wellness Hub. " +
        "Let's get you booked in! Can you confirm your postcode?",
      channel: "sms",
      detectedIntent: "GREETING",
    },
    {
      conversationId: conversations[3]._id,
      clinicId: clinics[2]._id,
      leadId: leads[3]._id,
      sender: "lead",
      content: "SA2 8XX",
      channel: "sms",
    },
    {
      conversationId: conversations[3]._id,
      clinicId: clinics[2]._id,
      leadId: leads[3]._id,
      sender: "ai",
      content:
        "Unfortunately we don't cover the SA2 area at this time. " +
        "I would recommend contacting a clinic closer to your location. " +
        "Sorry we could not help on this occasion.",
      channel: "sms",
    },
  ]);

  // === Bulk messages for analytics ===
  // Each bulk conversation gets 4 messages (2 AI, 2 lead) so transcripts
  // look realistic in the conversations UI. Timestamps inherit the parent
  // conversation's createdAt so bulk messages fall inside whatever
  // analytics date window is queried. `responseTimeSeconds` is retained
  // on AI messages for audit/debug purposes even though the analytics
  // overview now reports "average messages to booking" instead.
  const bulkMessages: any[] = [];
  for (let i = 4; i < conversations.length; i++) {
    const convo = conversations[i];
    const base = convo.createdAt ? new Date(convo.createdAt).getTime() : Date.now();
    const aiResponseSeconds = 4 + (i % 8); // 4–11 second spread

    bulkMessages.push(
      {
        conversationId: convo._id,
        clinicId: convo.clinicId,
        leadId: convo.leadId,
        sender: "ai",
        content: "Hi, thanks for getting in touch. How can we help?",
        channel: convo.channel,
        detectedIntent: "GREETING",
        responseTimeSeconds: aiResponseSeconds,
        createdAt: new Date(base),
        updatedAt: new Date(base),
      },
      {
        conversationId: convo._id,
        clinicId: convo.clinicId,
        leadId: convo.leadId,
        sender: "lead",
        content: "I'm looking to book an appointment.",
        channel: convo.channel,
        createdAt: new Date(base + 60_000),
        updatedAt: new Date(base + 60_000),
      },
      {
        conversationId: convo._id,
        clinicId: convo.clinicId,
        leadId: convo.leadId,
        sender: "ai",
        content: "Great — can you confirm your postcode?",
        channel: convo.channel,
        responseTimeSeconds: aiResponseSeconds + 2,
        createdAt: new Date(base + 120_000),
        updatedAt: new Date(base + 120_000),
      },
      {
        conversationId: convo._id,
        clinicId: convo.clinicId,
        leadId: convo.leadId,
        sender: "lead",
        content: "CF10 3AB",
        channel: convo.channel,
        createdAt: new Date(base + 180_000),
        updatedAt: new Date(base + 180_000),
      },
    );
  }

  if (bulkMessages.length > 0) {
    await MessageModel.insertMany(bulkMessages);
  }

  console.log(`Messages created (bulk: ${bulkMessages.length})\n`);
}
