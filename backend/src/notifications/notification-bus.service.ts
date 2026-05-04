import { Injectable } from "@nestjs/common";
import { Subject, Observable } from "rxjs";

/** Shape pushed through the bus. Matches the frontend SSE contract. */
export interface EscalationEvent {
  id: string;
  conversationId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  clinicId: string;
  clinicName: string;
  trigger: string;
  reason: string;
  createdAt: string;
}

/**
 * Process-local pub/sub bus for staff escalation events.
 *
 * `EscalationNotifierService` publishes here after it persists the
 * notification document, and `NotificationsController` subscribes
 * per-connection, filtering by the current staff member's
 * `assignedClinics`. The in-process implementation is fine for the
 * current deployment topology; swap in Redis pub/sub if the backend
 * ever scales horizontally.
 */
@Injectable()
export class NotificationBusService {
  // Unbounded subject — every subscriber gets every event. No replay
  // window because reconnect reconciliation is handled by the REST
  // list endpoint, not by buffering inside the bus.
  private readonly subject = new Subject<EscalationEvent>();

  /** Emit a fresh escalation to every live subscriber. */
  publish(event: EscalationEvent): void {
    this.subject.next(event);
  }

  /** Observable consumed by the SSE controller. */
  asObservable(): Observable<EscalationEvent> {
    return this.subject.asObservable();
  }
}
