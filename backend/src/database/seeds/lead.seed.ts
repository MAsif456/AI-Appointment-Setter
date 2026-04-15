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

/**
 * Realistic UK-style lead names for the bulk analytics seed.
 * Kept large enough that we don't repeat names inside the 71-lead bulk set.
 */
const FIRST_NAMES = [
  "Oliver", "Amelia", "Noah", "Olivia", "Jack", "Isla", "Leo", "Emily",
  "Harry", "Sophie", "George", "Grace", "Charlie", "Ella", "Thomas", "Poppy",
  "Arthur", "Mia", "Theo", "Lily", "Freddie", "Ava", "Alfie", "Chloe",
  "Henry", "Evie", "Oscar", "Charlotte", "James", "Freya", "Archie", "Jessica",
  "Mason", "Ruby", "Edward", "Zara", "William", "Lucy", "Joshua", "Hannah",
  "Samuel", "Rosie", "Daniel", "Maya", "Ethan", "Daisy", "Jacob", "Alice",
  "Logan", "Ivy", "Michael", "Harper", "Lucas", "Scarlett", "Benjamin", "Willow",
  "Max", "Matilda", "Isaac", "Bella", "Dylan", "Nina", "Finley", "Holly",
  "Reuben", "Esme", "Tommy", "Tilly", "Harvey", "Millie", "Elliot",
] as const;

const LAST_NAMES = [
  "Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson",
  "Davies", "Robinson", "Wright", "Thompson", "Evans", "Walker", "White",
  "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke", "Patel", "Khan",
  "Lewis", "Harris", "Morris", "King", "Hughes", "Edwards", "Hill", "Turner",
  "Martin", "Cooper", "Ward", "Baker", "Morgan", "Phillips", "Richards",
  "Watson", "Bennett", "Kelly", "Young", "Allen", "Price", "Griffiths",
  "Mitchell", "Collins", "Bailey", "Carter", "Parker", "Reed", "Stewart",
  "Cook", "Bell", "Murphy", "Rogers", "Gray", "James", "Reynolds",
] as const;

/** Deterministic pseudo-random so seeds are reproducible across runs. */
function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

/** Build a realistic full name that is unique inside the bulk set via index-based offsets. */
function makeName(index: number): { firstName: string; lastName: string } {
  return {
    firstName: pick(FIRST_NAMES, index),
    lastName: pick(LAST_NAMES, index * 7 + 3),
  };
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

  // Phase 2 — bulk analytics leads. Capped at 71 so, with the 4 named
  // fixtures, the grand total is exactly 75 leads / conversations and
  // doesn't blow up the Conversations page. Distributed across three
  // time tiers so each dashboard preset returns a realistic, professional
  // number and the booking chart has peaks on multiple days:
  //   last 7 days  → ~24 leads (tens platform-wide, several per day)
  //   last 30 days → ~52 leads total (≈ 2× the week)
  //   last 90 days → 75 leads total (full set, including the named fixtures)
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const TIERS = [
    { count: 24, dayMin: 1, dayMax: 7 }, // last week
    { count: 28, dayMin: 8, dayMax: 30 }, // days 8–30
    { count: 19, dayMin: 31, dayMax: 90 }, // days 31–90
  ];

  const bulk: any[] = [];
  let globalIdx = 0;
  TIERS.forEach((tier, tierIdx) => {
    const span = tier.dayMax - tier.dayMin + 1;
    for (let i = 0; i < tier.count; i++) {
      // Rotate clinics across the tier so each clinic gets roughly the
      // same share of leads in every time window.
      const clinic = clinics[(i + tierIdx) % clinics.length];
      const clinicIdx = (i + tierIdx) % clinics.length;

      // Offset by tierIdx + i so different leads land on different days
      // and multiple leads share the same day — the graph gets real peaks.
      const daysAgo = tier.dayMin + ((i * 2 + tierIdx) % span);
      const hour = 8 + ((i * 3 + tierIdx) % 10); // 08:00–17:00
      const minute = (i * 11) % 60;
      const createdAt = new Date(
        now - daysAgo * DAY_MS - (24 - hour) * 3600_000 + minute * 60_000,
      );

      const { firstName, lastName } = makeName(globalIdx);
      bulk.push({
        clinicId: clinic._id,
        firstName,
        lastName,
        phone: `07700 ${String(900000 + globalIdx).padStart(6, "0")}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${globalIdx}@example.com`,
        postcode: pick(POSTCODES, globalIdx),
        postcodeStatus: "valid",
        issue: pick(ISSUES, globalIdx + clinicIdx),
        urgency: pick(URGENCIES, globalIdx + clinicIdx),
        patientType: globalIdx % 4 === 0 ? "returning" : "new",
        leadSource: pick(LEAD_SOURCES, globalIdx + clinicIdx),
        preferredChannel: pick(CHANNELS, globalIdx),
        ghlContactId: `contact_bulk_${globalIdx}`,
        ghlTags: [],
        createdAt,
        updatedAt: createdAt,
      });
      globalIdx++;
    }
  });

  const leads = await LeadModel.insertMany([...named, ...bulk]);
  console.log(`Created ${leads.length} leads (${named.length} named + ${bulk.length} bulk)\n`);
  return leads;
}
