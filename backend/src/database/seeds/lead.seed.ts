/**
 * Seeds lead data for development/testing.
 *
 * Two-phase seed:
 *  1. Named fixture leads (Sarah, John, Rachel, Lisa) — used by the chat UI
 *     walkthroughs so the conversation/message seeds can target them by
 *     index (leads[0..3]).
 *  2. Bulk-generated analytics leads — ~36 leads per clinic spread evenly
 *     across the last 30 days. These are what make the analytics dashboard
 *     filters (last 7 days / last 30 days / custom range) return
 *     meaningful, consistent numbers across every clinic.
 */

const LEAD_SOURCES = ["facebook", "google_ads", "referral", "website"] as const;
const ISSUES = [
  "Back pain",
  "Knee injury",
  "Shoulder pain",
  "Neck pain",
  "Sports injury",
  "Sciatica",
] as const;
const URGENCIES = ["routine", "urgent", "unknown"] as const;
const CHANNELS = ["whatsapp", "sms", "website"] as const;
const POSTCODES = ["CF10 3AB", "NP20 1AA", "SA1 2BC", "CF31 4DE"] as const;

/** Deterministic pseudo-random so seeds are reproducible across runs. */
function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

export async function seedLeads(LeadModel: any, clinics: any[]) {
  console.log("Creating leads...");

  // Phase 1 — named fixtures used by chat UI walkthroughs.
  const named = [
    {
      clinicId: clinics[0]._id,
      firstName: "Sarah",
      lastName: "Williams",
      phone: "07700 900123",
      email: "sarah.williams@email.com",
      postcode: "CF10 3AB",
      postcodeStatus: "valid",
      issue: "Back Pain",
      urgency: "routine",
      patientType: "new",
      leadSource: "facebook",
      preferredChannel: "whatsapp",
      ghlContactId: "contact_sarah_001",
      ghlTags: ["qualified", "postcode-valid", "appointment-booked"],
      totalAppointments: 1,
    },
    {
      clinicId: clinics[1]._id,
      firstName: "John",
      lastName: "Davies",
      phone: "07700 900456",
      email: "john.davies@email.com",
      postcode: "NP20 1AA",
      postcodeStatus: "valid",
      issue: "Knee injury",
      urgency: "urgent",
      patientType: "new",
      leadSource: "google_ads",
      preferredChannel: "sms",
      ghlContactId: "contact_john_001",
      ghlTags: ["qualified"],
    },
    {
      clinicId: clinics[0]._id,
      firstName: "Rachel",
      lastName: "Green",
      phone: "07700 900789",
      email: "rachel.green@email.com",
      postcode: "",
      postcodeStatus: "not_checked",
      issue: "Shoulder pain",
      urgency: "unknown",
      patientType: "new",
      leadSource: "facebook",
      preferredChannel: "whatsapp",
      ghlContactId: "LnDXhTfVwpnIxMdz3bUW",
      ghlTags: [],
    },
    {
      clinicId: clinics[2]._id,
      firstName: "Lisa",
      lastName: "Evans",
      phone: "07700 900654",
      email: "lisa.evans@email.com",
      postcode: "SA2 8XX",
      postcodeStatus: "invalid",
      issue: "Neck pain",
      urgency: "routine",
      patientType: "new",
      leadSource: "referral",
      preferredChannel: "sms",
      ghlContactId: "contact_lisa_001",
      ghlTags: ["outside-area"],
    },
  ];

  // Phase 2 — bulk analytics leads, ~36 per clinic across 30 days.
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const LEADS_PER_CLINIC = 36;

  const bulk: any[] = [];
  clinics.forEach((clinic, clinicIdx) => {
    for (let i = 0; i < LEADS_PER_CLINIC; i++) {
      // Spread across last 30 days, skipping today so all leads fall inside
      // a [now-30d, now] window regardless of clock drift.
      const daysAgo = 1 + Math.floor((i * 30) / LEADS_PER_CLINIC);
      const createdAt = new Date(now - daysAgo * DAY_MS - (i % 24) * 3600_000);
      bulk.push({
        clinicId: clinic._id,
        firstName: `Lead${clinicIdx}${i}`,
        lastName: `Test`,
        phone: `07700 ${String(900000 + clinicIdx * 1000 + i).slice(-6)}`,
        email: `lead.${clinicIdx}.${i}@example.com`,
        postcode: pick(POSTCODES, i),
        postcodeStatus: "valid",
        issue: pick(ISSUES, i + clinicIdx),
        urgency: pick(URGENCIES, i + clinicIdx),
        patientType: i % 4 === 0 ? "returning" : "new",
        leadSource: pick(LEAD_SOURCES, i + clinicIdx),
        preferredChannel: pick(CHANNELS, i),
        ghlContactId: `contact_bulk_${clinicIdx}_${i}`,
        ghlTags: [],
        createdAt,
        updatedAt: createdAt,
      });
    }
  });

  const leads = await LeadModel.insertMany([...named, ...bulk]);
  console.log(`Created ${leads.length} leads (${named.length} named + ${bulk.length} bulk)\n`);
  return leads;
}
