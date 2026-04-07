import { Conversation, ConversationSchema } from './conversation.schema';

describe('ConversationSchema', () => {
  it('should create schema', () => {
    expect(ConversationSchema).toBeDefined();
  });

  it('should create conversation object', () => {
    const conversation = new Conversation();

    conversation.phase = 'greeting';
    conversation.channel = 'sms';

    expect(conversation.phase).toBe('greeting');
  });

  it('should support offered slots', () => {
    const conversation = new Conversation();

    conversation.offeredSlots = [
      { dateTime: new Date(), displayText: 'Tuesday at 2pm' },
    ];

    expect(conversation.offeredSlots.length).toBe(1);
  });

  it('should support context map', () => {
    const conversation = new Conversation();

    conversation.context = new Map();
    conversation.context.set('postcode', 'CF10');

    expect(conversation.context.get('postcode')).toBe('CF10');
  });
});