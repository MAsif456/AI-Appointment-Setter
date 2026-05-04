import {
  buildConfirmationMessage,
  formatDateBritish,
  ConfirmationDetails,
} from "./confirmation-message.builder";

describe("buildConfirmationMessage", () => {
  it("should include all details when fully provided", () => {
    const details: ConfirmationDetails = {
      clinicName: "Cardiff Physiotherapy Centre",
      clinicAddress: "123 Queen Street, Cardiff, CF10 2BX",
      appointmentDate: "Tuesday 17th March",
      appointmentTime: "2:00 PM",
      itemsToBring: "Photo ID",
    };

    const msg = buildConfirmationMessage(details);

    expect(msg).toContain("Appointment Confirmed!");
    expect(msg).toContain("Tuesday 17th March at 2:00 PM");
    expect(msg).toContain("Cardiff Physiotherapy Centre");
    expect(msg).toContain("123 Queen Street, Cardiff, CF10 2BX");
    expect(msg).toContain("Please bring: Photo ID");
    expect(msg).toContain("reschedule or cancel");
  });

  it("should omit address when not provided", () => {
    const details: ConfirmationDetails = {
      clinicName: "Test Clinic",
      appointmentDate: "Monday 1st April",
      appointmentTime: "9:00 AM",
    };

    const msg = buildConfirmationMessage(details);

    expect(msg).toContain("Test Clinic");
    expect(msg).not.toContain("undefined");
  });

  it("should omit items to bring when not provided", () => {
    const details: ConfirmationDetails = {
      clinicName: "Test Clinic",
      appointmentDate: "Monday 1st April",
      appointmentTime: "9:00 AM",
    };

    const msg = buildConfirmationMessage(details);

    expect(msg).not.toContain("Please bring");
  });

  it("should be concise enough for SMS", () => {
    const details: ConfirmationDetails = {
      clinicName: "Cardiff Physio",
      appointmentDate: "Tuesday 17th March",
      appointmentTime: "2:00 PM",
    };

    const msg = buildConfirmationMessage(details);

    expect(msg.length).toBeLessThan(400);
  });
});

describe("formatDateBritish", () => {
  // Tests use local-time ISO strings (no Z suffix) since slot times
  // represent clinic-local times, not UTC.
  it("should format a Tuesday afternoon correctly", () => {
    const result = formatDateBritish("2026-03-17T14:00:00");
    expect(result.date).toBe("Tuesday 17th March");
    expect(result.time).toBe("2:00 PM");
  });

  it("should format morning times with AM", () => {
    const result = formatDateBritish("2026-03-18T09:30:00");
    expect(result.date).toContain("Wednesday");
    expect(result.time).toBe("9:30 AM");
  });

  it("should handle midnight as 12:00 AM", () => {
    const result = formatDateBritish("2026-03-18T00:00:00");
    expect(result.time).toBe("12:00 AM");
  });

  it("should handle noon as 12:00 PM", () => {
    const result = formatDateBritish("2026-03-18T12:00:00");
    expect(result.time).toBe("12:00 PM");
  });

  it("should use st suffix for 1st", () => {
    const result = formatDateBritish("2026-03-01T10:00:00");
    expect(result.date).toContain("1st");
  });

  it("should use nd suffix for 2nd", () => {
    const result = formatDateBritish("2026-03-02T10:00:00");
    expect(result.date).toContain("2nd");
  });

  it("should use rd suffix for 3rd", () => {
    const result = formatDateBritish("2026-03-03T10:00:00");
    expect(result.date).toContain("3rd");
  });

  it("should use th suffix for 11th-13th (special cases)", () => {
    expect(formatDateBritish("2026-03-11T10:00:00").date).toContain("11th");
    expect(formatDateBritish("2026-03-12T10:00:00").date).toContain("12th");
    expect(formatDateBritish("2026-03-13T10:00:00").date).toContain("13th");
  });

  it("should use st suffix for 21st", () => {
    const result = formatDateBritish("2026-03-21T10:00:00");
    expect(result.date).toContain("21st");
  });

  it("should format minutes with leading zero", () => {
    const result = formatDateBritish("2026-03-17T14:05:00");
    expect(result.time).toBe("2:05 PM");
  });
});
