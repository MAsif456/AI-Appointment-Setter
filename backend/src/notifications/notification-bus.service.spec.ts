import { NotificationBusService, EscalationEvent } from "./notification-bus.service";

describe("NotificationBusService", () => {
  let bus: NotificationBusService;

  const event: EscalationEvent = {
    id: "e1",
    conversationId: "c1",
    leadId: "l1",
    leadName: "Jane Doe",
    leadPhone: "+44",
    clinicId: "clinic_1",
    clinicName: "Smile Dental",
    trigger: "abuse",
    reason: "test",
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    bus = new NotificationBusService();
  });

  it("delivers published events to subscribers", (done) => {
    bus.asObservable().subscribe((received) => {
      expect(received).toEqual(event);
      done();
    });
    bus.publish(event);
  });

  it("delivers events to multiple subscribers", () => {
    const received1: EscalationEvent[] = [];
    const received2: EscalationEvent[] = [];

    bus.asObservable().subscribe((e) => received1.push(e));
    bus.asObservable().subscribe((e) => received2.push(e));

    bus.publish(event);

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
  });

  it("does not deliver events to unsubscribed observers", () => {
    const received: EscalationEvent[] = [];
    const sub = bus.asObservable().subscribe((e) => received.push(e));
    sub.unsubscribe();

    bus.publish(event);
    expect(received).toHaveLength(0);
  });

  it("does not replay past events to late subscribers", () => {
    bus.publish(event);

    const received: EscalationEvent[] = [];
    bus.asObservable().subscribe((e) => received.push(e));

    expect(received).toHaveLength(0);
  });
});
