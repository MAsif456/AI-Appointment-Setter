export async function seedLeads(LeadModel: any, clinics: any[]) {

  console.log('Creating leads...');

  const leads = await LeadModel.insertMany([
    {
        clinicId: clinics[0]._id,
        firstName: 'Sarah',
        lastName: 'Williams',
        phone: '07700 900123',
        email: 'sarah.williams@email.com',
        postcode: 'CF10 3AB',
        postcodeStatus: 'valid',
        issue: 'Back Pain',
        urgency: 'routine',
        patientType: 'new',
        leadSource: 'facebook',
        preferredChannel: 'whatsapp',
        ghlContactId: 'contact_sarah_001',
        ghlTags: ['qualified', 'postcode-valid', 'appointment-booked'],
        totalAppointments: 1
      },
      {
        clinicId: clinics[0]._id,
        firstName: 'Emma',
        lastName: 'Thomas',
        phone: '07700 900789',
        email: 'emma.thomas@email.com',
        postcode: 'CF10 2AA',
        postcodeStatus: 'valid',
        issue: 'Shoulder pain',
        urgency: 'routine',
        patientType: 'new',
        leadSource: 'website',
        preferredChannel: 'sms',
        ghlContactId: 'contact_emma_001',
        ghlTags: ['qualified']
      },
      {
        clinicId: clinics[0]._id,
        firstName: 'David',
        lastName: 'Williams',
        phone: '07700 900345',
        email: 'david.w@email.com',
        postcode: 'CF10 4BB',
        postcodeStatus: 'valid',
        issue: 'Ankle Sprain',
        urgency: 'urgent',
        patientType: 'new',
        leadSource: 'google_ads',
        preferredChannel: 'whatsapp',
        ghlContactId: 'contact_david_001',
        ghlTags: ['qualified', 'appointment-booked'],
        totalAppointments: 1
      },
      {
        clinicId: clinics[1]._id,
        firstName: 'John',
        lastName: 'Davies',
        phone: '07700 900456',
        email: 'john.davies@email.com',
        postcode: 'NP20 1AA',
        postcodeStatus: 'valid',
        issue: 'Sports injury',
        urgency: 'urgent',
        patientType: 'new',
        leadSource: 'google_ads',
        preferredChannel: 'sms',
        ghlContactId: 'contact_john_001',
        ghlTags: ['qualified']
      },
      {
        clinicId: clinics[1]._id,
        firstName: 'Rachel',
        lastName: 'Green',
        phone: '07700 900987',
        email: 'rachel.green@email.com',
        postcode: 'NP20 2BB',
        postcodeStatus: 'valid',
        issue: 'Back pain',
        urgency: 'urgent',
        patientType: 'new',
        leadSource: 'facebook',
        preferredChannel: 'whatsapp',
        ghlContactId: 'contact_rachel_001',
        ghlTags: ['qualified']
      },
      {
        clinicId: clinics[2]._id,
        firstName: 'Michael',
        lastName: 'Jones',
        phone: '07700 900321',
        email: 'michael.jones@email.com',
        postcode: 'SA1 4YY',
        postcodeStatus: 'valid',
        issue: 'Sports injury',
        urgency: 'urgent',
        patientType: 'new',
        leadSource: 'instagram',
        preferredChannel: 'instagram',
        ghlContactId: 'contact_michael_001',
        ghlTags: []
      },
      {
        clinicId: clinics[2]._id,
        firstName: 'Lisa',
        lastName: 'Evans',
        phone: '07700 900654',
        email: 'lisa.evans@email.com',
        postcode: 'SA2 8XX',
        postcodeStatus: 'invalid',
        issue: 'Neck pain',
        urgency: 'routine',
        patientType: 'new',
        leadSource: 'referral',
        preferredChannel: 'sms',
        ghlContactId: 'contact_lisa_001',
        ghlTags: ['outside-area']
      }
  ]);

  console.log(`Created ${leads.length} leads\n`);

  return leads;
}