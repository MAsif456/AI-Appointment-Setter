/** Represents a single message in a conversation */
export interface Message {
  id: string;
  sender: 'ai' | 'lead';
  content: string;
  timestamp: string;
}

/** Represents a conversation with a lead */
export interface Conversation {
  id: string;
  patientName: string;
  phone: string;
  clinic: string;
  leadSource: string;
  phase: string;
  lastMessage: string;
  isHighPriority: boolean;
  requiresIntervention: boolean;
}

/** Detailed conversation with messages and metadata */
export interface ConversationDetail {
  id: string;
  patientName: string;
  phone: string;
  email: string;
  clinic: string;
  leadSource: string;
  issue: string;
  postcode: string;
  urgency: string;
  phase: string;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  messages: Message[];
  booking?: {
    date: string;
    time: string;
    appointmentId: string;
    status: string;
  };
}

/** Conversation list data — one lead per phase across different clinics */
export const mockConversations: Conversation[] = [
  {
    id: 'conv_001',
    patientName: 'Rachel Green',
    phone: '07700 900456',
    clinic: 'Newport Sports Clinic',
    leadSource: 'Facebook Ads',
    phase: 'Booking',
    lastMessage: 'No messages yet',
    isHighPriority: true,
    requiresIntervention: false,
  },
  {
    id: 'conv_002',
    patientName: 'Sarah Williams',
    phone: '07700 900123',
    clinic: 'Cardiff Physiotherapy Centre',
    leadSource: 'Facebook',
    phase: 'Confirmed',
    lastMessage:
      "Wonderful! I've booked you in for Thursday March...",
    isHighPriority: false,
    requiresIntervention: false,
  },
  {
    id: 'conv_003',
    patientName: 'John Davies',
    phone: '07700 900456',
    clinic: 'Newport Sports Clinic',
    leadSource: 'Google',
    phase: 'Qualified',
    lastMessage:
      "As soon as possible, it's quite painful",
    isHighPriority: false,
    requiresIntervention: false,
  },
  {
    id: 'conv_004',
    patientName: 'Lisa Evans',
    phone: '07700 900654',
    clinic: 'Swansea Wellness Hub',
    leadSource: 'Referral',
    phase: 'Declined',
    lastMessage:
      "Unfortunately we don't cover the SA2 area. I...",
    isHighPriority: false,
    requiresIntervention: false,
  },
];
