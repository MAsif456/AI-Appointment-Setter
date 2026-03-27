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
      expect(prompt).toContain('dates or times would work better');
    });

    it('AMBIGUOUS with same-time slots asks which day', () => {
      const ctx: SlotSelectionContext = {
        intent: 'AMBIGUOUS',
        ambiguousSlots: [
          { displayText: 'Tuesday 7th April at 1:20pm' },
          { displayText: 'Thursday 9th April at 1:20pm' },
          { displayText: 'Monday 13th April at 1:20pm' },
        ],
      };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('which day');
      expect(prompt).toContain('Do NOT pick one arbitrarily');
    });

    it('AMBIGUOUS with same-day slots asks which time', () => {
      const ctx: SlotSelectionContext = {
        intent: 'AMBIGUOUS',
        ambiguousSlots: [
          { displayText: 'Tuesday 7th April at 10am' },
          { displayText: 'Tuesday 7th April at 2pm' },
        ],
      };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('which time');
      expect(prompt).toContain('Do NOT pick one arbitrarily');
    });

    it('DIFFERENT_DATE instructs not to re-offer old slots', () => {
      const ctx: SlotSelectionContext = { intent: 'DIFFERENT_DATE' };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('Do NOT re-offer any previously offered slots');
      expect(prompt).toContain('Do NOT fall back to previously offered slots');
    });
  });

  // ---------------------------------------------------------------------------
  // Previously offered slots injection
  // ---------------------------------------------------------------------------
  describe('previouslyOfferedSlots injection', () => {
    it('includes PREVIOUSLY OFFERED SLOTS section when provided', () => {
      const prompt = buildSystemPrompt(lead, clinic, {
        slotSection: '',
        previouslyOfferedSlots: [
          'Tuesday 7th April at 1:20pm',
          'Thursday 9th April at 1:20pm',
        ],
      });
      expect(prompt).toContain('=== PREVIOUSLY OFFERED SLOTS ===');
      expect(prompt).toContain('1. Tuesday 7th April at 1:20pm');
      expect(prompt).toContain('2. Thursday 9th April at 1:20pm');
    });

    it('does NOT include PREVIOUSLY OFFERED SLOTS header when list is empty', () => {
      const prompt = buildSystemPrompt(lead, clinic, {
        slotSection: '',
        previouslyOfferedSlots: [],
      });
      expect(prompt).not.toContain('=== PREVIOUSLY OFFERED SLOTS ===');
    });

    it('does NOT include PREVIOUSLY OFFERED SLOTS header when undefined', () => {
      const prompt = buildSystemPrompt(lead, clinic, { slotSection: '' });
      expect(prompt).not.toContain('=== PREVIOUSLY OFFERED SLOTS ===');
    });

    it('includes rule to only offer slots from AVAILABLE SLOTS section', () => {
      const prompt = buildSystemPrompt(lead, clinic);
      expect(prompt).toContain('Only offer slots listed in the AVAILABLE SLOTS section');
    });

    it('includes rule to acknowledge previously offered slots accurately', () => {
      const prompt = buildSystemPrompt(lead, clinic);
      expect(prompt).toContain('Never deny offering a slot that is listed there');
    });
  });

  // Urgency context injection
  describe('urgencyContext injection', () => {
    it('Stage 3 does NOT ask about urgency', () => {
      const prompt = buildSystemPrompt(lead, clinic);
      expect(prompt).not.toContain('Ask about urgency');
      expect(prompt).toContain('Do NOT ask about urgency');
    });

    it('injects emergency guidance when urgencyContext is emergency', () => {
      const prompt = buildSystemPrompt(lead, clinic, undefined, {
        level: 'emergency',
        isEmergency: true,
      });
      expect(prompt).toContain('=== URGENCY CONTEXT ===');
      expect(prompt).toContain('EMERGENCY');
      expect(prompt).toContain('999');
    });

    it('injects priority language when urgencyContext is urgent', () => {
      const prompt = buildSystemPrompt(lead, clinic, undefined, {
        level: 'urgent',
        isEmergency: false,
      });
      expect(prompt).toContain('=== URGENCY CONTEXT ===');
      expect(prompt).toContain('urgently');
      expect(prompt).toContain('earliest available slot');
    });

    it('does not inject urgency section when urgencyContext is absent', () => {
      const prompt = buildSystemPrompt(lead, clinic);
      expect(prompt).not.toContain('=== URGENCY CONTEXT ===');
    });

    it('injects routine guidance when urgencyContext is routine', () => {
      const prompt = buildSystemPrompt(lead, clinic, undefined, {
        level: 'routine',
        isEmergency: false,
      });
      expect(prompt).toContain('=== URGENCY CONTEXT ===');
    });

    it('does not inject urgency section when level is unknown', () => {
      const prompt = buildSystemPrompt(lead, clinic, undefined, {
        level: 'unknown',
        isEmergency: false,
      });
      expect(prompt).not.toContain('=== URGENCY CONTEXT ===');
    });
  });

  // ---------------------------------------------------------------------------
  // FURTHER_DATE and DAY_OVERVIEW selection context
  // ---------------------------------------------------------------------------
  describe('FURTHER_DATE and DAY_OVERVIEW context', () => {
    const slotSection = '=== AVAILABLE SLOTS ===\nSome slots';

    it('instructs AI to offer furthest dates for FURTHER_DATE', () => {
      const ctx: SlotSelectionContext = { intent: 'FURTHER_DATE' };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('later or further available dates');
      expect(prompt).toContain('furthest dates available');
      expect(prompt).toContain('ONLY offer the exact slots listed above');
    });

    it('instructs AI to show day availability for DAY_OVERVIEW without time', () => {
      const ctx: SlotSelectionContext = { intent: 'DAY_OVERVIEW' };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('availability for a week range');
      expect(prompt).toContain('which weekdays have openings');
      expect(prompt).toContain('Do NOT offer specific time slots yet');
    });

    it('instructs AI to filter by time for DAY_OVERVIEW with numeric timePreference', () => {
      const ctx: SlotSelectionContext = { intent: 'DAY_OVERVIEW', timePreference: '12pm' };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('specifically asked about 12pm slots');
      expect(prompt).toContain('ONLY days that have a 12pm slot');
    });

    it('DAY_OVERVIEW with non-numeric timePreference shows general overview', () => {
      const ctx: SlotSelectionContext = { intent: 'DAY_OVERVIEW', timePreference: 'morning' };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection, selectionContext: ctx });
      expect(prompt).toContain('which weekdays have openings');
      expect(prompt).not.toContain('specifically asked about');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('falls back to Friendly tone for unknown tone values', () => {
      const prompt = buildSystemPrompt(lead, { ...clinic, tone: 'Unknown' });
      expect(prompt).toMatch(/warm.*casual.*conversational/i);
    });

    it('handles lead without issue', () => {
      const noIssueLead: LeadInfo = { firstName: 'Jane' };
      const prompt = buildSystemPrompt(noIssueLead, clinic);
      expect(prompt).toContain('Jane');
      expect(prompt).toContain('Ask what they need help with');
    });

    it('handles lead without lastName or phone', () => {
      const minLead: LeadInfo = { firstName: 'Bob' };
      const prompt = buildSystemPrompt(minLead, clinic);
      expect(prompt).toContain('Name: Bob');
      expect(prompt).not.toContain('Phone:');
    });

    it('handles clinic without serviceAreas', () => {
      const prompt = buildSystemPrompt(lead, { ...clinic, serviceAreas: [] });
      expect(prompt).toContain('Accept any postcode');
    });

    it('AMBIGUOUS with different days and different times uses generic question', () => {
      const ctx: SlotSelectionContext = {
        intent: 'AMBIGUOUS',
        ambiguousSlots: [
          { displayText: 'Tuesday 7th April at 10am' },
          { displayText: 'Thursday 9th April at 2pm' },
        ],
      };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection: '', selectionContext: ctx });
      expect(prompt).toContain('which one works best for you');
    });

    it('DIFFERENT_DATE without requestedDate omits day label', () => {
      const ctx: SlotSelectionContext = { intent: 'DIFFERENT_DATE' };
      const prompt = buildSystemPrompt(lead, clinic, { slotSection: '', selectionContext: ctx });
      expect(prompt).toContain('different availability');
      expect(prompt).not.toContain('for undefined');
    });
  });
});
