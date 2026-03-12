import { buildGreetingPrompt } from './prompt-builder';
import { LeadInfo } from './interfaces/lead-info.interface';
import { ClinicConfig } from './interfaces/clinic-config.interface';

describe('buildGreetingPrompt', () => {
  const baseLead: LeadInfo = {
    firstName: 'Sarah',
    lastName: 'Williams',
    email: 'sarah@email.com',
    phone: '07700 900123',
    issue: 'Back pain for 2 weeks',
    leadSource: 'Facebook',
    contactId: 'contact_001',
  };

  const baseClinic: ClinicConfig = {
    clinicId: 'clinic_001',
    name: 'Cardiff Chiropractic',
    tone: 'Friendly',
    serviceAreas: ['CF'],
    ghlLocationId: 'loc_001',
    isActive: true,
  };

  it('should include the lead first name in the prompt', () => {
    const prompt = buildGreetingPrompt(baseLead, baseClinic);
    expect(prompt).toContain('Sarah');
  });

  it('should include the lead issue in the prompt', () => {
    const prompt = buildGreetingPrompt(baseLead, baseClinic);
    expect(prompt).toContain('Back pain for 2 weeks');
  });

  it('should include the clinic name in the prompt', () => {
    const prompt = buildGreetingPrompt(baseLead, baseClinic);
    expect(prompt).toContain('Cardiff Chiropractic');
  });

  it('should include warm/casual language for Friendly tone', () => {
    const prompt = buildGreetingPrompt(baseLead, {
      ...baseClinic,
      tone: 'Friendly',
    });
    expect(prompt).toMatch(/warm.*casual.*conversational/i);
  });

  it('should include formal/businesslike language for Professional tone', () => {
    const prompt = buildGreetingPrompt(baseLead, {
      ...baseClinic,
      tone: 'Professional',
    });
    expect(prompt).toMatch(/formal.*businesslike/i);
  });

  it('should append custom instructions when present', () => {
    const prompt = buildGreetingPrompt(baseLead, {
      ...baseClinic,
      customInstructions: 'Always mention free parking',
    });
    expect(prompt).toContain('Always mention free parking');
  });

  it('should not include custom instructions when absent', () => {
    const prompt = buildGreetingPrompt(baseLead, baseClinic);
    expect(prompt).not.toContain('Additional instructions');
  });

  it('should ask for postcode in the prompt', () => {
    const prompt = buildGreetingPrompt(baseLead, baseClinic);
    expect(prompt.toLowerCase()).toContain('postcode');
  });

  it('should NOT contain AI model references', () => {
    const prompt = buildGreetingPrompt(baseLead, baseClinic);
    const forbidden = ['Groq', 'Llama', 'AI assistant', 'chatbot', 'model'];
    forbidden.forEach((term) => {
      expect(prompt).not.toContain(term);
    });
  });

  it('should handle a lead with no issue', () => {
    const leadNoIssue: LeadInfo = { firstName: 'Tom' };
    const prompt = buildGreetingPrompt(leadNoIssue, baseClinic);
    expect(prompt).toContain('Tom');
    expect(prompt).not.toContain('Their issue is');
  });
});
