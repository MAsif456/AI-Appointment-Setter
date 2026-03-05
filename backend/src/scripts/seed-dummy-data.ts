import { connect, connection } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserSchema } from '../schemas/user.schema';
import { Clinic, ClinicSchema } from '../schemas/clinic.schema';
import { Lead, LeadSchema } from '../schemas/lead.schema';
import { Conversation, ConversationSchema } from '../schemas/conversation.schema';
import { Message, MessageSchema } from '../schemas/message.schema';
import { Appointment, AppointmentSchema } from '../schemas/appointment.schema';
import { AuditLog, AuditLogSchema } from '../schemas/audit-log.schema';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/appointhealth';

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Create models
    const UserModel = connection.model('User', UserSchema);
    const ClinicModel = connection.model('Clinic', ClinicSchema);
    const LeadModel = connection.model('Lead', LeadSchema);
    const ConversationModel = connection.model('Conversation', ConversationSchema);
    const MessageModel = connection.model('Message', MessageSchema);
    const AppointmentModel = connection.model('Appointment', AppointmentSchema);
    const AuditLogModel = connection.model('AuditLog', AuditLogSchema);

    // Clear existing data
    console.log('Clearing existing data...');
    await Promise.all([
      UserModel.deleteMany({}),
      ClinicModel.deleteMany({}),
      LeadModel.deleteMany({}),
      ConversationModel.deleteMany({}),
      MessageModel.deleteMany({}),
      AppointmentModel.deleteMany({}),
      AuditLogModel.deleteMany({})
    ]);
    console.log('Data cleared\n');

    // 1. CREATE USERS
    console.log('Creating users...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = await UserModel.create({
      name: 'Admin User',
      email: 'admin@lunaxdigital.com',
      passwordHash: adminPassword,
      role: 'admin',
      isActive: true,
      notificationPreferences: {
        emailNotifications: true,
        dailySummary: true,
        stalled: true
      }
    });
    
    console.log(`Created admin user: ${adminUser.email}\n`);

    // 2. CREATE CLINICS
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

    // 3. CREATE LEADS
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

    // 4. CREATE CONVERSATIONS
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

    // 5. CREATE MESSAGES
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

    console.log(`Created messages\n`);

    // 6. CREATE APPOINTMENTS
    console.log('Creating appointments...');
    
    const appointments = await AppointmentModel.insertMany([
      {
        clinicId: clinics[0]._id,
        leadId: leads[0]._id,
        conversationId: conversations[0]._id,
        ghlAppointmentId: 'APT-2024-001234',
        appointmentDate: new Date('2026-03-06'),
        appointmentTime: '14:30',
        durationMinutes: 30,
        serviceType: 'Back pain',
        price: 60,
        status: 'confirmed'
      }
    ]);

    console.log(`Created ${appointments.length} appointments\n`);

    // 7. CREATE AUDIT LOGS
    console.log('Creating audit logs...');
    
    await AuditLogModel.insertMany([
      {
        userId: adminUser._id,
        clinicId: clinics[0]._id,
        action: 'clinic.created',
        entityType: 'clinic',
        entityId: clinics[0]._id.toString(),
        severity: 'info'
      }
    ]);

    console.log('Created audit logs\n');

    console.log('==========================================');
    console.log('DATABASE SEEDED SUCCESSFULLY!');
    console.log('==========================================\n');
    console.log(`   Users: 1`);
    console.log(`   Clinics: ${clinics.length}`);
    console.log(`   Leads: ${leads.length}`);
    console.log(`   Conversations: ${conversations.length}\n`);
    console.log('Login: admin@lunaxdigital.com / admin123\n');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await connection.close();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

seedDatabase();