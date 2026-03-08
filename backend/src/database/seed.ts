import { connect, connection } from 'mongoose';
import 'dotenv/config';

import { UserSchema } from './schemas/user.schema';
import { ClinicSchema } from './schemas/clinic.schema';
import { LeadSchema } from './schemas/lead.schema';
import { ConversationSchema } from './schemas/conversation.schema';
import { MessageSchema } from './schemas/message.schema';
import { AppointmentSchema } from './schemas/appointment.schema';
import { AuditLogSchema } from './schemas/audit-log.schema';

import { seedUsers } from './seeds/user.seed';
import { seedClinics } from './seeds/clinic.seed';
import { seedLeads } from './seeds/lead.seed';
import { seedConversations } from './seeds/conversation.seed';
import { seedMessages } from './seeds/message.seed';
import { seedAppointments } from './seeds/appointment.seed';
import { seedAuditLogs } from './seeds/audit-log.seed';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/appointhealth';

async function seedDatabase() {
  try {

    console.log('Connecting to MongoDB...');
    await connect(MONGODB_URI);
    console.log('Connected\n');

    const UserModel = connection.model('User', UserSchema);
    const ClinicModel = connection.model('Clinic', ClinicSchema);
    const LeadModel = connection.model('Lead', LeadSchema);
    const ConversationModel = connection.model('Conversation', ConversationSchema);
    const MessageModel = connection.model('Message', MessageSchema);
    const AppointmentModel = connection.model('Appointment', AppointmentSchema);
    const AuditLogModel = connection.model('AuditLog', AuditLogSchema);

    console.log('Clearing database...');

    await Promise.all([
      UserModel.deleteMany({}),
      ClinicModel.deleteMany({}),
      LeadModel.deleteMany({}),
      ConversationModel.deleteMany({}),
      MessageModel.deleteMany({}),
      AppointmentModel.deleteMany({}),
      AuditLogModel.deleteMany({})
    ]);

    console.log('Database cleared\n');

    const adminUser = await seedUsers(UserModel);
    const clinics = await seedClinics(ClinicModel, adminUser);
    const leads = await seedLeads(LeadModel, clinics);
    const conversations = await seedConversations(ConversationModel, clinics, leads, adminUser);

    await seedMessages(MessageModel, clinics, leads, conversations);
    await seedAppointments(AppointmentModel, clinics, leads, conversations);
    await seedAuditLogs(AuditLogModel, clinics, adminUser);

    console.log('==========================================');
    console.log('DATABASE SEEDED SUCCESSFULLY!');
    console.log('==========================================\n');
    console.log(`   Users: 1`);
    console.log(`   Clinics: ${clinics.length}`);
    console.log(`   Leads: ${leads.length}`);
    console.log(`   Conversations: ${conversations.length}\n`);
    console.log(`Login: admin@lunaxdigital.com / admin123\n`);

  } catch (error) {

    console.error('Seed failed:', error);

  } finally {

    await connection.close();
    console.log('Disconnected from MongoDB');

    process.exit(0);
  }
}

seedDatabase();