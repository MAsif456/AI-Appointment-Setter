/** All possible outcomes of analysing a lead's slot-selection reply */
export type SlotSelectionIntent =
  | 'SLOT_SELECTED'    // Lead confirmed exactly one slot
  | 'AMBIGUOUS'        // Reply matches more than one offered slot
  | 'DIFFERENT_DATE'   // Lead is asking for a different day
  | 'DIFFERENT_TIME'   // Lead is asking for a different time of day
  | 'FURTHER_DATE'     // Lead wants later/furthest available dates
  | 'NONE_SUITABLE'    // None of the offered slots work
  | 'DAY_OVERVIEW';    // Show available days (Mon-Fri) before offering specific slots

/** Minimal representation of a previously offered slot */
export interface OfferedSlotRef {
  dateTime: Date | string;
  /** Human-readable label from formatSlotDisplay, e.g. "Thursday 17th March at 2pm" */
  displayText: string;
}

/** The result returned by detectSlotSelection */
export interface SlotSelectionResult {
  intent: SlotSelectionIntent;
  /** The matched slot when intent is SLOT_SELECTED */
  selectedSlot?: OfferedSlotRef;
  /** All matching slots when intent is AMBIGUOUS */
  ambiguousSlots?: OfferedSlotRef[];
  /** Day name extracted from message when intent is DIFFERENT_DATE (e.g. "Friday") */
  requestedDate?: string;
  /** Parsed start date when the lead asks for a future range (e.g. "next week") */
  requestedStartDate?: Date;
  /** Parsed end date when the lead asks for a future range (e.g. "next week") */
  requestedEndDate?: Date;
  /** Time preference extracted from message when intent is DIFFERENT_TIME (e.g. "morning") */
  timePreference?: string;
}
