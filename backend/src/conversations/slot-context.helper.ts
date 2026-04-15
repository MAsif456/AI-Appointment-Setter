/**
 * Builds the slot context (selected slots + formatted prompt section) for a given conversation turn.
 * Handles FURTHER_DATE, DIFFERENT_DATE, DIFFERENT_TIME, and default slot-selection intents.
 */
import { SlotProvider } from "../ai/slot-provider";
import { Slot } from "../ai/interfaces/slot.interface";
import {
  selectSlots,
  selectLatestSlots,
  buildSlotPromptSection,
} from "../ai/slot-formatter";
import { SlotSelectionResult } from "../ai/slot-selector";

/** Day names indexed by Date.getDay() */
export const DAYS_LOWER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Filters slots by time-of-day preference (morning/afternoon/evening). */
function applyTimePref(input: Slot[], pref: string): Slot[] {
  return input.filter((s) => {
    const hour = parseInt(s.startTime.split(":")[0], 10);
    if (pref === "morning") return hour < 12;
    if (pref === "afternoon") return hour >= 12 && hour < 17;
    if (pref === "evening") return hour >= 17;
    return true; // 'earlier' / 'later' — let AI decide from all slots
  });
}

/**
 * Fetches slots and optionally filters by the lead's expressed preference.
 * @param provider - The slot provider to fetch available slots from.
 * @param clinicId - The clinic ID.
 * @param urgency - The urgency level of the lead.
 * @param selectionResult - The slot selection result from the lead's message.
 * @param previouslyOfferedSlots - Slots already offered to the lead (used to deduplicate).
 * @returns The selected slots and a formatted slot section for the prompt.
 */
export async function buildSlotContext(
  provider: SlotProvider,
  clinicId: string,
  urgency: "urgent" | "routine" | "flexible",
  selectionResult: SlotSelectionResult | null,
  previouslyOfferedSlots?: { dateTime: any; displayText: string }[],
): Promise<{ selected: Slot[]; slotSection: string }> {
  const requestedStart = selectionResult?.requestedStartDate
    ? new Date(selectionResult.requestedStartDate)
    : undefined;
  const requestedEnd = selectionResult?.requestedEndDate
    ? new Date(selectionResult.requestedEndDate)
    : undefined;

  // For FURTHER_DATE, search backwards from the 4-month GHL booking limit until
  // we find a month with actual availability.
  if (selectionResult?.intent === "FURTHER_DATE" && !requestedStart) {
    const now = new Date();
    let furthestSlots: Slot[] = [];
    for (let offset = 3; offset >= 1; offset--) {
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth() + offset,
        1,
      );
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + offset + 1,
        0,
      );
      const found = await provider.getAvailableSlots(
        clinicId,
        monthStart,
        monthEnd,
      );
      if (found.length > 0) {
        furthestSlots = found;
        break;
      }
    }
    if (furthestSlots.length > 0) {
      const selected = selectLatestSlots(furthestSlots);
      return {
        selected,
        slotSection: buildSlotPromptSection(selected, urgency),
      };
    }
  }

  const allSlots = await provider.getAvailableSlots(
    clinicId,
    requestedStart,
    requestedEnd,
  );
  let slots: Slot[];

  if (selectionResult?.intent === "FURTHER_DATE") {
    slots = selectLatestSlots(allSlots);
  } else if (
    selectionResult?.intent === "DIFFERENT_DATE" &&
    selectionResult.requestedDate
  ) {
    const day = selectionResult.requestedDate.toLowerCase();
    slots = allSlots.filter(
      (s) =>
        DAYS_LOWER[new Date(`${s.date}T${s.startTime}:00`).getDay()] === day,
    );
    if (selectionResult.timePreference) {
      const timePrefSlots = applyTimePref(
        slots,
        selectionResult.timePreference,
      );
      if (timePrefSlots.length > 0) slots = timePrefSlots;
    }
    if (previouslyOfferedSlots?.length) {
      const offeredKeys = new Set(
        previouslyOfferedSlots.map((o) => {
          const dt = new Date(o.dateTime);
          return `${dt.toISOString().split("T")[0]}_${dt.toTimeString().substring(0, 5)}`;
        }),
      );
      const fresh = slots.filter(
        (s) => !offeredKeys.has(`${s.date}_${s.startTime}`),
      );
      if (fresh.length > 0) slots = fresh;
    }
    slots = slots.slice(0, 3);
  } else if (
    selectionResult?.intent === "DIFFERENT_DATE" &&
    selectionResult.requestedStartDate
  ) {
    const rangeMs = selectionResult.requestedEndDate
      ? new Date(selectionResult.requestedEndDate).getTime() -
        new Date(selectionResult.requestedStartDate).getTime()
      : 0;
    const isSingleDay = rangeMs > 0 && rangeMs <= 24 * 60 * 60 * 1000;

    if (isSingleDay) {
      let daySlots = allSlots;
      if (selectionResult.timePreference) {
        const timePrefSlots = applyTimePref(
          daySlots,
          selectionResult.timePreference,
        );
        if (timePrefSlots.length > 0) daySlots = timePrefSlots;
      }
      slots = daySlots.slice(0, 3);
    } else {
      slots = selectSlots(allSlots, urgency);
      if (selectionResult.timePreference) {
        const timePrefSlots = applyTimePref(
          slots,
          selectionResult.timePreference,
        );
        if (timePrefSlots.length > 0) slots = timePrefSlots;
      }
    }
  } else if (
    selectionResult?.intent === "DIFFERENT_TIME" &&
    selectionResult.timePreference
  ) {
    let base = allSlots;
    if (selectionResult.requestedDate) {
      const day = selectionResult.requestedDate.toLowerCase();
      base = allSlots.filter(
        (s) =>
          DAYS_LOWER[new Date(`${s.date}T${s.startTime}:00`).getDay()] === day,
      );
    }
    if (
      (selectionResult.timePreference === "later" ||
        selectionResult.timePreference === "earlier") &&
      previouslyOfferedSlots?.length
    ) {
      const offeredKeys = new Set(
        previouslyOfferedSlots.map((o) => {
          const dt = new Date(o.dateTime);
          return `${dt.toISOString().split("T")[0]}_${dt.toTimeString().substring(0, 5)}`;
        }),
      );
      const offeredTimes = previouslyOfferedSlots.map((o) =>
        new Date(o.dateTime).getTime(),
      );
      const boundary =
        selectionResult.timePreference === "later"
          ? Math.max(...offeredTimes)
          : Math.min(...offeredTimes);
      const fresh = base.filter((s) => {
        const key = `${s.date}_${s.startTime}`;
        if (offeredKeys.has(key)) return false;
        const slotTime = new Date(`${s.date}T${s.startTime}:00`).getTime();
        return selectionResult.timePreference === "later"
          ? slotTime > boundary
          : slotTime < boundary;
      });
      slots = selectSlots(fresh.length > 0 ? fresh : base, urgency);
    } else {
      const filtered = applyTimePref(base, selectionResult.timePreference);
      slots = selectSlots(filtered.length > 0 ? filtered : base, urgency);
    }
  } else {
    slots = selectSlots(allSlots, urgency);
  }

  return {
    selected: slots,
    slotSection: buildSlotPromptSection(slots, urgency),
  };
}
