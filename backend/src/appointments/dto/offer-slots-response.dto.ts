export class SlotDto {
  dateTime: Date;
  displayText: string; // "Tuesday at 2pm"
  isEarliest?: boolean;
}

export class OfferSlotsResponseDto {
  message: string; // Conversational message
  slots: SlotDto[];
  isEmpty: boolean;
}