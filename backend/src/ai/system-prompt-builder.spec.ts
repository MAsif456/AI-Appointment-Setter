import { buildSystemPrompt, SlotSelectionContext } from './system-prompt-builder';
import { LeadInfo } from './interfaces/lead-info.interface';
import { ClinicConfig } from './interfaces/clinic-config.interface';

describe('buildSystemPrompt', () => {
  const lead: LeadInfo = {
    firstName: 'David',
    lastName: 'Williams',
    phone: '07700 900345',
    issue: 'Ankle Sprain',
  };

  const clinic: ClinicConfig = {
    clinicId: 'clinic_001',
    name: 'Cardiff Physiotherapy Centre',
    tone: 'Friendly',
    serviceAreas: ['CF'],
    ghlLocationId: 'loc_001',
    isActive: true,
  };

  it('should include the clinic name', () => {
    const prompt = buildSystemPrompt(lead, clinic);
    expect(prompt).toContain('Cardiff Physiotherapy Centre');
  });

  it('should include the patient name and issue', () => {
    const prompt = buildSystemPrompt(lead, clinic);
    expect(prompt).toContain('David');
    expect(prompt).toContain('Ankle Sprain');
  });

  it('should include friendly tone for Friendly clinics', () => {
    const prompt = buildSystemPrompt(lead, clinic);
    expect(prompt).toMatch(/warm.*casual.*conversational/i);
  });

  it('should include professional tone for Professional clinics', () => {
    const prompt = buildSystemPrompt(lead, {
      ...clinic,
      tone: 'Professional',
    });
    expect(prompt).toMatch(/formal.*businesslike/i);
  });

  it('should include service areas when present', () => {
    const prompt = buildSystemPrompt(lead, clinic);
    expect(prompt).toContain('CF');
  });

  it('should include custom instructions when present', () => {
    const prompt = buildSystemPrompt(lead, {
      ...clinic,
      customInstructions: 'Always mention free parking',
    });
    expect(prompt).toContain('Always mention free parking');
  });

  it('should instruct the AI to ask for postcode', () => {
    const prompt = buildSystemPrompt(lead, clinic);
    expect(prompt.toLowerCase()).toContain('postcode');
  });

  it('should NOT contain AI model references', () => {
    const prompt = buildSystemPrompt(lead, clinic);
    const forbidden = ['Groq', 'Llama', 'chatbot', 'GPT'];
    forbidden.forEach((term) => {
      expect(prompt).not.toContain(term);
    });
  });

  it('should include booking guidance instructions', () => {
    const prompt = buildSystemPrompt(lead, clinic);
    expect(prompt).toContain('booking');
  });

  it('should inject slot section when slotOptions provided', () => {
    const slotSection = '=== AVAILABLE SLOTS ===\nTuesday 17th March at 2pm';
    const prompt = buildSystemPrompt(lead, clinic, { slotSection });
    expect(prompt).toContain('=== AVAILABLE SLOTS ===');
    expect(prompt).toContain('Tuesday 17th March at 2pm');
  });

  it('should NOT include slot section when slotOptions is undefined', () => {
    const prompt = buildSystemPrompt(lead, clinic);
    expect(prompt).not.toContain('=== AVAILABLE SLOTS ===');
  });

  it('should include Stage 4 OFFER SLOT instructions', () => {
    const prompt = buildSystemPrompt(lead, clinic);
    expect(prompt).toContain('OFFER SLOT');
    expect(prompt).toContain('British English');
  });

  it('should include maximum 3 slots rule in Stage 4', () => {
    const prompt = buildSystemPrompt(lead, clinic);
    expect(prompt).toContain('maximum of 3 slots');
  });

  // ---------------------------------------------------------------------------
  // Selection context tests
  // ---------------------------------------------------------------------------
  describe('selectionContext injection', () => {
    const slotSection = '=== AVAILABLE SLOTS ===\nTuesday at 2pm';

    it('includes SLOT SELECTION STATUS section when selectionContext is provided', () => {
      const ctx: SlotSelectionContext = {
        intent: 'SLOT_SELECTED',
        selectedSlot: { displayText: 'Tuesday 24th March at 2pm' },
      };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('=== SLOT SELECTION STATUS ===');
    });

    it('does NOT include SLOT SELECTION STATUS when selectionContext is absent', () => {
      const prompt = buildSystemPrompt(lead, clinic, { slotSection });
      expect(prompt).not.toContain('=== SLOT SELECTION STATUS ===');
    });

    it('instructs AI to confirm booking on SLOT_SELECTED', () => {
      const ctx: SlotSelectionContext = {
        intent: 'SLOT_SELECTED',
        selectedSlot: { displayText: 'Tuesday 24th March at 2pm' },
      };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('Tuesday 24th March at 2pm');
      expect(prompt).toContain('confirm the booking details');
    });

    it('instructs AI to ask for clarification on AMBIGUOUS', () => {
      const ctx: SlotSelectionContext = {
        intent: 'AMBIGUOUS',
        ambiguousSlots: [
          { displayText: 'Tuesday 24th March at 2pm' },
          { displayText: 'Tuesday 24th March at 4pm' },
        ],
      };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('multiple slots');
      expect(prompt).toContain('clarify');
    });

    it('instructs AI to offer alternative date on DIFFERENT_DATE', () => {
      const ctx: SlotSelectionContext = { intent: 'DIFFERENT_DATE', requestedDate: 'Friday' };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('Friday');
      expect(prompt).toContain('AVAILABLE SLOTS section');
    });

    it('instructs AI to offer filtered slots on DIFFERENT_TIME', () => {
      const ctx: SlotSelectionContext = { intent: 'DIFFERENT_TIME', timePreference: 'morning' };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('morning');
      expect(prompt).toContain('AVAILABLE SLOTS section');
    });

    it('instructs AI to ask when works for NONE_SUITABLE', () => {
      const ctx: SlotSelectionContext = { intent: 'NONE_SUITABLE' };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('No problem');
      expect(prompt).toContain('When would work better');
    });
  });
});
