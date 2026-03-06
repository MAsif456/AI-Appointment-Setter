export async function seedClinics(ClinicModel: any, adminUser: any) {

  console.log('Creating clinics...');

  const clinics = await ClinicModel.insertMany([
    {
        name: 'Cardiff Physiotherapy Centre',
        ghlLocationId: 'loc_cardiff_001',
        ghlCalendarId: 'cal_cardiff_001',
        address: '123 Queen Street, Cardiff, CF10 2BX',
        phone: '029 2034 5678',
        email: 'info@cardiffphysio.com',
        serviceAreas: [
          { postcodePrefix: 'CF', description: 'Cardiff' },
          { postcodePrefix: 'NP', description: 'Newport' },
          { postcodePrefix: 'SA', description: 'Swansea' }
        ],
        services: [
          { name: 'Back pain', durationMinutes: 30, price: 60 },
          { name: 'Sports injury', durationMinutes: 45, price: 75 },
          { name: 'Rehabilitation', durationMinutes: 60, price: 90 }
        ],
        businessHours: [
          { day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
          { day: 'tuesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
          { day: 'wednesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
          { day: 'thursday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
          { day: 'friday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
          { day: 'saturday', isOpen: true, openTime: '10:00', closeTime: '14:00' },
          { day: 'sunday', isOpen: false }
        ],
        aiConfig: {
          tone: 'friendly',
          greetingTemplate: 'Hi {{firstName}}! Thanks for getting in touch with {{clinicName}}. I can help you book an appointment for your {{issue}}. Let me ask a few quick questions.',
          customInstructions: ['Always mention free parking available on-site.'],
          qualificationQuestions: {
            postcode: true,
            urgency: true,
            preferredTime: true,
            serviceType: false
          },
          faqResponses: [
            { question: 'Do you accept insurance?', answer: 'Yes, we accept all major health insurance providers.' },
            { question: 'What should I bring?', answer: 'Please bring photo ID and any relevant medical documents.' }
          ]
        },
        defaultAppointmentDuration: 30,
        isActive: true,
        todayLeadsCount: 12,
        todayBookingsCount: 5,
        monthLeadsCount: 245,
        monthBookingsCount: 103
      },
      {
        name: 'Newport Sports Clinic',
        ghlLocationId: 'loc_newport_001',
        ghlCalendarId: 'cal_newport_001',
        address: '45 Commercial Road, Newport, NP20 2PA',
        phone: '01633 555 123',
        email: 'contact@newportsportsclinic.com',
        serviceAreas: [
          { postcodePrefix: 'NP', description: 'Newport' },
          { postcodePrefix: 'CF', description: 'Cardiff' }
        ],
        services: [
          { name: 'Sports injury', durationMinutes: 45, price: 70 },
          { name: 'Massage therapy', durationMinutes: 30, price: 50 }
        ],
        businessHours: [
          { day: 'monday', isOpen: true, openTime: '08:00', closeTime: '18:00' },
          { day: 'tuesday', isOpen: true, openTime: '08:00', closeTime: '18:00' },
          { day: 'wednesday', isOpen: true, openTime: '08:00', closeTime: '18:00' },
          { day: 'thursday', isOpen: true, openTime: '08:00', closeTime: '18:00' },
          { day: 'friday', isOpen: true, openTime: '08:00', closeTime: '18:00' },
          { day: 'saturday', isOpen: false },
          { day: 'sunday', isOpen: false }
        ],
        aiConfig: {
          tone: 'professional',
          greetingTemplate: 'Hello {{firstName}}, welcome to {{clinicName}}. How can we assist you today?',
          customInstructions: [],
          qualificationQuestions: {
            postcode: true,
            urgency: true
          },
          faqResponses: []
        },
        defaultAppointmentDuration: 45,
        isActive: true,
        todayLeadsCount: 8,
        todayBookingsCount: 3,
        monthLeadsCount: 178,
        monthBookingsCount: 68
      },
      {
        name: 'Swansea Wellness Hub',
        ghlLocationId: 'loc_swansea_001',
        ghlCalendarId: 'cal_swansea_001',
        address: '78 High Street, Swansea, SA1 1NW',
        phone: '01792 444 567',
        email: 'hello@swanseawellness.com',
        serviceAreas: [
          { postcodePrefix: 'SA', description: 'Swansea' }
        ],
        services: [
          { name: 'Chiropractic', durationMinutes: 20, price: 55 },
          { name: 'Acupuncture', durationMinutes: 40, price: 65 }
        ],
        businessHours: [
          { day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
          { day: 'tuesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
          { day: 'wednesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
          { day: 'thursday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
          { day: 'friday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
          { day: 'saturday', isOpen: false },
          { day: 'sunday', isOpen: false }
        ],
        aiConfig: {
          tone: 'balanced',
          greetingTemplate: 'Hi {{firstName}}, thanks for contacting {{clinicName}}. Let\'s get you booked in!',
          customInstructions: ['Mention our new patient discount of 20%'],
          qualificationQuestions: {
            postcode: true,
            urgency: true
          },
          faqResponses: []
        },
        defaultAppointmentDuration: 20,
        isActive: true,
        todayLeadsCount: 15,
        todayBookingsCount: 7,
        monthLeadsCount: 312,
        monthBookingsCount: 147
      },
      {
        name: 'Bridgend Physio Plus',
        ghlLocationId: 'loc_bridgend_001',
        ghlCalendarId: 'cal_bridgend_001',
        address: '12 Market Street, Bridgend, CF31 1LL',
        phone: '01656 777 888',
        email: 'info@bridgendphysio.com',
        serviceAreas: [
          { postcodePrefix: 'CF', description: 'Cardiff' },
          { postcodePrefix: 'SA', description: 'Swansea' }
        ],
        services: [
          { name: 'Physiotherapy', durationMinutes: 30, price: 60 }
        ],
        businessHours: [],
        aiConfig: {
          tone: 'professional',
          greetingTemplate: 'Hello, welcome to {{clinicName}}.',
          customInstructions: [],
          qualificationQuestions: {
            postcode: true
          },
          faqResponses: []
        },
        defaultAppointmentDuration: 30,
        isActive: false,
        deactivatedAt: new Date('2026-02-15'),
        deactivatedBy: adminUser._id.toString(),
        todayLeadsCount: 0,
        todayBookingsCount: 0,
        monthLeadsCount: 89,
        monthBookingsCount: 34
      }
  ]);

  console.log(`Created ${clinics.length} clinics\n`);

  return clinics;
}