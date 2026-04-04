import { Lead, LeadSchema } from './lead.schema';

describe('LeadSchema', () => {
  it('should create schema', () => {
    expect(LeadSchema).toBeDefined();
  });

  it('should create lead object', () => {
    const lead = new Lead();

    lead.firstName = 'John';
    lead.phone = '123456';

    expect(lead.firstName).toBe('John');
  });

  it('should support ghl tags array', () => {
    const lead = new Lead();

    lead.ghlTags = ['tag1', 'tag2'];

    expect(lead.ghlTags.length).toBe(2);
  });

  it('should support custom fields map', () => {
    const lead = new Lead();

    lead.customFields = new Map();
    lead.customFields.set('test', 'value');

    expect(lead.customFields.get('test')).toBe('value');
  });
});